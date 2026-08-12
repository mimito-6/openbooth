/* ============================================================
   OpenBooth — Printer adapter (OB.printer)

   THE ONLY FILE IN OPENBOOTH THAT KNOWS receipt-engine EXISTS.

   Everything else in the app says "print this transaction" and reads
   a state string. It must never learn about BLE, GATT, ESC/POS, dot
   widths, chunk sizes, or SVG rasterizing — all of that belongs to
   receipt-engine (window.ReceiptBridge).

   ── When receipt-engine ships its printer API (roadmap v0.3) ────────
   Replace the marked ⟪SWAP⟫ blocks below. Nothing outside this file
   should need to change. See PRINTER-INTEGRATION.md.
   ============================================================ */
(function () {
  "use strict";
  window.OB = window.OB || {};

  /* ---------- the engine handle ---------- */
  function RB() {
    return window.ReceiptBridge || null;
  }

  /* ---------- state machine ----------
     Names are deliberately the ones OpenBooth's UI speaks. If
     receipt-engine publishes its own enum, map it here — do not
     rename these downstream. */
  var STATES = {
    IDLE: "idle",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    PRINTING: "printing",
    SUCCESS: "success",
    FAILED: "failed",
    DISCONNECTED: "disconnected",
  };

  var state = STATES.IDLE;
  var lastError = null;      // { code, message } — already user-facing
  var listeners = [];
  var printerInstance = null;
  var lastPrintedTxId = null;

  function setState(next, err) {
    state = next;
    lastError = err || null;
    listeners.slice().forEach(function (fn) {
      try {
        fn(state, lastError);
      } catch (e) {
        console.error("[OB.printer] listener threw", e);
      }
    });
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ---------- ⟪SWAP⟫ profiles ----------
     receipt-engine owns paper→dots. Until it exposes a profile table,
     this is the single quarantined place that knows the mapping, so
     the rest of OpenBooth never hardcodes 384/576. When the engine
     ships profiles, delete PROFILE_FALLBACK and read them from RB(). */
  var PROFILE_FALLBACK = [
    { id: "gprinter-ble-80", label: "Gprinter BLE 80mm", paper: "80mm", dots: 576 },
    { id: "generic-80", label: "Generic 80mm", paper: "80mm", dots: 576 },
    { id: "generic-58", label: "Generic 58mm", paper: "58mm", dots: 384 },
  ];

  function profiles() {
    var rb = RB();
    // ⟪SWAP⟫ prefer the engine's own table the moment it has one
    if (rb && typeof rb.listPrinterProfiles === "function") {
      try {
        var list = rb.listPrinterProfiles();
        if (list && list.length) return list;
      } catch (e) {
        console.warn("[OB.printer] engine profile list failed, using fallback", e);
      }
    }
    return PROFILE_FALLBACK;
  }

  function profileById(id) {
    var list = profiles();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  /* ---------- ⟪SWAP⟫ transmission tuning ----------
     Maps OpenBooth's three user-facing speeds onto whatever transport
     knobs the engine exposes. Today that is chunkSize / delayMs. */
  var TRANSMISSION_FALLBACK = {
    conservative: { chunkSize: 100, delayMs: 40 },
    standard: { chunkSize: 200, delayMs: 20 },
    fast: { chunkSize: 400, delayMs: 6 },
  };

  function transportFor(mode) {
    var rb = RB();
    if (rb && typeof rb.transmissionPreset === "function") {
      try {
        var p = rb.transmissionPreset(mode);
        if (p) return p;
      } catch (e) {
        /* fall through */
      }
    }
    return TRANSMISSION_FALLBACK[mode] || TRANSMISSION_FALLBACK.standard;
  }

  /* ---------- capability detection ---------- */
  function support() {
    var rb = RB();
    var secure =
      typeof window.isSecureContext === "boolean"
        ? window.isSecureContext
        : location.protocol === "https:" || location.hostname === "localhost";
    var hasBluetooth = !!(navigator && navigator.bluetooth);
    return {
      engine: !!rb,
      bluetooth: hasBluetooth,
      secureContext: secure,
      // usable == we could actually reach a printer right now
      usable: !!rb && hasBluetooth && secure,
    };
  }

  /* ---------- error translation ----------
     Raw DOMException / GATT text never reaches the UI. The original
     is kept on the console for debugging, per spec. */
  function humanError(e) {
    var raw = (e && (e.message || e.name)) || String(e || "");
    console.error("[OB.printer] raw error:", e);

    var cap = support();
    if (!cap.engine) return { code: "no_engine", message: window.t("print_err_no_engine") };
    if (!cap.secureContext) return { code: "insecure", message: window.t("print_err_insecure") };
    if (!cap.bluetooth) return { code: "no_bluetooth", message: window.t("print_err_no_bluetooth") };

    var s = raw.toLowerCase();
    if (s.indexOf("user cancelled") >= 0 || s.indexOf("user canceled") >= 0 || (e && e.name === "NotFoundError")) {
      return { code: "cancelled", message: window.t("print_err_cancelled") };
    }
    if (s.indexOf("gatt") >= 0 || s.indexOf("disconnect") >= 0 || (e && e.name === "NetworkError")) {
      return { code: "disconnected", message: window.t("print_err_disconnected") };
    }
    if (s.indexOf("characteristic") >= 0 || s.indexOf("特徵") >= 0) {
      return { code: "incompatible", message: window.t("print_err_incompatible") };
    }
    return { code: "failed", message: window.t("print_err_generic") };
  }

  /* ---------- printer handle ---------- */
  function getPrinter() {
    var rb = RB();
    if (!rb || !rb.BluetoothThermalPrinter) throw new Error("engine missing");
    if (!printerInstance) printerInstance = new rb.BluetoothThermalPrinter();
    return printerInstance;
  }

  function isConnected() {
    try {
      return !!(printerInstance && printerInstance.connected);
    } catch (e) {
      return false;
    }
  }

  /* ---------- settings access (OpenBooth's own store — no second store) ---------- */
  function cfg() {
    var st = window.OB.store && window.OB.store.get();
    return (st && st.settings) || {};
  }

  /* ---------- render: transaction → thermal SVG ----------
     Uses the engine's OpenBooth order adapter so the receipt reconciles
     to OpenBooth's own figures. */
  function buildReceipt(tx, target) {
    var rb = RB();
    if (!rb) return Promise.reject(new Error("engine missing"));
    var store = window.OB.store;
    var st = store.get();

    var ev = null;
    try {
      var list = st.events || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === tx.eventId) {
          ev = list[i];
          break;
        }
      }
      if (!ev && typeof store.currentEvent === "function") ev = store.currentEvent();
    } catch (e) {
      /* event is optional */
    }

    var tpl = null;
    try {
      if (window.OB.receipt && typeof window.OB.receipt.getTemplate === "function") {
        tpl = window.OB.receipt.getTemplate();
      }
    } catch (e) {
      /* template is optional — engine falls back to its default look */
    }

    return new Promise(function (resolve, reject) {
      try {
        var doc = rb.importOpenBoothOrder(tx, {
          settings: {
            shopName: st.settings.shopName,
            currencyCode: st.settings.currencyCode,
            currencySymbol: st.settings.currencySymbol,
            locale: st.settings.locale,
          },
          event: ev,
        });
        var merged = tpl && rb.applyTemplate ? rb.applyTemplate(doc, tpl) : doc;
        if (rb.ensureValid) merged = rb.ensureValid(merged);
        var svg = rb.renderReceiptToSvg(merged, { theme: target === "print" ? "thermal" : undefined });
        resolve({ svg: svg, doc: merged, metadata: readMetadata(merged, svg) });
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ---------- ⟪SWAP⟫ metadata ----------
     Spec wants estimatedLengthMm / estimatedReceiptsPerRoll when the
     engine provides them. It does not yet, so we surface whatever is
     there and otherwise report null — OpenBooth must not invent these
     numbers, and nothing in checkout depends on them. */
  function readMetadata(doc, svg) {
    var m = (doc && doc.metadata) || {};
    return {
      estimatedLengthMm: m.estimatedLengthMm != null ? m.estimatedLengthMm : null,
      estimatedReceiptsPerRoll: m.estimatedReceiptsPerRoll != null ? m.estimatedReceiptsPerRoll : null,
      available: m.estimatedLengthMm != null,
    };
  }

  /* ---------- public: connect / disconnect / test ---------- */
  function connect() {
    var cap = support();
    if (!cap.usable) {
      var err = humanError(new Error("unsupported"));
      setState(STATES.FAILED, err);
      return Promise.reject(err);
    }
    setState(STATES.CONNECTING);
    return getPrinter()
      .connect()
      .then(function () {
        setState(STATES.CONNECTED);
        return { name: printerInstance && printerInstance.name };
      })
      .catch(function (e) {
        var err = humanError(e);
        setState(err.code === "cancelled" ? STATES.IDLE : STATES.FAILED, err.code === "cancelled" ? null : err);
        throw err;
      });
  }

  function disconnect() {
    try {
      if (printerInstance) printerInstance.disconnect();
    } catch (e) {
      console.error("[OB.printer] disconnect threw", e);
    }
    setState(STATES.DISCONNECTED);
  }

  /* Send raw bytes for a rendered SVG. Shared by print + test. */
  function sendSvg(svg) {
    var rb = RB();
    var s = cfg();
    var prof = profileById(s.printerProfile);
    return rb.printReceiptSvg(svg, getPrinter(), {
      dots: prof.dots, // ⟪SWAP⟫ engine-owned once profiles land
      bitmap: { dither: "floyd-steinberg" },
      transport: transportFor(s.transmissionMode),
    });
  }

  /**
   * Print a saved transaction.
   * NEVER throws at the caller — checkout must not be able to fail
   * because printing failed. Resolves { ok, error }.
   */
  function printTransaction(tx) {
    if (!tx) return Promise.resolve({ ok: false, error: humanError(new Error("no transaction")) });
    var cap = support();
    if (!cap.usable) {
      var err0 = humanError(new Error("unsupported"));
      setState(STATES.FAILED, err0);
      return Promise.resolve({ ok: false, error: err0 });
    }
    setState(STATES.PRINTING);
    return buildReceipt(tx, "print")
      .then(function (built) {
        return sendSvg(built.svg);
      })
      .then(function () {
        lastPrintedTxId = tx.id;
        setState(STATES.SUCCESS);
        // settle back to a steady state so the UI does not stick on "success"
        setTimeout(function () {
          if (state === STATES.SUCCESS) setState(isConnected() ? STATES.CONNECTED : STATES.IDLE);
        }, 1500);
        return { ok: true };
      })
      .catch(function (e) {
        var err = humanError(e);
        setState(STATES.FAILED, err);
        return { ok: false, error: err };
      });
  }

  /** Test print — same path as a real print, with the engine's sample doc. */
  function testPrint() {
    var cap = support();
    if (!cap.usable) {
      var err0 = humanError(new Error("unsupported"));
      setState(STATES.FAILED, err0);
      return Promise.resolve({ ok: false, error: err0 });
    }
    var st = window.OB.store.get();
    var sampleTx = {
      id: "test-print",
      time: Date.now(),
      eventId: st.currentEventId,
      voided: false,
      lines: [{ kind: "product", refId: null, name: window.t("print_test_line"), unitPrice: 100, basePrice: 100, qty: 1, lineTotal: 100, isTokuten: false }],
      subtotal: 100,
      discount: 0,
      bundleSaved: 0,
      grandTotal: 100,
      stockUse: {},
      paymentMethodId: null,
      paymentMethodName: window.t("cash"),
      paymentType: "cash",
      cashReceived: 100,
      changeGiven: 0,
      giftNote: "",
    };
    setState(STATES.PRINTING);
    return buildReceipt(sampleTx, "print")
      .then(function (built) {
        return sendSvg(built.svg);
      })
      .then(function () {
        setState(STATES.SUCCESS);
        setTimeout(function () {
          if (state === STATES.SUCCESS) setState(isConnected() ? STATES.CONNECTED : STATES.IDLE);
        }, 1500);
        return { ok: true };
      })
      .catch(function (e) {
        var err = humanError(e);
        setState(STATES.FAILED, err);
        return { ok: false, error: err };
      });
  }

  window.OB.printer = {
    STATES: STATES,
    getState: function () {
      return state;
    },
    getError: function () {
      return lastError;
    },
    subscribe: subscribe,
    support: support,
    isConnected: isConnected,
    profiles: profiles,
    profileById: profileById,
    connect: connect,
    disconnect: disconnect,
    testPrint: testPrint,
    printTransaction: printTransaction,
    buildReceipt: buildReceipt,
    lastPrintedTxId: function () {
      return lastPrintedTxId;
    },
  };
})();

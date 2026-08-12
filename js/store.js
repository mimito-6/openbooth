/* ============================================================
   OpenBooth — Store
   Single source of truth. Persists to localStorage.
   Catalog (settings/products/combos/...) is editable data.
   Transactions are immutable facts with PRICE SNAPSHOTS.
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = () => window.OB.util;

  const KEY = "openbooth_v3";
  const CART_KEY = "openbooth_cart_v3";
  const LOCK_KEY = "openbooth_locked_v1";
  const LEGACY_KEY = "booth_register_v1";
  const SCHEMA_VERSION = 3;

  let state = null;
  let cart = null;
  const listeners = [];

  function uuid() {
    return U().uuid();
  }

  // ---------- defaults ----------
  function defaultState() {
    const evId = uuid();
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: {
        shopName: "OpenBooth",
        currencyCode: "TWD",
        currencySymbol: "NT$",
        locale: window.OB.i18n.detect(),
        theme: "warm",
        lowStockThreshold: 5,
        showStock: true,
        enableCombos: true,
        requireCash: true,
        showReceipt: false,
        // --- receipt printer (see js/printer.js; the adapter owns the
        // profile→dots mapping, nothing here encodes dot widths) ---
        autoPrint: false,
        printerProfile: "gprinter-ble-80",
        paperProfile: "80mm",
        transmissionMode: "standard",
        helperPin: "",
        notifyTemplate: "",
        mascot: null,
      },
      categories: [],
      products: [],
      combos: [],
      events: [{ id: evId, name: "", date: todayISO(), location: "", boothNumber: "", note: "", startFloat: 0, createdAt: Date.now(), archived: false }],
      currentEventId: evId,
      paymentMethods: defaultPaymentMethods(),
      giftThresholds: [],
      preorders: [],
      transactions: [],
    };
  }

  function defaultPaymentMethods() {
    return [
      { id: uuid(), name: "現金", type: "cash", enabled: true, isDefault: true, note: "", qr: null, sortOrder: 0 },
      { id: uuid(), name: "Line Pay", type: "external", enabled: true, isDefault: false, note: "", qr: null, sortOrder: 1 },
      { id: uuid(), name: "其他", type: "external", enabled: true, isDefault: false, note: "", qr: null, sortOrder: 2 },
    ];
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // ---------- persistence ----------
  // Auto-print used to live in the receipt add-on's own localStorage. OpenBooth
  // owns printing now, so adopt the seller's existing choice rather than
  // silently resetting it to off. Runs only until autoPrint is persisted here.
  function adoptLegacyAutoPrint() {
    try {
      const legacy = JSON.parse(localStorage.getItem("openbooth_receipt_settings_v1") || "{}");
      if (legacy && typeof legacy.autoPrint === "boolean") {
        state.settings.autoPrint = legacy.autoPrint;
        save();
      }
    } catch (e) {}
  }

  function load() {
    // Whether the PERSISTED state already carried an explicit autoPrint. Checked
    // before ensureIntegrity() backfills the default, and on both the
    // existing-state and fresh-install paths.
    let hadAutoPrint = false;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        hadAutoPrint = !!(parsed && parsed.settings && parsed.settings.autoPrint !== undefined);
        state = migrate(parsed);
      } else {
        state = defaultState();
        save();
      }
    } catch (e) {
      console.error("load failed", e);
      state = defaultState();
    }
    ensureIntegrity();
    if (!hadAutoPrint) adoptLegacyAutoPrint();
    try {
      cart = JSON.parse(localStorage.getItem(CART_KEY)) || emptyCart();
    } catch (e) {
      cart = emptyCart();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("save failed", e);
      if (U()) U().toast(window.t("save_failed_full"), "danger");
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}
  }

  function migrate(s) {
    if (!s || typeof s !== "object") return defaultState();
    // back up before any destructive migration
    if (s.schemaVersion !== SCHEMA_VERSION) {
      try {
        localStorage.setItem(KEY + "__backup_v" + (s.schemaVersion || 0), JSON.stringify(s));
      } catch (e) {}
    }
    // future per-version migrations go here (switch on s.schemaVersion)
    s.schemaVersion = SCHEMA_VERSION;
    return s;
  }

  function ensureIntegrity() {
    const d = defaultState();
    if (!state.settings) state.settings = d.settings;
    for (const k in d.settings) if (state.settings[k] === undefined) state.settings[k] = d.settings[k];
    ["categories", "products", "combos", "events", "paymentMethods", "giftThresholds", "preorders", "transactions"].forEach((k) => {
      if (!Array.isArray(state[k])) state[k] = [];
    });
    if (!state.events.length) state.events = d.events;
    if (!state.paymentMethods.length) state.paymentMethods = defaultPaymentMethods();
    if (!state.currentEventId || !state.events.find((e) => e.id === state.currentEventId)) {
      state.currentEventId = state.events[0].id;
    }
  }

  function emptyCart() {
    return { lines: [], discount: 0 };
  }

  // ---------- pub/sub ----------
  function subscribe(fn) {
    listeners.push(fn);
  }
  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  }
  function commit() {
    save();
    notify();
  }

  // ---------- accessors ----------
  function get() {
    return state;
  }
  function getCart() {
    return cart;
  }
  function currentEvent() {
    return state.events.find((e) => e.id === state.currentEventId) || state.events[0];
  }
  function product(id) {
    return state.products.find((p) => p.id === id);
  }
  function combo(id) {
    return state.combos.find((c) => c.id === id);
  }
  function paymentMethod(id) {
    return state.paymentMethods.find((m) => m.id === id);
  }
  function defaultPayment() {
    return state.paymentMethods.find((m) => m.isDefault && m.enabled) || state.paymentMethods.find((m) => m.enabled) || state.paymentMethods[0];
  }
  function activeProducts() {
    return state.products.filter((p) => !p.archived).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  function activeCombos() {
    return state.combos.filter((c) => !c.archived).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  function activeCategories() {
    return state.categories.filter((c) => !c.archived).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  // ---------- CRUD: products ----------
  function upsertProduct(p) {
    if (!p.id) {
      p.id = uuid();
      p.sortOrder = state.products.length;
      state.products.push(p);
    } else {
      const i = state.products.findIndex((x) => x.id === p.id);
      if (i >= 0) state.products[i] = Object.assign(state.products[i], p);
      else state.products.push(p);
    }
    commit();
    return p;
  }
  function deleteProduct(id) {
    state.products = state.products.filter((p) => p.id !== id);
    state.combos.forEach((c) => (c.uses = (c.uses || []).filter((u) => u.productId !== id)));
    commit();
  }

  // ---------- CRUD: combos ----------
  function upsertCombo(c) {
    if (!c.id) {
      c.id = uuid();
      c.sortOrder = state.combos.length;
      state.combos.push(c);
    } else {
      const i = state.combos.findIndex((x) => x.id === c.id);
      if (i >= 0) state.combos[i] = Object.assign(state.combos[i], c);
      else state.combos.push(c);
    }
    commit();
    return c;
  }
  function deleteCombo(id) {
    state.combos = state.combos.filter((c) => c.id !== id);
    commit();
  }

  // ---------- CRUD: categories ----------
  function upsertCategory(cat) {
    if (!cat.id) {
      cat.id = uuid();
      cat.sortOrder = state.categories.length;
      state.categories.push(cat);
    } else {
      const i = state.categories.findIndex((x) => x.id === cat.id);
      if (i >= 0) state.categories[i] = Object.assign(state.categories[i], cat);
    }
    commit();
    return cat;
  }
  function deleteCategory(id) {
    state.categories = state.categories.filter((c) => c.id !== id);
    state.products.forEach((p) => {
      if (p.categoryId === id) p.categoryId = null;
    });
    commit();
  }

  // ---------- CRUD: events ----------
  function upsertEvent(ev) {
    if (!ev.id) {
      ev.id = uuid();
      ev.createdAt = Date.now();
      state.events.push(ev);
    } else {
      const i = state.events.findIndex((x) => x.id === ev.id);
      if (i >= 0) state.events[i] = Object.assign(state.events[i], ev);
    }
    commit();
    return ev;
  }
  function deleteEvent(id) {
    if (state.events.length <= 1) return false;
    state.events = state.events.filter((e) => e.id !== id);
    if (state.currentEventId === id) state.currentEventId = state.events[0].id;
    commit();
    return true;
  }
  function switchEvent(id) {
    if (state.events.find((e) => e.id === id)) {
      state.currentEventId = id;
      commit();
    }
  }

  // ---------- CRUD: payment methods ----------
  function upsertPayment(m) {
    if (!m.id) {
      m.id = uuid();
      m.sortOrder = state.paymentMethods.length;
      state.paymentMethods.push(m);
    } else {
      const i = state.paymentMethods.findIndex((x) => x.id === m.id);
      if (i >= 0) state.paymentMethods[i] = Object.assign(state.paymentMethods[i], m);
    }
    if (m.isDefault) state.paymentMethods.forEach((x) => (x.isDefault = x.id === m.id));
    commit();
    return m;
  }
  function deletePayment(id) {
    if (state.paymentMethods.length <= 1) return;
    state.paymentMethods = state.paymentMethods.filter((m) => m.id !== id);
    if (!state.paymentMethods.some((m) => m.isDefault)) state.paymentMethods[0].isDefault = true;
    commit();
  }

  // ---------- CRUD: gift thresholds ----------
  function upsertGift(g) {
    if (!g.id) {
      g.id = uuid();
      state.giftThresholds.push(g);
    } else {
      const i = state.giftThresholds.findIndex((x) => x.id === g.id);
      if (i >= 0) state.giftThresholds[i] = Object.assign(state.giftThresholds[i], g);
    }
    commit();
    return g;
  }
  function deleteGift(id) {
    state.giftThresholds = state.giftThresholds.filter((g) => g.id !== id);
    commit();
  }

  // ---------- CRUD: preorders ----------
  function upsertPreorder(po) {
    if (!po.id) {
      po.id = uuid();
      po.createdAt = Date.now();
      state.preorders.push(po);
    } else {
      const i = state.preorders.findIndex((x) => x.id === po.id);
      if (i >= 0) state.preorders[i] = Object.assign(state.preorders[i], po);
    }
    commit();
    return po;
  }
  function deletePreorder(id) {
    state.preorders = state.preorders.filter((p) => p.id !== id);
    commit();
  }

  // ---------- transactions ----------
  function addTransaction(tx) {
    tx.id = uuid();
    tx.time = Date.now();
    tx.eventId = state.currentEventId;
    tx.voided = false;
    state.transactions.push(tx);
    commit();
    return tx;
  }
  function voidTransaction(id) {
    const tx = state.transactions.find((t) => t.id === id);
    if (tx) {
      tx.voided = true;
      commit();
    }
  }
  function eventTransactions(eventId) {
    eventId = eventId || state.currentEventId;
    return state.transactions.filter((t) => t.eventId === eventId && !t.voided);
  }

  // ---------- cart ----------
  function setCart(c) {
    cart = c;
    saveCart();
  }
  function clearCart() {
    cart = emptyCart();
    saveCart();
  }

  // ---------- helper lock ----------
  function isLocked() {
    return !!(state && state.settings && state.settings.helperPin && localStorage.getItem(LOCK_KEY) === "1");
  }
  function setLocked(on) {
    if (on && !(state && state.settings && state.settings.helperPin)) return false;
    if (on) localStorage.setItem(LOCK_KEY, "1");
    else localStorage.removeItem(LOCK_KEY);
    notify();
    return true;
  }
  function unlockWithPin(pin) {
    if (String(pin || "") !== String(state.settings.helperPin || "")) return false;
    return setLocked(false);
  }

  // ---------- import / export ----------
  function exportAll() {
    return JSON.stringify(state, null, 2);
  }
  function importAll(json) {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    if (!obj || !obj.schemaVersion) throw new Error("invalid backup");
    state = migrate(obj);
    ensureIntegrity();
    commit();
  }

  // preset = shareable stall config WITHOUT transactions/preorders (no revenue/PII)
  function exportPreset() {
    const settings = Object.assign({}, state.settings);
    delete settings.helperPin;
    return {
      schemaVersion: SCHEMA_VERSION,
      kind: "openbooth-preset",
      meta: { name: state.settings.shopName, exportedAt: Date.now() },
      settings,
      categories: state.categories,
      products: state.products.map((p) => Object.assign({}, p)),
      combos: state.combos,
      paymentMethods: state.paymentMethods,
      giftThresholds: state.giftThresholds,
    };
  }
  function applyPreset(obj, keepData) {
    if (typeof obj === "string") obj = JSON.parse(obj);
    if (!obj) throw new Error("invalid preset");
    const incomingSettings = Object.assign({}, obj.settings || {});
    delete incomingSettings.helperPin;
    state.settings = Object.assign(defaultState().settings, incomingSettings);
    state.categories = obj.categories || [];
    state.products = obj.products || [];
    state.combos = obj.combos || [];
    state.paymentMethods = (obj.paymentMethods && obj.paymentMethods.length) ? obj.paymentMethods : defaultPaymentMethods();
    state.giftThresholds = obj.giftThresholds || [];
    if (!keepData) {
      // keep events & transactions; just swapping catalog
    }
    ensureIntegrity();
    commit();
  }

  // share link via URL-safe base64 of UTF-8 JSON
  function encodePreset(obj) {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodePreset(code) {
    let b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }

  function clearAll() {
    try {
      localStorage.setItem(KEY + "__backup_clear", JSON.stringify(state));
    } catch (e) {}
    localStorage.removeItem(LOCK_KEY);
    state = defaultState();
    clearCart();
    commit();
  }

  // ---------- demo (clean, original, no third-party IP) ----------
  function loadDemo() {
    const c = (name, color) => ({ id: uuid(), name, color, sortOrder: state.categories.length + 0, archived: false });
    const cat = {
      sticker: c("貼紙", "#c46b43"),
      print: c("明信片", "#c98a1e"),
      acrylic: c("壓克力", "#6b5b95"),
    };
    state.categories = Object.values(cat);
    let so = 0;
    const p = (name, categoryId, price, stock, bundle) => ({
      id: uuid(),
      name,
      categoryId,
      price,
      stockInitial: stock,
      bundleRules: bundle || [],
      image: null,
      sku: "",
      sortOrder: so++,
      archived: false,
    });
    // Generic demo items with round prices (5 / 10 / 100) so the sample doesn't
    // reflect any specific seller's pricing.
    const prods = [
      p("小貼紙",       cat.sticker.id,   5, 200, []),
      p("角色貼紙",     cat.sticker.id,  10, 100, []),
      p("透卡明信片",   cat.print.id,    10, 100, []),
      p("珠光明信片",   cat.print.id,    10, 100, []),
      p("壓克力吊飾",   cat.acrylic.id, 100,  40, []),
      p("壓克力立牌",   cat.acrylic.id, 100,  30, []),
    ];
    state.products = prods;
    state.combos = [
      {
        id: uuid(),
        name: "明信片組",
        description: "透卡 + 珠光 各 1",
        price: 10,
        uses: [
          { productId: prods[2].id, qty: 1 },
          { productId: prods[3].id, qty: 1 },
        ],
        image: null,
        sortOrder: 0,
        archived: false,
      },
      {
        id: uuid(),
        name: "壓克力組合",
        description: "吊飾 + 立牌",
        price: 100,
        uses: [
          { productId: prods[4].id, qty: 1 },
          { productId: prods[5].id, qty: 1 },
        ],
        image: null,
        sortOrder: 1,
        archived: false,
      },
    ];
    state.giftThresholds = [{ id: uuid(), minAmount: 100, rewardText: "小禮物 ×1", enabled: true }];
    if (!state.settings.shopName || state.settings.shopName === "OpenBooth") state.settings.shopName = "我的攤位";
    commit();
  }

  // optional: import the author's legacy prototype data (booth_register_v1)
  function hasLegacy() {
    return !!localStorage.getItem(LEGACY_KEY);
  }

  OB.store = {
    load,
    save,
    saveCart,
    commit,
    notify,
    subscribe,
    get,
    getCart,
    setCart,
    clearCart,
    isLocked,
    setLocked,
    unlockWithPin,
    emptyCart,
    currentEvent,
    product,
    combo,
    paymentMethod,
    defaultPayment,
    activeProducts,
    activeCombos,
    activeCategories,
    upsertProduct,
    deleteProduct,
    upsertCombo,
    deleteCombo,
    upsertCategory,
    deleteCategory,
    upsertEvent,
    deleteEvent,
    switchEvent,
    upsertPayment,
    deletePayment,
    upsertGift,
    deleteGift,
    upsertPreorder,
    deletePreorder,
    addTransaction,
    voidTransaction,
    eventTransactions,
    exportAll,
    importAll,
    exportPreset,
    applyPreset,
    encodePreset,
    decodePreset,
    clearAll,
    loadDemo,
    hasLegacy,
    todayISO,
    SCHEMA_VERSION,
  };
})();

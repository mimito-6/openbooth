/* ============================================================
   OpenBooth — Print flow (OB.printFlow)

   The user-facing half of printing: decides whether a sale should
   auto-print, and turns the adapter's result into something a seller
   standing at a booth can act on.

   Hard rule this file exists to enforce: a print problem is NEVER
   reported as a sale problem. The transaction is already committed
   before anything here runs, so every message says the sale succeeded
   and only the receipt did not.

   Talks to OB.printer (the adapter) — never to receipt-engine directly.
   ============================================================ */
(function () {
  "use strict";
  window.OB = window.OB || {};
  const U = () => window.OB.util;
  const t = window.t;

  /* ---------- a notice that outlives a re-render ----------
     OB.ui.sheet marks itself .boo-transient, which the router strips on
     every commit; a print result must survive that, so this is its own
     dismissible card. Themed from tokens, never hardcoded colours. */
  function notice(opts) {
    const { el, esc } = U();
    document.querySelectorAll(".print-notice").forEach((n) => n.remove());

    const tone = opts.tone === "danger" ? "var(--danger)" : opts.tone === "warn" ? "var(--warning)" : "var(--success)";
    const card = el("div", {
      class: "print-notice",
      role: "status",
      style:
        "position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:120;" +
        "background:var(--surface);border:1px solid var(--border);border-left:4px solid " + tone + ";" +
        "border-radius:var(--r-md,12px);box-shadow:var(--shadow-float,0 8px 28px rgba(0,0,0,.18));" +
        "padding:12px 14px;max-width:520px;margin:0 auto;font-size:14px;color:var(--text)",
    });

    card.appendChild(el("div", { style: "font-weight:700;margin-bottom:2px", text: opts.title || "" }));
    if (opts.message) {
      card.appendChild(el("div", { style: "color:var(--text-secondary);line-height:1.5", text: opts.message }));
    }

    const row = el("div", { style: "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap" });
    (opts.actions || []).forEach((a) => {
      row.appendChild(
        el("button", {
          class: "mini-btn",
          text: a.label,
          onclick: () => {
            if (a.keepOpen !== true) card.remove();
            a.onClick();
          },
        })
      );
    });
    row.appendChild(el("button", { class: "mini-btn", text: t("close"), onclick: () => card.remove() }));
    card.appendChild(row);

    document.body.appendChild(card);
    if (opts.autoDismissMs) setTimeout(() => card.remove(), opts.autoDismissMs);
    return card;
  }

  /* ---------- shared outcome handling ---------- */
  function offlineNotice(tx, leadTitle) {
    notice({
      tone: "warn",
      title: leadTitle,
      message: t("print_offline_hint"),
      actions: [
        { label: t("printer_reconnect"), onClick: () => reconnectThenPrint(tx) },
        { label: t("reprint"), onClick: () => reprint(tx) },
      ],
    });
  }

  function failureNotice(tx, err) {
    notice({
      tone: "danger",
      title: t("sale_done_print_failed"),
      message: (err && err.message) || t("print_err_generic"),
      actions: [{ label: t("reprint"), onClick: () => reprint(tx) }],
    });
  }

  function successNotice() {
    notice({ tone: "ok", title: t("print_sent"), autoDismissMs: 2600, actions: [] });
  }

  function reconnectThenPrint(tx) {
    const P = window.OB.printer;
    P.connect()
      .then(() => reprint(tx))
      .catch((err) => {
        notice({
          tone: "danger",
          title: t("printer_connect_failed"),
          message: (err && err.message) || t("print_err_generic"),
          actions: [{ label: t("printer_reconnect"), onClick: () => reconnectThenPrint(tx) }],
        });
      });
  }

  /* ---------- after a completed sale ----------
     Called AFTER the transaction is committed. Returns nothing and
     never throws: checkout has already succeeded by this point. */
  function afterCheckout(tx) {
    const P = window.OB.printer;
    if (!P || !tx) return;
    const s = window.OB.store.get().settings;
    if (!s.autoPrint) return; // auto-print off → never print

    const cap = P.support();
    if (!cap.usable) {
      // Not a sale failure. Say so plainly and offer the two ways out.
      offlineNotice(tx, t("sale_done_printer_offline"));
      return;
    }
    if (!P.isConnected()) {
      // Web Bluetooth cannot silently re-pair without a user gesture.
      offlineNotice(tx, t("sale_done_printer_offline"));
      return;
    }

    P.printTransaction(tx).then((res) => {
      if (!res.ok) failureNotice(tx, res.error);
    });
  }

  /* ---------- reprint ----------
     Renders and prints an EXISTING transaction. Creates nothing, mutates
     nothing — the store is never touched on this path. */
  function reprint(tx) {
    const P = window.OB.printer;
    if (!P || !tx) return Promise.resolve({ ok: false });

    const cap = P.support();
    if (!cap.usable) {
      offlineNotice(tx, t("reprint_unavailable"));
      return Promise.resolve({ ok: false });
    }
    if (!P.isConnected()) {
      offlineNotice(tx, t("printer_not_connected"));
      return Promise.resolve({ ok: false });
    }
    U().toast(t("print_sending"));
    return P.printTransaction(tx).then((res) => {
      if (res.ok) successNotice();
      else failureNotice(tx, res.error);
      return res;
    });
  }

  /** The most recent non-voided sale of the current event, or null. */
  function lastTransaction() {
    const st = window.OB.store.get();
    const list = st.transactions || [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] && !list[i].voided) return list[i];
    }
    return null;
  }

  function reprintLast() {
    const tx = lastTransaction();
    if (!tx) {
      U().toast(t("no_records"), "danger");
      return Promise.resolve({ ok: false });
    }
    return reprint(tx);
  }

  window.OB.printFlow = {
    afterCheckout,
    reprint,
    reprintLast,
    lastTransaction,
    notice,
  };
})();

/* ============================================================
   OpenBooth — RECORD view (transactions, stats, cash-up)
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = OB.util;
  const { el, esc, fmtMoney, fmtTime, toast, confirmDialog } = U;
  const t = window.t;

  function render(root) {
    const st = OB.store.get();
    const ev = OB.store.currentEvent();
    const stats = OB.stats.eventStats(st);
    const txs = stats.txs.slice().reverse();

    const view = el("div", { class: "view active" });
    view.appendChild(
      OB.ui.header({
        title: t("nav_record"),
        subtitle: ev.name || t("no_event"),
        onBack: () => OB.router.go("home"),
        right: [
          { icon: OB.icon("bar-chart"), label: t("cashup"), onClick: openCashup },
          { icon: OB.icon("receipt"), label: t("product_sales_csv"), onClick: exportProductSalesCsv },
          { icon: OB.icon("upload"), label: t("export_csv"), onClick: exportCsv },
        ],
      })
    );
    const main = el("main");

    main.appendChild(
      OB.ui.statsRow([
        { label: t("stat_revenue"), value: fmtMoney(stats.revenue) },
        { label: t("stat_tx"), value: stats.count, unit: t("unit_tx"), small: true },
        { label: t("stat_items"), value: stats.pieces, unit: t("unit_pcs"), small: true },
      ])
    );

    // by payment
    const payKeys = Object.keys(stats.byPayment);
    if (payKeys.length) {
      const sec = el("section", { class: "section" }, [el("h2", { class: "section-title", text: t("by_payment") })]);
      payKeys.forEach((k) => {
        const v = stats.byPayment[k];
        sec.appendChild(
          el("div", { class: "summary-row" }, [el("span", { text: k + " (" + v.count + ")" }), el("span", { text: fmtMoney(v.amount) })])
        );
      });
      const avg = stats.count ? Math.round(stats.revenue / stats.count) : 0;
      sec.appendChild(el("div", { class: "summary-row", style: "border-top:1px solid var(--border);margin-top:6px;padding-top:8px" }, [el("span", { text: t("avg_ticket") }), el("span", { text: fmtMoney(avg) })]));
      main.appendChild(sec);
    }

    // product ranking (top 5)
    const ranking = Object.entries(stats.byProduct)
      .map(([pid, qty]) => ({ p: OB.store.product(pid), qty }))
      .filter((x) => x.p)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    if (ranking.length) {
      const sec = el("section", { class: "section" }, [el("h2", { class: "section-title", text: t("product_ranking") })]);
      ranking.forEach((x) => {
        sec.appendChild(el("div", { class: "summary-row" }, [el("span", { text: x.p.name }), el("span", { text: "×" + x.qty })]));
      });
      main.appendChild(sec);
    }

    // transaction list
    const sec = el("section", { class: "section" }, [el("h2", { class: "section-title", text: t("records") })]);
    if (!txs.length) {
      sec.appendChild(OB.ui.emptyState("receipt", t("no_records")));
    } else {
      txs.forEach((tx) => {
        const parts = (tx.lines || []).map((l) => l.name + "×" + l.qty + (l.isTokuten ? "✦" : ""));
        const row = el("div", { class: "list-row" });
        row.appendChild(
          el("div", { class: "list-main" }, [
            el("div", { class: "list-sub", text: fmtTime(tx.time) + " · " + (tx.paymentMethodName || "") }),
            el("div", { class: "list-title", style: "font-weight:600;font-size:13px;line-height:1.4", text: parts.join("・") || "—" }),
            tx.giftNote ? el("div", { class: "list-sub", html: OB.icon("gift", 13) + " " + esc(tx.giftNote) }) : null,
          ])
        );
        row.appendChild(
          el("div", { class: "list-end" }, [
            el("div", { class: "list-amount", text: fmtMoney(tx.grandTotal) }),
            el("button", { class: "mini-btn", style: "margin-top:6px", text: t("undo"), onclick: () => undo(tx) }),
          ])
        );
        sec.appendChild(row);
      });
    }
    main.appendChild(sec);

    if (txs.length) {
      main.appendChild(
        el("div", { style: "padding:8px 0 24px" }, [
          el("button", { class: "btn btn-secondary btn-block", style: "color:var(--danger)", html: OB.icon("alert", 15) + " " + esc(t("reset_records")), onclick: resetRecords }),
        ])
      );
    }

    view.appendChild(main);
    root.appendChild(view);

    function undo(tx) {
      const isCash = tx.paymentType === "cash";
      const msg = isCash ? t("confirm_undo_cash", { amount: fmtMoney(tx.grandTotal) }) : t("confirm_undo", { amount: fmtMoney(tx.grandTotal) });
      confirmDialog(msg, { danger: true }).then((ok) => {
        if (!ok) return;
        OB.store.voidTransaction(tx.id);
        toast(t("undone"), "success");
      });
    }

    function resetRecords() {
      confirmDialog(t("confirm_reset"), { danger: true }).then((ok) => {
        if (!ok) return;
        confirmDialog(t("confirm_reset2"), { danger: true }).then((ok2) => {
          if (!ok2) return;
          const s = OB.store.get();
          s.transactions = s.transactions.filter((x) => x.eventId !== s.currentEventId);
          OB.store.commit();
          toast(t("reset_done"));
        });
      });
    }

    function exportCsv() {
      if (!txs.length) {
        toast(t("no_records"), "danger");
        return;
      }
      const rows = [["時間/Time", "商品/Items", "付款/Payment", "小計", "折扣", "金額/Total", "收現", "找零"]];
      stats.txs.forEach((tx) => {
        const parts = (tx.lines || []).map((l) => l.name + "x" + l.qty + (l.isTokuten ? "(特典)" : ""));
        rows.push([
          new Date(tx.time).toLocaleString(),
          parts.join("; "),
          tx.paymentMethodName || "",
          tx.subtotal,
          tx.discount || 0,
          tx.grandTotal,
          tx.cashReceived != null ? tx.cashReceived : "",
          tx.changeGiven != null ? tx.changeGiven : "",
        ]);
      });
      const fname = (ev.name || "event").replace(/[^\w一-龥]+/g, "_") + "_" + (ev.date || "") + ".csv";
      U.downloadFile(fname, U.toCSV(rows), "text/csv");
      toast(t("exported"), "success");
    }

    function exportProductSalesCsv() {
      const productIds = Object.keys(stats.byProduct);
      if (!productIds.length) {
        toast(t("no_records"), "danger");
        return;
      }
      const revenueByProduct = {};
      const unitByProduct = {};
      stats.txs.forEach((tx) => {
        (tx.lines || []).forEach((line) => {
          if (line.kind !== "product") return;
          unitByProduct[line.refId] = line.unitPrice;
          revenueByProduct[line.refId] = (revenueByProduct[line.refId] || 0) + line.qty * line.unitPrice;
        });
      });
      const rows = [[t("product_name"), t("qty_sold"), t("remaining_stock"), t("unit_price"), t("revenue")]];
      productIds
        .map((pid) => ({ product: OB.store.product(pid), qty: stats.byProduct[pid] || 0 }))
        .filter((row) => row.product)
        .sort((a, b) => b.qty - a.qty || a.product.name.localeCompare(b.product.name))
        .forEach(({ product, qty }) => {
          const unit = unitByProduct[product.id] != null ? unitByProduct[product.id] : product.price;
          rows.push([product.name, qty, OB.inventory.committedRemaining(st, product.id), unit, revenueByProduct[product.id] != null ? revenueByProduct[product.id] : qty * unit]);
        });
      const fname = (ev.name || "event").replace(/[^\w一-龥]+/g, "_") + "_product_sales_" + (ev.date || OB.store.todayISO()) + ".csv";
      U.downloadFile(fname, U.toCSV(rows), "text/csv");
      toast(t("exported"), "success");
    }
  }

  // ---------- cash-up ----------
  function openCashup() {
    const st = OB.store.get();
    const ev = OB.store.currentEvent();
    const stats = OB.stats.eventStats(st);
    const sh = OB.ui.sheet({ title: t("cashup"), tall: true });

    const startFloat = ev.startFloat || 0;
    const expectedCash = startFloat + stats.cashRevenue;

    sh.body.appendChild(el("div", { class: "field-hint", style: "margin-bottom:10px", text: t("cashup_hint") }));

    const block = el("div", { class: "cash-confirm" });
    block.appendChild(row(t("start_float"), fmtMoney(startFloat)));
    block.appendChild(row(t("stat_revenue") + " (" + t("cash") + ")", fmtMoney(stats.cashRevenue)));
    block.appendChild(row(t("expected_cash"), fmtMoney(expectedCash), true));
    sh.body.appendChild(block);

    // counted input
    const countedI = el("input", { class: "cash-input", type: "number", inputmode: "numeric", placeholder: "0" });
    const diffRow = el("div", { class: "cash-row" }, [el("span", { class: "lbl", text: t("cash_diff") }), el("span", { class: "val", id: "diffVal", text: fmtMoney(0) })]);
    const counted = el("div", { class: "cash-confirm" }, [
      el("div", { class: "cash-row" }, [el("span", { class: "lbl", text: t("counted_cash") }), countedI]),
      diffRow,
    ]);
    countedI.addEventListener("input", () => {
      const v = Math.round(Number(countedI.value)) || 0;
      const diff = v - expectedCash;
      const dv = sh.body.querySelector("#diffVal");
      dv.textContent = (diff >= 0 ? "+" : "") + fmtMoney(diff);
      diffRow.classList.toggle("short", diff < 0);
      diffRow.classList.toggle("change", diff >= 0);
    });
    sh.body.appendChild(counted);

    // by payment
    const payKeys = Object.keys(stats.byPayment);
    if (payKeys.length) {
      sh.body.appendChild(el("div", { class: "section-title", text: t("by_payment") }));
      payKeys.forEach((k) => {
        const v = stats.byPayment[k];
        sh.body.appendChild(el("div", { class: "summary-row" }, [el("span", { text: k + " (" + v.count + ")" }), el("span", { text: fmtMoney(v.amount) })]));
      });
    }

    // gifts given
    if (stats.giftsGiven) {
      sh.body.appendChild(el("div", { class: "summary-row", style: "margin-top:8px" }, [el("span", { html: OB.icon("gift", 14) + " " + esc(t("gift_given")) }), el("span", { text: stats.giftsGiven + t("unit_pcs") })]));
    }

    // remaining stock
    sh.body.appendChild(el("div", { class: "section-title", text: t("remaining_stock") }));
    OB.store.activeProducts().forEach((p) => {
      const rem = OB.inventory.committedRemaining(st, p.id);
      if (!isFinite(rem)) return;
      sh.body.appendChild(el("div", { class: "summary-row" }, [el("span", { text: p.name }), el("span", { text: (rem <= 0 ? "✓ " : "") + Math.max(0, rem) })]));
    });

    function row(label, val, strong) {
      return el("div", { class: "cash-row" }, [el("span", { class: "lbl", text: label }), el("span", { class: "val", style: strong ? "" : "font-size:15px", text: val })]);
    }
  }

  OB.router.register("record", render);
})();

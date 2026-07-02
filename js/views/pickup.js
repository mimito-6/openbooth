/* ============================================================
   OpenBooth — PICKUP view (pre-orders + CSV import/export)
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = OB.util;
  const { el, esc, fmtMoney, toast, confirmDialog, copyText } = U;
  const t = window.t;

  const STATUSES = ["pending", "notified", "picked"];

  // Compose the notification text. Custom shop template wins; falls back to the
  // current locale's built-in template. Both support {items} / {amount}.
  function notifyText(po) {
    const tpl = (OB.store.get().settings.notifyTemplate || "").trim() || t("notify_template", { items: "{items}", amount: "{amount}" });
    return tpl.replace(/\{items\}/g, po.itemsText || "").replace(/\{amount\}/g, fmtMoney(po.amount));
  }

  let search = "";
  let filter = "all";

  function render(root) {
    search = "";
    filter = "all";
    const view = el("div", { class: "view active" });
    view.appendChild(
      OB.ui.header({
        title: t("nav_pickup"),
        onBack: () => OB.router.go("home"),
        right: [
          { icon: OB.icon("plus"), label: t("add_preorder"), onClick: () => edit(null) },
          { icon: OB.icon("download"), label: t("import_csv"), onClick: importCsv },
          { icon: OB.icon("upload"), label: t("export_csv"), onClick: exportCsv },
        ],
      })
    );
    const main = el("main");

    // status pills (also act as filter)
    const counts = { pending: 0, notified: 0, picked: 0 };
    OB.store.get().preorders.forEach((p) => (counts[p.status] = (counts[p.status] || 0) + 1));
    const pills = el("div", { class: "status-pills" });
    [["pending", "st_pending"], ["notified", "st_notified"], ["picked", "st_picked"]].forEach(([k, key]) => {
      pills.appendChild(
        el("div", { class: "status-pill " + k + (filter === k ? " active" : ""), onclick: () => { filter = filter === k ? "all" : k; renderList(); } }, [
          el("span", { class: "n", text: counts[k] || 0 }),
          el("span", { class: "t", text: t(key) }),
        ])
      );
    });
    main.appendChild(pills);

    main.appendChild(
      el("div", { class: "search-box" }, [
        el("input", { type: "search", placeholder: t("search_preorders"), oninput: (e) => { search = e.target.value.trim().toLowerCase(); renderList(); } }),
      ])
    );

    const listEl = el("div", { id: "preList" });
    main.appendChild(listEl);
    view.appendChild(main);
    root.appendChild(view);

    function renderList() {
      const st2 = OB.store.get();
      listEl.innerHTML = "";
      let items = st2.preorders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (filter !== "all") items = items.filter((p) => p.status === filter);
      if (search) items = items.filter((p) => (p.customerName + " " + p.itemsText + " " + (p.contact || "")).toLowerCase().includes(search));
      if (!items.length) {
        listEl.appendChild(OB.ui.emptyState("clipboard", t("no_preorders")));
        return;
      }
      items.forEach((p) => listEl.appendChild(row(p)));
    }

    function row(p) {
      const badge = el("span", { class: "badge " + p.status, text: t("st_" + p.status) });
      const r = el("div", { class: "list-row" });

      r.appendChild(
        el("div", { class: "list-main", onclick: () => edit(p) }, [
          el("div", { class: "list-title" }, [document.createTextNode(p.customerName || "—"), badge]),
          el("div", { class: "list-sub", text: p.itemsText + (p.contact ? " · " + p.contact : "") }),
        ])
      );

      // 3-segment status toggle — any state ⇄ any state (fully reversible)
      const toggle = el("div", { class: "status-toggle" });
      STATUSES.forEach((s) => {
        const seg = el("button", {
          class: "seg " + s + (p.status === s ? " active" : ""),
          text: t("st_" + s),
          "aria-label": t("st_" + s),
          onclick: (ev) => {
            ev.stopPropagation();
            if (p.status === s) return;
            setStatus(p, s);
          },
        });
        toggle.appendChild(seg);
      });

      r.appendChild(
        el("div", { class: "list-end" }, [
          el("div", { class: "list-amount", text: fmtMoney(p.amount) }),
          toggle,
        ])
      );
      return r;
    }

    function setStatus(p, status) {
      const prev = p.status;
      p.status = status;
      OB.store.upsertPreorder(p);
      // Subtle toast so the seller knows it took (especially the reversal case)
      const msg = t("status_changed_to", { to: t("st_" + status) });
      toast(msg, status === "picked" ? "success" : "");
      // commit() in store already triggers router.refresh via subscriber
      void prev;
    }

    async function importCsv() {
      const f = await U.pickFile(".csv,text/csv");
      if (!f) return;
      const text = await U.readFileText(f);
      const rows = U.parseCSV(text);
      if (!rows.length) return;
      let start = 0;
      const head = rows[0].join(",").toLowerCase();
      if (/customer|顧客|名前|name|품|품목|품/.test(head) || /item|品項/.test(head)) start = 1;
      let n = 0;
      for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0] && !r[2]) continue;
        OB.store.upsertPreorder({
          customerName: (r[0] || "").trim(),
          contact: (r[1] || "").trim(),
          itemsText: (r[2] || "").trim(),
          amount: Math.round(Number(r[3])) || 0,
          deposit: Math.round(Number(r[4])) || 0,
          status: "pending",
        });
        n++;
      }
      toast(t("imported") + " " + n, "success");
    }

    function exportCsv() {
      const st2 = OB.store.get();
      const rows = [[t("customer_name"), t("contact"), t("items_text"), t("amount"), t("deposit"), "status"]];
      st2.preorders.forEach((p) => rows.push([p.customerName, p.contact, p.itemsText, p.amount, p.deposit || 0, p.status]));
      U.downloadFile("preorders.csv", U.toCSV(rows), "text/csv");
      toast(t("exported"), "success");
    }

    renderList();
  }

  // ------------------------------------------------------------------
  // Edit sheet — includes notify-text preview + copy + edit template link
  // ------------------------------------------------------------------
  function edit(po) {
    const isNew = !po;
    const data = po ? Object.assign({}, po) : { customerName: "", contact: "", itemsText: "", amount: 0, deposit: 0, status: "pending" };
    const sh = OB.ui.sheet({ title: isNew ? t("add_preorder") : t("nav_pickup"), tall: true });

    const nameI = OB.ui.input({ value: data.customerName });
    const contactI = OB.ui.input({ value: data.contact || "", placeholder: t("ph_contact_examples") });
    const itemsI = el("textarea", { rows: 2 });
    itemsI.value = data.itemsText || "";
    const amountI = OB.ui.input({ type: "number", inputmode: "numeric", value: data.amount });
    const depositI = OB.ui.input({ type: "number", inputmode: "numeric", value: data.deposit || 0 });

    sh.body.appendChild(OB.ui.field(t("customer_name"), nameI));
    sh.body.appendChild(OB.ui.field(t("contact"), contactI));
    sh.body.appendChild(OB.ui.field(t("items_text"), itemsI));
    sh.body.appendChild(el("div", { class: "field-row" }, [OB.ui.field(t("amount"), amountI), OB.ui.field(t("deposit"), depositI)]));

    // notify-text preview, only when editing an existing pre-order
    if (!isNew) {
      const previewBox = el("div", { class: "cash-confirm", style: "margin-top:4px;background:var(--surface-2);border:1px dashed var(--border-strong);white-space:pre-wrap;font-size:14px;line-height:1.55;color:var(--text)" });
      const renderPreview = () => {
        // Build a transient po with current edit-form values so the preview reflects unsaved edits
        previewBox.textContent = notifyText({
          itemsText: itemsI.value.trim() || data.itemsText,
          amount: Math.round(Number(amountI.value)) || data.amount,
        });
      };
      renderPreview();
      itemsI.addEventListener("input", renderPreview);
      amountI.addEventListener("input", renderPreview);

      sh.body.appendChild(
        el("div", { class: "field" }, [
          el("label", {}, [
            document.createTextNode(t("notify_preview") + "  "),
            el("a", { href: "#", style: "color:var(--accent);font-size:12px;text-decoration:none", onclick: (e) => { e.preventDefault(); sh.close(); OB.router.go("settings"); toast(t("edit_in_settings"), ""); } }, [document.createTextNode(t("edit_template") + " →")]),
          ]),
          previewBox,
          el("button", { class: "btn btn-secondary btn-block btn-sm", style: "margin-top:8px", html: OB.icon("copy", 15) + " " + esc(t("copy_notify")), onclick: () => copyText(previewBox.textContent).then(() => toast(t("copied"), "success")) }),
        ])
      );
    }

    const saveBtn = el("button", { class: "btn btn-primary", text: t("save"), onclick: save });
    const actions = el("div", { class: "actions" }, [saveBtn]);
    if (!isNew) actions.insertBefore(el("button", { class: "btn btn-secondary", text: t("delete"), onclick: del }), saveBtn);
    sh.footer.appendChild(actions);

    function save() {
      if (!nameI.value.trim() && !itemsI.value.trim()) {
        toast(t("required"), "danger");
        return;
      }
      data.customerName = nameI.value.trim();
      data.contact = contactI.value.trim();
      data.itemsText = itemsI.value.trim();
      data.amount = Math.round(Number(amountI.value)) || 0;
      data.deposit = Math.round(Number(depositI.value)) || 0;
      OB.store.upsertPreorder(data);
      sh.close();
    }
    function del() {
      confirmDialog(t("confirm_delete", { name: data.customerName || "—" }), { danger: true }).then((ok) => {
        if (!ok) return;
        OB.store.deletePreorder(data.id);
        sh.close();
      });
    }
  }

  OB.router.register("pickup", render);
  OB.app = OB.app || {};
  OB.app.notifyText = notifyText; // expose for tests / future re-use
})();

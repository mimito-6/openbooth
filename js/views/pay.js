/* ============================================================
   OpenBooth — PAY view (custom payment methods + QR)
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = OB.util;
  const { el, esc, toast, confirmDialog } = U;
  const t = window.t;

  function render(root) {
    const st = OB.store.get();
    const view = el("div", { class: "view active" });
    view.appendChild(
      OB.ui.header({
        title: t("nav_pay"),
        onBack: () => OB.router.go("home"),
        right: [{ icon: "＋", label: t("add_payment"), onClick: () => edit(null) }],
      })
    );
    const main = el("main");

    st.paymentMethods
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .forEach((m) => {
        const row = el("div", { class: "list-row", onclick: () => edit(m) });
        row.appendChild(el("div", { class: "list-thumb", html: OB.icon(m.type === "cash" ? "banknote" : "credit-card", 22) }));
        row.appendChild(
          el("div", { class: "list-main" }, [
            el("div", { class: "list-title" }, [
              document.createTextNode(m.name),
              m.isDefault ? el("span", { class: "badge notified", text: t("default_method") }) : null,
            ]),
            el("div", { class: "list-sub", text: m.type === "cash" ? t("type_cash") : t("type_external") }),
          ])
        );
        row.appendChild(OB.ui.toggle(m.enabled, (on) => { m.enabled = on; OB.store.upsertPayment(m); }));
        main.appendChild(row);
      });

    view.appendChild(main);
    root.appendChild(view);
  }

  function edit(m) {
    const isNew = !m;
    const data = m ? Object.assign({}, m) : { name: "", type: "external", enabled: true, isDefault: false, note: "", qr: null };
    const sh = OB.ui.sheet({ title: isNew ? t("add_payment") : t("nav_pay") });

    const nameI = OB.ui.input({ value: data.name, placeholder: t("ph_payment_examples") });
    const typeSel = el("select");
    [["external", t("type_external")], ["cash", t("type_cash")]].forEach(([v, label]) => {
      const o = el("option", { value: v, text: label });
      if (v === data.type) o.selected = true;
      typeSel.appendChild(o);
    });
    const noteI = OB.ui.input({ value: data.note || "" });

    const qrWrap = el("div", { style: "display:flex;gap:10px;align-items:center" });
    function renderQr() {
      qrWrap.innerHTML = "";
      if (data.qr) qrWrap.appendChild(el("img", { src: data.qr, style: "width:72px;height:72px;border-radius:8px;object-fit:cover" }));
      qrWrap.appendChild(el("button", { class: "mini-btn", text: t("pick_image"), onclick: pickQr }));
      if (data.qr) qrWrap.appendChild(el("button", { class: "mini-btn", text: t("remove_image"), onclick: () => { data.qr = null; renderQr(); } }));
    }
    async function pickQr() {
      const f = await U.pickFile("image/*");
      if (!f) return;
      data.qr = await U.fileToScaledDataURL(f, 480, 0.85);
      renderQr();
    }
    renderQr();

    const defToggleWrap = el("div", { class: "settings-item" }, [el("span", { class: "si-label", text: t("set_default") })]);
    const defTg = OB.ui.toggle(data.isDefault, (on) => (data.isDefault = on));
    defToggleWrap.appendChild(defTg);

    sh.body.appendChild(OB.ui.field(t("method_name"), nameI));
    sh.body.appendChild(OB.ui.field(t("method_type"), typeSel));
    sh.body.appendChild(OB.ui.field(t("qr_image"), qrWrap));
    sh.body.appendChild(OB.ui.field(t("about"), noteI));
    sh.body.appendChild(defToggleWrap);

    const saveBtn = el("button", { class: "btn btn-primary", text: t("save"), onclick: save });
    const actions = el("div", { class: "actions" }, [saveBtn]);
    if (!isNew && OB.store.get().paymentMethods.length > 1) {
      actions.insertBefore(el("button", { class: "btn btn-secondary", text: t("delete"), onclick: del }), saveBtn);
    }
    sh.footer.appendChild(actions);

    function save() {
      if (!nameI.value.trim()) {
        toast(t("required"), "danger");
        return;
      }
      data.name = nameI.value.trim();
      data.type = typeSel.value;
      data.note = noteI.value.trim();
      OB.store.upsertPayment(data);
      sh.close();
      toast(t("save") + " ✓", "success");
    }
    function del() {
      confirmDialog(t("confirm_delete", { name: data.name }), { danger: true }).then((ok) => {
        if (!ok) return;
        OB.store.deletePayment(data.id);
        sh.close();
      });
    }
  }

  OB.router.register("pay", render);
})();

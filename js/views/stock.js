/* ============================================================
   OpenBooth — STOCK view (inventory CRUD: products/categories/combos)
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = OB.util;
  const { el, esc, fmtMoney, toast, confirmDialog } = U;
  const t = window.t;

  function render(root) {
    const st = OB.store.get();
    const view = el("div", { class: "view active" });

    view.appendChild(
      OB.ui.header({
        title: t("nav_stock"),
        onBack: () => OB.router.go("home"),
        right: [{ icon: OB.icon("tag"), label: t("manage_categories"), onClick: openCategories }],
      })
    );

    const main = el("main");

    // action buttons
    main.appendChild(
      el("div", { class: "fab-row" }, [
        el("button", { class: "btn btn-primary btn-sm", text: "＋ " + t("add_product"), onclick: () => editProduct(null) }),
        st.settings.enableCombos ? el("button", { class: "btn btn-secondary btn-sm", text: "＋ " + t("add_combo"), onclick: () => editCombo(null) }) : null,
      ])
    );

    // products list
    const prods = OB.store.activeProducts();
    const archived = st.products.filter((p) => p.archived);
    if (!prods.length && !archived.length) {
      main.appendChild(OB.ui.emptyState("box", t("no_products")));
    } else {
      const listSec = el("section", { class: "section" }, [el("h2", { class: "section-title", text: t("nav_stock") })]);
      prods.forEach((p) => listSec.appendChild(productRow(p)));
      main.appendChild(listSec);
    }

    // combos list
    if (st.settings.enableCombos) {
      const combos = OB.store.activeCombos();
      if (combos.length) {
        const cs = el("section", { class: "section" }, [el("h2", { class: "section-title", text: t("combos") })]);
        combos.forEach((c) => cs.appendChild(comboRow(c)));
        main.appendChild(cs);
      }
    }

    view.appendChild(main);
    root.appendChild(view);

    function productRow(p) {
      const rem = OB.inventory.committedRemaining(st, p.id);
      const sold = OB.inventory.soldCount(st, p.id);
      const cat = st.categories.find((c) => c.id === p.categoryId);
      const thumb = p.image
        ? el("img", { class: "list-thumb", src: p.image, alt: "" })
        : el("div", { class: "list-thumb", html: OB.icon("tag", 22) });
      const sub = (cat ? cat.name + " · " : "") + t("stock_label") + " " + (isFinite(rem) ? Math.max(0, rem) : "∞") + " · " + t("sold_label") + " " + sold;
      return el("div", { class: "list-row", onclick: () => editProduct(p) }, [
        thumb,
        el("div", { class: "list-main" }, [el("div", { class: "list-title", text: p.name }), el("div", { class: "list-sub", text: sub })]),
        el("div", { class: "list-end" }, [el("div", { class: "list-amount", text: fmtMoney(p.price) })]),
      ]);
    }

    function comboRow(c) {
      const parts = (c.uses || []).map((u) => {
        const p = OB.store.product(u.productId);
        return (p ? p.name : "?") + "×" + u.qty;
      });
      return el("div", { class: "list-row", onclick: () => editCombo(c) }, [
        el("div", { class: "list-thumb", html: OB.icon("gift", 22) }),
        el("div", { class: "list-main" }, [el("div", { class: "list-title", text: c.name }), el("div", { class: "list-sub", text: parts.join(" + ") })]),
        el("div", { class: "list-end" }, [el("div", { class: "list-amount", text: fmtMoney(c.price) })]),
      ]);
    }
  }

  // ---------- product editor ----------
  function editProduct(p) {
    const st = OB.store.get();
    const isNew = !p;
    const data = p
      ? JSON.parse(JSON.stringify(p))
      : { name: "", categoryId: st.categories[0] ? st.categories[0].id : null, price: 0, stockInitial: 50, bundleRules: [], image: null, sku: "" };

    // keepOnRefresh: creating a category from inside this form commits, and a
    // commit re-renders the view — the half-filled form must survive that.
    const sh = OB.ui.sheet({ title: isNew ? t("add_product") : t("edit_product"), tall: true, keepOnRefresh: true });

    const nameI = OB.ui.input({ value: data.name, placeholder: t("product_name") });
    const priceI = OB.ui.input({ type: "number", inputmode: "numeric", value: data.price });
    const stockI = OB.ui.input({ type: "number", inputmode: "numeric", value: data.stockInitial });
    const skuI = OB.ui.input({ value: data.sku || "" });

    // category picker + inline "new category" — previously you had to abandon
    // this form, open the category manager from the header, then start over
    const catSel = el("select", { style: "flex:1" });
    function fillCats() {
      catSel.innerHTML = "";
      catSel.appendChild(el("option", { value: "", text: t("none") }));
      OB.store.activeCategories().forEach((c) => {
        const o = el("option", { value: c.id, text: c.name });
        if (c.id === data.categoryId) o.selected = true;
        catSel.appendChild(o);
      });
    }
    fillCats();
    catSel.addEventListener("change", () => (data.categoryId = catSel.value || null));

    const newCatRow = el("div", { style: "display:none;gap:6px;margin-top:8px" });
    const newCatI = OB.ui.input({ placeholder: t("category_name"), style: "flex:1" });
    function createCat() {
      const made = addCategory(newCatI.value);
      if (!made) return;
      data.categoryId = made.id; // select what was just created
      newCatI.value = "";
      newCatRow.style.display = "none";
      fillCats();
    }
    newCatI.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        createCat();
      }
    });
    newCatRow.appendChild(newCatI);
    newCatRow.appendChild(el("button", { class: "btn btn-primary btn-sm", text: t("add"), onclick: createCat }));
    newCatRow.appendChild(el("button", { class: "btn btn-secondary btn-sm", text: t("cancel"), onclick: () => { newCatRow.style.display = "none"; newCatI.value = ""; } }));

    const catRow = el("div", { style: "display:flex;gap:6px;align-items:center" }, [
      catSel,
      el("button", {
        class: "mini-btn",
        text: "＋ " + t("new_category"),
        onclick: () => {
          newCatRow.style.display = "flex";
          setTimeout(() => newCatI.focus(), 0);
        },
      }),
    ]);
    const catField = el("div", {}, [catRow, newCatRow]);

    // image
    const imgPreview = el("div", { style: "display:flex;gap:10px;align-items:center" });
    function renderImg() {
      imgPreview.innerHTML = "";
      if (data.image) imgPreview.appendChild(el("img", { src: data.image, style: "width:64px;height:64px;border-radius:10px;object-fit:cover" }));
      imgPreview.appendChild(el("button", { class: "mini-btn", text: t("pick_image"), onclick: pickImg }));
      if (data.image) imgPreview.appendChild(el("button", { class: "mini-btn", text: t("remove_image"), onclick: () => { data.image = null; renderImg(); } }));
    }
    async function pickImg() {
      const f = await U.pickFile("image/*");
      if (!f) return;
      try {
        data.image = await U.fileToScaledDataURL(f, 360, 0.8);
        renderImg();
      } catch (e) {
        toast(t("image_failed"), "danger");
      }
    }
    renderImg();

    // bundle rules
    const bundleWrap = el("div");
    function renderBundles() {
      bundleWrap.innerHTML = "";
      (data.bundleRules || []).forEach((b, i) => {
        const qtyI = OB.ui.input({ type: "number", inputmode: "numeric", value: b.qty, placeholder: t("bundle_qty") });
        const priceB = OB.ui.input({ type: "number", inputmode: "numeric", value: b.price, placeholder: t("bundle_price") });
        const labelI = OB.ui.input({ value: b.label || "", placeholder: t("bundle_label") });
        qtyI.addEventListener("input", () => (b.qty = Math.round(Number(qtyI.value)) || 0));
        priceB.addEventListener("input", () => (b.price = Math.round(Number(priceB.value)) || 0));
        labelI.addEventListener("input", () => (b.label = labelI.value));
        const row = el("div", { class: "field-row", style: "align-items:flex-end" }, [
          el("div", { class: "field", style: "flex:0 0 70px" }, [el("label", { text: t("bundle_qty") }), qtyI]),
          el("div", { class: "field", style: "flex:0 0 90px" }, [el("label", { text: t("bundle_price") }), priceB]),
          el("div", { class: "field", style: "flex:1" }, [el("label", { text: t("bundle_label") }), labelI]),
          el("button", { class: "qty-btn", html: "×", style: "margin-bottom:14px", onclick: () => { data.bundleRules.splice(i, 1); renderBundles(); } }),
        ]);
        bundleWrap.appendChild(row);
      });
      bundleWrap.appendChild(
        el("button", { class: "mini-btn", text: t("add_bundle_rule"), onclick: () => { data.bundleRules = data.bundleRules || []; data.bundleRules.push({ qty: 0, price: 0, label: "" }); renderBundles(); } })
      );
    }
    renderBundles();

    sh.body.appendChild(OB.ui.field(t("product_name"), nameI));
    sh.body.appendChild(el("div", { class: "field-row" }, [OB.ui.field(t("price"), priceI), OB.ui.field(t("stock_initial"), stockI)]));
    sh.body.appendChild(OB.ui.field(t("category"), catField));
    sh.body.appendChild(OB.ui.field(t("image"), imgPreview));
    sh.body.appendChild(OB.ui.field(t("bundle_rules"), bundleWrap, t("bundle_hint_example")));
    sh.body.appendChild(OB.ui.field(t("sku"), skuI));

    const saveBtn = el("button", { class: "btn btn-primary", text: t("save"), onclick: save });
    const actions = el("div", { class: "actions" }, [saveBtn]);
    if (!isNew) {
      actions.insertBefore(el("button", { class: "btn btn-secondary", text: t("delete"), onclick: del }), saveBtn);
    }
    sh.footer.appendChild(actions);

    function save() {
      const name = nameI.value.trim();
      if (!name) {
        toast(t("required"), "danger");
        return;
      }
      data.name = name;
      data.price = Math.max(0, Math.round(Number(priceI.value)) || 0);
      data.stockInitial = stockI.value === "" ? Infinity : Math.max(0, Math.round(Number(stockI.value)) || 0);
      data.categoryId = catSel.value || null;
      data.sku = skuI.value.trim();
      data.bundleRules = (data.bundleRules || []).filter((b) => b.qty > 0 && b.price >= 0);
      OB.store.upsertProduct(data);
      sh.close();
      toast(t("save") + " ✓", "success");
    }
    function del() {
      confirmDialog(t("confirm_delete", { name: data.name }), { danger: true }).then((ok) => {
        if (!ok) return;
        OB.store.deleteProduct(data.id);
        sh.close();
      });
    }
  }

  // ---------- combo editor ----------
  function editCombo(c) {
    const st = OB.store.get();
    const isNew = !c;
    const data = c ? JSON.parse(JSON.stringify(c)) : { name: "", description: "", price: 0, uses: [], image: null };
    const sh = OB.ui.sheet({ title: isNew ? t("add_combo") : t("edit_product"), tall: true });

    const nameI = OB.ui.input({ value: data.name });
    const priceI = OB.ui.input({ type: "number", inputmode: "numeric", value: data.price });
    const descI = OB.ui.input({ value: data.description || "" });

    const usesWrap = el("div");
    function renderUses() {
      usesWrap.innerHTML = "";
      (data.uses || []).forEach((u, i) => {
        const sel = el("select", { style: "flex:1" });
        OB.store.activeProducts().forEach((p) => {
          const o = el("option", { value: p.id, text: p.name });
          if (p.id === u.productId) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", () => (u.productId = sel.value));
        const qtyI = OB.ui.input({ type: "number", inputmode: "numeric", value: u.qty, style: "width:64px" });
        qtyI.addEventListener("input", () => (u.qty = Math.max(1, Math.round(Number(qtyI.value)) || 1)));
        usesWrap.appendChild(
          el("div", { class: "field-row", style: "align-items:center;margin-bottom:8px" }, [
            sel,
            qtyI,
            el("button", { class: "qty-btn", html: "×", onclick: () => { data.uses.splice(i, 1); renderUses(); } }),
          ])
        );
      });
      if (OB.store.activeProducts().length) {
        usesWrap.appendChild(
          el("button", { class: "mini-btn", text: t("add_combo_item"), onclick: () => { data.uses.push({ productId: OB.store.activeProducts()[0].id, qty: 1 }); renderUses(); } })
        );
      } else {
        usesWrap.appendChild(el("div", { class: "field-hint", text: t("no_products") }));
      }
    }
    renderUses();

    sh.body.appendChild(OB.ui.field(t("product_name"), nameI));
    sh.body.appendChild(el("div", { class: "field-row" }, [OB.ui.field(t("price"), priceI)]));
    sh.body.appendChild(OB.ui.field(t("combo_desc"), descI));
    sh.body.appendChild(OB.ui.field(t("combo_includes"), usesWrap));

    const saveBtn = el("button", { class: "btn btn-primary", text: t("save"), onclick: save });
    const actions = el("div", { class: "actions" }, [saveBtn]);
    if (!isNew) actions.insertBefore(el("button", { class: "btn btn-secondary", text: t("delete"), onclick: del }), saveBtn);
    sh.footer.appendChild(actions);

    function save() {
      if (!nameI.value.trim()) {
        toast(t("required"), "danger");
        return;
      }
      data.name = nameI.value.trim();
      data.price = Math.max(0, Math.round(Number(priceI.value)) || 0);
      data.description = descI.value.trim();
      data.uses = (data.uses || []).filter((u) => u.productId && u.qty > 0);
      OB.store.upsertCombo(data);
      sh.close();
      toast(t("save") + " ✓", "success");
    }
    function del() {
      confirmDialog(t("confirm_delete", { name: data.name }), { danger: true }).then((ok) => {
        if (!ok) return;
        OB.store.deleteCombo(data.id);
        sh.close();
      });
    }
  }

  // ---------- category manager ----------
  // Common booth categories offered as one-tap chips. Suggestions only —
  // nothing is created until the seller taps one.
  const SUGGESTED_CATEGORIES = ["cat_sug_acrylic", "cat_sug_sticker", "cat_sug_postcard", "cat_sug_badge", "cat_sug_charm", "cat_sug_book", "cat_sug_print", "cat_sug_apparel", "cat_sug_stationery", "cat_sug_bag"];

  function addCategory(name) {
    const clean = (name || "").trim();
    if (!clean) return null;
    const dupe = OB.store.get().categories.find((c) => c.name.trim() === clean);
    if (dupe) {
      toast(t("category_exists"), "danger");
      return null;
    }
    return OB.store.upsertCategory({ name: clean, color: "#c46b43" });
  }

  function openCategories() {
    // keepOnRefresh: adding a category commits, which re-renders the view —
    // without this the sheet would be torn down on the first tap.
    const sh = OB.ui.sheet({ title: t("manage_categories"), keepOnRefresh: true });
    function renderList() {
      const st = OB.store.get();
      sh.body.innerHTML = "";

      // existing categories — rename in place, delete with ×
      st.categories.forEach((c) => {
        const nameI = OB.ui.input({ value: c.name });
        nameI.addEventListener("change", () => {
          const v = nameI.value.trim();
          if (!v) {
            nameI.value = c.name;
            return;
          }
          c.name = v;
          OB.store.upsertCategory(c);
        });
        sh.body.appendChild(
          el("div", { class: "field-row", style: "align-items:center;margin-bottom:8px" }, [
            nameI,
            el("button", { class: "qty-btn", html: "×", onclick: () => { OB.store.deleteCategory(c.id); renderList(); } }),
          ])
        );
      });
      if (!st.categories.length) {
        sh.body.appendChild(el("div", { class: "field-hint", style: "margin-bottom:10px", text: t("no_categories_yet") }));
      }

      // name it, THEN create it — the old flow made a placeholder called
      // "new category" and left you to rename it afterwards
      const newI = OB.ui.input({ placeholder: t("category_name") });
      function commitNew() {
        if (!newI.value.trim()) return;
        if (addCategory(newI.value)) {
          newI.value = "";
          renderList();
          setTimeout(() => newI.focus(), 0);
        }
      }
      newI.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitNew();
        }
      });
      sh.body.appendChild(
        el("div", { class: "field-row", style: "align-items:center;margin:10px 0 4px" }, [
          newI,
          el("button", { class: "btn btn-primary btn-sm", text: t("add"), onclick: commitNew }),
        ])
      );

      // one-tap suggestions for whatever the seller has not added yet
      const taken = st.categories.map((c) => c.name.trim());
      const remaining = SUGGESTED_CATEGORIES.map((k) => t(k)).filter((n) => taken.indexOf(n) < 0);
      if (remaining.length) {
        sh.body.appendChild(el("div", { class: "field-hint", style: "margin-top:12px", text: t("category_suggestions") }));
        const chips = el("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:6px" });
        remaining.forEach((n) => {
          chips.appendChild(
            el("button", { class: "mini-btn", text: "＋ " + n, onclick: () => { addCategory(n); renderList(); } })
          );
        });
        sh.body.appendChild(chips);
      }
    }
    renderList();
  }

  OB.app = OB.app || {};
  OB.app.openCategories = openCategories;

  OB.router.register("stock", render);
})();

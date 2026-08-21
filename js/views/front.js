/* ============================================================
   OpenBooth — FRONT view (sell) + cart + checkout flow
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = OB.util;
  const { el, esc, fmtMoney, uuid, toast, confirmDialog } = U;
  const t = window.t;

  let activeTab = "all";
  let search = "";

  function render(root) {
    const st = OB.store.get();
    const ev = OB.store.currentEvent();
    activeTab = "all";
    search = "";

    const view = el("div", { class: "view active" });

    view.appendChild(
      OB.ui.header({
        title: st.settings.shopName || t("nav_front"),
        subtitle: (ev.name || t("no_event")) + (ev.date ? " · " + ev.date : ""),
        onBack: () => OB.router.go("home"),
        right: (OB.store.isLocked && OB.store.isLocked())
          ? [
              { icon: OB.icon("lock-open"), label: t("unlock"), onClick: () => OB.app.unlockHelper() },
              { icon: OB.icon("home"), label: t("home"), onClick: () => OB.router.go("home") },
            ]
          : [{ icon: OB.icon("home"), label: t("home"), onClick: () => OB.router.go("home") }],
      })
    );

    // tabs
    const tabBar = el("div", { class: "tab-bar" });
    view.appendChild(tabBar);

    // search
    const searchWrap = el("div", { class: "search-wrap", style: "padding:0 16px 8px" }, [
      el("div", { class: "search-box" }, [
        el("input", {
          type: "search",
          placeholder: t("search_products"),
          oninput: (e) => {
            search = e.target.value.trim().toLowerCase();
            updateGrid();
          },
        }),
      ]),
    ]);
    view.appendChild(searchWrap);

    const gridWrap = el("main");
    const gridEl = el("div", { class: "item-grid", id: "frontGrid" });
    gridWrap.appendChild(el("section", { class: "section" }, [gridEl]));
    view.appendChild(gridWrap);

    root.appendChild(view);

    // floating bar
    const bar = el("div", { class: "sale-bar boo-transient", onclick: openSaleSheet }, [
      el("div", { class: "sale-bar-left" }, [
        el("div", { class: "sale-bar-count", id: "barCount" }),
        el("div", { class: "sale-bar-total", id: "barTotal" }),
      ]),
      el("div", { class: "sale-bar-cta", text: t("view_detail") }),
    ]);
    document.body.appendChild(bar);

    function renderTabs() {
      tabBar.innerHTML = "";
      const cats = OB.store.activeCategories();
      const tabs = [{ id: "all", name: t("tab_all") }].concat(cats.map((c) => ({ id: c.id, name: c.name })));
      if (st.settings.enableCombos && OB.store.activeCombos().length) tabs.push({ id: "__combo", name: t("nav_front") === "Front Desk" ? "Combos" : "套組" });
      tabs.forEach((tb) => {
        tabBar.appendChild(
          el("button", {
            class: "tab" + (activeTab === tb.id ? " active" : ""),
            text: tb.name,
            onclick: () => {
              activeTab = tb.id;
              renderTabs();
              updateGrid();
            },
          })
        );
      });
    }

    function productCard(p) {
      const cart = OB.store.getCart();
      const rem = OB.inventory.remaining(st, null, p.id);
      const inCart = cart.lines.filter((l) => l.kind === "product" && l.refId === p.id).reduce((s, l) => s + l.qty, 0);
      const remAfter = rem - inCart;
      const low = isFinite(rem) && remAfter <= st.settings.lowStockThreshold && remAfter > 0;
      const soldOut = isFinite(rem) && remAfter <= 0;
      // Add-on tiles say so on the tile, and say whether the price is live
      // right now — the rule depends on the rest of the cart, so a seller
      // cannot work it out by looking at this product alone.
      const addon = OB.pricing.isAddon(p);
      const addonLive = addon && OB.pricing.cartQualifiesForAddon(st, cart);
      const bundle = addon
        ? (addonLive ? t("addon_applied") : t("addon_idle", { price: fmtMoney(p.addonPrice) }))
        : (p.bundleRules && p.bundleRules[0]) ? p.bundleRules[0].label || p.bundleRules[0].qty + "→" + p.bundleRules[0].price : "";
      const card = el("div", {
        class: "item-card" + (inCart ? " has-qty" : "") + (soldOut ? " sold-out" : ""),
      });
      tapAdd(card, () => addProduct(p.id));
      if (inCart) attachSwipe(card, () => removeOne("product", p.id));
      if (inCart) card.appendChild(el("span", { class: "qty-badge", text: inCart }));
      if (p.image) card.appendChild(el("img", { class: "item-thumb", src: p.image, alt: "" }));
      card.appendChild(el("div", { class: "item-name", text: p.name }));
      // The struck-through list price rides on the note line, not next to the
      // big price — putting both numbers in the bottom row squeezed the stock
      // count onto a second line.
      let noteNode;
      if (addonLive) {
        noteNode = el("div", { class: "item-bundle addon-live" }, [
          el("span", { class: "addon-pill", text: t("addon_applied") }),
          el("span", { class: "price-was", text: fmtMoney(p.price) }),
        ]);
      } else if (bundle) {
        noteNode = el("div", { class: "item-bundle" + (addon ? " addon-idle" : ""), text: bundle });
      } else {
        noteNode = el("div", { class: "item-bundle" });
      }
      card.appendChild(noteNode);
      // While the add-on price is live it IS what the customer pays, so it
      // takes the big number. Showing the list price large while charging less
      // made sellers quote the wrong figure.
      const priceNode = el("div", {
        class: "item-price" + (addonLive ? " is-addon" : ""),
        html: esc(fmtMoney(addonLive ? p.addonPrice : p.price)),
      });
      const bottom = el("div", { class: "item-bottom" }, [priceNode]);
      if (st.settings.showStock && isFinite(rem)) {
        bottom.appendChild(el("div", { class: "item-stock" + (low ? " low" : ""), text: t("remain", { n: Math.max(0, remAfter) }) }));
      }
      card.appendChild(bottom);
      return card;
    }

    function comboCard(c) {
      const cart = OB.store.getCart();
      const inCart = cart.lines.filter((l) => l.kind === "combo" && l.refId === c.id).reduce((s, l) => s + l.qty, 0);
      const canSell = OB.inventory.canAddCombo(st, cart, c.id);
      const card = el("div", {
        class: "item-card combo" + (inCart ? " has-qty" : "") + (!canSell && !inCart ? " sold-out" : ""),
      });
      tapAdd(card, () => addCombo(c.id));
      if (inCart) attachSwipe(card, () => removeOne("combo", c.id));
      if (inCart) card.appendChild(el("span", { class: "qty-badge", text: inCart }));
      const nameLine = el("div", { class: "item-name" });
      nameLine.appendChild(el("span", { class: "combo-letter", text: t("combo_badge") }));
      nameLine.appendChild(document.createTextNode(c.name));
      card.appendChild(nameLine);
      card.appendChild(el("div", { class: "combo-desc", text: c.description || "" }));
      card.appendChild(el("div", { class: "item-bottom" }, [el("div", { class: "item-price", html: esc(fmtMoney(c.price)) })]));
      return card;
    }

    /* Swipe left on a tile to take one back off the cart.
       Tapping adds; until now the only way to remove was to open the detail
       sheet, which is a lot of taps when a customer changes their mind mid-sale.
       Vertical movement is left alone so the grid still scrolls, and the tap
       handler is suppressed once a gesture has been claimed as a swipe. */
    const SWIPE_TRIGGER = 56; // px before it counts as a remove
    function attachSwipe(card, onRemove) {
      let startX = 0;
      let startY = 0;
      let dx = 0;
      let axis = null; // null = undecided, "x" = ours, "y" = the page scrolls
      let active = false;

      const hint = el("div", { class: "swipe-hint", text: "−1" });
      card.appendChild(hint);

      function reset(animate) {
        card.classList.toggle("swiping", !animate);
        card.style.transform = "";
        hint.style.opacity = "";
        axis = null;
        active = false;
        dx = 0;
      }

      card.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        active = true;
        axis = null;
        startX = e.clientX;
        startY = e.clientY;
        card.classList.add("swiping");
      });

      card.addEventListener("pointermove", (e) => {
        if (!active) return;
        const mx = e.clientX - startX;
        const my = e.clientY - startY;
        if (!axis) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          // a mostly-horizontal, leftward move is ours; anything else scrolls
          axis = Math.abs(mx) > Math.abs(my) && mx < 0 ? "x" : "y";
          if (axis === "x") {
            // capture is an optimisation, not a requirement — never let it
            // throw out of the handler and abort the gesture
            try {
              card.setPointerCapture(e.pointerId);
            } catch (err) {}
          }
        }
        if (axis !== "x") return;
        e.preventDefault();
        dx = Math.max(-96, Math.min(0, mx));
        card.style.transform = "translateX(" + dx + "px)";
        hint.style.opacity = String(Math.min(1, Math.abs(dx) / SWIPE_TRIGGER));
      });

      function finish(e) {
        if (!active) return;
        const fired = axis === "x" && dx <= -SWIPE_TRIGGER;
        try {
          card.releasePointerCapture(e.pointerId);
        } catch (err) {}
        if (fired) {
          card.__swiped = true; // swallow the click this gesture produces
          setTimeout(() => (card.__swiped = false), 350);
          reset(true);
          onRemove();
          return;
        }
        reset(true);
      }
      card.addEventListener("pointerup", finish);
      card.addEventListener("pointercancel", finish);
    }

    function tapAdd(card, fn) {
      card.addEventListener("click", () => {
        if (card.__swiped) return;
        fn();
      });
    }

    function updateGrid() {
      gridEl.innerHTML = "";
      let prods = OB.store.activeProducts();
      let combos = st.settings.enableCombos ? OB.store.activeCombos() : [];
      if (search) {
        prods = prods.filter((p) => p.name.toLowerCase().includes(search));
        combos = combos.filter((c) => c.name.toLowerCase().includes(search));
      }
      if (activeTab === "__combo") {
        prods = [];
      } else if (activeTab !== "all") {
        prods = prods.filter((p) => p.categoryId === activeTab);
        combos = [];
      }
      if (!prods.length && !combos.length) {
        const hasAny = OB.store.activeProducts().length > 0;
        const box = el("div", { style: "grid-column:1/-1" });
        box.appendChild(hasAny ? OB.ui.emptyState("search", "—") : OB.ui.emptyState("box", t("no_products")));
        if (!hasAny) {
          box.appendChild(el("button", { class: "btn btn-primary btn-block", text: "＋ " + t("add_product"), onclick: () => OB.router.go("stock") }));
        }
        gridEl.appendChild(box);
        updateBar();
        return;
      }
      prods.forEach((p) => gridEl.appendChild(productCard(p)));
      if (activeTab === "all" && combos.length) {
        // combos appended after products
        combos.forEach((c) => gridEl.appendChild(comboCard(c)));
      } else if (activeTab === "__combo") {
        combos.forEach((c) => gridEl.appendChild(comboCard(c)));
      }
      updateBar();
    }

    function updateBar() {
      const sale = OB.pricing.calcSale(st, OB.store.getCart());
      const barEl = document.querySelector(".sale-bar");
      if (!barEl) return;
      if (sale.itemCount === 0) {
        barEl.classList.remove("show");
        return;
      }
      barEl.classList.add("show");
      document.getElementById("barCount").textContent = t("cart_count", { n: sale.itemCount });
      document.getElementById("barTotal").textContent = fmtMoney(sale.grandTotal);
    }

    function addProduct(id) {
      const cart = OB.store.getCart();
      if (!OB.inventory.canAddProduct(st, cart, id)) {
        toast(t("stock_short"), "danger");
        return;
      }
      let line = cart.lines.find((l) => l.kind === "product" && l.refId === id && !l.isTokuten && l.manualUnitPrice == null);
      if (line) line.qty++;
      else cart.lines.push({ uid: uuid(), kind: "product", refId: id, qty: 1, isTokuten: false, manualUnitPrice: null });
      OB.store.setCart(cart);
      updateGrid();
      hintSwipeOnce();
    }
    // A gesture nobody is told about is a gesture nobody uses. Mention it the
    // first time something lands in the cart, once per device.
    function hintSwipeOnce() {
      try {
        if (localStorage.getItem("openbooth_swipe_hint_v1")) return;
        localStorage.setItem("openbooth_swipe_hint_v1", "1");
        setTimeout(() => toast(t("swipe_to_remove")), 700);
      } catch (e) {}
    }
    function addCombo(id) {
      const cart = OB.store.getCart();
      if (!OB.inventory.canAddCombo(st, cart, id)) {
        toast(t("stock_short"), "danger");
        return;
      }
      let line = cart.lines.find((l) => l.kind === "combo" && l.refId === id && !l.isTokuten && l.manualUnitPrice == null);
      if (line) line.qty++;
      else cart.lines.push({ uid: uuid(), kind: "combo", refId: id, qty: 1, isTokuten: false, manualUnitPrice: null });
      OB.store.setCart(cart);
      updateGrid();
      hintSwipeOnce();
    }

    /* Take one unit back off the cart.
       The badge on a tile is the SUM of every line for that item, so prefer
       the plain line (the one tapping creates). Only if there is none — the
       item is in the cart solely as a 特典 / manually-priced line — fall back
       to the most recent matching line, so the swipe always does what the
       badge implies. Detailed surgery still belongs in the detail sheet. */
    function removeOne(kind, id) {
      const cart = OB.store.getCart();
      const matches = cart.lines.filter((l) => l.kind === kind && l.refId === id);
      if (!matches.length) return;
      const line =
        matches.find((l) => !l.isTokuten && l.manualUnitPrice == null) || matches[matches.length - 1];
      line.qty--;
      if (line.qty <= 0) cart.lines = cart.lines.filter((l) => l.uid !== line.uid);
      OB.store.setCart(cart);
      updateGrid();
    }

    OB.app.frontUpdate = updateGrid; // expose for sheet callbacks

    renderTabs();
    updateGrid();
    updateBar();
  }

  // ---------- sale sheet (cart → checkout) ----------
  function openSaleSheet() {
    const st = OB.store.get();
    const cart = OB.store.getCart();
    const sale = OB.pricing.calcSale(st, cart);
    if (sale.itemCount === 0) {
      toast(t("no_items"), "danger");
      return;
    }
    const sh = OB.ui.sheet({ title: t("sale_detail"), tall: true });
    let step = 1;
    let chosenPayment = OB.store.defaultPayment();
    let cashReceived = null;

    function recalc() {
      return OB.pricing.calcSale(OB.store.get(), OB.store.getCart());
    }

    function changeQty(uid, delta) {
      const c = OB.store.getCart();
      const line = c.lines.find((l) => l.uid === uid);
      if (!line) return;
      if (delta > 0) {
        // re-check stock
        if (line.kind === "product" && !OB.inventory.canAddProduct(st, c, line.refId)) {
          toast(t("stock_short"), "danger");
          return;
        }
        if (line.kind === "combo" && !OB.inventory.canAddCombo(st, c, line.refId)) {
          toast(t("stock_short"), "danger");
          return;
        }
        line.qty++;
      } else {
        line.qty--;
        if (line.qty <= 0) c.lines = c.lines.filter((l) => l.uid !== uid);
      }
      OB.store.setCart(c);
      if (OB.app.frontUpdate) OB.app.frontUpdate();
      renderStep1();
    }

    function toggleTokuten(uid) {
      const c = OB.store.getCart();
      const line = c.lines.find((l) => l.uid === uid);
      if (!line) return;
      line.isTokuten = !line.isTokuten;
      if (line.isTokuten) line.manualUnitPrice = null;
      OB.store.setCart(c);
      renderStep1();
    }

    function setLinePrice(uid) {
      const c = OB.store.getCart();
      const line = c.lines.find((l) => l.uid === uid);
      if (!line) return;
      const cur = line.manualUnitPrice != null ? line.manualUnitPrice : line.kind === "product" ? (OB.store.product(line.refId) || {}).price : (OB.store.combo(line.refId) || {}).price;
      const v = prompt(t("set_price"), cur);
      if (v == null) return;
      const n = Math.round(Number(v));
      if (isNaN(n) || n < 0) return;
      line.manualUnitPrice = n;
      line.isTokuten = false;
      OB.store.setCart(c);
      renderStep1();
    }

    function roundTotal() {
      const c = OB.store.getCart();
      const s = OB.pricing.calcSale(st, c);
      const v = prompt(t("manual_adjust") + " — " + t("total_due"), s.grandTotal);
      if (v == null) return;
      const finalT = Math.round(Number(v));
      if (isNaN(finalT) || finalT < 0) return;
      c.discount = Math.max(0, s.subtotal - finalT);
      OB.store.setCart(c);
      renderStep1();
    }

    function renderStep1() {
      const s = recalc();
      sh.body.innerHTML = "";
      sh.footer.innerHTML = "";
      if (!s.lines.length) {
        sh.close();
        return;
      }
      s.lines.forEach((L) => {
        const meta = el("div", { class: "sale-line-meta" });
        // show what is actually being charged per unit; the list price only
        // survives as a struck-through reference when they differ
        const discounted = !L.isTokuten && L.unitPrice !== L.basePrice;
        if (discounted) {
          meta.appendChild(el("span", { class: "price-was", style: "margin:0 4px 0 0", text: fmtMoney(L.basePrice) }));
        }
        meta.appendChild(document.createTextNode(fmtMoney(discounted ? L.unitPrice : L.basePrice) + " × " + L.qty));
        // when every unit took the add-on price the struck-through original
        // already says so — repeating it just wrapped the line
        const fullyAddon = L.addonQty && L.addonQty === L.qty;
        if (L.bundleNote && !fullyAddon) meta.appendChild(el("span", { class: "saved", text: " · " + L.bundleNote }));

        const nameEl = el("div", { class: "sale-line-name" }, [document.createTextNode(L.name)]);
        if (L.isTokuten) nameEl.appendChild(el("span", { class: "tag tag-tokuten", text: t("mark_tokuten") }));
        if (L.manual) nameEl.appendChild(el("span", { class: "tag tag-gift", text: t("set_price") }));

        const lineActions = el("div", { class: "line-actions" }, [
          el("button", { class: "mini-btn" + (L.isTokuten ? " active" : ""), text: t("mark_tokuten"), onclick: () => toggleTokuten(L.uid) }),
          el("button", { class: "mini-btn", text: t("set_price"), onclick: () => setLinePrice(L.uid) }),
        ]);

        const info = el("div", { class: "sale-line-info" }, [nameEl, meta, lineActions]);
        const qc = el("div", { class: "qty-controls" }, [
          el("button", { class: "qty-btn", html: "−", onclick: () => changeQty(L.uid, -1) }),
          el("span", { class: "qty-num", text: L.qty }),
          el("button", { class: "qty-btn", html: "+", onclick: () => changeQty(L.uid, 1) }),
        ]);
        const tot = el("div", { class: "sale-line-total", text: fmtMoney(L.lineTotal) });
        sh.body.appendChild(el("div", { class: "sale-line" }, [info, qc, tot]));
      });

      // summary
      if (s.bundleSaved > 0) {
        sh.footer.appendChild(summaryRow(t("original_total"), fmtMoney(s.originalTotal)));
        sh.footer.appendChild(summaryRow(t("bundle_saved"), "−" + fmtMoney(s.bundleSaved), "saved"));
      }
      if (s.discount > 0) sh.footer.appendChild(summaryRow(t("discount"), "−" + fmtMoney(s.discount), "saved"));
      sh.footer.appendChild(summaryRow(t("total_due"), fmtMoney(s.grandTotal), "total"));

      const adjustBtn = el("button", { class: "mini-btn", style: "margin-top:8px", html: OB.icon("calculator", 15) + " " + esc(t("manual_adjust")), onclick: roundTotal });
      sh.footer.appendChild(el("div", {}, [adjustBtn]));

      sh.footer.appendChild(
        el("div", { class: "actions" }, [
          el("button", { class: "btn btn-secondary", text: t("cancel"), onclick: cancelSale }),
          el("button", { class: "btn btn-primary", text: t("checkout") + " →", onclick: goStep2 }),
        ])
      );
    }

    function summaryRow(label, val, cls) {
      return el("div", { class: "summary-row " + (cls || "") }, [el("span", { text: label }), el("span", { text: val })]);
    }

    function cancelSale() {
      confirmDialog(t("confirm_cancel_sale")).then((ok) => {
        if (!ok) return;
        OB.store.clearCart();
        if (OB.app.frontUpdate) OB.app.frontUpdate();
        sh.close();
        toast(t("sale_canceled"));
      });
    }

    function goStep2() {
      step = 2;
      cashReceived = null;
      renderStep2();
    }

    function renderStep2() {
      const s = recalc();
      const st2 = OB.store.get();
      sh.body.innerHTML = "";
      sh.footer.innerHTML = "";

      sh.body.appendChild(el("div", { class: "summary-row total", style: "border:none", html: "<span>" + esc(t("total_due")) + "</span><span>" + esc(fmtMoney(s.grandTotal)) + "</span>" }));

      // gift banner
      s.gifts.forEach((g) => {
        sh.body.appendChild(el("div", { class: "gift-banner", text: t("gift_reach", { amount: fmtMoney(g.minAmount), reward: g.rewardText }) }));
      });

      // payment methods
      sh.body.appendChild(el("div", { class: "section-title", text: t("payment_method") }));
      const methods = st2.paymentMethods.filter((m) => m.enabled);
      const pm = el("div", { class: "pay-methods" });
      methods.forEach((m) => {
        pm.appendChild(
          el("div", {
            class: "pay-chip" + (chosenPayment && chosenPayment.id === m.id ? " active" : ""),
            text: m.name,
            onclick: () => {
              chosenPayment = m;
              renderStep2();
            },
          })
        );
      });
      sh.body.appendChild(pm);

      const isCash = chosenPayment && chosenPayment.type === "cash";
      if (isCash && st2.settings.requireCash) {
        renderCashPad(s.grandTotal);
      } else if (!isCash && chosenPayment && chosenPayment.qr) {
        sh.body.appendChild(el("img", { src: chosenPayment.qr, style: "width:180px;height:180px;display:block;margin:14px auto;border-radius:12px", alt: t("qr_alt") }));
        if (chosenPayment.note) sh.body.appendChild(el("div", { style: "text-align:center;color:var(--text-secondary);font-size:13px", text: chosenPayment.note }));
      }

      // customer display button
      sh.body.appendChild(
        el("button", {
          class: "mini-btn",
          style: "margin:10px auto;display:block",
          html: OB.icon("smartphone", 15) + " " + esc(t("customer_display")),
          onclick: () => OB.app.showCustomerDisplay(s.grandTotal, isCash ? null : chosenPayment && chosenPayment.qr),
        })
      );

      const short = isCash && st2.settings.requireCash && (cashReceived == null || cashReceived < s.grandTotal);
      sh.footer.appendChild(
        el("div", { class: "actions" }, [
          el("button", { class: "btn btn-secondary", html: "‹ " + esc(t("back")), onclick: () => { step = 1; renderStep1(); } }),
          el("button", { class: "btn btn-success", text: t("complete_sale"), disabled: short ? "true" : null, onclick: () => complete(s) }),
        ])
      );
    }

    function renderCashPad(total) {
      const pad = el("div", { class: "cash-confirm" });
      const input = el("input", {
        class: "cash-input",
        type: "number",
        inputmode: "numeric",
        placeholder: "0",
        value: cashReceived != null ? cashReceived : "",
      });
      input.addEventListener("input", () => {
        cashReceived = input.value === "" ? null : Math.round(Number(input.value));
        updateChange();
      });
      pad.appendChild(el("div", { class: "cash-row" }, [el("span", { class: "lbl", text: t("cash_received") }), input]));

      const changeRow = el("div", { class: "cash-row change" }, [el("span", { class: "lbl", text: t("change_due") }), el("span", { class: "val", id: "changeVal", text: fmtMoney(0) })]);
      pad.appendChild(changeRow);

      // Just an "Exact" shortcut. The numeric keypad comes from
      // <input type="number" inputmode="numeric"> on mobile.
      const exactBtn = el("button", {
        class: "btn btn-secondary btn-block btn-sm",
        style: "margin-top:10px",
        text: t("exact"),
        onclick: () => { cashReceived = total; input.value = total; updateChange(); },
      });
      pad.appendChild(exactBtn);
      sh.body.appendChild(pad);

      function updateChange() {
        const diff = (cashReceived || 0) - total;
        const row = changeRow;
        const val = document.getElementById("changeVal");
        if (diff < 0) {
          row.classList.add("short");
          row.querySelector(".lbl").textContent = t("short_amount");
          val.textContent = fmtMoney(-diff);
        } else {
          row.classList.remove("short");
          row.querySelector(".lbl").textContent = t("change_due");
          val.textContent = fmtMoney(diff);
        }
        // toggle complete button
        const completeBtn = sh.footer.querySelector(".btn-success");
        if (completeBtn) completeBtn.disabled = diff < 0;
      }
      updateChange();
    }

    function complete(s) {
      const st2 = OB.store.get();
      const cart = OB.store.getCart();
      const isCash = chosenPayment && chosenPayment.type === "cash";
      const tx = {
        lines: s.lines.map((l) => ({
          kind: l.kind,
          refId: l.refId,
          name: l.name,
          unitPrice: l.unitPrice,
          basePrice: l.basePrice,
          qty: l.qty,
          lineTotal: l.lineTotal,
          isTokuten: l.isTokuten,
        })),
        subtotal: s.subtotal,
        discount: s.discount,
        bundleSaved: s.bundleSaved,
        grandTotal: s.grandTotal,
        stockUse: OB.inventory.computeStockUse(st2, cart.lines),
        paymentMethodId: chosenPayment ? chosenPayment.id : null,
        paymentMethodName: chosenPayment ? chosenPayment.name : "—",
        paymentType: chosenPayment ? chosenPayment.type : "external",
        cashReceived: isCash ? cashReceived : null,
        changeGiven: isCash && cashReceived != null ? cashReceived - s.grandTotal : null,
        giftNote: s.gifts.map((g) => g.rewardText).join(", "),
      };
      // ORDER MATTERS: the sale is committed here and is final. Everything
      // below is presentation — a receipt or a printer problem must never
      // roll this back, delete it, or read to the user as a failed sale.
      const savedTx = OB.store.addTransaction(tx);
      OB.store.clearCart();
      sh.close();
      OB.app.hideCustomerDisplay();
      if (OB.router.current() === "front" && OB.app.frontUpdate) OB.app.frontUpdate();
      toast(t("sale_done", { amount: fmtMoney(s.grandTotal) }), "success");
      printFlourish(fmtMoney(s.grandTotal));
      // ONE receipt surface, gated by the single "show receipt" setting:
      // the receipt engine (preview/share/download) when loaded, otherwise the
      // built-in thank-you card. Stacking both trapped users under two modals.
      const hasEngine = window.OB && OB.receipt && typeof OB.receipt.handle === "function";
      if (st2.settings.showReceipt) {
        if (hasEngine) setTimeout(() => OB.receipt.handle(savedTx), 320);
        else setTimeout(() => showReceipt(savedTx), 300);
      }
      // Auto-print is its own setting: a seller who wants silent printing
      // should not have to also turn on the on-screen receipt. Wrapped so a
      // throw in the print layer can never surface as a checkout error.
      try {
        if (OB.printFlow) OB.printFlow.afterCheckout(savedTx);
      } catch (e) {
        console.error("[checkout] auto-print threw; sale is unaffected", e);
      }
    }

    renderStep1();
  }

  // Press-theme signature: a tiny receipt "prints" down and tears off on each
  // completed sale. Visible only under [data-theme="press"] (CSS-gated); other
  // themes never render it. Auto-removes itself.
  function printFlourish(amountText) {
    const wrap = el("div", { class: "print-flourish" }, [
      el("div", { class: "pf-paper" }, [
        el("div", { class: "pf-check", html: OB.icon("check", 30) }),
        el("div", { class: "pf-amt", text: amountText }),
        el("div", { class: "pf-msg", text: "thank you" }),
      ]),
    ]);
    document.body.appendChild(wrap);
    setTimeout(() => wrap.classList.add("tear"), 950);
    setTimeout(() => wrap.remove(), 1550);
  }

  function showReceipt(tx) {
    const sh = OB.ui.sheet({ title: t("receipt_title") });
    const isCash = tx.paymentType === "cash";
    const card = el("div", { class: "receipt-card" }, [
      el("div", { class: "receipt-shop", text: OB.store.get().settings.shopName || t("app_name") }),
      el("div", { class: "receipt-thanks", text: t("thank_you") }),
      el("div", { class: "receipt-meta", text: t("receipt_datetime") + ": " + new Date(tx.time).toLocaleString() }),
    ]);
    (tx.lines || []).forEach((l) => {
      card.appendChild(
        el("div", { class: "receipt-line" }, [
          el("span", { text: l.name + " × " + l.qty }),
          el("span", { text: fmtMoney(l.lineTotal) }),
        ])
      );
    });
    card.appendChild(el("div", { class: "receipt-line receipt-total" }, [el("span", { text: t("total_due") }), el("span", { text: fmtMoney(tx.grandTotal) })]));
    card.appendChild(el("div", { class: "receipt-line" }, [el("span", { text: t("payment_method") }), el("span", { text: tx.paymentMethodName || "—" })]));
    if (isCash && tx.changeGiven != null) {
      card.appendChild(el("div", { class: "receipt-line" }, [el("span", { text: t("change_due") }), el("span", { text: fmtMoney(tx.changeGiven) })]));
    }
    sh.body.appendChild(card);
    sh.footer.appendChild(el("button", { class: "btn btn-primary btn-block", text: t("yes"), onclick: sh.close }));
  }

  OB.router.register("front", render);
  OB.app = OB.app || {};
  OB.app.openSaleSheet = openSaleSheet;
})();

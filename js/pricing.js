/* ============================================================
   OpenBooth — Pricing engine (pure functions, integer money)
   Pipeline: base price → add-on price → bundle tiers → manual
             override → tokuten(free) → cart discount → gifts.
   No floats: all amounts are integers in the smallest unit.
   ============================================================ */
(function () {
  window.OB = window.OB || {};

  /* An "add-on" product has a second, cheaper price that only applies when the
     customer is buying something else as well ("buy anything, add this
     postcard for 100"). Unlike bundle tiers it is a CROSS-LINE rule — every
     other pricing rule here looks at one line in isolation, this one has to
     see the whole cart — and unlike a combo it does not have to enumerate
     which main item it pairs with.
     addonPrice: null / undefined = not an add-on.
     addonMax:   0 or missing = every unit qualifies; N = at most N per sale. */
  function isAddon(p) {
    return !!p && p.addonPrice != null && p.addonPrice >= 0;
  }

  /* The add-on price unlocks only if the cart holds something that is not
     itself an add-on — otherwise a cart of nothing but add-ons would discount
     itself. Combos always qualify as a main purchase. */
  function cartQualifiesForAddon(state, cart) {
    return (cart.lines || []).some((cl) => {
      if (cl.qty <= 0) return false;
      if (cl.kind === "combo") return true;
      const p = state.products.find((x) => x.id === cl.refId);
      return !!p && !isAddon(p);
    });
  }

  // Greedy bundle pricing for a single product line.
  // rules: [{qty, price, label}] ; returns {total, note}
  function applyBundle(unitPrice, qty, rules) {
    if (!rules || !rules.length) return { total: unitPrice * qty, note: "" };
    const sorted = rules.slice().filter((r) => r.qty > 0 && r.price >= 0).sort((a, b) => b.qty - a.qty);
    let remaining = qty;
    let total = 0;
    const notes = [];
    for (const r of sorted) {
      if (remaining >= r.qty) {
        const n = Math.floor(remaining / r.qty);
        total += n * r.price;
        remaining -= n * r.qty;
        notes.push((r.label || r.qty + "→" + r.price) + " ×" + n);
      }
    }
    total += remaining * unitPrice;
    return { total, note: notes.join(" · ") };
  }

  // Compute a full sale from cart lines.
  function calcSale(state, cart) {
    const lines = [];
    let originalTotal = 0;
    let subtotal = 0;
    let itemCount = 0;
    const addonUnlocked = cartQualifiesForAddon(state, cart);
    // addonMax is per sale, not per line, so spend the allowance across lines
    const addonUsed = {};

    (cart.lines || []).forEach((cl) => {
      if (cl.qty <= 0) return;
      let name = "",
        basePrice = 0,
        rules = null,
        prod = null,
        kind = cl.kind;
      if (cl.kind === "product") {
        const p = state.products.find((x) => x.id === cl.refId);
        if (!p) return;
        prod = p;
        name = p.name;
        basePrice = p.price;
        rules = p.bundleRules;
      } else {
        const c = state.combos.find((x) => x.id === cl.refId);
        if (!c) return;
        name = c.name;
        basePrice = c.price;
      }
      itemCount += cl.qty;

      const original = basePrice * cl.qty;
      let lineTotal,
        note = "",
        effUnit = basePrice;

      let addonQty = 0;
      if (cl.isTokuten) {
        lineTotal = 0;
        effUnit = 0;
      } else if (cl.manualUnitPrice != null) {
        // an explicit price the seller typed always wins
        effUnit = Math.round(cl.manualUnitPrice);
        lineTotal = effUnit * cl.qty;
      } else if (addonUnlocked && isAddon(prod)) {
        // eligible units take the add-on price; anything past the per-sale cap
        // falls back to the normal path so a limit stays honest
        const cap = Math.max(0, Math.round(prod.addonMax || 0));
        const already = addonUsed[prod.id] || 0;
        const allowance = cap > 0 ? Math.max(0, cap - already) : cl.qty;
        addonQty = Math.min(cl.qty, allowance);
        addonUsed[prod.id] = already + addonQty;
        const rest = cl.qty - addonQty;
        const restCalc = rules && rules.length ? applyBundle(basePrice, rest, rules) : { total: basePrice * rest, note: "" };
        lineTotal = addonQty * Math.round(prod.addonPrice) + restCalc.total;
        effUnit = addonQty === cl.qty ? Math.round(prod.addonPrice) : basePrice;
        note = addonQty > 0 ? window.t("addon_note", { n: addonQty }) : restCalc.note;
      } else if (cl.kind === "product" && rules && rules.length) {
        const b = applyBundle(basePrice, cl.qty, rules);
        lineTotal = b.total;
        note = b.note;
      } else {
        lineTotal = original;
      }

      lines.push({
        uid: cl.uid,
        kind,
        refId: cl.refId,
        name,
        qty: cl.qty,
        isTokuten: !!cl.isTokuten,
        manual: cl.manualUnitPrice != null,
        unitPrice: effUnit,
        basePrice,
        lineTotal,
        bundleNote: note,
        addonQty,
      });
      originalTotal += cl.isTokuten ? 0 : original;
      subtotal += lineTotal;
    });

    const discount = Math.max(0, Math.round(cart.discount || 0));
    const bundleSaved = Math.max(0, originalTotal - subtotal);
    const grandTotal = Math.max(0, subtotal - discount);

    // gift thresholds (use grandTotal pre-gift, i.e. what they spend)
    const gifts = (state.giftThresholds || [])
      .filter((g) => g.enabled && grandTotal >= g.minAmount)
      .sort((a, b) => b.minAmount - a.minAmount);

    return { lines, originalTotal, subtotal, bundleSaved, discount, grandTotal, itemCount, gifts };
  }

  OB.pricing = { calcSale, applyBundle, isAddon, cartQualifiesForAddon };
})();

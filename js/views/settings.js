/* ============================================================
   OpenBooth — SETTINGS view
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const U = OB.util;
  const { el, esc, toast, confirmDialog, copyText } = U;
  const t = window.t;

  const CURRENCIES = [
    { code: "TWD", symbol: "NT$" },
    { code: "JPY", symbol: "¥" },
    { code: "USD", symbol: "$" },
    { code: "KRW", symbol: "₩" },
    { code: "CNY", symbol: "¥" },
    { code: "HKD", symbol: "HK$" },
  ];
  const THEMES = [
    { group: "theme_basic" },
    { id: "warm", dots: ["#c46b43", "#faf6f0", "#6b5b95"] },
    { id: "sakura", dots: ["#e0688a", "#fdf3f5", "#8a6bc4"] },
    { id: "ocean", dots: ["#087f8c", "#eef8f8", "#356da8"] },
    { id: "mono", dots: ["#1c1c1a", "#f5f5f4", "#6e6e69"] },
    { id: "night", dots: ["#e08a5c", "#1b1916", "#a48fd6"] },
    // design themes (taste-driven set)
    { group: "theme_design" },
    { id: "koishi", dots: ["#b3704c", "#ece3d2", "#7d7363"] }, // warm tactile clay
    { id: "linen", dots: ["#a3564e", "#f0ece2", "#6d6385"] }, // warm editorial minimal
    { id: "graphite", dots: ["#4f9d80", "#17171a", "#7e8aa0"] }, // premium dark
    { id: "sage", dots: ["#5f7d68", "#e6e8df", "#6a7088"] }, // calm natural
    // v2 reference-driven bold-layout themes
    { id: "folio", dots: ["#2653e8", "#f2f4fa", "#14181f"] }, // blue/white portfolio editorial
    { id: "halftone", dots: ["#2244d4", "#dfe2e8", "#5a5f6a"] }, // swiss silver halftone
    { id: "zine", dots: ["#c81e56", "#e9ebee", "#2b58c8"] }, // ascii doujin zine
    { id: "spec", dots: ["#e84e14", "#f6f5f1", "#171715"] }, // industrial spec sheet
    { id: "pixel", dots: ["#f2e733", "#101014", "#4a4a55"] }, // signal black/yellow HUD
    { id: "meido", dots: ["#d9578b", "#fbeff1", "#8a6fb8"] }, // maid-café cute
    { id: "nothing", dots: ["#d71920", "#f3f2ef", "#1c1c1c"] }, // dot-matrix minimal
  ];

  function render(root) {
    const st = OB.store.get();
    const s = st.settings;
    const view = el("div", { class: "view active" });
    view.appendChild(OB.ui.header({ title: t("nav_settings"), onBack: () => OB.router.go("home") }));
    const main = el("main");

    // --- shop ---
    const shopName = OB.ui.input({ value: s.shopName });
    shopName.addEventListener("change", () => { s.shopName = shopName.value.trim() || "OpenBooth"; OB.store.commit(); });
    main.appendChild(OB.ui.field(t("shop_name"), shopName));

    // mascot
    const mascotWrap = el("div", { style: "display:flex;gap:10px;align-items:center" });
    function renderMascot() {
      mascotWrap.innerHTML = "";
      if (s.mascot) mascotWrap.appendChild(el("img", { src: s.mascot, style: "width:56px;height:56px;border-radius:12px;object-fit:contain;background:var(--surface-2)" }));
      mascotWrap.appendChild(el("button", { class: "mini-btn", text: t("pick_image"), onclick: pickMascot }));
      if (s.mascot) mascotWrap.appendChild(el("button", { class: "mini-btn", text: t("remove_image"), onclick: () => { s.mascot = null; OB.store.commit(); renderMascot(); } }));
    }
    async function pickMascot() {
      const f = await U.pickFile("image/*");
      if (!f) return;
      s.mascot = await U.fileToScaledDataURL(f, 256, 0.85);
      OB.store.commit();
      renderMascot();
    }
    renderMascot();
    main.appendChild(OB.ui.field(t("mascot_label"), mascotWrap));

    // currency + language row
    const curSel = el("select");
    CURRENCIES.forEach((c) => {
      const o = el("option", { value: c.code, text: c.code + " (" + c.symbol + ")" });
      if (c.code === s.currencyCode) o.selected = true;
      curSel.appendChild(o);
    });
    curSel.addEventListener("change", () => {
      const c = CURRENCIES.find((x) => x.code === curSel.value);
      s.currencyCode = c.code;
      s.currencySymbol = c.symbol;
      OB.store.commit();
      toast("✓");
    });

    const langSel = el("select");
    [["zh-Hant", "繁體中文"], ["ja", "日本語"], ["en", "English"], ["ko", "한국어"]].forEach(([v, label]) => {
      const o = el("option", { value: v, text: label });
      if (v === s.locale) o.selected = true;
      langSel.appendChild(o);
    });
    langSel.addEventListener("change", () => {
      s.locale = langSel.value;
      OB.i18n.setLocale(s.locale);
      OB.store.commit();
      OB.router.refresh();
    });
    // Language field: globe icon (line SVG, not emoji) + native word + the
    // universal English word "Language" so any visitor can recognise it.
    const langLabel = el("span", {}, [
      el("span", { html: OB.icon("globe", 14), style: "margin-right:4px;vertical-align:-2px;display:inline-block" }),
      document.createTextNode(t("language") + (OB.i18n.getLocale() === "en" ? "" : " · Language")),
    ]);
    main.appendChild(el("div", { class: "field-row" }, [OB.ui.field(t("currency"), curSel), OB.ui.field(langLabel, langSel)]));

    // theme
    const themeGrid = el("div", { class: "theme-grid" });
    THEMES.forEach((th) => {
      if (th.group) {
        themeGrid.appendChild(el("div", { class: "theme-group-label", text: t(th.group) }));
        return;
      }
      const dots = el("div", { class: "theme-dots" }, th.dots.map((c) => el("span", { style: "background:" + c })));
      themeGrid.appendChild(
        el("div", { class: "theme-swatch" + (s.theme === th.id ? " active" : ""), onclick: () => { s.theme = th.id; OB.store.commit(); document.documentElement.dataset.theme = th.id; OB.router.refresh(); } }, [dots, el("div", { text: th.id })])
      );
    });
    main.appendChild(OB.ui.field(t("theme"), themeGrid));

    // low stock
    const lowI = OB.ui.input({ type: "number", inputmode: "numeric", value: s.lowStockThreshold });
    lowI.addEventListener("change", () => { s.lowStockThreshold = Math.max(0, Math.round(Number(lowI.value)) || 0); OB.store.commit(); });
    main.appendChild(OB.ui.field(t("low_stock"), lowI));

    // toggles
    const togSec = el("section", { class: "section settings-list" });
    [["showStock", "show_stock"], ["enableCombos", "enable_combos"], ["requireCash", "require_cash"], ["showReceipt", "show_receipt"]].forEach(([key, label]) => {
      const item = el("div", { class: "settings-item" }, [el("span", { class: "si-label", text: t(label) })]);
      item.appendChild(OB.ui.toggle(s[key], (on) => { s[key] = on; OB.store.commit(); }));
      togSec.appendChild(item);
    });
    main.appendChild(togSec);

    // helper lock
    main.appendChild(el("h2", { class: "section-title", text: t("helper_lock") }));
    const helperSec = el("section", { class: "settings-list" });
    const pinInput = OB.ui.input({ type: "password", inputmode: "numeric", maxlength: "4", value: s.helperPin || "", placeholder: "0000" });
    pinInput.addEventListener("input", () => {
      pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    });
    helperSec.appendChild(OB.ui.field(t("helper_pin"), pinInput, t("helper_pin_hint")));
    const helperActions = el("div", { class: "actions", style: "margin-bottom:12px" }, [
      el("button", { class: "btn btn-primary", text: t("set_helper_pin"), onclick: savePin }),
      el("button", { class: "btn btn-secondary", text: t("clear_helper_pin"), onclick: clearPin }),
    ]);
    helperSec.appendChild(helperActions);
    helperSec.appendChild(el("button", { class: "btn btn-secondary btn-block", text: t("lock_now"), onclick: lockNow }));
    main.appendChild(helperSec);

    // --- pre-order notification template ---
    main.appendChild(el("h2", { class: "section-title", text: t("notify_template_setting") }));
    const tplArea = el("textarea", { rows: 3, placeholder: t("notify_template_default_hint"), style: "font-family:inherit" });
    tplArea.value = s.notifyTemplate || "";
    tplArea.addEventListener("change", () => { s.notifyTemplate = tplArea.value; OB.store.commit(); });
    main.appendChild(OB.ui.field(t("notify_template_setting"), tplArea, t("notify_template_hint")));
    main.appendChild(el("div", { style: "margin-top:-4px;margin-bottom:14px;display:flex;gap:8px" }, [
      el("button", { class: "mini-btn", text: t("preview"), onclick: () => {
        const sample = (s.notifyTemplate || "").trim() || t("notify_template", { items: "{items}", amount: "{amount}" });
        const filled = sample.replace(/\{items\}/g, t("notify_template_sample_items")).replace(/\{amount\}/g, OB.util.fmtMoney(120));
        OB.util.confirmDialog(filled, { yes: t("save"), no: t("cancel") });
      } }),
      el("button", { class: "mini-btn", text: t("reset_default"), onclick: () => { s.notifyTemplate = ""; OB.store.commit(); } }),
    ]));

    // --- receipt-engine (optional, only when the receipt module is loaded) ---
    if (window.OB && OB.receipt && typeof OB.receipt.openSettings === "function") {
      main.appendChild(el("h2", { class: "section-title", html: OB.icon("receipt", 15) + " " + esc(t("receipt_section")) }));
      const hasTpl = typeof OB.receipt.getTemplate === "function" && !!OB.receipt.getTemplate();
      const statusLine = el("div", { class: "field-hint", style: "color:" + (hasTpl ? "var(--success)" : "var(--text-muted)") + ";margin-bottom:8px",
        text: hasTpl ? t("receipt_template_loaded") : t("receipt_template_not_loaded") });
      main.appendChild(statusLine);
      const recSec = el("section", { class: "settings-list" });
      const recItem = el("div", { class: "settings-item", onclick: () => OB.receipt.openSettings() }, [
        el("span", { class: "si-label", text: t("receipt_settings_open") }),
        el("span", { class: "si-val", text: "→" }),
      ]);
      recSec.appendChild(recItem);
      main.appendChild(recSec);
      main.appendChild(el("div", { class: "field-hint", style: "margin-bottom:14px", text: t("receipt_hint") }));
    }

    // --- data backup ---
    main.appendChild(el("h2", { class: "section-title", text: t("data_backup") }));
    main.appendChild(el("div", { class: "gift-banner", style: "background:var(--accent-light);color:var(--accent-dark)", text: t("backup_reminder") }));
    const dataSec = el("section", { class: "settings-list" });
    function action(label, fn, danger) {
      const item = el("div", { class: "settings-item" + (danger ? " danger" : ""), onclick: fn }, [el("span", { class: "si-label", text: label }), el("span", { class: "si-val", text: "→" })]);
      dataSec.appendChild(item);
    }
    action(t("export_all"), exportAll);
    action(t("import_all"), importAll);
    action(t("export_share"), exportShare);
    action(t("share_link"), shareLink);
    action(t("load_demo"), loadDemo);
    action(t("clear_all"), clearAll, true);
    main.appendChild(dataSec);

    // about (no version string — keep this stable across releases)
    main.appendChild(el("h2", { class: "section-title", text: t("about") }));
    main.appendChild(
      el("div", { class: "update-log-box", style: "margin-bottom:24px" }, [
        el("div", {}, [el("b", { text: "OpenBooth" }), document.createTextNode(" · " + t("about_tagline"))]),
        el("div", { style: "margin-top:6px", text: t("about_privacy") }),
        el("a", { href: "https://github.com/mimito-6/openbooth", target: "_blank", rel: "noopener", style: "color:var(--accent);display:inline-block;margin-top:8px", text: "GitHub →" }),
      ])
    );

    view.appendChild(main);
    root.appendChild(view);

    // ---- data actions ----
    function exportAll() {
      U.downloadFile("openbooth-backup-" + OB.store.todayISO() + ".json", OB.store.exportAll(), "application/json");
      toast(t("exported"), "success");
    }
    async function importAll() {
      const f = await U.pickFile(".json,application/json");
      if (!f) return;
      try {
        const txt = await U.readFileText(f);
        const obj = JSON.parse(txt);
        if (obj.kind === "openbooth-preset") {
          OB.store.applyPreset(obj);
        } else {
          OB.store.importAll(obj);
        }
        toast(t("imported"), "success");
        OB.router.go("home");
      } catch (e) {
        toast(e.message, "danger");
      }
    }
    function exportShare() {
      U.downloadFile("openbooth-preset-" + OB.store.todayISO() + ".json", JSON.stringify(OB.store.exportPreset(), null, 2), "application/json");
      toast(t("exported"), "success");
    }
    function shareLink() {
      const code = OB.store.encodePreset(OB.store.exportPreset());
      const url = location.origin + location.pathname + "?config=" + code;
      if (url.length > 8000) {
        toast(t("preset_too_large"), "danger");
        return;
      }
      copyText(url).then(() => toast(t("link_copied"), "success"));
    }
    function loadDemo() {
      confirmDialog(t("load_demo") + "?").then((ok) => {
        if (!ok) return;
        OB.store.loadDemo();
        toast("✓", "success");
        OB.router.go("home");
      });
    }
    function savePin() {
      const pin = pinInput.value.trim();
      if (!/^\d{4}$/.test(pin)) {
        toast(t("pin_must_be_4_digits"), "danger");
        return;
      }
      s.helperPin = pin;
      OB.store.commit();
      toast(t("pin_saved"), "success");
    }
    function clearPin() {
      s.helperPin = "";
      OB.store.setLocked(false);
      OB.store.commit();
      pinInput.value = "";
      toast(t("pin_cleared"), "success");
    }
    function lockNow() {
      if (!s.helperPin) {
        toast(t("lock_requires_pin"), "danger");
        return;
      }
      OB.store.setLocked(true);
      toast(t("locked"), "success");
      OB.router.go("front");
    }
    function clearAll() {
      confirmDialog(t("confirm_clear"), { danger: true }).then((ok) => {
        if (!ok) return;
        confirmDialog(t("confirm_clear2"), { danger: true }).then((ok2) => {
          if (!ok2) return;
          OB.store.clearAll();
          toast(t("cleared"));
          OB.router.go("home");
        });
      });
    }
  }

  OB.router.register("settings", render);
})();

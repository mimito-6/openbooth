/* ============================================================
   OpenBooth — App bootstrap
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  OB.app = OB.app || {};
  const CACHE_NAME = "openbooth-v25";

  // ---- customer-facing display ----
  let cfd = null;
  function ensureCfd() {
    if (cfd) return cfd;
    cfd = OB.util.el("div", { class: "cfd" }, [
      OB.util.el("button", { class: "cfd-close", html: "×", onclick: hideCustomerDisplay }),
      OB.util.el("div", { class: "cfd-label", text: OB.i18n.t("total_due") }),
      OB.util.el("div", { class: "cfd-amount", id: "cfdAmount" }),
      OB.util.el("img", { class: "cfd-qr hidden", id: "cfdQr", alt: OB.i18n.t("qr_alt") }),
    ]);
    document.body.appendChild(cfd);
    return cfd;
  }
  function showCustomerDisplay(amount, qr) {
    ensureCfd();
    document.getElementById("cfdAmount").textContent = OB.util.fmtMoney(amount);
    const q = document.getElementById("cfdQr");
    if (qr) {
      q.src = qr;
      q.classList.remove("hidden");
    } else {
      q.classList.add("hidden");
    }
    cfd.querySelector(".cfd-label").textContent = OB.i18n.t("total_due");
    cfd.classList.add("show");
  }
  function hideCustomerDisplay() {
    if (cfd) cfd.classList.remove("show");
  }

  function unlockHelper() {
    const pin = prompt(OB.i18n.t("unlock_prompt"));
    if (pin == null) return false;
    if (OB.store.unlockWithPin(pin)) {
      OB.util.toast(OB.i18n.t("unlocked"), "success");
      OB.router.refresh();
      return true;
    }
    OB.util.toast(OB.i18n.t("wrong_pin"), "danger");
    return false;
  }

  // ---- offline readiness ----
  function checkOfflineReady() {
    return new Promise((resolve) => {
      if (location.protocol === "file:") return resolve(true);
      if (!("caches" in window)) return resolve(false);
      caches.has(CACHE_NAME).then((has) => resolve(has && !!navigator.serviceWorker && !!navigator.serviceWorker.controller)).catch(() => resolve(false));
    });
  }

  // ---- share link import (?config=) ----
  function handleShareLink() {
    const params = new URLSearchParams(location.search);
    const code = params.get("config");
    if (!code) return Promise.resolve(false);
    try {
      const preset = OB.store.decodePreset(code);
      return OB.util
        .confirmDialog(OB.i18n.t("confirm_import_preset", { name: preset.meta && preset.meta.name ? preset.meta.name : "?" }))
        .then((ok) => {
          if (ok) {
            OB.store.applyPreset(preset);
            OB.util.toast(OB.i18n.t("imported"), "success");
          }
          history.replaceState(null, "", location.pathname);
          return ok;
        });
    } catch (e) {
      OB.util.toast(OB.i18n.t("share_link_invalid"), "danger");
      return Promise.resolve(false);
    }
  }

  // ---- service worker ----
  function registerSW() {
    if (location.protocol === "file:") return;
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW register failed", e));
    });
  }

  function applyChrome() {
    const s = OB.store.get().settings;
    document.documentElement.dataset.theme = s.theme || "warm";
    document.documentElement.lang = s.locale === "ja" ? "ja" : s.locale === "en" ? "en" : s.locale === "ko" ? "ko" : "zh-Hant";
    OB.i18n.setLocale(s.locale);
    // keep the browser/status-bar chrome in sync with the active theme
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (bg && meta) meta.setAttribute("content", bg);
  }

  function init() {
    OB.store.load();
    // first-run locale detect (only if never set explicitly is hard to know; keep stored)
    applyChrome();

    // re-render current view on any data change
    OB.store.subscribe(() => {
      applyChrome();
      OB.router.refresh();
    });

    registerSW();

    handleShareLink().then(() => {
      // initial route from hash
      const h = (location.hash || "").replace(/^#\//, "");
      OB.router.go(h && h !== "home" ? h : "home", {}, { replace: true });
    });
  }

  OB.app.checkOfflineReady = checkOfflineReady;
  OB.app.showCustomerDisplay = showCustomerDisplay;
  OB.app.hideCustomerDisplay = hideCustomerDisplay;
  OB.app.unlockHelper = unlockHelper;
  OB.app.init = init;
  OB.app.CACHE_NAME = CACHE_NAME;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

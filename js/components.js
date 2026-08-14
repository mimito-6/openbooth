/* ============================================================
   OpenBooth — Shared UI components
   ============================================================ */
(function () {
  window.OB = window.OB || {};
  const { el } = OB.util;
  const t = window.t;

  function header(opts) {
    opts = opts || {};
    const left = el("div", { class: "header-left" });
    if (opts.onBack) {
      left.appendChild(el("button", { class: "back-btn", "aria-label": t("back"), html: "‹", onclick: opts.onBack }));
    }
    const titleWrap = el("div", { style: "min-width:0" }, [el("div", { class: "title", text: opts.title || "" })]);
    if (opts.subtitle) titleWrap.appendChild(el("div", { class: "subtitle", text: opts.subtitle }));
    left.appendChild(titleWrap);

    const top = el("div", { class: "header-top" }, [left]);
    if (opts.right) {
      const r = el("div", { style: "display:flex;gap:6px;align-items:center" });
      (Array.isArray(opts.right) ? opts.right : [opts.right]).forEach((b) => {
        if (!b) return;
        r.appendChild(el("button", { class: "icon-btn", "aria-label": b.label || "", html: b.icon, onclick: b.onClick }));
      });
      top.appendChild(r);
    }
    const h = el("header", { class: "header" }, [top]);
    if (opts.belowNode) h.appendChild(opts.belowNode);
    return h;
  }

  function statsRow(stats) {
    const row = el("div", { class: "stats" });
    stats.forEach((s) => {
      row.appendChild(
        el("div", { class: "stat" }, [
          el("div", { class: "stat-label", text: s.label }),
          el("div", { class: "stat-value " + (s.small ? "small" : ""), html: s.value + (s.unit ? ' <span class="unit">' + OB.util.esc(s.unit) + "</span>" : "") }),
        ])
      );
    });
    return row;
  }

  function emptyState(icon, text) {
    // Accepts an OB.icon name ("box","search",...); legacy emoji args are
    // mapped so old callers keep working. Renders a line-SVG, never an emoji.
    const legacy = { "\u{1F4E6}": "box", "\u{1F4CB}": "clipboard", "\u{1F9FE}": "receipt", "\u{1F50D}": "search" };
    const name = legacy[icon] || icon || "box";
    const svg = window.OB && OB.icon ? OB.icon(name, 38) : "";
    const iconNode = svg && svg.indexOf("<svg") === 0
      ? el("span", { class: "emoji", html: svg })
      : el("span", { class: "emoji", text: icon || "" });
    return el("div", { class: "empty-state" }, [iconNode, el("div", { text: text || "" })]);
  }

  // Bottom sheet. Returns { root, body, footer, close }
  function sheet(opts) {
    opts = opts || {};
    // keepOnRefresh: survive a store-commit re-render (see router.cleanTransient).
    // Use it for any sheet that saves while staying open.
    const keep = opts.keepOnRefresh ? " boo-keep" : "";
    const overlay = el("div", { class: "sheet-overlay boo-transient open" + keep });
    const sheetEl = el("div", { class: "sheet boo-transient " + (opts.tall ? "tall" : "") + keep });
    const body = el("div", { class: "sheet-body" });
    const footer = el("div", { class: "sheet-footer" });

    function close() {
      overlay.classList.remove("open");
      sheetEl.classList.remove("open");
      setTimeout(() => {
        overlay.remove();
        sheetEl.remove();
      }, 280);
      if (opts.onClose) opts.onClose();
    }

    const head = el("div", { class: "sheet-header" }, [
      el("div", { class: "sheet-title", text: opts.title || "" }),
      el("button", { class: "sheet-close", html: "×", onclick: close }),
    ]);
    sheetEl.appendChild(el("div", { class: "sheet-handle" }));
    sheetEl.appendChild(head);
    sheetEl.appendChild(body);
    if (opts.footer !== false) sheetEl.appendChild(footer);
    overlay.addEventListener("click", close);

    document.body.appendChild(overlay);
    document.body.appendChild(sheetEl);
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      sheetEl.classList.add("open");
    });
    return { root: sheetEl, body, footer, close };
  }

  function field(labelText, inputNode, hint) {
    // labelText may be a string or a prepared Node (e.g. icon + text)
    const label = el("label");
    if (labelText && labelText.nodeType) label.appendChild(labelText);
    else label.textContent = labelText || "";
    const f = el("div", { class: "field" }, [label, inputNode]);
    if (hint) f.appendChild(el("div", { class: "field-hint", text: hint }));
    return f;
  }
  function input(attrs) {
    return el("input", Object.assign({ type: "text" }, attrs || {}));
  }
  function toggle(on, onChange) {
    const tg = el("div", { class: "toggle " + (on ? "on" : "") });
    tg.addEventListener("click", () => {
      const next = !tg.classList.contains("on");
      tg.classList.toggle("on", next);
      onChange(next);
    });
    return tg;
  }

  /* ------------------------------------------------------------------
     Square image cropper. Product thumbs are square and object-fit:cover,
     so without this the browser silently decides which part of a photo
     survives — usually the middle, which is rarely where the product is.
     Drag to pan, slider to zoom. Resolves to a square dataURL, or null
     if cancelled.
     ------------------------------------------------------------------ */
  function cropImage(src, opts) {
    opts = opts || {};
    const OUT = opts.out || 480; // stored size — kept small, this goes in localStorage
    return new Promise((resolve) => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const sh = sheet({ title: opts.title || t("crop_title") });
        let settled = false;
        const done = (v) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        // closing by any route (× / backdrop) counts as cancel
        const origClose = sh.close;

        const VW = 280; // viewport is square; CSS keeps it responsive
        const viewport = el("div", {
          class: "crop-viewport",
          style: "width:100%;max-width:" + VW + "px;aspect-ratio:1/1;margin:0 auto;position:relative;overflow:hidden;border-radius:var(--r-md,12px);background:var(--surface-2);touch-action:none;cursor:grab",
        });
        const layer = el("img", {
          src: src,
          alt: "",
          draggable: "false",
          style: "position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;user-select:none;-webkit-user-drag:none",
        });
        viewport.appendChild(layer);

        // grid overlay so the framing is easy to judge
        viewport.appendChild(
          el("div", {
            style:
              "position:absolute;inset:0;pointer-events:none;" +
              "background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);" +
              "background-size:33.33% 33.33%;opacity:.55",
          })
        );

        const nw = img.naturalWidth || 1;
        const nh = img.naturalHeight || 1;
        let box = VW; // actual rendered viewport size, measured after layout
        let zoom = 1;
        let tx = 0;
        let ty = 0;

        function baseScale() {
          return Math.max(box / nw, box / nh); // cover
        }
        function scale() {
          return baseScale() * zoom;
        }
        function clamp() {
          const dw = nw * scale();
          const dh = nh * scale();
          tx = Math.min(0, Math.max(box - dw, tx));
          ty = Math.min(0, Math.max(box - dh, ty));
        }
        function paint() {
          clamp();
          layer.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale() + ")";
          layer.style.width = nw + "px";
          layer.style.height = nh + "px";
        }
        function centre() {
          const dw = nw * scale();
          const dh = nh * scale();
          tx = (box - dw) / 2;
          ty = (box - dh) / 2;
          paint();
        }

        // drag to pan
        let dragging = false;
        let sx = 0;
        let sy = 0;
        viewport.addEventListener("pointerdown", (e) => {
          dragging = true;
          sx = e.clientX - tx;
          sy = e.clientY - ty;
          viewport.setPointerCapture(e.pointerId);
          viewport.style.cursor = "grabbing";
        });
        viewport.addEventListener("pointermove", (e) => {
          if (!dragging) return;
          e.preventDefault();
          tx = e.clientX - sx;
          ty = e.clientY - sy;
          paint();
        });
        function endDrag(e) {
          if (!dragging) return;
          dragging = false;
          viewport.style.cursor = "grab";
          try {
            viewport.releasePointerCapture(e.pointerId);
          } catch (err) {}
        }
        viewport.addEventListener("pointerup", endDrag);
        viewport.addEventListener("pointercancel", endDrag);

        // zoom, anchored on the viewport centre so the framing does not jump
        const zoomI = el("input", { type: "range", min: "100", max: "300", value: "100", style: "width:100%" });
        zoomI.addEventListener("input", () => {
          const prev = scale();
          zoom = Number(zoomI.value) / 100;
          const next = scale();
          const cx = box / 2;
          const cy = box / 2;
          tx = cx - ((cx - tx) / prev) * next;
          ty = cy - ((cy - ty) / prev) * next;
          paint();
        });

        sh.body.appendChild(viewport);
        sh.body.appendChild(el("div", { class: "field-hint", style: "text-align:center;margin-top:8px", text: t("crop_hint") }));
        sh.body.appendChild(el("div", { style: "margin-top:10px" }, [el("label", { class: "field-hint", text: t("crop_zoom") }), zoomI]));

        sh.footer.appendChild(
          el("div", { class: "actions" }, [
            el("button", { class: "btn btn-secondary", text: t("cancel"), onclick: () => { done(null); origClose(); } }),
            el("button", {
              class: "btn btn-primary",
              text: t("save"),
              onclick: () => {
                const canvas = el("canvas");
                canvas.width = OUT;
                canvas.height = OUT;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, OUT, OUT);
                const s = scale();
                // viewport rect expressed in source pixels
                ctx.drawImage(img, -tx / s, -ty / s, box / s, box / s, 0, 0, OUT, OUT);
                done(canvas.toDataURL("image/jpeg", 0.85));
                origClose();
              },
            }),
          ])
        );
        sh.close = () => { done(null); origClose(); };

        // measure once laid out, then frame the image centred
        requestAnimationFrame(() => {
          box = viewport.clientWidth || VW;
          centre();
        });
      };
      img.src = src;
    });
  }

  OB.ui = { header, statsRow, emptyState, sheet, field, input, toggle, cropImage };
})();

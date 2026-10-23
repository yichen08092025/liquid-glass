/* ============================================================
   Liquid Glass — optical refraction runtime (Chromium only)
   ------------------------------------------------------------
   For every .lg-refract element, generate a rounded-rect lens
   displacement map that matches the element's size and radius,
   install an SVG filter, and point --lg-refraction at it.

   Usage:
     <link rel="stylesheet" href="liquid-glass.css">
     <script src="liquid-glass.js"></script>
     <div class="lg-glass lg-refract" data-lg-bezel="16" data-lg-disp="22">…

   API:
     LiquidGlass.supported            // boolean
     LiquidGlass.init(root)           // observe + build (auto on load)
     LiquidGlass.refresh(el?)         // rebuild after size/radius change
     LiquidGlass.setEnabled(false)    // turn refraction off (CSS fallback stays)
     LiquidGlass.destroy()

   No-ops silently on Safari/Firefox: the CSS frosted tier remains.
   ============================================================ */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const XLINK = "http://www.w3.org/1999/xlink";
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- engine detection ---------- */
  const ua = navigator.userAgent;
  const isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua);
  let supported = false;
  try {
    supported =
      isChromium &&
      (CSS.supports("backdrop-filter", "url(#lg-probe)") ||
        CSS.supports("-webkit-backdrop-filter", "url(#lg-probe)"));
  } catch (_) {
    supported = false;
  }

  const NEUTRAL = 128;

  /* ---------- displacement map ---------- */
  function sdRoundRect(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r);
    const qy = Math.abs(py) - (hh - r);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      r
    );
  }

  // Convex squircle falloff: strongest at the edge, smooth to zero at the
  // inner end of the bezel.
  function profile(u) {
    const s = 1 - u;
    return s * s * (3 - 2 * s);
  }

  function buildMap(w, h, radius, bezel, maxDisp) {
    const W = Math.max(2, Math.round(w));
    const H = Math.max(2, Math.round(h));
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(W, H);
    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = NEUTRAL;
      data[i + 1] = NEUTRAL;
      data[i + 2] = NEUTRAL;
      data[i + 3] = 255;
    }

    const hw = w / 2;
    const hh = h / 2;
    const sd = (x, y) => sdRoundRect(x - hw, y - hh, hw, hh, radius);
    const eps = 1;

    for (let y = 0; y < H; y++) {
      const py = y + 0.5;
      for (let x = 0; x < W; x++) {
        const px = x + 0.5;
        const depth = -sd(px, py);
        if (depth <= 0 || depth >= bezel) continue;

        const magnitude = profile(depth / bezel);
        if (magnitude < 0.004) continue;

        const gx = (sd(px + eps, py) - sd(px - eps, py)) / (2 * eps);
        const gy = (sd(px, py + eps) - sd(px, py - eps)) / (2 * eps);
        const len = Math.hypot(gx, gy) || 1;
        const nx = -gx / len;
        const ny = -gy / len;

        const i = (y * W + x) * 4;
        data[i] = clamp(NEUTRAL + nx * magnitude * 127, 0, 255);
        data[i + 1] = clamp(NEUTRAL + ny * magnitude * 127, 0, 255);
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /* ---------- SVG + filter cache ---------- */
  let svg = null;
  let uid = 0;
  const filterCache = new Map();
  let applied = new WeakMap();
  let observed = new WeakSet();
  const pending = new Set();
  let flushScheduled = false;
  let observer = null;

  function ensureSvg() {
    if (svg) return svg;
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;";
    document.body.appendChild(svg);
    return svg;
  }

  function createFilter(w, h, radius, bezel, maxDisp) {
    const W = Math.round(w);
    const H = Math.round(h);
    const id = "lg-filter-" + ++uid;
    const mapUrl = buildMap(W, H, radius, bezel, maxDisp);

    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(W));
    filter.setAttribute("height", String(H));
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const feImage = document.createElementNS(NS, "feImage");
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    feImage.setAttribute("width", String(W));
    feImage.setAttribute("height", String(H));
    feImage.setAttribute("preserveAspectRatio", "none");
    feImage.setAttribute("result", "map");
    feImage.setAttribute("href", mapUrl);
    feImage.setAttributeNS(XLINK, "xlink:href", mapUrl);

    const displacement = document.createElementNS(NS, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "map");
    // feDisplacementMap's max shift is scale/2 (channels map to [-0.5, 0.5]).
    displacement.setAttribute("scale", String(maxDisp * 2));
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");

    filter.appendChild(feImage);
    filter.appendChild(displacement);
    ensureSvg().appendChild(filter);
    return { id };
  }

  function apply(el) {
    if (!supported) return;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 10 || h < 10) return;

    const cs = getComputedStyle(el);
    const radius = Math.min(
      parseFloat(cs.borderTopLeftRadius) || 0,
      Math.min(w, h) / 2
    );
    const autoBezel = clamp(Math.min(w, h) * 0.05, 8, 20);
    const bezel = clamp(Number(el.dataset.lgBezel) || autoBezel, 6, 30);
    const maxDisp = clamp(Number(el.dataset.lgDisp) || bezel * 1.2, 4, 44);

    const key = `${Math.round(w)}x${Math.round(h)}:${Math.round(radius)}:${Math.round(bezel)}:${Math.round(maxDisp)}`;
    if (applied.get(el) === key) return;

    let entry = filterCache.get(key);
    if (!entry) {
      entry = createFilter(w, h, radius, bezel, maxDisp);
      filterCache.set(key, entry);
    }
    el.style.setProperty("--lg-refraction", `url(#${entry.id})`);
    el.classList.add("lg-refract");
    applied.set(el, key);
  }

  function schedule(el) {
    pending.add(el);
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      const list = [...pending];
      pending.clear();
      for (const el of list) {
        try {
          apply(el);
        } catch (error) {
          console.warn("liquid-glass: filter build failed", error);
        }
      }
    });
  }

  function init(root = document) {
    if (!supported) {
      document.documentElement.classList.add("lg-no-refract");
      return;
    }
    if (!observer) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) schedule(entry.target);
      });
    }
    const elements = root.querySelectorAll(".lg-refract");
    for (const el of elements) {
      el.classList.add("lg-refract");
      if (observed.has(el)) continue;
      observed.add(el);
      observer.observe(el);
      schedule(el);
    }
  }

  function refresh(target) {
    if (!supported) return;
    if (target) {
      schedule(target);
      return;
    }
    const elements = document.querySelectorAll(".lg-refract");
    for (const el of elements) schedule(el);
  }

  function setEnabled(on) {
    document.documentElement.classList.toggle("lg-no-refract", !on);
  }

  function destroy() {
    observer?.disconnect();
    observer = null;
    filterCache.clear();
    pending.clear();
    svg?.remove();
    svg = null;
    applied = new WeakMap();
    observed = new WeakSet();
    document.querySelectorAll(".lg-refract").forEach((el) => {
      el.style.removeProperty("--lg-refraction");
    });
  }

  window.LiquidGlass = { supported, init, refresh, setEnabled, destroy };

  if (supported) {
    if (document.readyState === "complete") {
      requestAnimationFrame(() => init());
    } else {
      window.addEventListener("load", () => requestAnimationFrame(() => init()), { once: true });
    }
  } else {
    document.documentElement.classList.add("lg-no-refract");
  }
})();

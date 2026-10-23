/* ============================================================
   Liquid Glass runtime
   - 为每个玻璃元素生成一张「圆角矩形透镜」位移贴图（SVG feImage）
   - 通过 backdrop-filter: url(#filter) 让边缘产生折射（Chromium only）
   - 不支持时静默降级为纯 CSS 磨砂玻璃
   ============================================================ */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const XLINK = "http://www.w3.org/1999/xlink";
  const root = document.documentElement;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- 能力检测 ---------- */
  const ua = navigator.userAgent;
  const isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua);
  let supportsRefraction = false;
  try {
    supportsRefraction =
      isChromium &&
      (CSS.supports("backdrop-filter", "url(#lg-probe)") ||
        CSS.supports("-webkit-backdrop-filter", "url(#lg-probe)"));
  } catch (_) {
    supportsRefraction = false;
  }

  /* ---------- 位移贴图 ---------- */
  const NEUTRAL = 128;

  // 圆角矩形有符号距离场（内部为负）
  function sdRoundRect(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r);
    const qy = Math.abs(py) - (hh - r);
    const ax = Math.max(qx, 0);
    const ay = Math.max(qy, 0);
    return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
  }

  // 凸面 squircle 的位移衰减：边缘最强，到镜片内缘平滑归零
  function profile(u) {
    const s = 1 - u;
    return s * s * (3 - 2 * s);
  }

  function buildDisplacementMap(w, h, radius, bezel, maxDisp) {
    const W = Math.max(2, Math.round(w));
    const H = Math.max(2, Math.round(h));
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(W, H);
    const data = image.data;

    // 默认中性（无位移）
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
        const depth = -sd(px, py); // 到边界的内侧距离
        if (depth <= 0 || depth >= bezel) continue;
        const u = depth / bezel;
        const magnitude = profile(u);
        if (magnitude < 0.004) continue;

        // 外法线 = SDF 梯度，指向内部取反
        const gx = (sd(px + eps, py) - sd(px - eps, py)) / (2 * eps);
        const gy = (sd(px, py + eps) - sd(px, py - eps)) / (2 * eps);
        const len = Math.hypot(gx, gy) || 1;
        const nx = -gx / len;
        const ny = -gy / len;

        const vx = nx * magnitude;
        const vy = ny * magnitude;
        const i = (y * W + x) * 4;
        data[i] = clamp(NEUTRAL + vx * 127, 0, 255);
        data[i + 1] = clamp(NEUTRAL + vy * 127, 0, 255);
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /* ---------- SVG 容器与滤镜 ---------- */
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;";
  document.body.appendChild(svg);

  let uid = 0;
  const filterCache = new Map();

  function createFilter(w, h, radius, bezel, maxDisp) {
    const W = Math.round(w);
    const H = Math.round(h);
    const id = "lg-filter-" + ++uid;
    const mapUrl = buildDisplacementMap(W, H, radius, bezel, maxDisp);

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
    // feDisplacementMap 的最大位移只有 scale 的一半：通道映射到 [-0.5, 0.5]
    displacement.setAttribute("scale", String(maxDisp * 2));
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");

    filter.appendChild(feImage);
    filter.appendChild(displacement);
    svg.appendChild(filter);

    return { id, mapUrl, filter };
  }

  const applied = new WeakMap();
  const pending = new Set();
  let flushScheduled = false;

  // 真正的刷新逻辑（带缓存）
  function apply(el) {
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 10 || h < 10) return;

    const cs = getComputedStyle(el);
    const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, Math.min(w, h) / 2);
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

  function scheduleApply(el) {
    pending.add(el);
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      const list = [...pending];
      pending.clear();
      for (const item of list) {
        try {
          apply(item);
        } catch (err) {
          console.warn("liquid-glass: filter failed", err);
        }
      }
    });
  }

  /* ---------- 初始化 ---------- */
  const glassEls = [...document.querySelectorAll(".lg-refract")];
  let resizeObserver = null;

  function enableRefraction() {
    if (!supportsRefraction) {
      root.classList.add("lg-no-refract");
      glassEls.forEach((el) => el.classList.remove("lg-refract"));
      return;
    }
    root.classList.remove("lg-no-refract");
    glassEls.forEach((el) => el.classList.add("lg-refract"));

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) scheduleApply(entry.target);
      });
    }
    glassEls.forEach((el) => {
      resizeObserver.observe(el);
      scheduleApply(el);
    });
  }

  /* ---------- 控件 ---------- */
  const themeButtons = [...document.querySelectorAll("[data-theme-btn]")];
  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      root.dataset.theme = btn.dataset.themeBtn;
      themeButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
    });
  });

  const hero = document.getElementById("hero");
  const materialButtons = [...document.querySelectorAll("[data-material-btn]")];
  materialButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.materialBtn;
      hero.classList.remove("lg-material--clear", "lg-material--tinted");
      if (value === "clear") hero.classList.add("lg-material--clear");
      if (value === "tinted") hero.classList.add("lg-material--tinted");
      materialButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
    });
  });

  const refractToggle = document.getElementById("refractToggle");
  const refractDesc = document.getElementById("refractDesc");
  const supportNote = document.getElementById("supportNote");

  let reduceTransparency = false;
  let refractOn = supportsRefraction;

  function syncRefractionClass() {
    const off = !refractOn || reduceTransparency;
    root.classList.toggle("lg-no-refract", off);
  }

  if (!supportsRefraction) {
    refractToggle.checked = false;
    refractToggle.disabled = true;
    if (refractDesc) refractDesc.textContent = "当前浏览器不支持 SVG 折射（Chromium 专属）";
    if (supportNote) {
      supportNote.textContent =
        "当前浏览器已自动降级为 CSS 磨砂玻璃。用 Chrome 或 Edge 打开可以看到边缘折射。";
    }
  }
  refractToggle?.addEventListener("change", () => {
    refractOn = refractToggle.checked;
    syncRefractionClass();
  });

  const transparencyToggle = document.getElementById("transparencyToggle");
  transparencyToggle?.addEventListener("change", () => {
    reduceTransparency = transparencyToggle.checked;
    root.classList.toggle("lg-reduced-transparency", reduceTransparency);
    syncRefractionClass();
  });

  function bindRange(input, output, formatValue) {
    if (!input) return;
    const update = () => {
      const percent = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty("--fill", percent + "%");
      if (output) output.textContent = formatValue(input.value);
    };
    input.addEventListener("input", update);
    update();
  }

  bindRange(
    document.getElementById("blurRange"),
    document.getElementById("blurOut"),
    (v) => `${v}px`
  );
  bindRange(
    document.getElementById("satRange"),
    document.getElementById("satOut"),
    (v) => `${v}%`
  );

  const blurRange = document.getElementById("blurRange");
  blurRange?.addEventListener("input", () => {
    root.style.setProperty("--lg-blur", `${blurRange.value}px`);
  });

  const satRange = document.getElementById("satRange");
  satRange?.addEventListener("input", () => {
    root.style.setProperty("--lg-sat", `${satRange.value}%`);
  });

  /* ---------- 菜单 ---------- */
  const menu = document.getElementById("menu");
  const menuBtn = document.getElementById("menuBtn");

  function openMenu() {
    if (!menu || !menuBtn) return;
    const rect = menuBtn.getBoundingClientRect();
    menu.style.top = `${Math.round(rect.bottom + 12)}px`;
    menu.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
    menu.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    menuBtn?.setAttribute("aria-expanded", "false");
  }
  menuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu?.hidden) openMenu();
    else closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (!menu || menu.hidden) return;
    if (menu.contains(event.target) || menuBtn?.contains(event.target)) return;
    closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  /* ---------- 指针高光 ---------- */
  let sheenRaf = 0;
  let lastPointer = null;
  let lastSheenEl = null;

  document.addEventListener(
    "pointermove",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(".lg-glass") : null;
      if (!target) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      lastSheenEl = target;
      if (sheenRaf) return;
      sheenRaf = requestAnimationFrame(() => {
        sheenRaf = 0;
        if (!lastPointer || !lastSheenEl) return;
        const rect = lastSheenEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const mx = ((lastPointer.x - rect.left) / rect.width) * 100;
        const my = ((lastPointer.y - rect.top) / rect.height) * 100;
        lastSheenEl.style.setProperty("--lg-mx", `${mx.toFixed(1)}%`);
        lastSheenEl.style.setProperty("--lg-my", `${my.toFixed(1)}%`);
      });
    },
    { passive: true }
  );

  /* ---------- 玻璃球拖动 ---------- */
  const lens = document.getElementById("lens");
  let drag = null;

  if (lens) {
    lens.addEventListener("pointerdown", (event) => {
      const rect = lens.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      };
      lens.setPointerCapture(event.pointerId);
      lens.style.left = `${rect.left}px`;
      lens.style.top = `${rect.top}px`;
      lens.style.bottom = "auto";
      lens.classList.add("is-dragging");
      event.preventDefault();
    });

    lens.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const x = clamp(event.clientX - drag.dx, 6, window.innerWidth - drag.w - 6);
      const y = clamp(event.clientY - drag.dy, 6, window.innerHeight - drag.h - 6);
      lens.style.left = `${x}px`;
      lens.style.top = `${y}px`;
    });

    const endDrag = (event) => {
      if (drag && event.pointerId !== drag.id) return;
      drag = null;
      lens.classList.remove("is-dragging");
    };
    lens.addEventListener("pointerup", endDrag);
    lens.addEventListener("pointercancel", endDrag);

    lens.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 42 : 14;
      const rect = lens.getBoundingClientRect();
      let x = rect.left;
      let y = rect.top;
      if (event.key === "ArrowLeft") x -= step;
      else if (event.key === "ArrowRight") x += step;
      else if (event.key === "ArrowUp") y -= step;
      else if (event.key === "ArrowDown") y += step;
      else return;
      event.preventDefault();
      lens.style.left = `${clamp(x, 6, window.innerWidth - rect.width - 6)}px`;
      lens.style.top = `${clamp(y, 6, window.innerHeight - rect.height - 6)}px`;
      lens.style.bottom = "auto";
    });
  }

  /* ---------- 小交互 ---------- */
  const dockItems = [...document.querySelectorAll(".dock__item")];
  dockItems.forEach((item) => {
    item.addEventListener("click", () => {
      dockItems.forEach((other) => {
        other.classList.toggle("is-active", other === item);
        if (other === item) other.setAttribute("aria-current", "page");
        else other.removeAttribute("aria-current");
      });
    });
  });

  const playBtn = document.getElementById("playBtn");
  const playIcon = document.getElementById("playIcon");
  let playing = false;
  playBtn?.addEventListener("click", () => {
    playing = !playing;
    if (playIcon) {
      playIcon.innerHTML = playing
        ? '<path d="M8 5.5h3v13H8zM13 5.5h3v13h-3z"/>'
        : '<path d="M9 6.5v11l9-5.5z"/>';
    }
    playBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
  });

  document.getElementById("ctaPrimary")?.addEventListener("click", () => {
    document.getElementById("materials")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("ctaSecondary")?.addEventListener("click", () => {
    document.getElementById("notes")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const navLinks = [...document.querySelectorAll(".nav__links a")];
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((other) => other.classList.toggle("is-active", other === link));
    });
  });

  // 窗口尺寸变化时，修正被拖到边缘外的玻璃球
  window.addEventListener("resize", () => {
    if (!lens) return;
    const rect = lens.getBoundingClientRect();
    if (rect.left + rect.width > window.innerWidth || rect.top + rect.height > window.innerHeight) {
      lens.style.left = `${clamp(rect.left, 6, window.innerWidth - rect.width - 6)}px`;
      lens.style.top = `${clamp(rect.top, 6, window.innerHeight - rect.height - 6)}px`;
      lens.style.bottom = "auto";
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    if (supportsRefraction) {
      enableRefraction();
    } else {
      enableRefraction(); // 内部会统一关闭
    }
    syncRefractionClass();
  }

  if (document.readyState === "complete") {
    requestAnimationFrame(boot);
  } else {
    window.addEventListener("load", () => requestAnimationFrame(boot), { once: true });
  }
})();

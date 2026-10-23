---
name: liquid-glass
description: 'Apple Liquid Glass materials for the web (液态玻璃 / liquid glass) — build or convert navigation bars, toolbars, tab bars, docks, popovers, sheets, glass buttons, segmented controls, switches and floating panels into translucent glass with specular rims, light/dark/clear/tinted variants, Chromium-only SVG edge refraction, Safari/Firefox fallback and accessibility fallbacks. Use when asked to make glass, frosted, glassmorphism, iOS 26/27-style "liquid glass" UI, or to restyle an existing app with translucent materials.'
---

# Liquid Glass

Apple's Liquid Glass, rebuilt for the web. It is **not** one blur value: the look comes from a
material stack (blur + saturation + luminosity + a thin specular **rim** + a soft shadow), and,
on Chromium only, a real **refraction** pass that bends the background at the glass edge.

This skill ships the material, a runtime, component primitives and a worked **lab**. Two tiers,
shipped together and degrading silently:

| tier | what | tech | engines |
| --- | --- | --- | --- |
| **tier 1 — frosted glass** | blur, saturation, brightness, rim, shadow, variants | CSS `backdrop-filter` | all modern |
| **tier 2 — refraction** | the edge bends/shifts background content | SVG `feDisplacementMap` via `backdrop-filter: url(#…)` | Chromium only |

Tier 2 is an enhancement. Layout, contrast and identity must survive with tier 1 alone.

## Material rules

- **Chrome, not content.** Apple puts Liquid Glass on the functional layer (navigation, toolbars,
  tab bars, docks, popovers, sheets, floating controls). Lists, articles, tables and form bodies
  stay on standard materials. When in doubt, glass the *container* or the *trigger*, not the rows.
- **Two variants.** `regular` (default, readable over anything) and `clear` (highly translucent,
  only over rich media). A brand color is a **tint** on top, not a third variant.
- **Glass needs something behind it.** Over a flat solid background it reads as frosted chrome and
  the refraction is invisible. Put it over photography, a wallpaper, scrolling content, or a
  background with tonal variation. If the app is flat, add subtle depth or accept the quiet look.
- **One material per layer.** Glass inside glass collapses legibility. Inside a glass panel use a
  quiet solid/tinted control (`.lg-btn`), not another `.lg-glass`.
- **Restraint wins.** A few glass surfaces read as Apple; every card glassed reads as a template.
- Concrete numbers (only one is Apple's): for `clear` over bright media add a **35% dark dimming
  layer**; text contrast **4.5:1** body / **3:1** large. Blur/saturation are taste — the defaults
  here are calibrated to Apple's reference images, not quoted specs (see `references/sources.md`).

## Composition

Glass doesn't fix layout. Keep the negative space intentional:

- **Two-column editorial grid.** Give a wide glass panel a main content column and a narrow metadata rail (spec list, stats, actions). A single left-aligned column in a wide panel reads as empty.
- **Divide large panels with hairlines.** A 1px top rule separates the header from the action row without adding another card.
- **Share one baseline for floating chrome.** Dock, mini player and a lens/toy should sit on a common bottom rhythm and align to the page grid where they can.
- **Index the section headers.** `01 / Materials`, `02 / Components` plus a short right-aligned description create rhythm and keep the eye moving.
- **Vary the spacing.** Use a small scale (16 / 24 / 40 / 48) and give the hero one large breathing area; uniform gaps make everything equally quiet.
- **Cap the glass.** 3–8 surfaces. When every card is glass, the negative space disappears and the material stops meaning anything.

## Step 1 — Choose surfaces

Inventory the UI; classify each region as **chrome** (glass candidate) or **content** (leave alone).

- Candidates: top nav / toolbar, bottom tab bar / dock, search field, floating action button,
  popover / menu / dropdown, sheet / modal chrome, media player, toasts, onboarding callouts.
- Not candidates: dense lists, data tables, article bodies, long forms, settings rows.
- Pick **3–8 surfaces**, not everything. Prefer the ones that float over a rich background.

**Done when:** there is a written list: surface → chrome/content → variant (`regular`/`clear`/tinted) →
background behind it. Every `regular` surface must have a legible backdrop plan; every `clear`
surface must sit over media (and gets a dark scrim if that media can be bright).

## Step 2 — Install the core

1. Copy `assets/liquid-glass.css` and `assets/liquid-glass.js` into the app (e.g. `src/glass/`).
2. Import the CSS once; load the JS once (script tag, or `import "./glass/liquid-glass.js"`).
3. Map the tokens to the app's design system instead of restyling from scratch:

```css
:root {
  --lg-ink: var(--text);
  --lg-ink-soft: var(--muted);
  --lg-accent: var(--accent);       /* tinted buttons / active states */
  --lg-radius: 24px;
  --lg-blur: 18px;                  /* 10–14 small chrome, 16–22 panels */
  --lg-sat: 190%;
  --lg-bright: 1.1;                 /* light theme; ~1.0 dark */
}
```

If the app's dark mode is a `.dark` class rather than `[data-theme="dark"]`, add that selector
next to the dark block in the CSS. Delete the demo tokens you do not use.

```html
<div class="lg-glass" style="--lg-radius: 24px; padding: 18px">
  <p>Glass panel</p>
</div>
```

**Done when:** one `.lg-glass` panel renders frosted over the app background in both themes,
with no layout shift and text using the app's own colors.

## Step 3 — Compose the chrome

Mark surfaces and compose from the primitives (`assets/liquid-glass.css`). Prefer applying the
class to *existing* markup over rebuilding the DOM.

- Toolbar: `.lg-glass.lg-toolbar` — one floating pill; active nav item uses `--lg-hover`.
- Dock / tab bar: `.lg-glass.lg-dock` + `.lg-dock__item`; active item gets `.is-active`.
- Menu / popover: `.lg-glass.lg-menu` + `.lg-menu__item`; anchor it to the trigger and animate
  `transform-origin: top right` with a 180 ms scale/fade. Fixed positioning must not sit inside a
  transformed ancestor, or it will anchor to that ancestor.
- Buttons: `.lg-btn` (quiet, inside glass) and `.lg-btn--tinted` (one primary action). A tinted
  control does **not** need its own backdrop blur.
- Segmented control / switch / field: `.lg-seg`, `.lg-switch`, `.lg-field`. Keep hit targets ≥44px.
- Sheet: glass chrome + content on a solid surface; pair with a scrim over media.

Radii are concentric: inner radius = outer radius − padding. Pills are `999px`.

**Done when:** every chosen surface renders in light and dark, focus-visible works, and no glass
element is nested inside another glass element.

## Step 4 — Tune the material

Start from these values, then compare against the lab's screenshots:

| knob | range | effect |
| --- | --- | --- |
| `--lg-blur` | 10–14 small chrome · 16–22 panels | higher = milkier, less context |
| `--lg-sat` | 170–200% | keeps the backdrop vivid under frost |
| `--lg-bright` | 1.06–1.12 light · 0.95–1.0 dark | lifts or sinks the material |
| `--lg-fill-a` | .14–.24 light · .28–.36 dark | white/black veil over the blur |
| clear | `.lg-clear` (.03–.1 fill) | media-only; add 35% dark scrim if bright |
| tinted | `.lg-tinted` (accent .6–.85) | primary actions; white text + white rim |
| rim | 1.5–2px gradient | bright top-left → transparent mid → faint bottom-right |
| shadow | large soft + tight contact | dark theme uses pure black, light theme a green-black |

Text inside glass uses `--lg-ink`; do not put a flat gray body text on thin glass. If the material
looks like an opaque white plate, lower `--lg-fill-a` before adding more blur; if text is unreadable,
raise fill or blur rather than adding a second layer.

**Done when:** side-by-side with `examples/lab/screenshots/light-hero.jpg` the fill, rim and depth
read as the same family; body text still passes 4.5:1 on the busiest area it overlaps.

## Step 5 — Add refraction (optional, Chromium)

1. Add `lg-refract` to **key chrome only** (nav, dock, menu, the one showpiece control). Budget:
   ~8–12 elements; skip everything below the fold and inside scrolling lists.
2. Optionally tune per element: `data-lg-bezel="16" data-lg-disp="22"` (bezel ≈ edge band in px,
   disp ≈ max shift). Defaults: bezel = 5% of the short side clamped 8–20, disp = 1.2×bezel.
   A draggable "lens" toy can use a wide bezel (28–34) and low blur (2–4px).
3. Toggle it with `LiquidGlass.setEnabled(false)` or the root class `lg-no-refract`. The CSS
   frosted tier takes over.

How it works: the runtime generates one element-sized rounded-rect displacement map (signed
distance field + convex-squircle falloff), encodes the inward normal into R/G, and installs a
filter whose `feDisplacementMap` `scale` is **2×** the desired pixels (channels map to ±0.5).
Maps are cached by geometry and rebuilt through a `ResizeObserver`.

React / dynamic content:

```js
useEffect(() => {
  LiquidGlass.init(ref.current);   // scan a subtree after mount
}, []);
```

**Done when:** refraction is visible over a detailed background (toggle on/off shows the
difference), no element is blank/transparent while its map loads, and the console is clean.

## Step 6 — Accessibility and fallback

- `prefers-reduced-transparency: reduce` → solid surfaces (already in the CSS); also wire an
  in-app "reduce transparency" setting to `.lg-reduced-transparency`.
- `prefers-contrast: more` → frostier, more defined rim (already in the CSS).
- `prefers-reduced-motion` → no scale-in popovers; the CSS disables transitions.
- `clear` over bright media: add a 35% dark dimming layer.
- Provide a visible focus ring; keep 44px targets; never rely on color alone for active state.
- Safari / Firefox: tier 1 only. Confirm the page looks intentional, not broken.

**Done when:** forcing reduced transparency yields solid, readable surfaces in both themes, and
Safari (or a WebKit engine) shows no blank glass or missing content.

## Step 7 — Verify

- Screenshot at two widths × two themes. Compare against `examples/lab/screenshots/`.
- Toggle refraction off; the layout must not move.
- Scroll and resize: no flicker, no blank maps, no repeated rebuilds.
- Run the verification checklist below.

**Done when:** the checklist is all true and the before/after screenshots are saved.

---

## Converting an existing app

Do not rewrite the UI. Move it.

1. **Snapshot.** Screenshot the current UI (both themes) for the before/after.
2. **Inventory** (Step 1) and pick 3–6 surfaces. Leave the content layer alone.
3. **Map tokens** to the app's existing colors/radii; add only the glass tokens. Preserve type,
   spacing, layout and interactions.
4. **Tier 1 first.** Replace the surface's background/border/shadow with `.lg-glass`; delete the
   old `backdrop-filter` stack so blur is not doubled. Screenshot and fix contrast/layout before
   going further.
5. **Tier 2 last**, on 2–4 key surfaces only (nav/dock/menu/showpiece). Off for lists and below-fold.
6. **Background.** If the app is flat, the glass will read as frosted chrome. Improve depth with a
   soft page gradient/noise, or design for the quiet look. State the trade-off to the user.
7. **Accessibility + fallback** pass, then final screenshots.

**Done when:** the app's information hierarchy and layout are unchanged, only the chrome's material
moved, and the checklist below passes.

## Verification checklist

- [ ] Glass only on chrome; content layer still uses standard surfaces.
- [ ] No glass-inside-glass; one tinted primary action per view.
- [ ] Light and dark both pass; ink tokens are the app's own.
- [ ] Body contrast 4.5:1, large text 3:1 on the busiest overlapping area.
- [ ] Reduced transparency → solid and readable; reduced motion → no pop-in.
- [ ] Safari/Firefox fallback looks intentional (tier 1 only).
- [ ] Refraction toggle works and does not move layout.
- [ ] ≤12 refracting elements; no refracting long lists; resize/scroll is smooth.
- [ ] No console errors; no blank glass while maps load.

## Files

- `assets/liquid-glass.css` — tokens, material, rim/sheen, variants, primitives, a11y. Start here.
- `assets/liquid-glass.js` — Chromium refraction runtime (`LiquidGlass.init/refresh/setEnabled`).
- `examples/lab/` — complete worked page: hero, console, three materials, components, dock, menus,
  draggable lens. Open in Chrome; use its screenshots as the visual target.
- `references/sources.md` — Apple HIG facts, Apple's web CSS, Figma limitation, WebKit bug,
  community technique references, and gotchas measured while building this.

## Hard-won gotchas

- `feDisplacementMap` max shift is `scale / 2`; set `scale = 2 × desired px`.
- Each element needs its own element-sized filter; caching by geometry is mandatory.
- The filter region must be `userSpaceOnUse` at `0,0,W,H`, and the map must be element-sized.
- Do not put `opacity` or `filter` on an ancestor of a backdrop-filter element — it changes the
  backdrop root and can kill or break the effect.
- Fixed-position popovers inside a transformed `<nav>` anchor to the nav, not the viewport.
- A blur radius above ~24px hides the refraction; Apple's real material is restrained, so tune
  the rim and fill first, refraction second.
- Do not promise "copy CSS from the Figma Material page": Figma's Glass effect does not export to
  CSS/SVG (see `references/sources.md`). Hand-authoring is the honest path — say so.

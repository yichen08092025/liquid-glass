# Liquid Glass — sources, numbers, and browser facts

Everything in this skill is traceable. Labels:
**[OFFICIAL]** Apple documentation · **[WEB]** Apple production web CSS ·
**[COMMUNITY]** third-party estimate / reverse engineering · **[UNKNOWN]** not published.

## Apple's material semantics — [OFFICIAL]

- HIG → Materials: <https://developer.apple.com/design/human-interface-guidelines/materials>
  - Liquid Glass is a **functional layer** (controls, navigation, tab bars, sidebars). Standard materials are the **content layer**. Apple explicitly says not to use Liquid Glass in the content layer; the exception is a transiently interactive control such as a slider knob being touched.
  - Liquid Glass has exactly two variants: **`regular`** (blurs and adjusts luminosity for legibility) and **`clear`** (highly translucent; intended over visually rich media).
  - Standard materials: **ultra-thin / thin / regular / thick**; thicker = more opaque = better contrast.
  - Only explicit glass number: for `clear` over bright content, add a **35% dark dimming layer**.
- HIG → Accessibility: text ≤17 pt needs **4.5:1**; large text (18 pt) and bold need **3:1**.
- Adopting Liquid Glass: <https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass> — Reduce Transparency / Increase Contrast can remove or modify effects; system appearance settings change the material.
- SwiftUI API vocabulary (useful naming): `Glass.regular/.clear`, `.tint(_:)`, `.interactive()`, `glassEffect(_:in:)`, `GlassEffectContainer`, `buttonStyle(.glass)` / `.glassProminent`.

**No official blur radius or saturation value exists.** Any claim that Apple specifies `20px / 180%` for the OS material is false attribution.

## Apple's own web CSS — [WEB]

Apple's global navigation: <https://www.apple.com/api-www/global-elements/global-header/v1/assets/globalheader.css>
`--globalnav-backdrop-filter: saturate(180%) blur(20px); --globalnav-background: rgba(250,252,252,.8)`.
Useful as a sanity anchor for the *web tier*, not as the iOS material spec.

## Visual calibration — [OFFICIAL] images

- macOS 26 Mail toolbar closeup: <https://www.apple.com/v/os/g/images/macos/highlights/liquid_glass__bf6kssw93vrm_large_2x.jpg>
- iOS 26 lock screen: <https://9to5mac.com/wp-content/uploads/sites/6/2025/08/ios-26-liquid-glass-beta-6.jpg>
- macOS 26 clear look: <https://www.apple.com/newsroom/images/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/article/Apple-WWDC25-Liquid-Glass-Home-Screen-clear-look-250609_big.jpg.large_2x.jpg>
- macOS 26 dark tint: <https://www.apple.com/newsroom/images/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/article/Apple-WWDC25-Liquid-Glass-Home-Screen-dark-tint-250609_big.jpg.large_2x.jpg>

Characteristics to match: restrained fill, thin specular rim (bright top-left, faint bottom-right), soft outer shadow, content still recognizable through the blur, text vibrancy, and no hard white plate over the whole surface.

## Why the Figma "Copy as code → CSS" route doesn't work

- Apple Design Resources list the iOS 27 kit: <https://developer.apple.com/design/resources/> → <https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27>
- The kit is publicly viewable; duplicating needs a (free) Figma account. Layer values are auth-walled.
- Apple's kit uses Figma's native **Glass effect** (light angle, light intensity, refraction, depth, dispersion, frost, splay). Figma does not export Glass to SVG and does not render it in Figma Sites; Dev Mode outputs only the non-glass layers. So a genuine machine-exported "liquid glass CSS" from that file cannot exist. Any CSS sold as such is hand-rebuilt.
- Consequence: hand-author the material from semantics + reference images (what this skill does). Be honest with the user about this.

## Browser support — verified

| Engine | `backdrop-filter: url(#svgFilter)` |
| --- | --- |
| Chromium (Chrome / Edge / Arc / Brave, 108+) | **Works** — verified by rendering `feDisplacementMap` over stripes in Chrome 155 and measuring shifted pixels |
| Safari / WebKit | **Does not work.** WebKit bug 245510 (open since 2022); Apple engineer Simon Fraser: “Accelerated filters (including backdrop-filter) can't use SVG filters, sadly.” Patch proposals exist but are unshipped |
| Firefox | Treat as unsupported; reports conflict for non-displacement filters |
| Base `backdrop-filter` | Chrome 76 / Edge 79 / Firefox 103 / Safari 18 unprefixed; ~97% global support |

Sources: <https://bugs.webkit.org/show_bug.cgi?id=245510>, <https://bugs.webkit.org/show_bug.cgi?id=297770>,
<https://caniuse.com/css-backdrop-filter>, <https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter>

`prefers-reduced-transparency` is Chromium 119+ (not Baseline); pair it with the solid fallback class. `prefers-contrast` is widely supported.

## Technique references — [COMMUNITY], MIT where noted

- kube.io, "Liquid Glass in the Browser: Refraction with CSS and SVG" — Snell's law, convex squircle profile, 127 ray samples, displacement map encoding, specular light. <https://kube.io/blog/liquid-glass-css-svg>
- shuding/liquid-glass (MIT): <https://github.com/shuding/liquid-glass> — per-element canvas displacement map, `backdrop-filter: url(#id) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`.
- VII-Cae/hyalite (MIT): <https://github.com/VII-Cae/hyalite--liquid-glass> — SDF-based lens maps for arbitrary radii, resize handling.
- kevinbism/liquid-glass-effect (MIT): pure-CSS fallback tier.

## Facts learned while building this skill

- `feDisplacementMap` interprets an 8-bit channel as `(C/255 − 0.5) × scale`, so the maximum shift is **scale / 2**. Encode a normalized vector into R/G and set `scale = 2 × desiredPixels`.
- The filter region must be `userSpaceOnUse` with `x=0,y=0,width=W,height=H` matching the element; the map must be element-sized, so each distinct size/radius needs its own filter. Cache by geometry.
- A 0×0 `position:fixed` SVG in the body works as the filter host.
- Chromium applies the SVG filter to the backdrop *before* the following `blur()` in the filter list; ordering matters for how visible the warp is. The default order here is `url(#f) blur(...) saturate(...)`.
- `prefers-reduced-motion` does not imply reduced transparency; handle both.
- Backdrop filters sample content behind the element. A flat app background makes refraction (and much of the glass depth) vanish; design a background with some tonal variation or accept a frosted-chrome look.

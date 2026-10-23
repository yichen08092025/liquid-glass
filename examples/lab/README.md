# Liquid Glass Lab — worked example

Full-page demo used as the visual target for this skill. Open `index.html` in Chrome or Edge
for the complete effect (frost + edge refraction). Safari and Firefox fall back to frosted glass.

What is in the page:

- floating glass toolbar and dock
- three materials: clear / regular / tinted
- light / dark appearance switch
- live blur and saturation sliders
- a draggable glass lens over the photo (best place to see the refraction)
- popover menu, segmented controls, switches, search field
- reduced-transparency preview (the switch in the console)

Files:

```
index.html           demo markup
lab.css              demo layout + the material stack (self-contained snapshot)
lab.js               demo runtime (displacement maps + demo interactions)
assets/bg.jpg        background photo (Picsum / Unsplash)
screenshots/         light, dark, sections, mobile, menu
```

The reusable, namespaced core lives at `../../assets/liquid-glass.css` and
`../../assets/liquid-glass.js` — use those in real projects, not the lab's snapshot.
The lab exists to show a finished composition and to provide screenshots for comparison.

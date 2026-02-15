## UI/UX and performance research summary

Date: 2026-02-15

### Sources reviewed
- W3C WCAG 2.2 contrast guidance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- web.dev typography guidance: https://web.dev/learn/design/typography/
- Material motion durations/easing: https://m1.material.io/motion/duration-easing.html
- web.dev animation performance: https://web.dev/articles/animations-guide
- web.dev layout thrashing/performance: https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing
- web.dev content structure hierarchy: https://web.dev/learn/accessibility/structure

### Key findings
- Typography quality is not only font selection; line-height, hierarchy, and responsive readability strongly affect comprehension.
- Strong visual hierarchy should prioritize the main task area and keep secondary metadata in lower-emphasis regions.
- Motion should be fast and informative; desktop transitions in the 150-200ms range are generally responsive and reduce perceived lag.
- Animation and layout cost can affect interaction smoothness and CPU/GPU load, especially with frequent updates and large animated surfaces.
- Accessible structure and heading order improve scanning and task completion.

### Applied changes in this project
- Reworked typography stack for stronger display/body contrast (`Sora` + `Plus Jakarta Sans`).
- Raised task hierarchy by promoting the live gameplay/input section and moving game detail metadata to a lower-priority panel.
- Shifted leaderboard to the secondary column so the answer workflow remains the primary focal area.
- Tuned client performance hotspots:
  - reduced game timer render interval from 200ms to 500ms;
  - reduced draft autosave frequency (180ms to 420ms debounce);
  - reduced animated bubble count.
- Added policy-based round ending control and scoring-mode controls so gameplay behavior is explicit and configurable.


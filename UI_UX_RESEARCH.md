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

## Mobile-first UX research and arrangement update

Date: 2026-02-25

### Sources reviewed
- web.dev responsive design basics: https://web.dev/learn/design/design-basics
- web.dev content reordering guidance: https://web.dev/articles/content-reordering
- web.dev touch target guidance: https://web.dev/articles/accessible-tap-targets
- web.dev form UX best practices: https://web.dev/articles/payment-and-address-form-best-practices
- W3C WCAG 2.2 target size minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

### Key findings
- Prioritize the primary task (round action and answer input) above secondary information on smaller screens.
- Keep logical source order and avoid visual reorder patterns that can break keyboard and assistive tech navigation.
- Touch interfaces need larger tap areas and spacing to reduce mistaps.
- Form labels should stay explicit on mobile and not rely on placeholders.
- Dense tables should adapt to a stacked or card-like pattern on very narrow viewports instead of forcing horizontal scan.

### Applied arrangement updates in this project
- Added a mobile status strip in the game board primary area to surface timer and round/leaderboard summary at the point of action.
- Hid the A-Z letter picker and full turn-order list while a round is active so answer entry stays focused.
- Added visible per-field labels for answer inputs on mobile breakpoints while preserving accessible label text.
- Reworked results tables for smaller screens by using per-cell labels and stacked card-like rows.
- Converted mobile leaderboard cards to horizontal swipe tiles for faster scanning.
- Increased touch target sizing on coarse pointers for action buttons and mark controls.

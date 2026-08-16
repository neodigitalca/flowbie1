# Instagram feed ad best practices (Meta ads)

Use these rules for every Meta ad creative and caption in this workspace.

## Creative format

- Output a designed Instagram feed sponsored-post creative with bold type hierarchy, generous spacing, and **visible designed graphic elements**.
- Every ad needs a **focal graphic**: icons, accent bars, geometric shapes, abstract SEO/local motifs, gradient panels, or UI vignettes from the brief `visualConcept`.
- Text-only on an empty or faded photo background is not acceptable.
- One focal graphic cluster plus headline. Reference marketing/instagram-ads for composition density.
- Photo-hero style only when the creative brief sets `creativeStyle: photo_hero`.

## Visual tool palette

- The creative brief sets `creativeStyle` and `visualToolPalette` (nine tools, each with **degree** 0.0 to 1.0).
- **degree 0**: tool off for this run.
- **degree above 0**: tool is active; higher values are more prominent (0.2 = subtle, 0.8 = dominant).
- Tools: typography, icon_cluster, accent_shapes, city_skyline, device_screen, people, map_overlay, gradient_panel, photo_focal.
- Vary degree values each generate for the same keyword. No tool is mandatory.
- `visualConcept` describes only tools with degree > 0 and their degrees.
- **icon_cluster**: when degree > 0, use at most 2 to 3 distinct icons in one small cluster. Never repeat the same motif. Degree controls prominence, not icon count.

## Focus keyword

- focusKeyword is a research seed. Rewrite into natural English with correct grammar.
- Never paste or jam the raw keyword into headlines, captions, or on-image text.
- Example: "AISEO Edmonton" → "AI SEO for Edmonton businesses", not "AISEO for Edmonton Business".

## On-image text

- One headline only (max 6 words). Optional subline (3 to 5 words).
- Use the exact headline and subline from the creative brief.
- Every headline must include a concrete outcome, benefit, or next step. Never stop at setup alone (e.g. bad: "We help Edmonton businesses"; good: "We help Edmonton get found" or headline "We help Edmonton" plus subline "Rank higher locally").
- Never paste the focus keyword verbatim on the image.
- Never duplicate the headline on the image.
- Never duplicate the subline or repeat any on-image phrase a second time (including footer slogans).
- Maximum two on-image text lines: headline plus optional subline only.
- Do not paint caption, primary text, description, CTA, URLs, or checklist items into the image.
- Never render design-spec or platform labels as visible text ("Designed", "Instagram Feed", aspect ratios, "Sponsored Ad", placement/format headers).

## Device screens

- When `device_screen.degree > 0`, pick `deviceScreenLayout` from post context (Elementor editor, WordPress admin, published homepage/service page, or NEO Pulse dashboard).
- Screens show realistic WordPress or page-builder layout structure with gray placeholder bars only. No readable words on screens.
- No abstract dashboards, holographic UI, neon wireframes, or chart-only screens.
- When device_screen is active, do not add duplicate chart or growth icons in icon_cluster.

## Caption (primaryText)

- Short Instagram caption. Sentence 1 expands the brief `captionHook`.
- Caption is separate from on-image text.
- Plain language, benefit-focused, with a definitive outcome or next step, under 2 short sentences.

## Visual vibe and palette

- Background and accent colors come from `visualVibe` and `backgroundTreatment` in the creative brief.
- Modern, engaging, vibe-driven. Not keyword-driven palette.

## Local ads

- When `localityCity` is set, city skyline appears only when `city_skyline.degree > 0` in the brief palette.
- Locality is context; skyline use is driven by degree, not keyword text on the image.

## Maps

- Map overlays only when `map_overlay.degree > 0` or the creative brief sets `useMapOverlay: true`.

## Realism

- Every object, screen, and scene element must look physically plausible and make visual sense together.
- On-image text is only the brief headline and optional subline.

## No Instagram UI chrome

- Do not paint profile bars, Sponsored labels, like buttons, or phone bezels into the creative.

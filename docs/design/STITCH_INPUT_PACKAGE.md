# Google Stitch Input Package

## Goal
- Give Google Stitch enough product, UX, copy, and technical context to redesign the side panel without inventing out-of-scope features.
- Keep the generated concepts aligned with the current alpha constraints, not a hypothetical full product.

## What To Paste Or Upload Into Stitch

### 1. Product Brief
Paste a short product summary first:

- Product: `News Context`
- Surface: `Chrome MV3 side panel`
- Width target: `400px`, minimum `360px`, maximum `480px`
- Core job: `show 3-5 same-issue related articles next to the article the user is already reading`
- Repeated-use hooks: `watchlist`, `briefing`, `Founder Pass upsell`
- Primary tone: `editorial, calm, factual, high-trust`

### 2. Screens To Generate
Ask Stitch for these screens only:

1. Onboarding
2. Loading
3. Main context
4. Watchlist
5. Plan / paywall
6. Settings / consent
7. Unsupported / error / low-confidence state

Do not ask for:
- team dashboard
- marketing homepage
- external API portal
- monthly subscription pricing page

### 3. Files To Upload
Use these as source material:

- `docs/03_Wireframes_and_ScreenSpecs.md`
- `docs/12_CopyDeck.md`
- `docs/08_Security_Privacy_Legal.md`
- `docs/ALPHA_RELEASE_CHECKLIST.md`
- `apps/extension/src/sidepanel/main.ts`
- `apps/extension/public/sidepanel/styles.css`

### 4. Current-State Screenshots To Upload
Capture and upload these from the running extension:

- onboarding
- main context success
- watchlist
- plan/paywall
- settings/support
- unsupported
- error

If you only upload one image, make it the current `main context` screen.

### 5. Behavior Constraints To Paste
Copy these constraints into Stitch so it does not hallucinate product scope:

- Chrome MV3 extension only
- side panel only, not full-page app
- no remote hosted code
- no dark-mode-first design
- no ranking claims about article truth
- no “AI summary of the article body” promise
- Founder Pass is a simple repeat-use upgrade, not a team plan
- support links may still be placeholder-safe fallback
- privacy/contact/store metadata exists outside the visible UI

### 6. Content Hierarchy To Preserve
- Current article source card
- freshness banner
- common signals strip
- related articles list
- watchlist save / feedback actions
- paywall comparison
- settings / consent / support status

### 7. Visual Direction To Request
- editorial and trustworthy, not generic SaaS
- warm paper-like background, strong information hierarchy
- compact enough for 400px width
- cards should feel like reading tools, not dashboards
- clear emphasis on “current article -> related coverage -> action”
- high contrast and fast scanability

## Recommended Stitch Prompt Structure
1. Start with the product brief.
2. Paste the screen list.
3. Paste the constraints.
4. Attach screenshots and wireframe doc.
5. Ask for one cohesive design system across all 7 states.
6. Ask for component-level reuse, not unrelated one-off screens.

## Output To Request From Stitch
- one cohesive side panel design system
- mobile-width desktop side panel layout
- component specs for:
  - nav pills
  - source card
  - freshness banner
  - common signal chips
  - related article cards
  - watchlist cards
  - plan comparison table
  - support/contact cards
- color tokens
- typography tokens
- spacing and radius tokens
- state guidance for success / low-confidence / unsupported / error

## Hand-off Rule
Use Stitch for layout and visual hierarchy ideas, then implement the result back into:

- `apps/extension/src/sidepanel/main.ts`
- `apps/extension/public/sidepanel/styles.css`

Do not let Stitch redefine product scope.

# Paste-Ready Stitch Prompt

Design a compact Chrome MV3 side panel called `News Context`.

The panel width is about 400px and must still work at 360px. This is not a full dashboard and not a marketing landing page. It is a reading companion that opens beside an article and helps the user compare same-issue coverage from other publishers.

The product has 7 states:
1. onboarding
2. loading
3. main context success
4. watchlist
5. plan / paywall
6. settings / consent
7. unsupported / error / low-confidence

Primary job:
- show the current article
- show 3-5 related same-issue articles
- show freshness and common signals
- let the user save the issue to a watchlist

Secondary job:
- show repeat-use value through watchlist and briefing
- show Founder Pass as a simple repeat-use upgrade

Hard constraints:
- Chrome MV3 extension side panel only
- no team dashboard
- no external API product
- no monthly subscription messaging
- no dark-mode-first concept
- no truth-ranking or “we decide who is right” messaging
- no remote hosted code assumptions

Visual direction:
- editorial, calm, trustworthy
- warm paper-like background
- sharper information hierarchy than a generic SaaS panel
- source card should feel premium and readable
- related article cards should scan quickly
- badges and chips should feel purposeful, not decorative
- make watchlist, plan, and settings feel consistent with the main article experience

Please use one coherent design system across all states.

Prioritize these components:
- top shell / route indicator
- nav pills
- source card
- freshness banner
- common signals strip
- related article cards
- action area
- watchlist cards
- plan comparison
- support/contact cards

I will also attach:
- current screenshots
- copy deck
- wireframe/spec doc
- current HTML/CSS implementation

Please return:
- one unified visual direction
- component specs
- token suggestions for color, spacing, type, radius, and shadows
- guidance for success / low-confidence / unsupported / error variants

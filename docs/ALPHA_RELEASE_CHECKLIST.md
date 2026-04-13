# Alpha Release Checklist

## Goal
- Close launch-critical gaps before a Chrome Web Store unlisted alpha submission.
- Keep launch blockers explicit and separate from later commercial or B2B work.

## Automated Checks
- [ ] `npm.cmd run typecheck` or `.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run test`
- [ ] `npm.cmd run benchmark:resolve -- --iterations=50`
- [ ] `npm.cmd run ops:starter-pack`
- [ ] `npm.cmd run ops:validate-exports`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd run build:alpha` is run immediately before the final submission preflight and packaging step
- [ ] `npx.cmd playwright test --config playwright.config.ts --reporter=line`
- [ ] `npm.cmd run release:preflight`
- [ ] `npm.cmd run release:archive-alpha`

## Package Checks
- [ ] `apps/extension/dist-alpha/manifest.json` exists
- [ ] `apps/extension/dist-alpha/alpha-release.json` exists
- [ ] `apps/extension/dist-alpha/icons/icon-16.png` exists
- [ ] `apps/extension/dist-alpha/icons/icon-32.png` exists
- [ ] `apps/extension/dist-alpha/icons/icon-48.png` exists
- [ ] `apps/extension/dist-alpha/icons/icon-128.png` exists
- [ ] alpha manifest declares `icons`
- [ ] alpha manifest has no localhost host permission
- [ ] alpha manifest only keeps Naver article pages and the chosen HTTPS API origin
- [ ] extension page CSP stays `script-src 'self'; object-src 'self'`
- [ ] no remote hosted code is introduced in the side panel bundle
- [ ] no external brand language such as `The Broadside` appears in the shipped `News Context` UI

## Store Submission Metadata
- [ ] Follow `docs/ops/RELEASE_VALUE_INJECTION_CHECKLIST.md`
- [ ] If you need the fastest public routes, publish `docs/` through GitHub Pages and reuse `docs/public/privacy-policy.html` plus `docs/public/public-contact.html`
- [ ] `alpha-release.json.store_listing.status` is reviewed before submission
- [ ] `STORE_PRIVACY_POLICY_URL` is set to a real HTTPS URL before store submission
- [ ] `STORE_PUBLIC_CONTACT_URL` is set to a real HTTPS or `mailto:` route before store submission
- [ ] `STORE_TERMS_OF_SERVICE_URL` is either set or explicitly left optional for this release
- [ ] `docs/public/privacy-policy.html` no longer contains `Draft Public Page`, `[Operator Name]`, or other unresolved placeholder tokens
- [ ] `docs/public/public-contact.html` no longer contains `Draft Public Page`, `[Public Contact Route]`, or unresolved contact placeholders
- [ ] if the repo's own legal bar in `docs/08_Security_Privacy_Legal.md` is being followed, Terms and deletion-request handling are explicitly closed before upload
- [ ] If this alpha needs a live operator follow-up path, inject real `SUPPORT_*` values before external sharing
- [ ] release notes explain that analytics is opt-in and article context is limited to the extension purpose

## Final Stable Chrome Confirmation
- [ ] Record the result in `docs/QA_EXECUTION_NOTES.md` under `Final Stable Chrome Sign-Off`
- [ ] final sign-off is performed against a freshly rebuilt `dist-alpha`, not an older local tree
- [ ] supported Naver article -> action click -> panel open -> loading -> main context
- [ ] shipped UI keeps the `News Context` product identity while using the newer editorial hierarchy
- [ ] unsupported page -> unsupported state + beta support CTA or placeholder-safe fallback notice
- [ ] API down / timeout -> error state + retry + beta support CTA or placeholder-safe fallback notice
- [ ] low-confidence result -> badge + helper + quality support CTA or placeholder-safe fallback notice
- [ ] onboarding secondary CTA defers compare and lands on a safe route instead of triggering the same immediate resolve flow as the primary CTA
- [ ] unsupported non-article recovery labels the Naver News destination honestly and does not present a misleading retry-only action as a supported-page shortcut
- [ ] watchlist save / delete still works
- [ ] checkout popup -> hosted return bridge -> Founder Pass unlock works without a blocked `chrome-extension://` redirect
- [ ] paywall / Founder Pass mismatch -> billing support CTA or placeholder-safe fallback notice
- [ ] B2B starter report inquiry path -> B2B support CTA or placeholder-safe fallback notice
- [ ] settings/support copy stays user-facing and does not expose internal `SUPPORT_*`, `config key`, or runtime-source wording in the product UI
- [ ] briefing load failure has a clear retry/support recovery path and does not dead-end on raw error text
- [ ] the translated editorial styling still relies only on bundled/local assets and does not introduce remote fonts, remote imagery, or dashboard-style expansion

## Upload Artifact Checks
- [ ] `npm.cmd run release:archive-alpha` creates the canonical upload archive from the final `apps/extension/dist-alpha` tree
- [ ] `apps/extension/release-artifacts/news-context-alpha-upload.zip` exists
- [ ] `apps/extension/release-artifacts/news-context-alpha-upload.manifest.json` exists
- [ ] the archive root structure is checked once before upload so the reviewed artifact and uploaded artifact are the same thing
- [ ] `release:preflight` is run against the same rebuilt tree that produced that archive

## Launch Blockers
- [ ] real Chrome Web Store privacy policy URL exists
- [ ] real public contact route exists
- [ ] public legal/contact pages are no longer draft placeholders
- [ ] final stable Chrome confirmation is complete with no core flow blocker

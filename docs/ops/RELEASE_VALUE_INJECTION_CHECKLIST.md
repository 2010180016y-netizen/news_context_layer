# Release Value Injection Checklist

## Goal
- Inject the real store-listing values needed for an unlisted Chrome Web Store launch.
- Keep support/contact values on the existing runtime path, but treat them as operationally optional for an early alpha unless live follow-up is required.
- Keep secrets and operational endpoints out of the repo while still making the release path deterministic.
- Run one automated preflight after injection so the next operator can see exactly what is still missing.

## Read This First
- `plan.md`
- `docs/QA_EXECUTION_NOTES.md`
- `docs/ALPHA_RELEASE_CHECKLIST.md`
- `docs/ops/PREDEPLOY_EXPERT_REVIEW.md`
- `docs/ops/SUPPORT_CONTACT_FLOW.md`
- `docs/public/privacy-policy.html`
- `docs/public/public-contact.html`
- `apps/extension/scripts/build-alpha.mjs`
- `apps/extension/dist-alpha/alpha-release.json`

## Source Of Truth
Real values must only enter through the existing environment-variable or CLI override path.

### Support Runtime Keys
- `SUPPORT_CHANNEL_STATUS`
- `SUPPORT_RESPONSE_SLA`
- `SUPPORT_BETA_URL`
- `SUPPORT_BILLING_URL`
- `SUPPORT_QUALITY_URL`
- `SUPPORT_B2B_URL`

### Store Listing Keys
- `STORE_PRIVACY_POLICY_URL`
- `STORE_PUBLIC_CONTACT_URL`
- `STORE_TERMS_OF_SERVICE_URL`

Rules:
- Do not hard-code real values into repo source files.
- Use `https:` for public web routes.
- `mailto:` is allowed only for `STORE_PUBLIC_CONTACT_URL` and the support-channel URLs.
- Submission is held if `STORE_PRIVACY_POLICY_URL` or `STORE_PUBLIC_CONTACT_URL` is missing.
- URL presence alone is not enough for launch readiness: the public pages must no longer contain draft/placeholder tokens and should meet the release bar described in `docs/ALPHA_RELEASE_CHECKLIST.md`.

What “URL” means here:
- `STORE_PRIVACY_POLICY_URL`: any publicly reachable HTTPS page that contains the privacy policy users and Chrome reviewers can open.
- `STORE_PUBLIC_CONTACT_URL`: any publicly reachable HTTPS page or `mailto:` address that gives a public way to contact the operator.
- These do not need a separate customer-support platform. A simple public page and a public email route are enough for the current alpha.
- The fastest current path is GitHub Pages from `docs/`, using the release-grade HTML files in `docs/public/`.

## Values To Collect Before Injection
### Required
- Real privacy policy HTTPS URL
- Real public contact route as HTTPS or `mailto:`

### Recommended
- Real beta support route
- Real billing issue route
- Real parser/resolve quality issue route
- Real B2B inquiry route
- Support SLA wording for runtime display
- Terms of service HTTPS URL

## Injection Steps
### 1. Export Real Values Into The Shell
```powershell
$env:SUPPORT_CHANNEL_STATUS='configured'
$env:SUPPORT_RESPONSE_SLA='Same business day acknowledgement, next-step response within 2 business days.'
$env:SUPPORT_BETA_URL='https://<real-support-route>'
$env:SUPPORT_BILLING_URL='https://<real-billing-route>'
$env:SUPPORT_QUALITY_URL='https://<real-quality-route>'
$env:SUPPORT_B2B_URL='mailto:<real-b2b-contact>'
$env:STORE_PRIVACY_POLICY_URL='https://<real-privacy-policy>'
$env:STORE_PUBLIC_CONTACT_URL='mailto:<real-public-contact>'
$env:STORE_TERMS_OF_SERVICE_URL='https://<real-terms>'
```

### 2. Rebuild The Alpha Package
```powershell
npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com
```

### 3. Run Submission Preflight
```powershell
npm.cmd run release:preflight
```

Expected result:
- `readyForSubmission = true`
- `storeConfigured = true`
- no blocking missing keys for store-listing metadata

### 4. Treat The Rebuilt Tree As The Upload Candidate
- run `build:alpha` immediately before the final `release:preflight`
- run `npm.cmd run release:archive-alpha`
- create or inspect the exact upload archive from that rebuilt `dist-alpha`
- do not assume an older `dist-alpha` tree is equivalent just because preflight was green once

## What The Preflight Checks
- `dist-alpha/manifest.json` exists
- declared icon files exist
- insecure host permissions are absent
- alpha API base URL is HTTPS
- support placeholder fallback is disclosed through warnings when `SUPPORT_*` routes are still missing
- store-listing required URLs are configured
- placeholder metadata has been replaced
- It does not verify that the public privacy/contact pages have release-grade substance beyond the URL and placeholder metadata checks.

It does **not** replace manual browser verification. Final stable Chrome confirmation still belongs to `docs/ALPHA_RELEASE_CHECKLIST.md`.

## Final Submission Sequence
1. Inject real `STORE_*` values.
2. Rebuild alpha.
3. Run `npm.cmd run release:preflight`.
4. Confirm the public privacy/contact pages are no longer draft placeholders.
5. Run `npm.cmd run release:archive-alpha`.
6. Inspect `apps/extension/release-artifacts/news-context-alpha-upload.zip` and its manifest.
7. Run the final stable Chrome confirmation in `docs/ALPHA_RELEASE_CHECKLIST.md`.
8. If this alpha needs live operator follow-up, inject real `SUPPORT_*` values and rebuild alpha again.
9. Review `apps/extension/dist-alpha/alpha-release.json`.
10. Upload only after automated preflight, archive verification, manual confirmation, and the public-page content review are all green.

## If Preflight Fails
- `SUPPORT_*` missing:
  - submission is not blocked for an early alpha
  - support CTAs will stay on placeholder-safe fallback notices
  - inject real values before external sharing if live follow-up is expected
- `STORE_PRIVACY_POLICY_URL` or `STORE_PUBLIC_CONTACT_URL` missing:
  - release is blocked
  - do not upload
- `STORE_TERMS_OF_SERVICE_URL` missing:
  - check release decision
  - this is recommended, not always blocking
- icon or manifest failure:
  - rebuild and inspect `apps/extension/dist-alpha`

## Do Not Commit
- Real support aliases
- Real form URLs
- Real privacy policy or contact secrets that are not already public
- Local operator-specific environment files

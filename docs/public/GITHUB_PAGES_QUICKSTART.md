# GitHub Pages In 10 Minutes

## Goal
- Publish the repo's `docs/` folder through GitHub Pages.
- Reuse the already-prepared public pages in `docs/public/`.
- Fill the two remaining Chrome Web Store submission values without inventing a support platform.

## What You Need
- A GitHub repository that contains this project.
- GitHub access with permission to push and open repository settings.
- A public email route if you prefer `mailto:` instead of the contact page.

## Files Already Ready
- `docs/public/index.html`
- `docs/public/privacy-policy.html`
- `docs/public/public-contact.html`
- `docs/.nojekyll`

## Fastest Setup
1. Push this repository to GitHub.
2. Open GitHub repository settings.
3. Go to `Pages`.
4. Set `Source` to `Deploy from a branch`.
5. Select your main branch and `/docs`.
6. Save and wait for GitHub Pages to publish.

Expected public routes:
- `https://<github-username>.github.io/<repo-name>/public/privacy-policy.html`
- `https://<github-username>.github.io/<repo-name>/public/public-contact.html`

## What To Put Into The Release
Use the published URLs as:

```powershell
$env:STORE_PRIVACY_POLICY_URL='https://<github-username>.github.io/<repo-name>/public/privacy-policy.html'
$env:STORE_PUBLIC_CONTACT_URL='https://<github-username>.github.io/<repo-name>/public/public-contact.html'
```

If you want to use an email instead of the contact page:

```powershell
$env:STORE_PUBLIC_CONTACT_URL='mailto:<public-contact-email>'
```

## Then Rebuild
```powershell
npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com
npm.cmd run release:preflight
```

Expected result:
- `release:preflight` becomes green for store listing metadata.
- Support links may still remain warnings for early alpha.

## If You Want The Absolute Minimum
- Publish only `privacy-policy.html` through GitHub Pages.
- Use `mailto:` for `STORE_PUBLIC_CONTACT_URL`.

This is enough for the current alpha if the page is publicly reachable.

## Notes
- The pages can stay plain HTML for now.
- You do not need a separate support platform.
- You do not need a customer portal.
- You only need one public privacy page and one public contact route.

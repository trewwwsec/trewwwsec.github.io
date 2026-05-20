# Trewwwsec Portfolio

Bold Astro-powered security portfolio and research blog for Trewwwsec.

## What this site includes

- Personal-brand homepage for a security engineer working across defensive and offensive security.
- Local research/blog index.
- Reposted Medium writeups with source links back to the original articles.
- GitHub Pages deployment workflow.

## Local development

```bash
npm install
npm run dev
```

## Validate before publishing

```bash
ASTRO_TELEMETRY_DISABLED=1 npm run build
npm audit --omit=dev
```

## GitHub Pages setup

For a user/organization Pages site, publish this repository as:

```text
trewwwsec.github.io
```

Then enable **Settings → Pages → Build and deployment → GitHub Actions**.

If publishing as a project page instead of the user page, set these repository variables:

- `SITE_URL`: `https://trewwwsec.github.io`
- `SITE_BASE_PATH`: `/REPOSITORY_NAME/`

## Edit before launch

Replace placeholder contact/project details in `src/pages/index.astro` and `src/layouts/BaseLayout.astro`:

- `hello@example.com`
- GitHub/profile links if different
- Resume/project links when available

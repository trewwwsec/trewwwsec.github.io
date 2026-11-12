# Sitewide GoatCounter Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sitewide aggregate visitor analytics to the GitHub Pages site with GoatCounter, without changing hosting or collecting persistent visitor identifiers.

**Architecture:** Read a public GoatCounter endpoint from an Astro build-time variable and conditionally emit the official beacon once from the shared layout. The GitHub Pages workflow supplies the value from a repository Actions variable; when unset, no beacon is rendered.

**Tech Stack:** Astro, GitHub Actions, GitHub Pages, GoatCounter hosted JavaScript counter.

**Spec:** `docs/superpowers/specs/2026-11-12-sitewide-goatcounter-analytics-design.md`

## Global Constraints

- Keep the site on GitHub Pages; do not onboard or proxy its hostname through Cloudflare.
- Measure sitewide aggregate page views and referrers only; no custom events, user IDs, cookies, or session replay.
- `PUBLIC_GOATCOUNTER_ENDPOINT` is a public counter URL, not a secret or API credential.
- If the endpoint is unset, omit the script and let the build succeed.
- The production endpoint must come from the user's GoatCounter site; never leave a test endpoint in the deployed configuration.

---

## Build verification note

The main checkout previously timed out during Astro diagnostics. After dependency setup in the isolated worktree, the baseline `npm run build` passed with zero Astro diagnostics. Continue to run the configured and unset endpoint checks below; do not treat any future timeout as a passing check.

### Task 1: Add the conditional sitewide beacon

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: build variable `PUBLIC_GOATCOUNTER_ENDPOINT`, supplied by GitHub Actions variable `GOATCOUNTER_ENDPOINT`.
- Produces: zero GoatCounter script tags when unset; exactly one script tag per rendered page when configured, with `src="https://gc.zgo.at/count.js"` and `data-goatcounter` set to the configured endpoint.

- [ ] **Step 1: Establish a passing baseline build**

  Run `npm run build` before implementation. If Astro diagnostics time out, investigate and fix that environment issue before changing files or treating the feature test as meaningful.

- [ ] **Step 2: Run a failing configured-output check**

  Build with a non-production test endpoint:

  ```bash
  PUBLIC_GOATCOUNTER_ENDPOINT=https://example.goatcounter.com/count npm run build
  ```

  Then run this one-off check against representative routes:

  ```bash
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const pages = [
    "dist/index.html",
    "dist/blog/index.html",
    "dist/blog/stacked-aws-iam-privilege-escalation/index.html",
  ];
  const endpoint = "https://example.goatcounter.com/count";
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const count = (html.match(/https:\/\/gc\.zgo\.at\/count\.js/g) ?? []).length;
    if (count !== 1 || !html.includes(`data-goatcounter="${endpoint}"`)) {
      console.error(`FAIL ${page}: expected one configured GoatCounter beacon`);
      process.exitCode = 1;
    }
  }
  '
  ```

  Expected before implementation: the check fails because the beacon is absent.

- [ ] **Step 3: Add the minimal conditional script**

  In the `BaseLayout.astro` frontmatter, define:

  ```ts
  const goatcounterEndpoint = import.meta.env.PROD
    ? import.meta.env.PUBLIC_GOATCOUNTER_ENDPOINT
    : undefined;
  ```

  Before `</body>`, render the official snippet only when that value is non-empty:

  ```astro
  {goatcounterEndpoint && (
    <script
      is:inline
      async
      src="https://gc.zgo.at/count.js"
      data-goatcounter={goatcounterEndpoint}
    ></script>
  )}
  ```

- [ ] **Step 4: Pass the repository variable into the Pages build**

  Add the value to the existing `Build site` step in `.github/workflows/deploy.yml`:

  ```yaml
  PUBLIC_GOATCOUNTER_ENDPOINT: ${{ vars.GOATCOUNTER_ENDPOINT }}
  ```

  Do not add a fallback endpoint. If the repository variable is absent, Astro should render no beacon.

- [ ] **Step 5: Document account setup and privacy scope**

  Add a short README section explaining that the owner must create a GoatCounter site and set the `GOATCOUNTER_ENDPOINT` Actions repository variable to its `/count` URL. State that the value is public, analytics are page views/referrers only, and local builds omit the beacon when the variable is unset.

- [ ] **Step 6: Verify configured and unset builds**

  After the configured-output check passes, run:

  ```bash
  env -u PUBLIC_GOATCOUNTER_ENDPOINT npm run build
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const pages = [
    "dist/index.html",
    "dist/blog/index.html",
    "dist/blog/stacked-aws-iam-privilege-escalation/index.html",
  ];
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const count = (html.match(/https:\/\/gc\.zgo\.at\/count\.js/g) ?? []).length;
    if (count !== 0) {
      console.error(`FAIL ${page}: unexpected GoatCounter beacon`);
      process.exitCode = 1;
    }
  }
  '
  ```

  The configured check uses a test endpoint only; never deploy it.

- [ ] **Step 7: Commit the integration**

  ```bash
  git add src/layouts/BaseLayout.astro .github/workflows/deploy.yml README.md
  git commit -m "Add sitewide GoatCounter analytics"
  ```

### Task 2: Verify live collection after account configuration

**Files:**
- No source edits unless the live check finds a specific integration defect.

**Interfaces:**
- Consumes: GitHub Actions variable `GOATCOUNTER_ENDPOINT` set to the real endpoint, and a successful GitHub Pages deployment.
- Produces: a verified page-view request visible in the GoatCounter dashboard.

- [ ] **Step 1: Confirm the production variable is configured**

  Verify that the GitHub repository variable `GOATCOUNTER_ENDPOINT` equals the endpoint from the GoatCounter site. Never print account credentials or create an API token for this integration.

- [ ] **Step 2: Verify the deployed output**

  Open the homepage, blog index, and Stacked writeup in a browser. Confirm the beacon loads from `https://gc.zgo.at/count.js`, each page has only one beacon, and the request targets the configured `/count` endpoint.

- [ ] **Step 3: Confirm a page view in GoatCounter**

  Check the GoatCounter dashboard for a page view from the browser session. If an ad blocker suppresses the request, report that limitation rather than adding a fallback tracker.

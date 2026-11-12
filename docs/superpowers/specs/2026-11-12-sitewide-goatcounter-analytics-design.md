# Sitewide GoatCounter Analytics

## Context

The site is a static Astro portfolio deployed through GitHub Pages. It has no existing visitor analytics. Cloudflare Web Analytics is not usable for this hostname in the user's account: the dashboard will not add it unless the site is onboarded to Cloudflare. The site should remain on GitHub Pages.

The user wants sitewide aggregate traffic metrics, not individual visitor profiles, session replay, or custom event tracking.

## Decision

Use GoatCounter's hosted service and its official lightweight JavaScript counter. It supports externally hosted static sites, reports page views and referrers, does not use cookies or persistent visitor identifiers, and is free for reasonable public usage. GoatCounter's hosted dashboard remains the analytics interface; no server-side analytics service is added to this project.

## Integration

Add one conditional GoatCounter script to `BaseLayout.astro`, which wraps all site routes. The script is included only when the production build receives a `PUBLIC_GOATCOUNTER_ENDPOINT` value. The GitHub Pages workflow passes the public endpoint from a repository variable named `GOATCOUNTER_ENDPOINT` into that Astro build variable.

The endpoint is a public identifier embedded into the rendered HTML, not a credential. Do not store an account password or API key in the repository or workflow. Local builds and deployments without the variable omit the script and send no analytics.

The user must create a GoatCounter hosted site and set the repository variable to its counter endpoint, such as `https://<site-code>.goatcounter.com/count`, before production collection can begin.

## Privacy and scope

- Measure all site routes through the shared layout.
- Use GoatCounter's default page-view and referrer metrics only.
- Do not add custom events, user IDs, cookies, session replay, or advertising features.
- Do not proxy the site or change DNS/hosting.
- Do not add a consent banner as part of this integration. Review any applicable privacy-notice requirements separately; a cookie-free implementation does not by itself determine legal disclosure obligations.

## Failure behavior

If `GOATCOUNTER_ENDPOINT` is absent, the built site omits the script without failing the build. If the analytics script or endpoint is blocked or unavailable, the site remains usable and only analytics data is lost. Ad blockers may prevent some page views from being counted.

## Verification and acceptance

1. Build with the endpoint unset; verify no GoatCounter beacon is emitted.
2. Build with a valid endpoint; verify exactly one beacon appears on the homepage, blog index, and a blog article, with the configured endpoint.
3. Exercise a deployed page with browser network inspection and confirm the counter request is accepted and appears in the GoatCounter dashboard.
4. Confirm no route navigation or content behavior changes and the GitHub Pages build remains successful.

The final dashboard check requires the user's GoatCounter endpoint/account; it cannot be completed before that prerequisite is configured.

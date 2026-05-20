---
title: "Hack the Box: CriticalOps — JWT Forgery with Client-Side Secrets"
description: "A Bug Bounty CTF writeup on decoding JWTs, finding leaked client-side signing secrets, and forging admin authorization."
pubDate: 2025-06-30
readTime: "4 min read"
sourceUrl: "https://medium.com/@trewwwsec/hack-the-box-bug-bounty-ctf-playground-criticalops-exploiting-jwt-with-leaked-client-side-4d536247c17e"
tags: ["CTF Writeup", "JWT Security", "Client-Side Secrets"]
featured: true
---

## Challenge

CriticalOps is a monitoring and incident-reporting application for critical infrastructure. The objective was to hunt for security issues and retrieve the flag stored inside the site.

## Initial access and token review

After registering and logging in, the browser session exposed a JWT. Decoding the token showed a familiar risk pattern: the token used `HS256`, and authorization-relevant fields such as the user role were embedded directly in the payload.

That alone does not prove exploitation, but it sets the direction. If the signing secret can be recovered, the token can be re-signed with stronger privileges.

## Client-side secret discovery

The application appeared to be a Next.js app serving chunked JavaScript. Browser developer tools made it possible to inspect network requests and source bundles. Searching through client-side code for secret-like strings surfaced two candidates:

- `SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED`
- `SecretKey-CriticalOps-2025`

Tracing usage showed the first value appeared tied to login flow behavior, while the second value was connected to JWT creation logic. That made the JWT signing key the higher-value finding.

## Escalation path

Rather than only modifying the current account, the next step was to look for a likely privileged username. The registration endpoint at `/api/auth/register` leaked enough behavior to identify that `admin` was already registered.

With a likely target username and a recovered signing secret, the forged token needed only a few properties:

```js
const jwt = require('jsonwebtoken');

const secret = 'SecretKey-CriticalOps-2025';
const payload = {
  userId: 'd0b2b904-99d8-45b2-9b78-22e15d37613f',
  username: 'admin',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const forgedToken = jwt.sign(payload, secret, { algorithm: 'HS256' });
console.log(forgedToken);
```

Replacing the browser’s stored auth token with the forged token caused the application to expose an Admin Panel route. Visiting the admin area revealed the incident reports and the flag.

## Defensive notes

- Never ship signing secrets in client-side bundles.
- Prefer asymmetric JWT signing when clients do not need signing authority.
- Do not trust client-controlled role claims unless the server can validate them against authoritative state.
- Avoid user-enumeration behavior in registration flows.
- Monitor JavaScript bundles for accidentally embedded secrets before release.

Special thanks to Hack The Box and the jsonwebtoken/jwt.io teams.

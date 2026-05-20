---
title: "Hack the Box: NovaEnergy — API Queries and Information Disclosure"
description: "A Bug Bounty CTF writeup on finding exposed API documentation, leaking an email verification token, and turning that disclosure into account access."
pubDate: 2025-06-30
readTime: "2 min read"
sourceUrl: "https://medium.com/@trewwwsec/hack-the-box-bug-bounty-ctf-playground-novaenergy-exploiting-apis-with-unauthenticated-queries-e5960927d6eb"
tags: ["CTF Writeup", "API Security", "Information Disclosure"]
featured: true
---

## Challenge

NovaEnergy is an internal file-sharing application where access is intended to be limited to company employees. The target objective was to identify a vulnerability that could lead to a breach and retrieve the flag from the application.

## Process

The first signal came from the registration flow. Creating an account required an `@novaenergy.com` email address, and the account could not be used until email verification completed. That put the verification workflow on the critical path.

While interacting with login and registration, the application exposed API calls through the HTTP proxy. The API appeared to live under `/api`, so the next step was endpoint discovery with a common API endpoint wordlist. That led to API documentation exposed at `/api/docs`.

The Swagger interface was not just documentation; its “try it out” behavior queried the live production API. That made it possible to test the verification flow directly from the docs instead of switching tools.

## Finding

The `/api/email-verify` style endpoint expected a token, which meant the useful question became: where does that token live, and can a user retrieve it?

Another endpoint, `/api/userDetails`, returned user profile details. When queried for the newly registered account, it included the verification token. That turned the email-verification control into a self-service bypass: request user details, copy the leaked token, then submit it back to the verification endpoint.

## Exploit path

The exploit chain was short:

1. Register a new account with an allowed NovaEnergy email format.
2. Discover the API documentation and testable endpoints.
3. Query the user details endpoint.
4. Extract the leaked verification token.
5. Submit the email and token to the verification endpoint.
6. Log in with the now-verified account.
7. Download the exposed `flag.txt` file from the file area.

The key lesson is that verification tokens are authentication material. If an API returns them to an unverified user, the verification step becomes decorative rather than protective.

## Defensive notes

- Never return account activation or verification tokens from general user profile endpoints.
- Treat API documentation as production attack surface when it can execute live requests.
- Separate “identity exists” data from “identity can prove mailbox control” data.
- Add authorization checks around user detail endpoints even when the data appears low-risk.

Special thanks to Hack The Box, Assetnote, and SecLists.

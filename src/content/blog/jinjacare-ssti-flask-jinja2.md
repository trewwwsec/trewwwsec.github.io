---
title: "Hack The Box: JinjaCare — SSTI in Flask/Jinja2"
description: "A Bug Bounty CTF writeup on finding server-side template injection through profile fields and using rendered certificates to prove impact."
pubDate: 2025-06-29
readTime: "3 min read"
sourceUrl: "https://medium.com/@trewwwsec/hack-the-box-bug-bounty-ctf-wrietup-jinjacare-template-injection-in-python-flasks-jinja2-1a576f787737"
tags: ["CTF Writeup", "SSTI", "Flask", "Jinja2"]
featured: true
---

## Challenge

JinjaCare is a vaccination-record application that lets users store history and generate digital certificates. The objective was to find a security issue and retrieve the flag from the application.

## Finding the reflection point

Registration fields were validated tightly enough that direct payloads did not work during signup. After registration, however, the profile-edit flow allowed user-controlled values to be changed. That made profile fields the likely injection point.

The missing piece was reflection: where would those fields be rendered in a server-side template? The dashboard included a certificate download feature, and the generated vaccination certificate reflected the edited profile data.

That certificate became the test surface.

## Proving template execution

A simple Jinja2 expression in the profile name field was enough to prove server-side evaluation once the certificate was generated. From there, the payloads moved from arithmetic-style probes to environment inspection.

Dumping configuration exposed sensitive application data:

```text
{{ config.items() }}
```

The next step was local filesystem discovery through Python object access:

```text
{{ self.__init__.__globals__.__builtins__.__import__('os').listdir('/') }}
```

That directory listing showed `flag.txt` at the filesystem root.

## Reading the flag

Importing `os.open()` directly was not the cleanest route because it collided with the goal of using the local file-opening primitive. Using builtins through Flask/Jinja globals provided a working path:

```text
{{ get_flashed_messages.__globals__.__builtins__.open('/flag.txt').read() }}
```

Rendering the certificate with that payload returned the contents of the flag file.

## Defensive notes

- Never render user-controlled profile fields as templates.
- Treat document-generation features as high-risk reflection points.
- Escape untrusted data before inserting it into server-rendered templates.
- Avoid exposing Flask config secrets to template contexts when possible.
- Add tests that render user-controlled fields containing template delimiters such as `{{` and `{%`.

Special thanks to Hack The Box and PayloadsAllTheThings.

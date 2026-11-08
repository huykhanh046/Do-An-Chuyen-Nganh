# SSRF Security Report

## Status: PASS

## Findings

Server-Side Request Forgery (SSRF) requires a backend server capable of fetching URLs specified or influenced by users (such as webhook testers, link preview engines, PDF generators, or image proxies).

- **Backend Architecture**: HK Store is currently an architectural client-side static web application (HTML5, CSS3, Vanilla JS) running in the browser and persisted via Web Storage (`localStorage`).
- **Network Calls**: There are no backend services, serverless functions, or SSR runtimes making HTTP requests to external URLs based on user inputs.
- **Image/Media Sources**: All images and icons are served from local relative paths (`assets/images/`, `assets/icons/`) or trusted CDNs (Unsplash, Google Fonts). The application does not accept or fetch user-supplied remote image URLs.

## What's at risk

In applications with SSRF vulnerabilities, an attacker can coerce the backend server into sending requests to internal networks, accessing cloud metadata endpoints (e.g. `http://169.254.169.254/latest/meta-data/`), or scanning internal ports. Because HK Store has no backend fetching mechanism, it is immune to SSRF.

## What's already secure

- No user-controlled URL fetching mechanisms exist in the codebase.
- No remote proxying or link preview endpoints.

## Recommendations

- If a backend service is added in the future with remote URL fetching (e.g., automated receipt webhook dispatch or image upload from URL), implement strict allowlists for protocols (`http`, `https`), validate DNS resolution, and block private IP address ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`).

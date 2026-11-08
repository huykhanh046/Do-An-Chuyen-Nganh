# SECURITY_HEADERS Fix Plan

## Changes

- Created `_headers` for Cloudflare Pages and Netlify.
- Created `vercel.json` for Vercel edge deployment.
- Created `netlify.toml` for Netlify deployments.

## New files

- `_headers`
- `vercel.json`
- `netlify.toml`

## Verification goals

- [x] All 5 primary security headers configured (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- [x] `object-src 'none'` and `frame-ancestors 'none'` explicitly configured.
- [x] Strict-Transport-Security sets `max-age=31536000; includeSubDomains`.
- [x] Hosting configurations cover all paths (`/*`).

## Manual verification (for the human)

- Once deployed to Vercel/Netlify/Cloudflare, run `curl -I https://your-domain.com` or use `vibe-check check.py` to verify that all response headers are returned by the edge server.

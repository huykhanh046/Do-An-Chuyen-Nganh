# CORS Fix Plan

## Changes

- None required. No open or misconfigured CORS headers exist.

## New files

- None.

## Verification goals

- [x] No `Access-Control-Allow-Origin: *` configured for sensitive resources.
- [x] No dynamic origin reflection paired with credentials.
- [x] Edge/hosting configs (`_headers`, `vercel.json`, `netlify.toml`) do not introduce wildcard CORS vulnerabilities.

## Manual verification (for the human)

- Test API responses from another origin if a backend is deployed in the future, verifying that unauthorized origins receive a CORS error from the browser.

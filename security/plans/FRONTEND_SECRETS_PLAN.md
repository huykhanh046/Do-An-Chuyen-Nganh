# FRONTEND_SECRETS Fix Plan

## Changes

- No changes required. The frontend contains no private credentials or exposed source maps.

## New files

- None.

## Verification goals

- [x] No secret keys in any frontend file (`assets/js/`).
- [x] No source map files (`*.map`) in the repository.
- [x] No external sensitive requests dispatched from the browser.
- [x] No public environment variables containing confidential secrets.

## Manual verification (for the human)

- Open the browser DevTools (F12) -> Network tab, reload the page, and verify that no requests to external servers transmit proprietary API secrets or private tokens.

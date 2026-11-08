# SECRETS_EXPOSURE Fix Plan

## Changes

- Create `.env.example` with standard environment variable placeholders for future server integration.

## New files

- `.env.example`

## Verification goals

- [x] `git ls-files .env` returns nothing.
- [x] `.env.example` exists with placeholder values only.
- [x] No live secrets present in source code.

## Manual verification (for the human)

- Ensure that any future secret API keys or third-party tokens are loaded via server-side environment variables and never committed to git.

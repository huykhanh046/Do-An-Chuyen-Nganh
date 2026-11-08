# ERROR_HANDLING Fix Plan

## Changes

- `assets/js/ui.js`:
  - Added global `error` and `unhandledrejection` handlers to trap unexpected script errors and suppress internal diagnostic details.

## New files

- None.

## Verification goals

- [x] Global error and rejection handlers active in `setupGlobalEvents()`.
- [x] Application displays user-friendly error banners and empty states instead of unhandled crashes.
- [x] Zero debug or documentation endpoints exposed.

## Manual verification (for the human)

- Open browser console (F12) -> Console. Navigate through various pages, including invalid order URLs (`order-detail.html?id=INVALID`), and confirm that graceful empty states are rendered without unhandled script exceptions.

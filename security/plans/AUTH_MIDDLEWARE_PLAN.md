# AUTH_MIDDLEWARE Fix Plan

## Changes

- Client-side route guards are correctly implemented across all protected pages.
- Ensure that `order-success.html` verifies that the viewed order matches the currently authenticated user if not an admin.

## New files

- None.

## Verification goals

- [x] Unauthenticated access to `checkout.html` redirects to `login.html?returnUrl=checkout.html`.
- [x] Unauthenticated access to `account.html` redirects to `login.html?returnUrl=account.html`.
- [x] Non-admin access to `admin.html` redirects away.
- [x] Open redirects are blocked by `Auth.getSafeReturnUrl()`.

## Manual verification (for the human)

- Open `admin.html` in an Incognito window without logging in; verify that you are redirected to `login.html`.

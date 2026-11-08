# XSS Fix Plan

## Changes

- `assets/js/pages/product-page.js`:
  - Wrapped `c.name` and `c.code` in `Storage.escapeHTML()` when rendering color swatch buttons.
- `assets/js/pages/checkout-page.js`:
  - Wrapped `item.size` and `item.colorName` in `Storage.escapeHTML()` when generating cart item previews.
- Verified all other dynamic string interpolations in `order-success-page.js`, `cart-page.js`, `admin-page.js`, and `fashion-features.js`.

## New files

- None.

## Verification goals

- [x] Zero unescaped user-supplied inputs interpolated into `innerHTML`.
- [x] `Storage.escapeHTML()` correctly handles `<script>`, `"`, `'`, and `&` characters.
- [x] CSP policy blocks unauthorized inline/remote script execution.

## Manual verification (for the human)

1. Open `register.html` and register an account with full name `<script>alert(1)</script>`.
2. Navigate to `account.html` and `checkout.html`.
3. Verify that the name renders safely as plain text `<script>alert(1)</script>` and no alert popup triggers.

# PAYMENT_WEBHOOKS Fix Plan

## Changes

- None required. No live payment webhook endpoints are implemented in this client-side simulated architecture.

## New files

- None.

## Verification goals

- [x] Application does not expose unprotected payment webhook listeners.
- [x] Client payment gateway flow functions safely in sandboxed / simulated mode.

## Manual verification (for the human)

- Test the checkout process using VNPAY / MoMo QR code simulation, verifying that orders update their status correctly in local storage.

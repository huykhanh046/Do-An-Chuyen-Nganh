# CSRF Fix Plan

## Changes

- None required. Client-side localStorage authentication is immune to ambient cross-site cookie injection.

## New files

- None.

## Verification goals

- [x] Application does not rely on ambient session cookies for state-changing operations.
- [x] No `GET` link navigation triggers account modifications, payments, or order cancellations.
- [x] All state-modifying actions require explicit user interaction inside the authenticated origin.

## Manual verification (for the human)

- Verify that opening an external website in another tab cannot trigger an action (such as placing an order or cancelling an order) in HK Store.

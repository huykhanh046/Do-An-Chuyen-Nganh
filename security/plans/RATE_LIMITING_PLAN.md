# RATE_LIMITING Fix Plan

## Changes

- `assets/js/auth.js`:
  - Added `getLoginRateLimit()`, `recordFailedLogin()`, `clearLoginRateLimit()` to throttle password attempts.
  - Added `checkRegistrationRateLimit()` to throttle rapid registrations.
  - Implemented 5 failed attempts limit with 15-minute lockout and HTTP 429 status code return.

## New files

- None.

## Verification goals

- [x] Failed login attempts are recorded and decremented.
- [x] After 5 failed attempts, login requests are blocked with HTTP 429 status and lockout message.
- [x] Subsequent login requests remain locked out until the 15-minute window expires.
- [x] Successful login clears failed attempt records.
- [x] Automated test suite proves lockout and reset behavior.

## Manual verification (for the human)

1. Open `login.html`.
2. Enter `khach@hkstore.vn` with an incorrect password 5 times consecutively.
3. Verify that on the 5th attempt, an alert/toast informs you that the account has been locked for 15 minutes.

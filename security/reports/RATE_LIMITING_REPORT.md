# RATE_LIMITING Security Report

## Status: PASS

## Findings

Brute-force password guessing, credential stuffing, and automated registration spam were evaluated across authentication entry points:

1. **Previous State**:
   - `Auth.login(email, password)` did not track failed authentication attempts. A malicious script could execute thousands of password guesses against demo/seed accounts without being throttled.
   - `Auth.register(...)` did not throttle rapid successive account registrations.
2. **Implementation Applied (`assets/js/auth.js`)**:
   - **Login Rate Limiter**:
     - Configured `MAX_FAILED_ATTEMPTS = 5` and `LOCKOUT_MS = 15 * 60 * 1000` (15-minute lockout window).
     - Failed attempts are tracked per user email in `Storage.KEYS` (`hkstore_v1_rate_limit_login`).
     - Returns HTTP 401 status with the exact number of remaining attempts on failed login.
     - On reaching 5 failed attempts, the account is temporarily locked with HTTP 429 status and remaining lockout duration displayed to the user.
     - Successful login clears the failed attempts counter.
   - **Registration Rate Limiter**:
     - Configured `checkRegistrationRateLimit()` limiting registrations to a maximum of 5 accounts within any 10-minute sliding window. Exceeding this limit returns HTTP 429 status.

## What's at risk

Without rate limiting, attackers can perform automated dictionary attacks and credential stuffing to compromise user and administrator accounts, or flood the storage system with bogus customer registrations.

## What's already secure

- Client-side lockout prevents rapid automated password brute-forcing.
- Graceful lockout countdown notifications rendered to the user.
- Registration spam throttled to 5 per 10 minutes.

## Recommendations

- When connecting to a production backend API (Express / FastAPI / Supabase), implement IP-based and user-based rate limiting on the edge using Redis (`express-rate-limit` / `slow_api`) with strict IP resolution behind trusted reverse proxies (Cloudflare `CF-Connecting-IP`).

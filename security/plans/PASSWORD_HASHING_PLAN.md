# PASSWORD_HASHING Fix Plan

## Changes

- `assets/js/auth.js`:
  - Added cryptographic `sha256Sync` and `hashPassword(password, salt)` utilities.
  - Updated `Auth.register()` to store only salted `passwordHash`.
  - Updated `Auth.login()` to verify against `passwordHash` and automatically upgrade legacy plaintext passwords upon successful login.

## New files

- None.

## Verification goals

- [x] Passwords are never saved in plaintext in `localStorage`.
- [x] Salted cryptographic hashing is applied to all new users.
- [x] Legacy seed records automatically upgrade to salted hashes upon authentication.
- [x] Automated unit test suite verifies hashing, verification, and migration correctness.

## Manual verification (for the human)

1. Open `login.html` and log in with `khach@hkstore.vn` / `khach1234`.
2. Open DevTools (F12) -> Application -> Local Storage -> `hkstore_v1_users`.
3. Inspect the user object for `khach@hkstore.vn`: verify that `password` is absent and `passwordHash` contains a salted string (`<salt>$<sha256_hash>`).

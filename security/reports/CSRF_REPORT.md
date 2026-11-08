# CSRF Security Report

## Status: PASS

## Findings

Cross-Site Request Forgery (CSRF) exploits ambient browser credentials (session cookies or HTTP Basic Auth) that are automatically included with cross-site requests.

1. **Authentication Storage Model (`assets/js/auth.js`)**:
   - The application does not use ambient session cookies for authentication.
   - User authentication state is maintained exclusively in Web Storage (`localStorage.getItem('hk_auth_user')`).
   - Web Storage is bound to the Same-Origin Policy (SOP). A malicious third-party site cannot read or inject headers/payloads containing the user's `localStorage` session.
2. **State Mutation Triggers**:
   - All state-modifying actions (placing orders, cancelling orders, updating profile, adding/removing cart items, admin status changes) are driven by explicit DOM event listeners (`click`, `submit`) executing inside the local JavaScript context.
   - No `<a>` tag GET navigation triggers state mutation or account changes.
3. **Cross-Origin Form Submissions**:
   - Cross-origin `<form action="...">` submissions cannot execute local JavaScript functions or manipulate the origin's `localStorage`.

## What's at risk

In cookie-based applications lacking CSRF protection (`SameSite=Strict/Lax` or anti-CSRF synchronizer tokens), a malicious site can submit unauthorized requests on behalf of an authenticated user (e.g. transfer funds, place orders, change emails). Because HK Store does not rely on ambient session cookies, cross-origin requests carry no credentials.

## What's already secure

- Immune to classic cookie-based CSRF attacks due to `localStorage`-backed authentication.
- No state changes executed via simple GET link navigations.

## Recommendations

- When transitioning to a server-side session architecture in production, ensure session cookies are configured with:
  - `SameSite=Lax` (or `Strict` for critical banking/order mutations)
  - `HttpOnly`
  - `Secure`
  - Anti-CSRF tokens for state-changing endpoints (`POST`, `PUT`, `DELETE`).

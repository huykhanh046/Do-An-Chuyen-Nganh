# PAYMENT_WEBHOOKS Security Report

## Status: PASS (N/A)

## Findings

Inbound payment webhooks (e.g. Stripe Webhooks, VNPAY IPN, MoMo IPN) require an exposed HTTP server endpoint that receives asynchronous POST callbacks from payment service providers.

1. **Current Payment Implementation**:
   - The project supports three checkout payment methods:
     - Cash on Delivery (COD)
     - Bank Transfer (Vietcombank memo matching)
     - Online QR Gateway (VNPAY / MoMo simulated interactive gateway with 60s auto-refreshing QR codes)
   - Transactions are processed and confirmed directly in the client session without an external backend webhook endpoint.
2. **Third-Party Payment SDKs**:
   - The repository contains 0 Stripe, PayPal, or live payment webhook listener endpoints.

## What's at risk

In production web applications with unverified payment webhooks, an attacker can craft fake HTTP POST requests pretending to be Stripe or MoMo with `"status": "paid"`, granting free orders without genuine fund transfers.

## What's already secure

- No unverified webhook endpoints are exposed to the public internet.

## Recommendations

- When integrating live payment webhooks with Stripe, VNPAY, or MoMo on a production backend:
  1. Always verify the cryptographic signature (`stripe.Webhook.constructEvent` or HMAC-SHA256 signature check using your merchant secret key).
  2. Implement idempotency by tracking processed event / transaction IDs in the database to prevent replay attacks.
  3. Respond with HTTP 200 only after successful processing, and return HTTP 400/401 on signature mismatches.

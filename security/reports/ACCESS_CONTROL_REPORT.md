# ACCESS_CONTROL Security Report

## Status: PASS

## Findings

In this application architecture, authorization and resource ownership (Broken Object Level Authorization / IDOR prevention) were audited across all user-accessible resource flows:

1. **Order Detail View (`assets/js/pages/order-detail-page.js`)**:
   - Reads `orderId` parameter from URL (`?id=...`).
   - Retrieves the order via `HKStore.Orders.getById(orderId)`.
   - Validates ownership before rendering:
     ```javascript
     const currentUser = Auth.getCurrentUser();
     const isAdmin = currentUser && currentUser.role === "admin";
     if (!isAdmin && order.userId !== currentUser.id) {
       renderError("Bạn không có quyền truy cập vào thông tin đơn hàng này!");
       return;
     }
     ```
   - Prevents normal customers from viewing orders belonging to other customers even if they guess or modify the order ID in the URL.

2. **Order Cancellation (`assets/js/orders.js`)**:
   - Inside `Orders.cancelOrder(orderId, reason)`:
     ```javascript
     const currentUser = HK.Auth.getCurrentUser();
     const isAdmin = currentUser && currentUser.role === "admin";
     if (!isAdmin) {
       if (order.userId !== currentUser.id) {
         return { success: false, message: "Bạn không có quyền thao tác trên đơn hàng này." };
       }
     }
     ```
   - Regular users cannot cancel, tamper with, or refund another customer's order.

3. **User Profile & Order History (`assets/js/pages/account-page.js`)**:
   - `Orders.getByUserId(currentUser.id)` strictly filters orders matching the active authenticated session's user ID.
   - Profile update directly persists against `currentUser.id`.

4. **Cart Isolation (`assets/js/cart.js`)**:
   - Cart storage keys are namespaced per user (`hk_cart_${userId}`). Users cannot read or manipulate another user's cart.

5. **Admin Dashboard (`assets/js/pages/admin-page.js`)**:
   - Guarded with `Auth.requireAdmin()`.
   - Only accounts with `role === "admin"` can perform administrative operations (inventory modification, order status progression).

## What's at risk

Without resource-level ownership validation (IDOR), users could view personal information (shipping addresses, phone numbers, recipient names) and purchase histories of other customers, or maliciously cancel other customers' orders by guessing order IDs.

## What's already secure

- Explicit check `order.userId === currentUser.id` in both read (`order-detail-page.js`) and write (`orders.js: cancelOrder`).
- Strict user-scoping for order listings (`Orders.getByUserId`).
- Namespaced cart storage per user ID.
- Separation of concerns between general authentication (`Auth.requireAuth`) and object ownership verification.

## Recommendations

- When transitioning to a production backend API (Node.js/Express, Python/FastAPI, or Supabase), replicate this exact check at the API layer: `WHERE order.user_id = req.user.id` so that frontend bypass is impossible.

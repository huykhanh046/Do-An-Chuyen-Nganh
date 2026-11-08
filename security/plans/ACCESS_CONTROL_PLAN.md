# ACCESS_CONTROL Fix Plan

## Changes

- No code modifications required; access control and resource ownership checks are already implemented across all sensitive workflows (`order-detail-page.js`, `orders.js`, `account-page.js`, and `cart.js`).

## New files

- None.

## Verification goals

- [x] Every view with a resource ID parameter checks `order.userId === currentUser.id` or `currentUser.role === 'admin'`.
- [x] Read operations (`order-detail.html?id=...`) reject unowned orders with a 403-equivalent user error block.
- [x] Write operations (`Orders.cancelOrder`) return failure if the non-admin user is not the order creator.
- [x] Account history strictly filters `Orders.getByUserId(currentUser.id)`.
- [x] Cart storage is isolated per user ID (`hk_cart_${userId}`).

## Manual verification (for the human)

1. Log in as regular customer `khach@hkstore.vn`.
2. Navigate to `order-detail.html?id=ORD-ADMIN-001` (an order belonging to `admin@hkstore.vn`).
3. Verify that the screen shows "Bạn không có quyền truy cập vào thông tin đơn hàng này!" and does not render any order details.

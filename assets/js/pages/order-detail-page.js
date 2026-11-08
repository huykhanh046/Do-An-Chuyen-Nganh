/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Chi tiết Đơn hàng (Order Detail)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Auth = HKStore.Auth;
  const Orders = HKStore.Orders;
  const UI = HKStore.UI;

  function initOrderDetailPage() {
    if (!Auth.requireAuth("order-detail.html")) return;

    UI.initCommonUI();

    const orderId = Storage.getUrlParam("id");
    if (!orderId) {
      renderError("Không tìm thấy mã đơn hàng yêu cầu.");
      return;
    }

    const order = Orders.getById(orderId);
    if (!order) {
      renderError("Đơn hàng không tồn tại trong hệ thống.");
      return;
    }

    const currentUser = Auth.getCurrentUser();
    const isAdmin = currentUser && currentUser.role === "admin";

    // Kiểm tra quyền sở hữu đơn hàng
    if (!isAdmin && order.userId !== currentUser.id) {
      renderError("Bạn không có quyền truy cập vào thông tin đơn hàng này!");
      return;
    }

    renderOrderDetail(order, isAdmin);
  }

  function renderError(message) {
    const container = document.getElementById("order-detail-card");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <h1 style="font-size: 1.35rem; margin-bottom: 6px;">Thông báo đơn hàng</h1>
          <p class="text-muted">${Storage.escapeHTML(message)}</p>
          <a href="account.html" class="btn btn-primary" style="margin-top: 16px;">Về trang đơn hàng của tôi</a>
        </div>
      `;
    }
  }

  function renderOrderDetail(order, isAdmin) {
    const statusNames = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao",
      delivered: "Đã giao",
      cancelled: "Đã hủy"
    };

    const paymentStatusNames = {
      pending: "Chờ thanh toán",
      paid: "Đã thanh toán",
      refund_pending: "Chờ hoàn tiền",
      refunded: "Đã hoàn tiền"
    };

    const idEl = document.getElementById("order-id");
    const dateEl = document.getElementById("order-date");
    const statusEl = document.getElementById("order-status-badge");
    const paymentStatusEl = document.getElementById("order-payment-badge");
    const paymentMethodEl = document.getElementById("order-payment-method");
    const recipientEl = document.getElementById("order-recipient-info");
    const itemsTbody = document.getElementById("order-items-tbody");
    const subtotalEl = document.getElementById("order-subtotal");
    const shippingEl = document.getElementById("order-shipping");
    const totalEl = document.getElementById("order-total");
    const cancelActionWrap = document.getElementById("order-cancel-wrap");

    if (idEl) idEl.textContent = order.id;
    if (dateEl) dateEl.textContent = Storage.formatDate(order.createdAt);

    if (statusEl) {
      statusEl.className = `badge badge-status-${order.orderStatus}`;
      statusEl.textContent = statusNames[order.orderStatus] || order.orderStatus;
    }

    if (paymentStatusEl) {
      paymentStatusEl.className = `badge badge-payment-${order.paymentStatus}`;
      paymentStatusEl.textContent = paymentStatusNames[order.paymentStatus] || order.paymentStatus;
    }

    let pMethod = "Thanh toán khi nhận hàng (COD)";
    if (order.paymentMethod === "banking") pMethod = "Chuyển khoản Ngân hàng (Vietcombank)";
    if (order.paymentMethod === "gateway") {
      if (order.paymentProvider === "momo") pMethod = "Ví điện tử MoMo (Quét mã QR)";
      else if (order.paymentProvider === "vnpay") pMethod = "Cổng thanh toán VNPAY-QR";
      else pMethod = "Cổng thanh toán VNPAY / Ví MoMo (QR)";
      if (order.paymentRef) pMethod += ` — Mã phiên: ${order.paymentRef}`;
    }
    if (paymentMethodEl) paymentMethodEl.textContent = pMethod;

    const bankBoxEl = document.getElementById("order-bank-transfer-box");
    if (bankBoxEl) {
      if (order.paymentMethod === "banking" && order.paymentStatus === "pending" && order.orderStatus !== "cancelled") {
        const transferMemo = `${order.id} ${order.customerInfo.phone}`;
        bankBoxEl.classList.remove("hidden");
        bankBoxEl.innerHTML = `
          <div class="bank-transfer-box">
            <div class="bank-transfer-row">
              <span>Vietcombank · STK: <strong class="tabular-nums">686868686868</strong></span>
              <button type="button" class="copy-chip-btn js-copy-text" data-copy="686868686868">Sao chép STK</button>
            </div>
            <div class="bank-transfer-row">
              <span>Nội dung: <strong>${Storage.escapeHTML(transferMemo)}</strong></span>
              <button type="button" class="copy-chip-btn js-copy-text" data-copy="${Storage.escapeHTML(transferMemo)}">Sao chép</button>
            </div>
          </div>
        `;
      } else {
        bankBoxEl.classList.add("hidden");
      }
    }

    if (recipientEl) {
      recipientEl.innerHTML = `
        <p><strong>Người nhận:</strong> ${Storage.escapeHTML(order.customerInfo.fullName)}</p>
        <p><strong>Số điện thoại:</strong> ${Storage.escapeHTML(order.customerInfo.phone)}</p>
        <p><strong>Email:</strong> ${Storage.escapeHTML(order.customerInfo.email)}</p>
        <p><strong>Địa chỉ nhận hàng:</strong> ${Storage.escapeHTML(order.customerInfo.address)}</p>
        ${order.customerInfo.note ? `<p><strong>Ghi chú:</strong> ${Storage.escapeHTML(order.customerInfo.note)}</p>` : ""}
        ${order.cancelReason ? `<p class="text-danger"><strong>Lý do hủy:</strong> ${Storage.escapeHTML(order.cancelReason)}</p>` : ""}
      `;
    }

    if (itemsTbody) {
      const ProductsSvc = HKStore.Products;
      itemsTbody.innerHTML = order.items
        .map((item) => {
          const currentProd = ProductsSvc ? ProductsSvc.getById(item.productId) : null;
          const isDeleted = !currentProd;

          return `
            <tr ${isDeleted ? 'style="background-color: var(--color-bg);"' : ""}>
              <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                  <img src="${item.image || "assets/images/placeholder.svg"}" alt="${Storage.escapeHTML(item.name)}" style="width: 50px; aspect-ratio: 3/4; object-fit: cover; border-radius: 2px; ${
            isDeleted ? "opacity: 0.72;" : ""
          }" onerror="this.src='assets/images/placeholder.svg'" />
                  <div>
                    ${
                      isDeleted
                        ? `<strong>${Storage.escapeHTML(item.name)}</strong> <span class="badge badge-out" style="font-size: 0.65rem; margin-left: 6px;">Ngừng kinh doanh</span>`
                        : `<a href="product.html?id=${encodeURIComponent(item.productId)}" style="font-weight: 700;">${Storage.escapeHTML(item.name)}</a>`
                    }
                    <div class="text-muted"><small>SKU: ${Storage.escapeHTML(item.sku || "N/A")} | Size: ${Storage.escapeHTML(item.size)} | Màu: ${Storage.escapeHTML(item.colorName)}</small></div>
                  </div>
                </div>
              </td>
              <td>${Storage.formatCurrency(item.price)}</td>
              <td class="text-center">${item.quantity}</td>
              <td class="font-bold text-right">${Storage.formatCurrency(item.lineTotal)}</td>
            </tr>
          `;
        })
        .join("");
    }

    if (subtotalEl) subtotalEl.textContent = Storage.formatCurrency(order.subtotal);
    if (shippingEl) shippingEl.textContent = order.shippingFee === 0 ? "MIỄN PHÍ" : Storage.formatCurrency(order.shippingFee);
    if (totalEl) totalEl.textContent = Storage.formatCurrency(order.total);

    // Xử lý nút Hủy đơn cho khách hàng
    if (cancelActionWrap) {
      const canCancel = order.orderStatus === "pending" || (isAdmin && order.orderStatus === "confirmed");
      if (canCancel) {
        cancelActionWrap.innerHTML = `
          <button type="button" class="btn btn-danger btn-sm js-cancel-current-order">
            Hủy đơn hàng này
          </button>
        `;
        cancelActionWrap.querySelector(".js-cancel-current-order").addEventListener("click", () => {
          UI.showConfirm(
            "Bạn có chắc chắn muốn hủy đơn hàng này? Toàn bộ số lượng sản phẩm sẽ được hoàn lại kho.",
            () => {
              const res = Orders.cancelOrder(order.id, isAdmin ? "Admin hủy đơn" : "Khách hàng hủy đơn");
              if (res.success) {
                UI.showToast(res.message, "success");
                initOrderDetailPage(); // Vẽ lại giao diện
              } else {
                UI.showToast(res.message, "error");
              }
            }
          );
        });
      } else {
        cancelActionWrap.innerHTML = "";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initOrderDetailPage);
})();

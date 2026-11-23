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

    const printInvoiceBtn = document.getElementById("btn-detail-print-invoice");
    if (printInvoiceBtn) {
      printInvoiceBtn.addEventListener("click", () => {
        if (HKStore.EmailService && typeof HKStore.EmailService.openPrintableInvoicePDF === "function") {
          HKStore.EmailService.openPrintableInvoicePDF(order);
        }
      });
    }

    // Nếu người dùng mở từ nút "Tải Hóa Đơn PDF" trong Gmail (?invoice=pdf)
    if (Storage.getUrlParam("invoice") === "pdf") {
      setTimeout(() => {
        if (HKStore.EmailService && typeof HKStore.EmailService.openPrintableInvoicePDF === "function") {
          HKStore.EmailService.openPrintableInvoicePDF(order);
        }
      }, 350);
    }
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

  function renderTrackingSection(order) {
    const trackingEl = document.getElementById("order-tracking-section");
    if (!trackingEl) return;

    const steps = [
      { key: "pending", label: "Đặt hàng thành công", desc: "Chờ cửa hàng xác nhận" },
      { key: "confirmed", label: "Đã xác nhận", desc: "Đang đóng gói & lên đơn" },
      { key: "shipping", label: "Đang giao hàng", desc: "Đã bàn giao cho ĐVVC" },
      { key: "delivered", label: "Đã giao thành công", desc: "Khách đã nhận hàng" }
    ];

    const statusOrder = ["pending", "confirmed", "shipping", "delivered"];
    const currentIdx = statusOrder.indexOf(order.orderStatus);
    const isCancelled = order.orderStatus === "cancelled";

    const carrierCode = order.shippingCarrier || "spx";
    const carrierName =
      order.shippingCarrierName || (Orders.getCarrierName ? Orders.getCarrierName(carrierCode) : "Đơn vị vận chuyển");
    const trackingCode = (order.trackingCode || "").trim();
    const trackingUrl =
      trackingCode && Orders.getCarrierTrackingUrl
        ? Orders.getCarrierTrackingUrl(carrierCode, trackingCode)
        : "#";

    const stepperHtml = isCancelled
      ? `
        <div style="padding: 12px 16px; background: #FDF2F2; border: 1px solid #F5C6CB; border-radius: 4px; color: #9B1C1C; font-size: 0.9rem; margin-bottom: 14px;">
          <strong>Đơn hàng đã bị hủy.</strong> ${order.cancelReason ? `Lý do: ${Storage.escapeHTML(order.cancelReason)}` : ""}
        </div>
      `
      : `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
          ${steps
            .map((step, idx) => {
              const isDone = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              const borderColor = isCurrent ? "#111" : isDone ? "#1B6E32" : "var(--color-border)";
              const bgColor = isCurrent ? "#111" : isDone ? "#EEF7F0" : "#FAFAFA";
              const textColor = isCurrent ? "#FFF" : isDone ? "#1B6E32" : "var(--color-text-muted)";

              return `
                <div style="border: 1px solid ${borderColor}; background: ${bgColor}; color: ${textColor}; padding: 10px 12px; border-radius: 4px; transition: all 0.2s;">
                  <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; opacity: 0.85; margin-bottom: 2px;">
                    Bước ${idx + 1} ${isDone ? "✓" : ""}
                  </div>
                  <div style="font-size: 0.86rem; font-weight: 800;">${step.label}</div>
                  <div style="font-size: 0.74rem; opacity: 0.85; margin-top: 2px;">${step.desc}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;

    const trackingBoxHtml = !isCancelled
      ? `
        <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px;">
              Thông tin vận chuyển &amp; Mã vận đơn giao hàng
            </div>
            ${
              trackingCode
                ? `
                  <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <span style="font-size: 0.92rem;">Đơn vị vận chuyển: <strong>${Storage.escapeHTML(carrierName)}</strong></span>
                    <span style="color: var(--color-border-dark);">|</span>
                    <span style="font-size: 0.92rem;">Mã vận đơn: <strong style="font-family: monospace; font-size: 1rem; background: #FFF; padding: 3px 8px; border: 1px solid var(--color-border-dark); border-radius: 3px; letter-spacing: 0.04em;">${Storage.escapeHTML(trackingCode)}</strong></span>
                  </div>
                  ${
                    order.trackingUpdatedAt
                      ? `<div class="text-muted" style="font-size: 0.76rem; margin-top: 4px;">Cập nhật lúc: ${Storage.formatDate(order.trackingUpdatedAt)}</div>`
                      : ""
                  }
                `
                : `
                  <div style="font-size: 0.9rem; color: var(--color-text);">
                    <strong>Mã vận đơn giao hàng:</strong> <span class="text-muted">Đang chờ cập nhật từ đơn vị vận chuyển</span>
                  </div>
                  <div class="text-muted" style="font-size: 0.78rem; margin-top: 2px;">
                    ${
                      order.orderStatus === "shipping"
                        ? "Đơn hàng đang được bàn giao cho đơn vị vận chuyển, mã vận đơn sẽ sớm được hiển thị tại đây."
                        : "Mã vận đơn sẽ được cửa hàng cập nhật ngay khi đơn hàng chuyển sang trạng thái Đang giao."
                    }
                  </div>
                `
            }
          </div>

          ${
            trackingCode
              ? `
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <button type="button" class="btn btn-secondary btn-sm js-copy-text" data-copy="${Storage.escapeHTML(trackingCode)}">
                    Sao chép mã vận đơn
                  </button>
                  <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                    Tra cứu tiến trình đơn hàng &nearr;
                  </a>
                </div>
              `
              : ""
          }
        </div>
      `
      : "";

    trackingEl.innerHTML = `
      <h2 style="font-size: 0.98rem; font-weight: 800; letter-spacing: 0; margin-bottom: 10px;">
        Tiến trình đơn hàng &amp; Mã vận đơn giao hàng
      </h2>
      ${stepperHtml}
      ${trackingBoxHtml}
    `;
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

    renderTrackingSection(order);

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

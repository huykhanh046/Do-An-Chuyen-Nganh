/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Xác nhận Đặt hàng Thành công (Order Success)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Orders = HKStore.Orders;
  const UI = HKStore.UI;

  function initOrderSuccessPage() {
    UI.initCommonUI();

    const orderId = Storage.getUrlParam("orderId");
    if (!orderId) {
      window.location.href = "index.html";
      return;
    }

    const order = Orders.getById(orderId);
    if (!order) {
      document.getElementById("order-success-card").innerHTML = `
        <div class="empty-state">
          <h2 style="font-size: 1.25rem; margin-bottom: 6px;">Không tìm thấy đơn hàng</h2>
          <p class="text-muted">Mã đơn hàng không hợp lệ hoặc đã bị xóa.</p>
          <a href="index.html" class="btn btn-primary" style="margin-top: 16px;">Về trang chủ</a>
        </div>
      `;
      return;
    }

    renderSuccessDetails(order);
  }

  function renderSuccessDetails(order) {
    const codeEl = document.getElementById("success-order-code");
    const dateEl = document.getElementById("success-order-date");
    const paymentEl = document.getElementById("success-order-payment");
    const bankBoxEl = document.getElementById("success-bank-transfer-box");
    const customerEl = document.getElementById("success-order-customer");
    const itemsEl = document.getElementById("success-order-items");
    const totalEl = document.getElementById("success-order-total");
    const detailLink = document.getElementById("success-detail-link");

    if (codeEl) codeEl.textContent = order.id;
    if (dateEl) dateEl.textContent = Storage.formatDate(order.createdAt);

    let paymentMethodText = "COD (Thanh toán khi nhận hàng)";
    if (order.paymentMethod === "banking") paymentMethodText = "Chuyển khoản Ngân hàng";
    if (order.paymentMethod === "gateway") {
      if (order.paymentProvider === "momo") paymentMethodText = "Ví điện tử MoMo (Quét mã QR)";
      else if (order.paymentProvider === "vnpay") paymentMethodText = "Cổng thanh toán VNPAY-QR";
      else paymentMethodText = "Cổng VNPAY / Ví MoMo (QR)";
    }

    let paymentBadgeClass = "badge-payment-pending";
    let paymentBadgeText = "Chờ thanh toán";
    if (order.paymentStatus === "paid") {
      paymentBadgeClass = "badge-payment-paid";
      paymentBadgeText = "Đã thanh toán";
    }

    if (paymentEl) {
      const refHtml = order.paymentRef ? ` <small class="text-muted tabular-nums">(${Storage.escapeHTML(order.paymentRef)})</small>` : "";
      paymentEl.innerHTML = `${paymentMethodText}${refHtml} • <span class="badge ${paymentBadgeClass}">${paymentBadgeText}</span>`;
    }

    if (bankBoxEl) {
      if (order.paymentMethod === "banking" && order.paymentStatus !== "paid") {
        const transferMemo = `${order.id} ${order.customerInfo.phone}`;
        bankBoxEl.classList.remove("hidden");
        bankBoxEl.innerHTML = `
          <div class="bank-transfer-box" style="background-color: var(--color-surface);">
            <strong style="font-size: 0.85rem;">Hướng dẫn chuyển khoản hoàn tất đơn hàng:</strong>
            <div class="bank-transfer-row">
              <span>Ngân hàng: <strong>Vietcombank — CN TP DA NANG</strong></span>
            </div>
            <div class="bank-transfer-row">
              <span>Chủ TK: <strong>CONG TY TNHH HK STORE VIET NAM</strong></span>
            </div>
            <div class="bank-transfer-row">
              <span>Số tài khoản: <strong class="tabular-nums">686868686868</strong></span>
              <button type="button" class="copy-chip-btn js-copy-text" data-copy="686868686868">Sao chép STK</button>
            </div>
            <div class="bank-transfer-row">
              <span>Nội dung CK: <strong>${Storage.escapeHTML(transferMemo)}</strong></span>
              <button type="button" class="copy-chip-btn js-copy-text" data-copy="${Storage.escapeHTML(transferMemo)}">Sao chép nội dung</button>
            </div>
          </div>
        `;
      } else {
        bankBoxEl.classList.add("hidden");
      }
    }

    if (customerEl) {
      customerEl.innerHTML = `
        <strong>${Storage.escapeHTML(order.customerInfo.fullName)}</strong> (${Storage.escapeHTML(order.customerInfo.phone)})<br/>
        ${Storage.escapeHTML(order.customerInfo.address)}
      `;
    }

    if (itemsEl) {
      itemsEl.innerHTML = order.items
        .map((item) => {
          const currentProd = HKStore.Products ? HKStore.Products.getById(item.productId) : null;
          const isDeleted = !currentProd;

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--color-border); font-size: 0.9rem;">
              <div>
                <strong>${Storage.escapeHTML(item.name)}</strong>
                ${isDeleted ? '<span class="badge badge-out" style="font-size:0.65rem;margin-left:6px;">Ngừng kinh doanh</span>' : ""}
                <div class="text-muted"><small>${Storage.escapeHTML(item.size)} - ${Storage.escapeHTML(item.colorName)} × ${item.quantity}</small></div>
              </div>
              <div class="font-bold tabular-nums">${Storage.formatCurrency(item.lineTotal)}</div>
            </div>
          `;
        })
        .join("");
    }

    if (totalEl) totalEl.textContent = Storage.formatCurrency(order.total);
    if (detailLink) detailLink.href = `order-detail.html?id=${order.id}`;

    const emailBanner = document.getElementById("success-email-banner");
    if (emailBanner && order.customerInfo && order.customerInfo.email) {
      emailBanner.innerHTML = `
        <strong>📧 Đã gửi Email xác nhận &amp; Hóa đơn điện tử:</strong> Thông tin chi tiết đơn hàng <strong>#${Storage.escapeHTML(order.id)}</strong> kèm link theo dõi vận đơn đã được gửi tự động tới hộp thư <strong>${Storage.escapeHTML(order.customerInfo.email)}</strong>.
      `;
    }

    const printBtn = document.getElementById("btn-success-print-invoice");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        if (HKStore.EmailService && typeof HKStore.EmailService.openPrintableInvoicePDF === "function") {
          HKStore.EmailService.openPrintableInvoicePDF(order);
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initOrderSuccessPage);
})();

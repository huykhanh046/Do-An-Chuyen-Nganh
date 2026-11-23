/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Tài khoản Khách hàng (Profile & Lịch sử Đơn hàng)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Auth = HKStore.Auth;
  const Orders = HKStore.Orders;
  const UI = HKStore.UI;

  let currentUser = null;

  function initAccountPage() {
    if (!Auth.requireAuth("account.html")) return;

    currentUser = Auth.getCurrentUser();
    UI.initCommonUI();

    setupTabs();
    populateProfileForm();
    renderOrdersHistory();
  }

  function setupTabs() {
    const tabBtns = Array.from(document.querySelectorAll(".js-account-tab-btn"));
    const tabPanes = document.querySelectorAll(".js-account-tab-pane");
    let currentIdx = 0;

    tabBtns.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("active")) return;
        const targetTab = btn.getAttribute("data-tab");
        const direction = idx >= currentIdx ? 1 : -1;
        currentIdx = idx;

        tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const activePane = document.getElementById(`tab-pane-${targetTab}`);
        if (activePane) {
          UI.switchTabPane(tabPanes, activePane, direction);
        }
      });
    });
  }

  function populateProfileForm() {
    const nameInput = document.getElementById("profile-name");
    const emailInput = document.getElementById("profile-email");
    const phoneInput = document.getElementById("profile-phone");
    const addressInput = document.getElementById("profile-address");
    const roleBadge = document.getElementById("profile-role-badge");

    if (nameInput) nameInput.value = currentUser.fullName || "";
    if (emailInput) emailInput.value = currentUser.email || "";
    if (phoneInput) phoneInput.value = currentUser.phone || "";
    if (addressInput) addressInput.value = currentUser.address || "";
    if (roleBadge) {
      roleBadge.textContent = currentUser.role === "admin" ? "Quản trị viên (Admin)" : "Khách hàng thân thiết";
    }

    const form = document.getElementById("profile-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        [nameInput, phoneInput].forEach((el) => UI.clearFieldError && UI.clearFieldError(el));

        const res = Auth.updateProfile({
          fullName: nameInput.value.trim(),
          phone: phoneInput.value.trim(),
          address: addressInput.value.trim()
        });

        if (res.success) {
          currentUser = res.user;
          if (phoneInput) phoneInput.value = currentUser.phone || "";
          UI.showToast("Cập nhật thông tin cá nhân thành công!", "success");
        } else {
          if (res.field === "name" && nameInput) {
            UI.setFieldError(nameInput, res.message);
            nameInput.focus();
          } else if (res.field === "phone" && phoneInput) {
            UI.setFieldError(phoneInput, res.message);
            phoneInput.focus();
          }
          UI.showToast(res.message, "error");
        }
      });
    }
  }

  function renderOrdersHistory() {
    const container = document.getElementById("orders-history-container");
    if (!container) return;

    const userOrders = Orders.getByUserId(currentUser.id);

    if (userOrders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h2 style="font-size: 1.2rem; margin-bottom: 6px;">Bạn chưa có đơn hàng nào</h2>
          <p class="text-muted">Khám phá các sản phẩm streetwear mới nhất tại HK Store ngay!</p>
          <a href="products.html" class="btn btn-primary btn-sm" style="margin-top: 16px;">Khám phá bộ sưu tập</a>
        </div>
      `;
      return;
    }

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

    container.innerHTML = userOrders
      .map((ord) => {
        const canCancel = ord.orderStatus === "pending";
        const trackingCode = (ord.trackingCode || "").trim();
        const carrierCode = ord.shippingCarrier || "spx";
        const carrierName =
          ord.shippingCarrierName || (Orders.getCarrierName ? Orders.getCarrierName(carrierCode) : "Đơn vị vận chuyển");
        const trackingUrl =
          trackingCode && Orders.getCarrierTrackingUrl
            ? Orders.getCarrierTrackingUrl(carrierCode, trackingCode)
            : "#";

        return `
        <div class="order-card">
          <div class="order-card-header">
            <div>
              <span class="font-bold">${ord.id}</span>
              <span class="text-muted" style="margin-left: 8px;"><small>${Storage.formatDate(ord.createdAt)}</small></span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="badge badge-status-${ord.orderStatus}">
                ${statusNames[ord.orderStatus] || ord.orderStatus}
              </span>
              <span class="badge badge-payment-${ord.paymentStatus}">
                ${paymentStatusNames[ord.paymentStatus] || ord.paymentStatus}
              </span>
            </div>
          </div>

          ${
            trackingCode || ord.orderStatus === "shipping" || ord.orderStatus === "delivered"
              ? `
            <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.84rem;">
              <div>
                <span class="text-muted">Mã vận đơn giao hàng:</span>
                ${
                  trackingCode
                    ? `<strong style="font-family: monospace; margin-left: 6px; padding: 2px 6px; background: #FFF; border: 1px solid var(--color-border-dark); border-radius: 2px;">${Storage.escapeHTML(trackingCode)}</strong>
                       <span class="text-muted" style="margin-left: 6px;">(${Storage.escapeHTML(carrierName)})</span>`
                    : `<span class="text-muted" style="margin-left: 6px;">Đang cập nhật mã từ ĐVVC...</span>`
                }
              </div>
              ${
                trackingCode
                  ? `
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button type="button" class="copy-chip-btn js-copy-text" data-copy="${Storage.escapeHTML(trackingCode)}">Sao chép mã</button>
                  <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="font-weight: 700; text-decoration: underline; font-size: 0.8rem;">Tra cứu vận đơn &nearr;</a>
                </div>
              `
                  : ""
              }
            </div>
          `
              : ""
          }

          <div class="order-card-body" style="margin-bottom: 16px;">
            ${ord.items
              .map((item) => {
                const currentProd = HKStore.Products ? HKStore.Products.getById(item.productId) : null;
                const isDeleted = !currentProd;

                return `
                  <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: center; font-size: 0.88rem; ${
                    isDeleted ? "background: var(--color-bg); padding: 6px 8px; border-radius: 4px;" : ""
                  }">
                    <img src="${item.image || "assets/images/placeholder.svg"}" alt="${Storage.escapeHTML(item.name)}" style="width: 44px; aspect-ratio: 3/4; object-fit: cover; border-radius: 2px; ${
                  isDeleted ? "opacity: 0.72;" : ""
                }" onerror="this.src='assets/images/placeholder.svg'" />
                    <div style="flex-grow: 1;">
                      <strong>${Storage.escapeHTML(item.name)}</strong>
                      ${
                        isDeleted
                          ? '<span class="badge badge-out" style="font-size: 0.65rem; margin-left: 6px;">Ngừng kinh doanh</span>'
                          : ""
                      }
                      <div class="text-muted"><small>Size: ${Storage.escapeHTML(item.size)} | Màu: ${Storage.escapeHTML(item.colorName)} × ${item.quantity}</small></div>
                    </div>
                    <div class="font-bold tabular-nums">${Storage.formatCurrency(item.lineTotal)}</div>
                  </div>
                `;
              })
              .join("")}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border); padding-top: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              Tổng tiền: <strong class="tabular-nums" style="font-size: 1.1rem; color: var(--color-primary);">${Storage.formatCurrency(ord.total)}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
              ${
                canCancel
                  ? `<button type="button" class="btn btn-secondary btn-sm js-cancel-order" data-id="${ord.id}">Hủy đơn hàng</button>`
                  : ""
              }
              <a href="order-detail.html?id=${ord.id}" class="btn btn-primary btn-sm">Xem chi tiết</a>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    // Gắn sự kiện hủy đơn
    container.querySelectorAll(".js-cancel-order").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-id");
        UI.showConfirm(
          "Bạn có chắc chắn muốn hủy đơn hàng này? Tồn kho của các sản phẩm sẽ được tự động hoàn lại.",
          () => {
            const res = Orders.cancelOrder(orderId, "Khách hàng chủ động hủy qua trang cá nhân");
            if (res.success) {
              UI.showToast(res.message, "success");
              renderOrdersHistory();
            } else {
              UI.showToast(res.message, "error");
            }
          }
        );
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initAccountPage);
})();

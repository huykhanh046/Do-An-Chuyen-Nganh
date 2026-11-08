/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Đặt hàng & Thanh toán (Checkout Page)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Auth = HKStore.Auth;
  const Cart = HKStore.Cart;
  const Orders = HKStore.Orders;
  const UI = HKStore.UI;

  // =========================================================================
  // CẤU HÌNH CỔNG THANH TOÁN QR VNPAY / MOMO (CÓ THỂ ĐỔI ẢNH QR TẠI ĐÂY)
  // Hỗ trợ mọi định dạng ảnh (.png, .jpg, .webp, .svg). Cũng có thể đổi trực
  // tiếp trên thuộc tính data-qr-vnpay / data-qr-momo trong file checkout.html
  // =========================================================================
  const QR_PAYMENT_CONFIG = {
    refreshSeconds: 60, // Bắt buộc làm mới mã QR sau mỗi 60 giây
    providers: {
      vnpay: {
        id: "vnpay",
        shortName: "VNPAY-QR",
        title: "Cổng thanh toán VNPAY-QR",
        qrImage: "assets/images/VNPAY.jpg",
        instruction: "Mở ứng dụng Ngân hàng (Mobile Banking) hoặc Ví VNPAY, chọn Quét mã QR để thanh toán."
      },
      momo: {
        id: "momo",
        shortName: "Ví MoMo",
        title: "Cổng thanh toán Ví điện tử MoMo",
        qrImage: "assets/images/MOMO.jpg",
        instruction: "Mở ứng dụng MoMo trên điện thoại, chọn Quét mã để hoàn tất thanh toán."
      }
    }
  };

  let isSubmitting = false;

  function initCheckoutPage() {
    // 1. Kiểm tra đăng nhập (Bảo vệ luồng thanh toán)
    if (!Auth.requireAuth("checkout.html")) {
      return;
    }

    UI.initCommonUI();

    // 2. Kiểm tra giỏ hàng
    const currentUser = Auth.getCurrentUser();
    const summary = Cart.getCartSummary(currentUser.id);

    if (!summary.items || summary.items.length === 0) {
      window.location.href = "cart.html";
      return;
    }

    renderOrderSummary(summary);
    populateUserInfo(currentUser);
    setupPaymentMethodTabs();
    setupFormSubmission();
  }

  // Điền thông tin cá nhân của user đang đăng nhập
  function populateUserInfo(user) {
    const nameInput = document.getElementById("checkout-name");
    const emailInput = document.getElementById("checkout-email");
    const phoneInput = document.getElementById("checkout-phone");
    const addressInput = document.getElementById("checkout-address");

    if (nameInput) nameInput.value = user.fullName || "";
    if (emailInput) {
      emailInput.value = user.email || "";
      emailInput.readOnly = true; // Email cố định theo tài khoản
    }
    if (phoneInput) phoneInput.value = user.phone || "";
    if (addressInput) addressInput.value = user.address || "";
  }

  // Vẽ danh sách tóm tắt đơn hàng bên cột phải
  function renderOrderSummary(summary) {
    const itemsList = document.getElementById("checkout-items-list");
    const subtotalEl = document.getElementById("checkout-subtotal");
    const shippingEl = document.getElementById("checkout-shipping");
    const totalEl = document.getElementById("checkout-total");

    if (itemsList) {
      itemsList.innerHTML = summary.items
        .map(
          (item) => `
        <div style="display: flex; gap: 12px; margin-bottom: 12px; align-items: center;">
          <img src="${item.image}" alt="${Storage.escapeHTML(item.name)}" style="width: 50px; aspect-ratio: 3/4; object-fit: cover; border-radius: 2px;" onerror="this.src='assets/images/placeholder.svg'" />
          <div style="flex-grow: 1; font-size: 0.85rem;">
            <strong>${Storage.escapeHTML(item.name)}</strong>
            <div class="text-muted"><small>${Storage.escapeHTML(item.size)} / ${Storage.escapeHTML(item.colorName)} × ${item.quantity}</small></div>
          </div>
          <div style="font-weight: 700; font-size: 0.9rem;">${Storage.formatCurrency(item.lineTotal)}</div>
        </div>
      `
        )
        .join("");
    }

    if (subtotalEl) subtotalEl.textContent = Storage.formatCurrency(summary.subtotal);
    if (shippingEl) {
      shippingEl.textContent = summary.shippingFee === 0 ? "MIỄN PHÍ" : Storage.formatCurrency(summary.shippingFee);
    }
    if (totalEl) totalEl.textContent = Storage.formatCurrency(summary.total);
  }

  // Chuyển đổi phương thức thanh toán & cổng con VNPAY / MoMo
  function setupPaymentMethodTabs() {
    const cards = document.querySelectorAll(".payment-option-card");
    const bankingInfo = document.getElementById("banking-demo-info");
    const gatewayProviderBox = document.getElementById("gateway-provider-box");

    // Đồng bộ đường dẫn ảnh QR nếu người dùng chỉnh sửa trên checkout.html
    if (gatewayProviderBox) {
      const customVnpayQr = gatewayProviderBox.getAttribute("data-qr-vnpay");
      const customMomoQr = gatewayProviderBox.getAttribute("data-qr-momo");
      if (customVnpayQr) QR_PAYMENT_CONFIG.providers.vnpay.qrImage = customVnpayQr;
      if (customMomoQr) QR_PAYMENT_CONFIG.providers.momo.qrImage = customMomoQr;

      const providerCards = gatewayProviderBox.querySelectorAll(".gateway-provider-card");
      providerCards.forEach((pCard) => {
        pCard.addEventListener("click", () => {
          providerCards.forEach((c) => c.classList.remove("active"));
          pCard.classList.add("active");
          const pRadio = pCard.querySelector('input[type="radio"]');
          if (pRadio) pRadio.checked = true;
        });
      });
    }

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");

        const method = card.getAttribute("data-method");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        if (bankingInfo) {
          bankingInfo.style.display = method === "banking" ? "flex" : "none";
        }
        if (gatewayProviderBox) {
          gatewayProviderBox.style.display = method === "gateway" ? "flex" : "none";
        }
      });
    });
  }

  // Xử lý gửi form đặt hàng
  function setupFormSubmission() {
    const form = document.getElementById("checkout-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      const nameEl = document.getElementById("checkout-name");
      const emailEl = document.getElementById("checkout-email");
      const phoneEl = document.getElementById("checkout-phone");
      const addressEl = document.getElementById("checkout-address");
      const noteEl = document.getElementById("checkout-note");

      const fullName = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";
      const rawPhone = phoneEl ? phoneEl.value.trim() : "";
      const phone = Auth.normalizePhone ? Auth.normalizePhone(rawPhone) : rawPhone.replace(/[\s.-]/g, "");
      const address = addressEl ? addressEl.value.trim() : "";
      const note = noteEl ? noteEl.value.trim() : "";

      [nameEl, emailEl, phoneEl, addressEl].forEach((el) => UI.clearFieldError && UI.clearFieldError(el));

      let firstInvalid = null;
      if (!fullName || fullName.length < 2) {
        UI.setFieldError(nameEl, "Vui lòng nhập họ và tên người nhận (tối thiểu 2 ký tự).");
        firstInvalid = firstInvalid || nameEl;
      }
      if (!email) {
        UI.setFieldError(emailEl, "Vui lòng kiểm tra địa chỉ email tài khoản.");
        firstInvalid = firstInvalid || emailEl;
      }
      const validPhone = Auth.isValidPhone ? Auth.isValidPhone(phone) : /^(0|\+84)[0-9]{9,10}$/.test(phone);
      if (!phone) {
        UI.setFieldError(phoneEl, "Vui lòng nhập số điện thoại liên hệ khi giao hàng.");
        firstInvalid = firstInvalid || phoneEl;
      } else if (!validPhone) {
        UI.setFieldError(phoneEl, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0 hoặc +84.");
        firstInvalid = firstInvalid || phoneEl;
      }
      if (!address || address.length < 6) {
        UI.setFieldError(addressEl, "Vui lòng nhập địa chỉ nhận hàng cụ thể (số nhà, đường, phường/xã, tỉnh/thành).");
        firstInvalid = firstInvalid || addressEl;
      }

      if (firstInvalid) {
        firstInvalid.focus();
        UI.showToast("Vui lòng kiểm tra lại các trường thông tin được đánh dấu đỏ.", "error");
        return;
      }

      // Phương thức thanh toán đang chọn
      const selectedMethodEl = document.querySelector('input[name="payment_method"]:checked');
      const paymentMethod = selectedMethodEl ? selectedMethodEl.value : "cod";

      const customerInfo = { fullName, email, phone, address, note };

      // Trường hợp 1 & 2: COD hoặc Chuyển khoản ngân hàng (Chờ thanh toán)
      if (paymentMethod === "cod" || paymentMethod === "banking") {
        executeCreateOrder(customerInfo, paymentMethod, "pending", null, null);
      }
      // Trường hợp 3: Cổng thanh toán QR VNPAY / Ví MoMo (Làm mới mã QR bắt buộc mỗi 60s)
      else if (paymentMethod === "gateway") {
        const checkedProviderEl = document.querySelector('input[name="gateway_provider"]:checked');
        const initialProvider = checkedProviderEl ? checkedProviderEl.value : "vnpay";
        openQrGatewayModal(customerInfo, initialProvider);
      }
    });
  }

  // Sinh mã phiên QR ngẫu nhiên cho mỗi chu kỳ 60 giây
  function generateQrSessionRef(providerKey) {
    const prefix = providerKey === "momo" ? "MOMO" : "VNPAY";
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `HKQR-${prefix}-${rand}`;
  }

  // Hỗ trợ làm mới URL ảnh từ máy chủ từ xa (http/https) nhưng vẫn an toàn với đường dẫn file cục bộ (file://)
  function resolveQrImgSrc(rawUrl) {
    const url = String(rawUrl || "").trim();
    if (/^https?:\/\//i.test(url)) {
      const sep = url.indexOf("?") === -1 ? "?" : "&";
      return `${url}${sep}_qr=${Date.now()}`;
    }
    return url;
  }

  // Mở Cổng thanh toán QR VNPAY / MoMo với cơ chế bắt buộc làm mới mã QR mỗi 60s
  function openQrGatewayModal(customerInfo, initialProvider = "vnpay") {
    const currentUser = Auth.getCurrentUser();
    const summary = Cart.getCartSummary(currentUser.id);

    const LIMIT_SECONDS = QR_PAYMENT_CONFIG.refreshSeconds || 60;
    let activeProviderKey = QR_PAYMENT_CONFIG.providers[initialProvider] ? initialProvider : "vnpay";
    let secondsLeft = LIMIT_SECONDS;
    let refreshCount = 1;
    let currentSessionRef = generateQrSessionRef(activeProviderKey);
    let isRefreshing = false;
    let countdownTimer = null;
    let refreshAnimTimer = null;

    const cleanupTimers = () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      if (refreshAnimTimer) {
        clearTimeout(refreshAnimTimer);
        refreshAnimTimer = null;
      }
    };

    const currentCfg = QR_PAYMENT_CONFIG.providers[activeProviderKey];

    const modalContent = `
      <div>
        <!-- Chuyển nhanh giữa VNPAY-QR & Ví MoMo ngay trong cổng thanh toán -->
        <div class="qr-gateway-tabs" role="tablist" aria-label="Cổng thanh toán QR">
          <button type="button" class="qr-gateway-tab-btn js-qr-provider-tab ${activeProviderKey === "vnpay" ? "active" : ""}" data-provider="vnpay" role="tab" aria-selected="${activeProviderKey === "vnpay" ? "true" : "false"}">
            <span class="gateway-brand-pill is-vnpay">VNPAY</span>
            <span>Cổng VNPAY-QR</span>
          </button>
          <button type="button" class="qr-gateway-tab-btn js-qr-provider-tab ${activeProviderKey === "momo" ? "active" : ""}" data-provider="momo" role="tab" aria-selected="${activeProviderKey === "momo" ? "true" : "false"}">
            <span class="gateway-brand-pill is-momo">MoMo</span>
            <span>Ví điện tử MoMo</span>
          </button>
        </div>

        <div class="qr-payment-stage">
          <p id="js-qr-provider-hint" class="text-muted" style="font-size: 0.82rem; margin-bottom: 12px; max-width: 380px;">
            ${Storage.escapeHTML(currentCfg.instruction)}
          </p>

          <!-- Khung hiển thị ảnh Mã QR (Hỗ trợ thay ảnh tùy ý) -->
          <div class="qr-payment-frame">
            <img
              id="js-qr-payment-img"
              src="${Storage.escapeHTML(currentCfg.qrImage)}"
              alt="Mã QR thanh toán ${Storage.escapeHTML(currentCfg.shortName)}"
              class="qr-payment-img"
              onerror="this.src='assets/images/placeholder.svg'"
            />
            <div id="js-qr-refresh-overlay" class="qr-refresh-overlay" aria-live="polite">
              <span class="qr-spinner" aria-hidden="true"></span>
              <span id="js-qr-overlay-msg">Đang làm mới mã QR...</span>
            </div>
          </div>

          <!-- Bộ đếm ngược 60s bắt buộc làm mới mã QR -->
          <div class="qr-timer-box">
            <div class="qr-timer-row">
              <span>Mã QR tự động làm mới sau: <strong id="js-qr-countdown" class="qr-timer-countdown">${LIMIT_SECONDS}s</strong></span>
              <button type="button" id="js-btn-refresh-qr" class="copy-chip-btn" title="Tạo mã QR mới ngay lập tức">
                Làm mới mã
              </button>
            </div>
            <div class="qr-timer-bar" aria-hidden="true">
              <div id="js-qr-progress-fill" class="qr-timer-fill" style="width: 100%;"></div>
            </div>
          </div>

          <!-- Thông tin giao dịch tương ứng phiên QR hiện tại -->
          <div class="qr-meta-box">
            <div class="qr-meta-row">
              <span class="text-muted">Phương thức:</span>
              <strong id="js-qr-provider-name">${Storage.escapeHTML(currentCfg.title)}</strong>
            </div>
            <div class="qr-meta-row">
              <span class="text-muted">Số tiền thanh toán:</span>
              <strong class="tabular-nums" style="font-size: 1.08rem; color: var(--color-primary);">${Storage.formatCurrency(summary.total)}</strong>
            </div>
            <div class="qr-meta-row">
              <span class="text-muted">Mã phiên QR (<span id="js-qr-cycle-num" class="tabular-nums">#1</span>):</span>
              <code id="js-qr-session-ref" class="tabular-nums" style="font-weight: 700;">${currentSessionRef}</code>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
          <button type="button" class="btn btn-primary btn-block js-gateway-action" id="js-qr-confirm-btn" data-action="success">
            Tôi đã quét mã &amp; Thanh toán thành công
          </button>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" class="btn btn-danger btn-sm js-gateway-action" data-action="fail">
              Báo lỗi giao dịch
            </button>
            <button type="button" class="btn btn-secondary btn-sm js-gateway-action" data-action="cancel">
              Đóng / Đổi phương thức
            </button>
          </div>
        </div>
      </div>
    `;

    const modal = UI.showModal({
      title: "Thanh toán Quét mã QR (VNPAY / MoMo)",
      content: modalContent,
      confirmText: null,
      showCancel: false,
      extraClass: "hk-qr-gateway-modal",
      onCancel: () => {
        cleanupTimers();
      }
    });

    const root = modal.element;
    if (!root) return;

    const qrImgEl = root.querySelector("#js-qr-payment-img");
    const overlayEl = root.querySelector("#js-qr-refresh-overlay");
    const overlayMsgEl = root.querySelector("#js-qr-overlay-msg");
    const countdownEl = root.querySelector("#js-qr-countdown");
    const progressFillEl = root.querySelector("#js-qr-progress-fill");
    const providerHintEl = root.querySelector("#js-qr-provider-hint");
    const providerNameEl = root.querySelector("#js-qr-provider-name");
    const sessionRefEl = root.querySelector("#js-qr-session-ref");
    const cycleNumEl = root.querySelector("#js-qr-cycle-num");
    const confirmBtnEl = root.querySelector("#js-qr-confirm-btn");
    const manualRefreshBtn = root.querySelector("#js-btn-refresh-qr");

    const updateTimerUI = () => {
      if (!countdownEl || !progressFillEl) return;
      const pct = Math.max(0, Math.min(100, (secondsLeft / LIMIT_SECONDS) * 100));
      const expiring = secondsLeft <= 10;
      countdownEl.textContent = `${secondsLeft}s`;
      countdownEl.classList.toggle("is-expiring", expiring);
      progressFillEl.style.width = `${pct}%`;
      progressFillEl.classList.toggle("is-expiring", expiring);
    };

    // Thực hiện làm mới mã QR (tự động khi hết 60s, hoặc khi đổi cổng / bấm Làm mới)
    const triggerQrRefresh = (reason) => {
      if (isRefreshing) return;
      isRefreshing = true;

      if (confirmBtnEl) confirmBtnEl.disabled = true;
      if (qrImgEl) qrImgEl.classList.add("is-refreshing");
      if (overlayMsgEl) {
        overlayMsgEl.textContent =
          reason === "expired"
            ? "Đã hết 60s hiệu lực — Đang tạo mã QR mới..."
            : "Đang khởi tạo mã QR bảo mật mới...";
      }
      if (overlayEl) overlayEl.classList.add("is-visible");

      if (refreshAnimTimer) clearTimeout(refreshAnimTimer);
      refreshAnimTimer = setTimeout(() => {
        const cfg = QR_PAYMENT_CONFIG.providers[activeProviderKey];
        if (reason === "expired" || reason === "manual") {
          refreshCount += 1;
        } else {
          refreshCount = 1;
        }
        currentSessionRef = generateQrSessionRef(activeProviderKey);
        secondsLeft = LIMIT_SECONDS;

        if (qrImgEl) {
          qrImgEl.src = resolveQrImgSrc(cfg.qrImage);
          qrImgEl.setAttribute("data-session-ref", currentSessionRef);
          qrImgEl.alt = `Mã QR thanh toán ${cfg.shortName}`;
          qrImgEl.classList.remove("is-refreshing");
        }
        if (providerHintEl) providerHintEl.textContent = cfg.instruction;
        if (providerNameEl) providerNameEl.textContent = cfg.title;
        if (sessionRefEl) sessionRefEl.textContent = currentSessionRef;
        if (cycleNumEl) cycleNumEl.textContent = `#${refreshCount}`;

        // Reset thanh tiến trình tức thì về 100% trước khi đếm ngược tiếp
        if (progressFillEl) {
          progressFillEl.style.transition = "none";
          progressFillEl.style.width = "100%";
          progressFillEl.classList.remove("is-expiring");
          void progressFillEl.offsetWidth;
          progressFillEl.style.transition = "";
        }
        updateTimerUI();

        if (overlayEl) overlayEl.classList.remove("is-visible");
        if (confirmBtnEl) confirmBtnEl.disabled = false;
        isRefreshing = false;

        if (reason === "expired") {
          UI.showToast("Mã QR đã được làm mới tự động sau 60 giây!", "info", 2400);
        } else if (reason === "manual") {
          UI.showToast("Đã cấp mã QR mới (hiệu lực 60 giây).", "success", 2000);
        }
      }, 420);
    };

    // Bộ đếm ngược thời gian thực mỗi 1 giây
    countdownTimer = setInterval(() => {
      if (!document.body.contains(root)) {
        cleanupTimers();
        return;
      }
      if (isRefreshing) return;

      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        secondsLeft = 0;
        updateTimerUI();
        triggerQrRefresh("expired");
      } else {
        updateTimerUI();
      }
    }, 1000);

    // Nút làm mới mã QR thủ công
    if (manualRefreshBtn) {
      manualRefreshBtn.addEventListener("click", () => {
        triggerQrRefresh("manual");
      });
    }

    // Chuyển tab VNPAY-QR <-> Ví MoMo ngay trong modal
    root.querySelectorAll(".js-qr-provider-tab").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        const nextProvider = tabBtn.getAttribute("data-provider");
        if (!nextProvider || nextProvider === activeProviderKey) return;
        activeProviderKey = nextProvider;

        root.querySelectorAll(".js-qr-provider-tab").forEach((b) => {
          const isMatch = b.getAttribute("data-provider") === activeProviderKey;
          b.classList.toggle("active", isMatch);
          b.setAttribute("aria-selected", isMatch ? "true" : "false");
        });

        // Đồng bộ lựa chọn bên ngoài form Checkout
        const outerCard = document.querySelector(`.gateway-provider-card[data-provider="${activeProviderKey}"]`);
        if (outerCard) outerCard.click();

        triggerQrRefresh("switch");
      });
    });

    // Các nút hành động xác nhận / báo lỗi / đóng
    root.querySelectorAll(".js-gateway-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (isRefreshing) return;
        const action = btn.getAttribute("data-action");
        const confirmedProvider = activeProviderKey;
        const confirmedRef = currentSessionRef;

        cleanupTimers();
        modal.close();

        if (action === "success") {
          executeCreateOrder(customerInfo, "gateway", "paid", confirmedProvider, confirmedRef);
        } else if (action === "fail") {
          UI.showToast(
            `Giao dịch qua ${QR_PAYMENT_CONFIG.providers[confirmedProvider].shortName} chưa hoàn tất. Giỏ hàng vẫn được giữ nguyên.`,
            "error"
          );
        } else {
          UI.showToast("Đã đóng cổng thanh toán QR.", "info");
        }
      });
    });
  }

  // Gọi Service để tạo đơn hàng chính thức
  function executeCreateOrder(customerInfo, paymentMethod, paymentStatus, paymentProvider = null, paymentRef = null) {
    isSubmitting = true;
    const submitBtn = document.getElementById("btn-submit-order");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "ĐANG XỬ LÝ ĐƠN HÀNG...";
    }

    try {
      const res = Orders.createOrder({
        customerInfo: customerInfo,
        paymentMethod: paymentMethod,
        paymentProvider: paymentProvider,
        paymentRef: paymentRef,
        paymentStatus: paymentStatus
      });

      if (res.success) {
        UI.showToast("Đặt hàng thành công!", "success");
        // Ngăn chặn tải lại hoặc gửi trùng: chuyển trang ngay lập tức
        setTimeout(() => {
          window.location.href = `order-success.html?orderId=${encodeURIComponent(res.order.id)}`;
        }, 500);
      } else {
        UI.showToast(res.message, "error");
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "HOÀN TẤT ĐẶT HÀNG";
        }
      }
    } catch (err) {
      console.error("[Checkout] Lỗi khi tạo đơn hàng:", err);
      UI.showToast("Đã xảy ra lỗi trong quá trình tạo đơn hàng. Vui lòng thử lại!", "error");
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "HOÀN TẤT ĐẶT HÀNG";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initCheckoutPage);
})();

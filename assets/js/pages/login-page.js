/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Đăng nhập (Login Page)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Auth = HKStore.Auth;
  const UI = HKStore.UI;

  function initLoginPage() {
    UI.initCommonUI();

    const safeReturnUrl = Auth.getSafeReturnUrl ? Auth.getSafeReturnUrl("") : Storage.getUrlParam("returnUrl") || "";

    // Nếu đã đăng nhập sẵn rồi thì chuyển trang luôn
    if (Auth.isLoggedIn()) {
      window.location.href = safeReturnUrl || (Auth.isAdmin() ? "admin.html" : "index.html");
      return;
    }

    // Bảo toàn returnUrl khi khách chuyển sang trang Đăng ký
    const regLink = document.getElementById("login-register-link");
    if (regLink && safeReturnUrl) {
      regLink.href = `register.html?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
    }

    // Hiển thị thông báo ngữ cảnh rõ ràng nếu được chuyển hướng từ Thanh toán / Tài khoản
    const contextBanner = document.getElementById("login-context-banner");
    if (contextBanner && safeReturnUrl) {
      contextBanner.classList.remove("hidden");
      if (safeReturnUrl.indexOf("checkout.html") !== -1) {
        contextBanner.textContent =
          "Vui lòng đăng nhập để hoàn tất đặt hàng — toàn bộ sản phẩm trong giỏ hàng của bạn vẫn được giữ nguyên.";
      } else if (safeReturnUrl.indexOf("admin.html") !== -1) {
        contextBanner.textContent =
          "Khu vực Quản trị yêu cầu đăng nhập bằng tài khoản Quản trị viên (Admin).";
      } else {
        contextBanner.textContent = "Vui lòng đăng nhập để tiếp tục truy cập trang yêu cầu.";
      }
    }

    setupLoginForm(safeReturnUrl);
    setupQuickFillButtons();
  }

  function setupLoginForm(returnUrl) {
    const form = document.getElementById("login-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const emailEl = document.getElementById("login-email");
      const passEl = document.getElementById("login-password");
      const email = emailEl ? emailEl.value.trim() : "";
      const password = passEl ? passEl.value : "";

      [emailEl, passEl].forEach((el) => UI.clearFieldError && UI.clearFieldError(el));

      let firstInvalid = null;
      if (!email) {
        UI.setFieldError(emailEl, "Vui lòng nhập địa chỉ email của bạn.");
        firstInvalid = firstInvalid || emailEl;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        UI.setFieldError(emailEl, "Định dạng email chưa hợp lệ (ví dụ: ten@email.com).");
        firstInvalid = firstInvalid || emailEl;
      }
      if (!password) {
        UI.setFieldError(passEl, "Vui lòng nhập mật khẩu đăng nhập.");
        firstInvalid = firstInvalid || passEl;
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const res = Auth.login(email, password);

      if (res.success) {
        UI.showToast(`Xin chào ${res.user.fullName}!`, "success");
        setTimeout(() => {
          if (returnUrl) {
            window.location.href = returnUrl;
          } else if (res.user.role === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "index.html";
          }
        }, 400);
      } else {
        UI.setFieldError(passEl, res.message);
        UI.showToast(res.message, "error");
      }
    });
  }

  // Nút bấm 1-click điền nhanh tài khoản Demo
  function setupQuickFillButtons() {
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    const pills = document.querySelectorAll(".js-quick-account");
    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const email = pill.getAttribute("data-email");
        const pass = pill.getAttribute("data-pass");
        if (emailInput) {
          emailInput.value = email;
          UI.clearFieldError(emailInput);
        }
        if (passwordInput) {
          passwordInput.value = pass;
          UI.clearFieldError(passwordInput);
        }
        UI.showToast(`Đã điền thông tin tài khoản: ${email}`, "info");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initLoginPage);
})();

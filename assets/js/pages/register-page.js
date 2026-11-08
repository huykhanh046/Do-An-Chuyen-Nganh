/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Đăng ký Tài khoản (Register Page)
 */
(function () {
  "use strict";

  const Auth = HKStore.Auth;
  const UI = HKStore.UI;

  function initRegisterPage() {
    UI.initCommonUI();

    const safeReturnUrl = Auth.getSafeReturnUrl ? Auth.getSafeReturnUrl("index.html") : "index.html";

    if (Auth.isLoggedIn()) {
      window.location.href = safeReturnUrl;
      return;
    }

    const loginLink = document.getElementById("register-login-link");
    if (loginLink && safeReturnUrl && safeReturnUrl !== "index.html") {
      loginLink.href = `login.html?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
    }

    const form = document.getElementById("register-form");
    if (!form) return;

    const fieldMap = {
      name: document.getElementById("reg-name"),
      email: document.getElementById("reg-email"),
      password: document.getElementById("reg-password"),
      confirmPassword: document.getElementById("reg-confirm-password"),
      phone: document.getElementById("reg-phone")
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      Object.keys(fieldMap).forEach((k) => {
        if (fieldMap[k] && UI.clearFieldError) UI.clearFieldError(fieldMap[k]);
      });

      const fullName = fieldMap.name ? fieldMap.name.value.trim() : "";
      const email = fieldMap.email ? fieldMap.email.value.trim() : "";
      const password = fieldMap.password ? fieldMap.password.value : "";
      const confirmPassword = fieldMap.confirmPassword ? fieldMap.confirmPassword.value : "";
      const phone = fieldMap.phone ? fieldMap.phone.value.trim() : "";
      const address = document.getElementById("reg-address").value.trim();

      const res = Auth.register({
        fullName,
        email,
        password,
        confirmPassword,
        phone,
        address
      });

      if (res.success) {
        UI.showToast("Đăng ký tài khoản thành công!", "success");
        setTimeout(() => {
          window.location.href = safeReturnUrl;
        }, 450);
      } else {
        const targetEl = res.field && fieldMap[res.field] ? fieldMap[res.field] : null;
        if (targetEl && UI.setFieldError) {
          UI.setFieldError(targetEl, res.message);
          targetEl.focus();
        }
        UI.showToast(res.message, "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initRegisterPage);
})();

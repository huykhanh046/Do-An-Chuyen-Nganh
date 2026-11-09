/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Đăng ký Tài khoản & Xác thực OTP Gmail Cá nhân
 * (Bảo mật SHA-256, không hiển thị lộ OTP trên giao diện)
 */
(function () {
  "use strict";

  const Auth = HKStore.Auth;
  const UI = HKStore.UI;
  const EmailService = HKStore.EmailService;

  let pendingRegistrationData = null;
  let countdownInterval = null;
  let remainingSeconds = 120;

  function initRegisterPage() {
    UI.initCommonUI();

    const safeReturnUrl = Auth.getSafeReturnUrl ? Auth.getSafeReturnUrl("index.html") : "index.html";

    // Nếu đã đăng nhập, chuyển hướng luôn
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

    // Các phần tử DOM của Bước 1 & Bước 2
    const step1Pane = document.getElementById("reg-step-1");
    const step2Pane = document.getElementById("reg-step-2");
    const stepInd1 = document.getElementById("step-ind-1");
    const stepInd2 = document.getElementById("step-ind-2");
    const stepperLine = document.getElementById("stepper-line");
    const authTitle = document.getElementById("auth-main-title");
    const authDesc = document.getElementById("auth-main-desc");

    // Các trường form Bước 1
    const fieldMap = {
      name: document.getElementById("reg-name"),
      email: document.getElementById("reg-email"),
      password: document.getElementById("reg-password"),
      confirmPassword: document.getElementById("reg-confirm-password"),
      phone: document.getElementById("reg-phone")
    };
    const addressInput = document.getElementById("reg-address");

    // Các trường Bước 2 (OTP)
    const otpDisplayEmail = document.getElementById("otp-display-email");
    const otpTimerDisplay = document.getElementById("otp-timer-display");
    const btnResendOtp = document.getElementById("btn-resend-otp");
    const btnVerifyOtp = document.getElementById("btn-verify-otp");
    const btnBackStep1 = document.getElementById("btn-back-step1");
    const btnEditEmail = document.getElementById("btn-edit-email");
    const otpErrorMsg = document.getElementById("otp-error-msg");
    const otpInputs = Array.from(document.querySelectorAll("#otp-inputs-container .otp-digit"));

    // =========================================================================
    // 1. XỬ LÝ SUBMIT BƯỚC 1 (Kiểm tra dữ liệu & Gửi OTP thật về Gmail)
    // =========================================================================
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Xóa lỗi cũ
      Object.keys(fieldMap).forEach((k) => {
        if (fieldMap[k] && UI.clearFieldError) UI.clearFieldError(fieldMap[k]);
      });

      const fullName = fieldMap.name ? fieldMap.name.value.trim() : "";
      const email = fieldMap.email ? fieldMap.email.value.trim() : "";
      const password = fieldMap.password ? fieldMap.password.value : "";
      const confirmPassword = fieldMap.confirmPassword ? fieldMap.confirmPassword.value : "";
      const phone = fieldMap.phone ? fieldMap.phone.value.trim() : "";
      const address = addressInput ? addressInput.value.trim() : "";

      const formData = { fullName, email, password, confirmPassword, phone, address };

      // Xác thực dữ liệu đầu vào
      const valRes = Auth.validateRegistrationInfo(formData);
      if (!valRes.success) {
        const targetEl = valRes.field && fieldMap[valRes.field] ? fieldMap[valRes.field] : null;
        if (targetEl && UI.setFieldError) {
          UI.setFieldError(targetEl, valRes.message);
          targetEl.focus();
        }
        UI.showToast(valRes.message, "error");
        return;
      }

      // Lưu tạm dữ liệu hợp lệ
      pendingRegistrationData = formData;

      // Kiểm tra xem cổng gửi thư Gmail đã được kết nối chưa
      if (!EmailService || !EmailService.isConfigured()) {
        openEmailGatewaySetupModal(formData);
        return;
      }

      await dispatchOtpAndProceed(formData);
    });

    async function dispatchOtpAndProceed(formData) {
      const submitBtn = document.getElementById("btn-submit-step1");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "ĐANG GỬI MÃ OTP VỀ GMAIL...";
      }

      const otpRes = Auth.generateOTP(formData.email);
      if (!otpRes.success) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "TIẾP TỤC XÁC THỰC OTP →";
        }
        UI.showToast(otpRes.message, "error");
        return;
      }

      const emailRes = await EmailService.sendOTPEmail({
        toEmail: formData.email,
        toName: formData.fullName,
        otpCode: otpRes.otp,
        expiresInMinutes: 2
      });

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "TIẾP TỤC XÁC THỰC OTP →";
      }

      if (!emailRes.success) {
        UI.showToast(emailRes.message || "Không thể gửi email OTP.", "error");
        if (emailRes.notConfigured) {
          openEmailGatewaySetupModal(formData);
        }
        return;
      }

      UI.showToast(`Mã xác thực 6 chữ số đã gửi về hộp thư ${formData.email}!`, "success", 6000);
      switchToStep2(formData.email);
    }

    // Modal cấu hình cổng gửi Gmail thật (Chỉ cần thiết lập 1 lần)
    function openEmailGatewaySetupModal(formData) {
      const gasCode = EmailService.getGoogleAppsScriptCode();
      const currentCfg = EmailService.getConfig();

      const modalHtml = `
        <div style="font-size: 0.88rem; line-height: 1.55; color: var(--color-primary);">
          <p style="margin-bottom: 12px;">
            Để hệ thống gửi thư OTP thật trực tiếp từ <strong>Google Mail</strong> đến hộp thư <strong>${HKStore.Storage.escapeHTML(formData.email)}</strong> (và mọi Gmail khách hàng khác), vui lòng liên kết Web App Google Script của bạn (chỉ mất 60 giây, miễn phí 100%):
          </p>
          <ol style="padding-left: 18px; margin-bottom: 12px; font-size: 0.83rem; color: var(--color-text-muted);">
            <li style="margin-bottom: 4px;">Mở <a href="https://script.google.com/home" target="_blank" rel="noopener" style="color: var(--color-primary); font-weight: 700; text-decoration: underline;">script.google.com</a> &rarr; bấm <strong>Dự án mới (New project)</strong>.</li>
            <li style="margin-bottom: 4px;">Xóa mã mặc định, bấm nút <strong>Sao chép mã Google Script</strong> bên dưới và dán vào.</li>
            <li style="margin-bottom: 4px;">Bấm <strong>Triển khai (Deploy)</strong> &rarr; <strong>Tùy chọn triển khai mới</strong> &rarr; Chọn loại: <strong>Ứng dụng web (Web app)</strong> &rarr; Quyền truy cập: <strong>Bất kỳ ai (Anyone)</strong> &rarr; Bấm Triển khai &amp; Cấp quyền Gmail.</li>
            <li>Copy đường dẫn <strong>URL ứng dụng web</strong> (<code>https://script.google.com/macros/s/.../exec</code>) dán vào ô bên dưới:</li>
          </ol>

          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 0.78rem; font-weight: 700;">Mã Google Apps Script (15 dòng):</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-gas-code" style="padding: 3px 10px; font-size: 0.75rem;">Sao chép mã</button>
            </div>
            <pre style="background: #111; color: #f8f8f8; padding: 10px; border-radius: 4px; font-size: 0.75rem; overflow-x: auto; max-height: 130px; margin: 0;"><code>${HKStore.Storage.escapeHTML(gasCode)}</code></pre>
          </div>

          <div class="form-group" style="margin-bottom: 6px;">
            <label class="form-label" for="input-gas-url" style="font-size: 0.82rem;">URL Ứng dụng Web Google Script <span class="required">*</span></label>
            <input type="url" id="input-gas-url" class="form-control" placeholder="https://script.google.com/macros/s/.../exec" value="${HKStore.Storage.escapeHTML(currentCfg.googleScriptUrl || "")}" />
          </div>
          <small style="color: var(--color-text-muted); font-size: 0.76rem; display: block;">
            * Bạn cũng có thể gửi URL này cho trợ lý AI để lưu vĩnh viễn vào mã nguồn trên Vercel.
          </small>
        </div>
      `;

      UI.showModal({
        title: "KẾT NỐI GMAIL GỬI MÃ OTP THẬT",
        content: modalHtml,
        confirmText: "Lưu & Gửi OTP về Gmail ngay",
        cancelText: "Đóng",
        onConfirm: () => {
          const urlInput = document.getElementById("input-gas-url");
          const val = urlInput ? urlInput.value.trim() : "";
          if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(val)) {
            UI.showToast("Vui lòng dán đúng URL Web App từ script.google.com (kết thúc bằng /exec).", "error");
            return false;
          }
          EmailService.setConfig({ googleScriptUrl: val });
          UI.showToast("Đã kết nối cổng Gmail thành công!", "success");
          dispatchOtpAndProceed(formData);
          return true;
        }
      });

      setTimeout(() => {
        const copyBtn = document.getElementById("btn-copy-gas-code");
        if (copyBtn) {
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(gasCode).then(() => {
              copyBtn.textContent = "Đã sao chép ✓";
              UI.showToast("Đã sao chép mã Google Apps Script!", "info");
              setTimeout(() => {
                copyBtn.textContent = "Sao chép mã";
              }, 2000);
            });
          });
        }
      }, 100);
    }

    // =========================================================================
    // 2. CHUYỂN GIAO DIỆN BƯỚC 1 -> BƯỚC 2 & BẮT ĐẦU ĐẾM NGƯỢC
    // =========================================================================
    function switchToStep2(email) {
      if (step1Pane) step1Pane.style.display = "none";
      if (step2Pane) step2Pane.style.display = "block";

      if (stepInd1) {
        stepInd1.classList.remove("active");
        stepInd1.classList.add("completed");
      }
      if (stepperLine) stepperLine.classList.add("active");
      if (stepInd2) stepInd2.classList.add("active");

      if (authTitle) authTitle.textContent = "XÁC THỰC TÀI KHOẢN";
      if (authDesc) authDesc.textContent = "Bảo vệ tài khoản với lớp xác thực mã OTP qua Gmail";

      if (otpDisplayEmail) otpDisplayEmail.textContent = email;

      // Reset các ô nhập OTP
      clearOtpInputs();

      // Bắt đầu đếm ngược 120s
      startOtpCountdown(120);

      // Focus vào ô đầu tiên
      if (otpInputs[0]) {
        setTimeout(() => otpInputs[0].focus(), 150);
      }
    }

    // =========================================================================
    // 3. QUAY LẠI BƯỚC 1 (SỬA THÔNG TIN HOẶC ĐỔI EMAIL)
    // =========================================================================
    function switchToStep1() {
      clearInterval(countdownInterval);

      if (step2Pane) step2Pane.style.display = "none";
      if (step1Pane) step1Pane.style.display = "block";

      if (stepInd2) stepInd2.classList.remove("active");
      if (stepperLine) stepperLine.classList.remove("active");
      if (stepInd1) {
        stepInd1.classList.remove("completed");
        stepInd1.classList.add("active");
      }

      if (authTitle) authTitle.textContent = "ĐĂNG KÝ THÀNH VIÊN";
      if (authDesc) authDesc.textContent = "Gia nhập cộng đồng Streetwear HK Store";

      if (fieldMap.email) {
        setTimeout(() => fieldMap.email.focus(), 100);
      }
    }

    if (btnBackStep1) btnBackStep1.addEventListener("click", switchToStep1);
    if (btnEditEmail) btnEditEmail.addEventListener("click", switchToStep1);

    // =========================================================================
    // 4. BỘ ĐẾM THỜI GIAN & GỬI LẠI MÃ OTP
    // =========================================================================
    function startOtpCountdown(seconds = 120) {
      clearInterval(countdownInterval);
      remainingSeconds = seconds;

      if (btnResendOtp) btnResendOtp.disabled = true;

      const updateTimerText = () => {
        const m = Math.floor(remainingSeconds / 60);
        const s = remainingSeconds % 60;
        const text = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        if (otpTimerDisplay) otpTimerDisplay.textContent = text;
      };

      updateTimerText();

      countdownInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerText();

        if (remainingSeconds <= 0) {
          clearInterval(countdownInterval);
          if (btnResendOtp) btnResendOtp.disabled = false;
          if (otpTimerDisplay) otpTimerDisplay.textContent = "00:00 (Hết hạn)";
          UI.showToast("Mã OTP đã hết hiệu lực. Bạn có thể nhấn 'Gửi lại mã OTP'.", "info");
        }
      }, 1000);
    }

    if (btnResendOtp) {
      btnResendOtp.addEventListener("click", async () => {
        if (!pendingRegistrationData || !pendingRegistrationData.email) {
          UI.showToast("Không tìm thấy thông tin đăng ký. Vui lòng thử lại từ bước 1.", "error");
          switchToStep1();
          return;
        }

        btnResendOtp.disabled = true;
        const res = Auth.generateOTP(pendingRegistrationData.email);

        if (!res.success) {
          btnResendOtp.disabled = false;
          UI.showToast(res.message, "error");
          return;
        }

        clearOtpInputs();

        const emailRes = await EmailService.sendOTPEmail({
          toEmail: pendingRegistrationData.email,
          toName: pendingRegistrationData.fullName,
          otpCode: res.otp,
          expiresInMinutes: 2
        });

        if (!emailRes.success) {
          btnResendOtp.disabled = false;
          UI.showToast(emailRes.message || "Không thể gửi lại mã OTP.", "error");
          return;
        }

        UI.showToast(`Đã gửi lại mã OTP mới đến hộp thư ${pendingRegistrationData.email}!`, "success");
        startOtpCountdown(120);

        if (otpInputs[0]) otpInputs[0].focus();
      });
    }

    // =========================================================================
    // 5. XỬ LÝ 6 Ô NHẬP MÃ OTP (Gõ phím, Xóa lùi, Dán chuỗi)
    // =========================================================================
    function clearOtpInputs() {
      otpInputs.forEach((inp) => {
        inp.value = "";
        inp.classList.remove("has-value");
      });
      if (otpErrorMsg) {
        otpErrorMsg.textContent = "";
        otpErrorMsg.style.display = "none";
      }
    }

    function getEnteredOtp() {
      return otpInputs.map((i) => i.value.trim()).join("");
    }

    otpInputs.forEach((inp, idx) => {
      inp.addEventListener("input", () => {
        const val = inp.value.replace(/\D/g, "");
        inp.value = val.slice(0, 1);

        inp.classList.toggle("has-value", inp.value !== "");

        if (inp.value && idx < otpInputs.length - 1) {
          otpInputs[idx + 1].focus();
        }

        // Tự động kiểm tra nếu đã nhập đủ 6 số
        if (getEnteredOtp().length === 6) {
          triggerVerify();
        }
      });

      inp.addEventListener("keydown", (e) => {
        if (e.key === "Backspace") {
          if (!inp.value && idx > 0) {
            otpInputs[idx - 1].value = "";
            otpInputs[idx - 1].classList.remove("has-value");
            otpInputs[idx - 1].focus();
            e.preventDefault();
          } else {
            inp.classList.remove("has-value");
          }
        } else if (e.key === "ArrowLeft" && idx > 0) {
          otpInputs[idx - 1].focus();
          e.preventDefault();
        } else if (e.key === "ArrowRight" && idx < otpInputs.length - 1) {
          otpInputs[idx + 1].focus();
          e.preventDefault();
        } else if (e.key === "Enter") {
          e.preventDefault();
          triggerVerify();
        }
      });

      inp.addEventListener("paste", (e) => {
        e.preventDefault();
        const clipboard = (e.clipboardData || window.clipboardData).getData("text");
        const digits = clipboard.replace(/\D/g, "").slice(0, 6);

        if (!digits) return;

        digits.split("").forEach((d, i) => {
          if (otpInputs[i]) {
            otpInputs[i].value = d;
            otpInputs[i].classList.add("has-value");
          }
        });

        const nextFocus = Math.min(digits.length, otpInputs.length - 1);
        if (otpInputs[nextFocus]) {
          otpInputs[nextFocus].focus();
        }

        if (digits.length === 6) {
          triggerVerify();
        }
      });
    });

    // =========================================================================
    // 6. XÁC NHẬN MÃ OTP & HOÀN TẤT ĐĂNG KÝ
    // =========================================================================
    function showOtpError(message) {
      const container = document.getElementById("otp-inputs-container");
      if (container) {
        container.classList.remove("is-shake");
        void container.offsetWidth;
        container.classList.add("is-shake");
      }

      if (otpErrorMsg) {
        otpErrorMsg.textContent = message;
        otpErrorMsg.style.display = "block";
      }

      UI.showToast(message, "error");
    }

    async function triggerVerify() {
      if (!pendingRegistrationData || !pendingRegistrationData.email) {
        UI.showToast("Phiên đăng ký không hợp lệ. Vui lòng nhập lại thông tin.", "error");
        switchToStep1();
        return;
      }

      const code = getEnteredOtp();
      if (code.length < 6) {
        showOtpError("Vui lòng nhập đầy đủ 6 chữ số mã OTP nhận từ Gmail.");
        const firstEmpty = otpInputs.find((i) => !i.value);
        if (firstEmpty) firstEmpty.focus();
        return;
      }

      if (btnVerifyOtp) {
        btnVerifyOtp.disabled = true;
        btnVerifyOtp.textContent = "Đang kiểm tra...";
      }

      // Xác thực OTP bằng mã băm SHA-256
      const verifyRes = Auth.verifyOTP(pendingRegistrationData.email, code);

      if (!verifyRes.success) {
        if (btnVerifyOtp) {
          btnVerifyOtp.disabled = false;
          btnVerifyOtp.textContent = "XÁC NHẬN & HOÀN TẤT ĐĂNG KÝ";
        }
        showOtpError(verifyRes.message);

        clearOtpInputs();
        if (otpInputs[0]) otpInputs[0].focus();
        return;
      }

      // Đăng ký tài khoản chính thức
      if (btnVerifyOtp) {
        btnVerifyOtp.textContent = "Đang khởi tạo tài khoản...";
      }

      const regRes = Auth.registerVerifiedUser(pendingRegistrationData);

      if (regRes.success) {
        clearInterval(countdownInterval);
        UI.showToast("Xác thực Gmail & đăng ký tài khoản thành công!", "success", 3000);

        setTimeout(() => {
          window.location.href = safeReturnUrl;
        }, 600);
      } else {
        if (btnVerifyOtp) {
          btnVerifyOtp.disabled = false;
          btnVerifyOtp.textContent = "XÁC NHẬN & HOÀN TẤT ĐĂNG KÝ";
        }
        UI.showToast(regRes.message, "error");
      }
    }

    if (btnVerifyOtp) {
      btnVerifyOtp.addEventListener("click", triggerVerify);
    }
  }

  document.addEventListener("DOMContentLoaded", initRegisterPage);
})();

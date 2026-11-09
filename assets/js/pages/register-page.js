/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Đăng ký Tài khoản & Xác thực OTP Gmail
 * (Tuân thủ Design DNA & Animate UI)
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
    const demoOtpCodeEl = document.getElementById("demo-otp-code");
    const otpTimerDisplay = document.getElementById("otp-timer-display");
    const btnResendOtp = document.getElementById("btn-resend-otp");
    const btnVerifyOtp = document.getElementById("btn-verify-otp");
    const btnBackStep1 = document.getElementById("btn-back-step1");
    const btnEditEmail = document.getElementById("btn-edit-email");
    const btnAutofillOtp = document.getElementById("btn-autofill-otp");
    const otpErrorMsg = document.getElementById("otp-error-msg");
    const otpInputs = Array.from(document.querySelectorAll("#otp-inputs-container .otp-digit"));

    // =========================================================================
    // 1. XỬ LÝ SUBMIT BƯỚC 1 (Kiểm tra dữ liệu & Tạo mã OTP)
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

      const submitBtn = document.getElementById("btn-submit-step1");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang gửi mã OTP...";
      }

      // Tạo mã OTP
      const otpRes = Auth.generateOTP(email);
      if (!otpRes.success) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "TIẾP TỤC XÁC THỰC OTP →";
        }
        UI.showToast(otpRes.message, "error");
        return;
      }

      // Gửi mã OTP qua EmailService
      if (EmailService && EmailService.sendOTPEmail) {
        EmailService.sendOTPEmail({
          toEmail: email,
          toName: fullName,
          otpCode: otpRes.otp,
          expiresInMinutes: 2
        });
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "TIẾP TỤC XÁC THỰC OTP →";
      }

      // Hiển thị thông báo thành công
      UI.showToast(`Mã xác thực 6 chữ số đã gửi về ${email}!`, "success", 6000);

      // Chuyển sang Bước 2
      switchToStep2(email, otpRes.otp);
    });

    // =========================================================================
    // 2. CHUYỂN GIAO DIỆN BƯỚC 1 -> BƯỚC 2 & BẮT ĐẦU ĐẾM NGƯỢC
    // =========================================================================
    function switchToStep2(email, currentOtp) {
      if (step1Pane) step1Pane.style.display = "none";
      if (step2Pane) step2Pane.style.display = "block";

      if (stepInd1) {
        stepInd1.classList.remove("active");
        stepInd1.classList.add("completed");
      }
      if (stepperLine) stepperLine.classList.add("active");
      if (stepInd2) stepInd2.classList.add("active");

      if (authTitle) authTitle.textContent = "XÁC THỰC TÀI KHOẢN";
      if (authDesc) authDesc.textContent = "Bảo vệ tài khoản với lớp xác thực mã OTP";

      if (otpDisplayEmail) otpDisplayEmail.textContent = email;
      if (demoOtpCodeEl) demoOtpCodeEl.textContent = currentOtp || "------";

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

      // Focus lại email nếu nhấn Đổi email
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
      btnResendOtp.addEventListener("click", () => {
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

        if (demoOtpCodeEl) demoOtpCodeEl.textContent = res.otp;
        clearOtpInputs();

        if (EmailService && EmailService.sendOTPEmail) {
          EmailService.sendOTPEmail({
            toEmail: pendingRegistrationData.email,
            toName: pendingRegistrationData.fullName,
            otpCode: res.otp,
            expiresInMinutes: 2
          });
        }

        UI.showToast(`Đã gửi lại mã OTP mới đến ${pendingRegistrationData.email}!`, "success");
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
      // Nhập ký tự
      inp.addEventListener("input", (e) => {
        const val = inp.value.replace(/\D/g, "");
        inp.value = val.slice(0, 1);

        inp.classList.toggle("has-value", inp.value !== "");

        if (inp.value && idx < otpInputs.length - 1) {
          otpInputs[idx + 1].focus();
        }

        // Tự động kiểm tra nếu đã đủ 6 số
        if (getEnteredOtp().length === 6) {
          triggerVerify();
        }
      });

      // Bấm phím Backspace / Di chuyển
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

      // Dán chuỗi OTP (Paste Ctrl+V)
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

    // Nút "Điền mã" Demo hỗ trợ test nhanh / chấm điểm
    if (btnAutofillOtp) {
      btnAutofillOtp.addEventListener("click", () => {
        if (!pendingRegistrationData) return;
        const pending = Auth.getPendingOTP(pendingRegistrationData.email);
        if (!pending || !pending.code) return;

        pending.code.split("").forEach((d, i) => {
          if (otpInputs[i]) {
            otpInputs[i].value = d;
            otpInputs[i].classList.add("has-value");
          }
        });

        UI.showToast("Đã tự động điền mã OTP!", "info");
        if (otpInputs[5]) otpInputs[5].focus();
        setTimeout(triggerVerify, 250);
      });
    }

    // =========================================================================
    // 6. XÁC NHẬN MÃ OTP & HOÀN TẤT ĐĂNG KÝ
    // =========================================================================
    function showOtpError(message) {
      const container = document.getElementById("otp-inputs-container");
      if (container) {
        container.classList.remove("is-shake");
        void container.offsetWidth; // Trigger reflow
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
        showOtpError("Vui lòng nhập đầy đủ 6 chữ số mã OTP.");
        const firstEmpty = otpInputs.find((i) => !i.value);
        if (firstEmpty) firstEmpty.focus();
        return;
      }

      if (btnVerifyOtp) {
        btnVerifyOtp.disabled = true;
        btnVerifyOtp.textContent = "Đang kiểm tra...";
      }

      // Xác thực OTP
      const verifyRes = Auth.verifyOTP(pendingRegistrationData.email, code);

      if (!verifyRes.success) {
        if (btnVerifyOtp) {
          btnVerifyOtp.disabled = false;
          btnVerifyOtp.textContent = "XÁC NHẬN & HOÀN TẤT ĐĂNG KÝ";
        }
        showOtpError(verifyRes.message);

        // Xóa trắng để người dùng gõ lại
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
        UI.showToast("Đăng ký & xác thực Gmail thành công! Đang chuyển hướng...", "success", 3000);

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

/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Gửi Email Xác thực OTP Thật về Gmail Cá nhân
 * Hỗ trợ:
 *   1. Google Apps Script (MailApp chính chủ Google - Miễn phí 100%, gửi tới mọi Gmail)
 *   2. EmailJS REST API
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  // Cấu hình mặc định trong source code (Lưu cố định khi deploy lên Vercel)
  const DEFAULT_CONFIG = {
    // Cách 1 (Khuyên dùng - Chính chủ Google): Dán URL Web App từ https://script.google.com
    googleScriptUrl: "",

    // Cách 2 (EmailJS): Điền thông tin từ https://www.emailjs.com
    serviceId: "",
    templateId: "",
    publicKey: ""
  };

  const STORAGE_KEY = "hkstore_v1_email_config";

  // Mẫu HTML Email chuẩn thương hiệu HK Store gửi về hộp thư Gmail khách hàng
  function buildHtmlEmailTemplate({ toName, otpCode, expiresInMinutes }) {
    return [
      '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 32px; background: #ffffff; color: #111111;">',
      '  <div style="border-bottom: 2px solid #111111; padding-bottom: 16px; margin-bottom: 24px;">',
      '    <h2 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #111111;">HK STORE</h2>',
      '    <p style="margin: 4px 0 0; color: #666666; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">Streetwear Minimalist — Xác thực bảo mật tài khoản</p>',
      '  </div>',
      '  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Xin chào <strong>' + (toName || "Quý khách") + '</strong>,</p>',
      '  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">Cảm ơn bạn đã đăng ký tài khoản tại <strong>HK Store</strong>. Vui lòng nhập mã OTP gồm 6 chữ số dưới đây để hoàn tất xác minh địa chỉ Gmail của bạn:</p>',
      '  <div style="margin: 24px 0; padding: 20px; background: #f7f7f5; border: 2px dashed #111111; text-align: center; border-radius: 4px;">',
      '    <span style="font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #111111; font-family: monospace;">' + otpCode + '</span>',
      '  </div>',
      '  <p style="font-size: 13px; color: #555555; line-height: 1.6; margin: 0 0 24px;">',
      '    Mã xác thực này có hiệu lực trong vòng <strong>' + (expiresInMinutes || 2) + ' phút</strong>. Vì lý do bảo mật, tuyệt đối không chia sẻ mã này cho bất kỳ ai.',
      '  </p>',
      '  <div style="border-top: 1px solid #eeeeee; padding-top: 16px; font-size: 12px; color: #888888;">',
      '    Email này được gửi tự động từ hệ thống bảo mật của HK Store. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.',
      '  </div>',
      '</div>'
    ].join("");
  }

  const EmailService = {
    // Lấy cấu hình hiện tại (kết hợp giữa DEFAULT_CONFIG và cấu hình lưu trong máy)
    getConfig: function () {
      const stored = HK.Storage ? HK.Storage.get(STORAGE_KEY, null) : null;
      const base = window.HK_EMAIL_CONFIG || DEFAULT_CONFIG;
      return {
        googleScriptUrl: (stored && stored.googleScriptUrl) || base.googleScriptUrl || "",
        serviceId: (stored && stored.serviceId) || base.serviceId || "",
        templateId: (stored && stored.templateId) || base.templateId || "",
        publicKey: (stored && stored.publicKey) || base.publicKey || ""
      };
    },

    // Lưu cấu hình mới
    setConfig: function (newConfig) {
      const merged = Object.assign({}, EmailService.getConfig(), newConfig || {});
      if (HK.Storage) {
        HK.Storage.set(STORAGE_KEY, merged);
      }
      window.HK_EMAIL_CONFIG = merged;
      return merged;
    },

    // Kiểm tra đã cấu hình cổng gửi Gmail thật hay chưa
    isConfigured: function () {
      const cfg = EmailService.getConfig();
      const hasGoogleScript = Boolean(
        cfg.googleScriptUrl &&
        /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(cfg.googleScriptUrl.trim())
      );
      const hasEmailJs = Boolean(cfg.serviceId && cfg.templateId && cfg.publicKey);
      return hasGoogleScript || hasEmailJs;
    },

    // Mã nguồn Google Apps Script chuẩn để kết nối Gmail trong 60 giây
    getGoogleAppsScriptCode: function () {
      return [
        "function doPost(e) {",
        "  try {",
        "    var data = JSON.parse(e.postData.contents);",
        "    MailApp.sendEmail({",
        "      to: data.toEmail,",
        "      subject: data.subject,",
        "      htmlBody: data.htmlBody",
        "    });",
        "    return ContentService.createTextOutput(JSON.stringify({ success: true }))",
        "      .setMimeType(ContentService.MimeType.JSON);",
        "  } catch (err) {",
        "    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))",
        "      .setMimeType(ContentService.MimeType.JSON);",
        "  }",
        "}"
      ].join("\n");
    },

    /**
     * Gửi mã OTP xác thực thật đến hộp thư Gmail của khách hàng
     */
    sendOTPEmail: async function ({ toEmail, toName, otpCode, expiresInMinutes = 2 }) {
      const cfg = EmailService.getConfig();

      if (!EmailService.isConfigured()) {
        return {
          success: false,
          notConfigured: true,
          message: "Chưa kết nối cổng gửi thư Gmail (Google Apps Script / EmailJS)."
        };
      }

      const subject = "[" + otpCode + "] Mã xác thực OTP đăng ký tài khoản HK Store";
      const htmlBody = buildHtmlEmailTemplate({ toName, otpCode, expiresInMinutes });

      // 1. Ưu tiên gửi qua Google Apps Script (MailApp chính chủ Google)
      if (cfg.googleScriptUrl && cfg.googleScriptUrl.trim()) {
        try {
          const response = await fetch(cfg.googleScriptUrl.trim(), {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
              toEmail: toEmail,
              toName: toName || "Quý khách",
              otpCode: otpCode,
              subject: subject,
              htmlBody: htmlBody,
              expiryMinutes: expiresInMinutes
            }),
            redirect: "follow"
          });

          // Với Google Apps Script, nếu đọc được JSON thì kiểm tra, nếu opaque (no-cors) vẫn là đã gửi
          if (response.type === "opaque" || response.ok) {
            try {
              const resJson = await response.json();
              if (resJson && resJson.success === false) {
                return {
                  success: false,
                  message: "Lỗi từ Google Script: " + (resJson.error || "Không xác định")
                };
              }
            } catch (e) {
              // Phản hồi thành công
            }
            return {
              success: true,
              sentVia: "google_script",
              message: "Mã xác thực OTP 6 chữ số đã được gửi về hộp thư Gmail: " + toEmail
            };
          }
        } catch (err) {
          // Thử fallback no-cors nếu trình duyệt chặn đọc redirect từ script.googleusercontent.com
          try {
            await fetch(cfg.googleScriptUrl.trim(), {
              method: "POST",
              mode: "no-cors",
              headers: {
                "Content-Type": "text/plain;charset=utf-8"
              },
              body: JSON.stringify({
                toEmail: toEmail,
                toName: toName || "Quý khách",
                otpCode: otpCode,
                subject: subject,
                htmlBody: htmlBody,
                expiryMinutes: expiresInMinutes
              })
            });
            return {
              success: true,
              sentVia: "google_script",
              message: "Mã xác thực OTP 6 chữ số đã được gửi về hộp thư Gmail: " + toEmail
            };
          } catch (innerErr) {
            return {
              success: false,
              message: "Không thể kết nối tới Google Apps Script. Vui lòng kiểm tra lại đường dẫn Web App."
            };
          }
        }
      }

      // 2. Gửi qua EmailJS REST API
      if (cfg.serviceId && cfg.templateId && cfg.publicKey) {
        try {
          const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              service_id: cfg.serviceId.trim(),
              template_id: cfg.templateId.trim(),
              user_id: cfg.publicKey.trim(),
              template_params: {
                to_email: toEmail,
                email: toEmail,
                user_email: toEmail,
                to_name: toName || "Quý khách",
                otp_code: otpCode,
                expiry_minutes: expiresInMinutes,
                store_name: "HK STORE - Streetwear Minimalist"
              }
            })
          });

          if (res.ok) {
            return {
              success: true,
              sentVia: "emailjs",
              message: "Mã xác thực OTP 6 chữ số đã được gửi về hộp thư Gmail: " + toEmail
            };
          } else {
            const errText = await res.text();
            return {
              success: false,
              message: "EmailJS từ chối gửi thư: " + errText
            };
          }
        } catch (err) {
          return {
            success: false,
            message: "Lỗi kết nối tới máy chủ EmailJS. Vui lòng kiểm tra mạng."
          };
        }
      }

      return {
        success: false,
        notConfigured: true,
        message: "Chưa cấu hình dịch vụ gửi email."
      };
    }
  };

  HK.EmailService = EmailService;
})(window.HKStore);

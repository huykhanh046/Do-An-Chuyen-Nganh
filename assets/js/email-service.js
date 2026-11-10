/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Gửi Email Tự động & Xuất Hóa đơn PDF Chi tiết (Email & PDF Invoice Service)
 * Hỗ trợ tự động gửi Email về Gmail thật qua Google Apps Script (MailApp) / EmailJS khi:
 *   1. Khách đăng ký tài khoản (Mã OTP kích hoạt + Email chào mừng thành viên)
 *   2. Khách đặt hàng thành công (Kèm bảng Hóa đơn chi tiết, nút tải Hóa đơn PDF & link theo dõi vận đơn)
 *   3. Trạng thái đơn hàng chuyển sang "Đang giao hàng" (shipping) hoặc "Giao thành công" (delivered)
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  // Cấu hình mặc định trong source code (Lưu cố định khi deploy lên Vercel)
  const DEFAULT_CONFIG = {
    // Cách 1 (Khuyên dùng - Chính chủ Google): Web App Google Apps Script gửi từ Gmail thật
    googleScriptUrl:
      "https://script.google.com/macros/s/AKfycbzmP_ihBU_BbwizaRyeeI49PoOAhc3N7J3RSELv6d7ZanoVA8ThIm8XKhjBa1f7-9yF/exec",

    // Cách 2 (EmailJS): Điền thông tin từ https://www.emailjs.com
    serviceId: "",
    templateId: "",
    publicKey: ""
  };

  const STORAGE_KEY = "hkstore_v1_email_config";
  const EMAIL_LOGS_KEY = "hkstore_v1_email_logs";
  const LIVE_SITE_ORIGIN = "https://hethongquanlythoitrang-hkstore.vercel.app";

  function escapeHtml(str) {
    if (HK.Storage && HK.Storage.escapeHTML) {
      return HK.Storage.escapeHTML(str);
    }
    return String(str === undefined || str === null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(amount) {
    if (HK.Storage && HK.Storage.formatCurrency) {
      return HK.Storage.formatCurrency(amount);
    }
    return new Intl.NumberFormat("vi-VN").format(Number(amount) || 0) + " ₫";
  }

  function formatDateTime(isoStr) {
    if (HK.Storage && HK.Storage.formatDate) {
      return HK.Storage.formatDate(isoStr);
    }
    try {
      return new Date(isoStr || Date.now()).toLocaleString("vi-VN");
    } catch (e) {
      return String(isoStr || "");
    }
  }

  function getBaseSiteUrl() {
    try {
      if (window.location && /^https?:\/\//i.test(window.location.origin)) {
        const pathDir = window.location.pathname.replace(/\/[^/]*$/, "");
        return window.location.origin + pathDir;
      }
    } catch (e) {}
    return LIVE_SITE_ORIGIN;
  }

  function recordEmailLog(entry) {
    try {
      if (!HK.Storage) return;
      const logs = HK.Storage.get(EMAIL_LOGS_KEY, []);
      logs.unshift(
        Object.assign(
          {
            id: "EML-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            sentAt: new Date().toISOString()
          },
          entry
        )
      );
      HK.Storage.set(EMAIL_LOGS_KEY, logs.slice(0, 100));
    } catch (e) {}
  }

  // 1. Mẫu HTML Email OTP Đăng ký
  function buildHtmlOtpTemplate({ toName, otpCode, expiresInMinutes }) {
    return [
      '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 32px; background: #ffffff; color: #111111;">',
      '  <div style="border-bottom: 2px solid #111111; padding-bottom: 16px; margin-bottom: 24px;">',
      '    <h2 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #111111;">HK STORE</h2>',
      '    <p style="margin: 4px 0 0; color: #666666; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">Streetwear Minimalist — Xác thực bảo mật tài khoản</p>',
      '  </div>',
      '  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Xin chào <strong>' + escapeHtml(toName || "Quý khách") + '</strong>,</p>',
      '  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">Cảm ơn bạn đã đăng ký tài khoản tại <strong>HK Store</strong>. Vui lòng nhập mã OTP gồm 6 chữ số dưới đây để hoàn tất kích hoạt tài khoản của bạn:</p>',
      '  <div style="margin: 24px 0; padding: 20px; background: #f7f7f5; border: 2px dashed #111111; text-align: center; border-radius: 4px;">',
      '    <span style="font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #111111; font-family: monospace;">' + escapeHtml(otpCode) + '</span>',
      '  </div>',
      '  <p style="font-size: 13px; color: #555555; line-height: 1.6; margin: 0 0 24px;">',
      '    Mã xác thực này có hiệu lực trong vòng <strong>' + (expiresInMinutes || 2) + ' phút</strong>. Vì lý do bảo mật, tuyệt đối không chia sẻ mã này cho bất kỳ ai.',
      '  </p>',
      '  <div style="border-top: 1px solid #eeeeee; padding-top: 16px; font-size: 12px; color: #888888;">',
      '    HK Store Streetwear · 126 Thanh Vinh 10, Hoà Khánh Bắc, Đà Nẵng · Hotline: 0965 811 846',
      '  </div>',
      '</div>'
    ].join("");
  }

  // 2. Mẫu HTML Email Chào mừng sau khi kích hoạt OTP thành công
  function buildHtmlWelcomeTemplate({ toName, toEmail }) {
    const baseUrl = getBaseSiteUrl();
    return [
      '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 32px; background: #ffffff; color: #111111;">',
      '  <div style="border-bottom: 2px solid #111111; padding-bottom: 16px; margin-bottom: 24px;">',
      '    <h2 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #111111;">HK STORE</h2>',
      '    <p style="margin: 4px 0 0; color: #1b6e32; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">✓ Tài khoản đã kích hoạt thành công</p>',
      '  </div>',
      '  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Xin chào <strong>' + escapeHtml(toName || "Quý khách") + '</strong>,</p>',
      '  <p style="font-size: 14px; line-height: 1.6; margin: 0 0 18px;">Chúc mừng bạn đã chính thức trở thành thành viên của cộng đồng Streetwear <strong>HK Store</strong>. Địa chỉ Gmail <strong>' + escapeHtml(toEmail) + '</strong> đã được xác thực bảo mật thành công.</p>',
      '  <div style="background: #f7f7f5; border-left: 4px solid #111111; padding: 14px 16px; margin-bottom: 22px; font-size: 13px; line-height: 1.6;">',
      '    <strong>Đặc quyền thành viên HK Store:</strong><br/>',
      '    • Miễn phí vận chuyển (Freeship) cho mọi đơn hàng từ 500.000₫<br/>',
      '    • Hỗ trợ đổi trả size linh hoạt trong vòng 15 ngày<br/>',
      '    • Nhận hóa đơn điện tử PDF &amp; theo dõi mã vận đơn thời gian thực',
      '  </div>',
      '  <div style="text-align: center; margin: 24px 0;">',
      '    <a href="' + baseUrl + '/products.html" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 13px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; border-radius: 3px;">Khám phá Bộ sưu tập ngay &rarr;</a>',
      '  </div>',
      '  <div style="border-top: 1px solid #eeeeee; padding-top: 16px; font-size: 12px; color: #888888;">',
      '    HK Store Streetwear · 126 Thanh Vinh 10, Hoà Khánh Bắc, Đà Nẵng · Hotline: 0965 811 846',
      '  </div>',
      '</div>'
    ].join("");
  }

  // 3. Mẫu HTML Email Xác nhận Đặt hàng thành công & Hóa đơn PDF chi tiết
  function buildOrderConfirmationTemplate(order) {
    const baseUrl = getBaseSiteUrl();
    const orderDetailUrl = `${baseUrl}/order-detail.html?id=${encodeURIComponent(order.id)}`;
    const invoicePdfUrl = `${baseUrl}/order-detail.html?id=${encodeURIComponent(order.id)}&invoice=pdf`;

    let paymentMethodText = "Thanh toán khi nhận hàng (COD)";
    if (order.paymentMethod === "banking") paymentMethodText = "Chuyển khoản Ngân hàng (Vietcombank)";
    if (order.paymentMethod === "gateway") {
      paymentMethodText = order.paymentProvider === "momo" ? "Ví điện tử MoMo (QR)" : "Cổng VNPAY-QR";
    }
    const paymentStatusText = order.paymentStatus === "paid" ? "ĐÃ THANH TOÁN" : "CHỜ THANH TOÁN";

    const itemsRowsHtml = (order.items || [])
      .map(
        (item, idx) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eeeeee; font-size: 13px;">
            <strong>${idx + 1}. ${escapeHtml(item.name)}</strong><br/>
            <span style="color: #666666; font-size: 12px;">SKU: ${escapeHtml(item.sku || "N/A")} | Phân loại: Size ${escapeHtml(item.size)} - ${escapeHtml(item.colorName)}</span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eeeeee; font-size: 13px; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eeeeee; font-size: 13px; text-align: right;">${formatMoney(item.price)}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eeeeee; font-size: 13px; font-weight: 700; text-align: right;">${formatMoney(item.lineTotal)}</td>
        </tr>
      `
      )
      .join("");

    return [
      '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 28px; background: #ffffff; color: #111111;">',
      '  <div style="border-bottom: 2px solid #111111; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">',
      '    <div>',
      '      <h2 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #111111;">HK STORE — HÓA ĐƠN ĐẶT HÀNG</h2>',
      '      <p style="margin: 4px 0 0; color: #1b6e32; font-size: 12px; font-weight: 700; text-transform: uppercase;">✓ Đặt hàng thành công — Mã đơn: #' + escapeHtml(order.id) + '</p>',
      '    </div>',
      '  </div>',
      '  <p style="font-size: 14px; line-height: 1.6; margin: 0 0 14px;">Xin chào <strong>' + escapeHtml(order.customerInfo.fullName) + '</strong>,</p>',
      '  <p style="font-size: 14px; line-height: 1.6; margin: 0 0 18px;">Cảm ơn bạn đã mua sắm tại <strong>HK Store</strong>! Đơn hàng <strong>#' + escapeHtml(order.id) + '</strong> của bạn đã được hệ thống ghi nhận. Dưới đây là Hóa đơn chi tiết và đường dẫn theo dõi vận đơn của bạn:</p>',
      '  <div style="background: #f8f8f6; border: 1px solid #e5e5e5; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.65;">',
      '    <div><strong>Mã hóa đơn / Đơn hàng:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: 700;">#' + escapeHtml(order.id) + '</span></div>',
      '    <div><strong>Thời gian đặt hàng:</strong> ' + escapeHtml(formatDateTime(order.createdAt)) + '</div>',
      '    <div><strong>Người nhận:</strong> ' + escapeHtml(order.customerInfo.fullName) + ' — <strong>SĐT:</strong> ' + escapeHtml(order.customerInfo.phone) + '</div>',
      '    <div><strong>Địa chỉ nhận hàng:</strong> ' + escapeHtml(order.customerInfo.address) + '</div>',
      order.customerInfo.note ? '    <div><strong>Ghi chú giao hàng:</strong> ' + escapeHtml(order.customerInfo.note) + '</div>' : '',
      '    <div><strong>Phương thức thanh toán:</strong> ' + escapeHtml(paymentMethodText) + ' (' + paymentStatusText + ')</div>',
      '  </div>',
      '  <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; color: #111111;">Chi tiết sản phẩm trong hóa đơn:</h3>',
      '  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">',
      '    <thead>',
      '      <tr style="background: #111111; color: #ffffff; font-size: 12px; text-transform: uppercase;">',
      '        <th style="padding: 8px; text-align: left;">Sản phẩm</th>',
      '        <th style="padding: 8px; text-align: center;">SL</th>',
      '        <th style="padding: 8px; text-align: right;">Đơn giá</th>',
      '        <th style="padding: 8px; text-align: right;">Thành tiền</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + itemsRowsHtml + '</tbody>',
      '  </table>',
      '  <div style="margin-left: auto; max-width: 280px; font-size: 13px; line-height: 1.8; margin-bottom: 24px;">',
      '    <div style="display: flex; justify-content: space-between;"><span>Tạm tính:</span> <strong>' + formatMoney(order.subtotal) + '</strong></div>',
      '    <div style="display: flex; justify-content: space-between;"><span>Phí vận chuyển:</span> <strong>' + (order.shippingFee === 0 ? "MIỄN PHÍ" : formatMoney(order.shippingFee)) + '</strong></div>',
      '    <div style="display: flex; justify-content: space-between; border-top: 2px solid #111111; padding-top: 6px; margin-top: 4px; font-size: 15px; font-weight: 900;"><span>TỔNG THANH TOÁN:</span> <span style="color: #b71c1c;">' + formatMoney(order.total) + '</span></div>',
      '  </div>',
      '  <div style="text-align: center; margin: 24px 0; padding: 18px; background: #f4f4f2; border-radius: 4px;">',
      '    <div style="margin-bottom: 12px; font-size: 13px; font-weight: 700; color: #111111;">TRUY CẬP HÓA ĐƠN PDF &amp; THEO DÕI VẬN ĐƠN TRỰC TUYẾN</div>',
      '    <a href="' + invoicePdfUrl + '" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 11px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-radius: 3px; margin: 4px;">📄 Xem &amp; Tải Hóa đơn PDF</a>',
      '    <a href="' + orderDetailUrl + '" style="display: inline-block; background: #ffffff; color: #111111; border: 1px solid #111111; text-decoration: none; padding: 10px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-radius: 3px; margin: 4px;">🚚 Theo dõi Tiến trình &amp; Vận đơn</a>',
      '  </div>',
      '  <div style="border-top: 1px solid #eeeeee; padding-top: 14px; font-size: 12px; color: #888888; line-height: 1.5;">',
      '    HK Store Streetwear · 126 Thanh Vinh 10, Phường Hoà Khánh Bắc, TP. Đà Nẵng · Hotline: 0965 811 846',
      '  </div>',
      '</div>'
    ].join("");
  }

  // 4. Mẫu HTML Email Cập nhật Trạng thái Đơn hàng ("Đang giao hàng" / "Giao thành công")
  function buildOrderStatusTemplate(order, statusType) {
    const baseUrl = getBaseSiteUrl();
    const orderDetailUrl = `${baseUrl}/order-detail.html?id=${encodeURIComponent(order.id)}`;
    const invoicePdfUrl = `${baseUrl}/order-detail.html?id=${encodeURIComponent(order.id)}&invoice=pdf`;

    const isDelivered = statusType === "delivered";
    const carrierCode = order.shippingCarrier || "spx";
    const carrierName =
      order.shippingCarrierName ||
      (HK.Orders && HK.Orders.getCarrierName ? HK.Orders.getCarrierName(carrierCode) : "Đơn vị vận chuyển");
    const trackingCode = (order.trackingCode || "").trim();
    const trackingUrl =
      trackingCode && HK.Orders && HK.Orders.getCarrierTrackingUrl
        ? HK.Orders.getCarrierTrackingUrl(carrierCode, trackingCode)
        : orderDetailUrl;

    const statusBadgeHtml = isDelivered
      ? '<span style="display: inline-block; background: #1b6e32; color: #ffffff; padding: 4px 10px; font-size: 12px; font-weight: 700; border-radius: 3px; text-transform: uppercase;">✓ ĐÃ GIAO HÀNG THÀNH CÔNG</span>'
      : '<span style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 4px 10px; font-size: 12px; font-weight: 700; border-radius: 3px; text-transform: uppercase;">🚚 ĐANG GIAO HÀNG ĐẾN BẠN</span>';

    const leadMessage = isDelivered
      ? `Đơn hàng <strong>#${escapeHtml(order.id)}</strong> của bạn đã được <strong>giao thành công</strong>! Cảm ơn bạn đã tin tưởng lựa chọn sản phẩm của <strong>HK Store</strong>. Nếu sản phẩm cần hỗ trợ đổi size, bạn có <strong>15 ngày đổi trả miễn phí</strong> kể từ hôm nay.`
      : `Đơn hàng <strong>#${escapeHtml(order.id)}</strong> của bạn đã được đóng gói hoàn tất và bàn giao cho đơn vị vận chuyển <strong>${escapeHtml(carrierName)}</strong>. Vui lòng giữ liên lạc điện thoại (<strong>${escapeHtml(order.customerInfo.phone)}</strong>) để bưu tá giao hàng cho bạn nhé!`;

    const trackingSectionHtml = trackingCode
      ? [
          '<div style="background: #eef6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 16px; margin-bottom: 20px;">',
          '  <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1e40af; margin-bottom: 6px;">Thông tin Vận đơn Giao hàng</div>',
          '  <div style="font-size: 14px; margin-bottom: 4px;">Đơn vị vận chuyển: <strong>' + escapeHtml(carrierName) + '</strong></div>',
          '  <div style="font-size: 14px; margin-bottom: 12px;">Mã vận đơn: <span style="font-family: monospace; font-size: 15px; font-weight: 900; background: #ffffff; padding: 3px 8px; border: 1px solid #93c5fd; border-radius: 3px;">' + escapeHtml(trackingCode) + '</span></div>',
          '  <a href="' + trackingUrl + '" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 9px 16px; font-size: 12px; font-weight: 700; border-radius: 3px; text-transform: uppercase;">🔍 Tra cứu hành trình vận đơn trực tiếp &nearr;</a>',
          '</div>'
        ].join("")
      : [
          '<div style="background: #f8f8f6; border: 1px solid #e5e5e5; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px;">',
          '  <div><strong>Đơn vị vận chuyển:</strong> ' + escapeHtml(carrierName) + '</div>',
          '  <div><strong>Địa chỉ nhận hàng:</strong> ' + escapeHtml(order.customerInfo.address) + '</div>',
          '</div>'
        ].join("");

    const itemsSummaryHtml = (order.items || [])
      .map(
        (item) =>
          `<li style="margin-bottom: 6px;"><strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.size)} - ${escapeHtml(item.colorName)}) × ${item.quantity} — <strong>${formatMoney(item.lineTotal)}</strong></li>`
      )
      .join("");

    return [
      '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 28px; background: #ffffff; color: #111111;">',
      '  <div style="border-bottom: 2px solid #111111; padding-bottom: 16px; margin-bottom: 20px;">',
      '    <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #111111;">HK STORE — CẬP NHẬT ĐƠN HÀNG</h2>',
      '    ' + statusBadgeHtml,
      '  </div>',
      '  <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px;">Xin chào <strong>' + escapeHtml(order.customerInfo.fullName) + '</strong>,</p>',
      '  <p style="font-size: 14px; line-height: 1.65; margin: 0 0 18px;">' + leadMessage + '</p>',
      trackingSectionHtml,
      '  <div style="background: #f8f8f6; border: 1px solid #e5e5e5; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px;">',
      '    <div style="font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Tóm tắt sản phẩm (Đơn #' + escapeHtml(order.id) + '):</div>',
      '    <ul style="margin: 0 0 10px 18px; padding: 0; line-height: 1.6;">' + itemsSummaryHtml + '</ul>',
      '    <div style="border-top: 1px solid #dddddd; padding-top: 8px; font-size: 14px;">Tổng thanh toán: <strong style="color: #b71c1c;">' + formatMoney(order.total) + '</strong></div>',
      '  </div>',
      '  <div style="text-align: center; margin: 22px 0;">',
      '    <a href="' + orderDetailUrl + '" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 11px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-radius: 3px; margin: 4px;">🚚 Xem Tiến trình Đơn hàng</a>',
      '    <a href="' + invoicePdfUrl + '" style="display: inline-block; background: #ffffff; color: #111111; border: 1px solid #111111; text-decoration: none; padding: 10px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-radius: 3px; margin: 4px;">📄 Tải Hóa đơn PDF</a>',
      '  </div>',
      '  <div style="border-top: 1px solid #eeeeee; padding-top: 14px; font-size: 12px; color: #888888;">',
      '    HK Store Streetwear · 126 Thanh Vinh 10, Phường Hoà Khánh Bắc, TP. Đà Nẵng · Hotline: 0965 811 846',
      '  </div>',
      '</div>'
    ].join("");
  }

  // Hàm cốt lõi gửi HTML Email qua Google Apps Script hoặc EmailJS
  async function dispatchRawEmail({ toEmail, toName, subject, htmlBody, type = "general", extraParams = {} }) {
    const cleanEmail = String(toEmail || "").trim();
    if (!cleanEmail) {
      return { success: false, message: "Địa chỉ email người nhận không hợp lệ." };
    }

    const cfg = EmailService.getConfig();
    if (!EmailService.isConfigured()) {
      recordEmailLog({
        type,
        toEmail: cleanEmail,
        subject,
        status: "not_configured"
      });
      return {
        success: false,
        notConfigured: true,
        message: "Chưa kết nối cổng gửi thư Gmail (Google Apps Script / EmailJS)."
      };
    }

    // 1. Ưu tiên gửi qua Google Apps Script (MailApp chính chủ Google)
    if (cfg.googleScriptUrl && cfg.googleScriptUrl.trim()) {
      const payload = Object.assign(
        {
          toEmail: cleanEmail,
          toName: toName || "Quý khách",
          subject: subject,
          htmlBody: htmlBody
        },
        extraParams
      );

      try {
        const response = await fetch(cfg.googleScriptUrl.trim(), {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload),
          redirect: "follow"
        });

        if (response.status === 401 || response.status === 403) {
          recordEmailLog({ type, toEmail: cleanEmail, subject, status: "error_401" });
          return {
            success: false,
            permissionError: true,
            message:
              "Google Script đang để quyền 'Chỉ mình tôi' (Lỗi 401). Hãy vào Quản lý triển khai -> Sửa -> chọn Ai có quyền truy cập: 'Bất kỳ ai (Anyone)'!"
          };
        }

        if (response.type === "opaque" || response.ok) {
          try {
            const resJson = await response.json();
            if (resJson && resJson.success === false) {
              recordEmailLog({ type, toEmail: cleanEmail, subject, status: "failed" });
              return {
                success: false,
                message: "Lỗi từ Google Script: " + (resJson.error || "Không xác định")
              };
            }
          } catch (e) {}

          recordEmailLog({ type, toEmail: cleanEmail, subject, status: "sent", via: "google_script" });
          return {
            success: true,
            sentVia: "google_script",
            message: `Đã gửi email tới hộp thư ${cleanEmail}`
          };
        }
      } catch (err) {
        // Fallback no-cors khi trình duyệt chặn đọc redirect từ script.googleusercontent.com
        try {
          await fetch(cfg.googleScriptUrl.trim(), {
            method: "POST",
            mode: "no-cors",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
          });
          recordEmailLog({ type, toEmail: cleanEmail, subject, status: "sent", via: "google_script_nocors" });
          return {
            success: true,
            sentVia: "google_script",
            message: `Đã gửi email tới hộp thư ${cleanEmail}`
          };
        } catch (innerErr) {
          recordEmailLog({ type, toEmail: cleanEmail, subject, status: "network_error" });
          return {
            success: false,
            message: "Không thể kết nối tới Google Apps Script. Vui lòng kiểm tra lại kết nối mạng."
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
            template_params: Object.assign(
              {
                to_email: cleanEmail,
                email: cleanEmail,
                user_email: cleanEmail,
                to_name: toName || "Quý khách",
                subject: subject,
                html_body: htmlBody,
                store_name: "HK STORE - Streetwear Minimalist"
              },
              extraParams
            )
          })
        });

        if (res.ok) {
          recordEmailLog({ type, toEmail: cleanEmail, subject, status: "sent", via: "emailjs" });
          return {
            success: true,
            sentVia: "emailjs",
            message: `Đã gửi email tới hộp thư ${cleanEmail}`
          };
        } else {
          const errText = await res.text();
          recordEmailLog({ type, toEmail: cleanEmail, subject, status: "failed" });
          return {
            success: false,
            message: "EmailJS từ chối gửi thư: " + errText
          };
        }
      } catch (err) {
        recordEmailLog({ type, toEmail: cleanEmail, subject, status: "network_error" });
        return {
          success: false,
          message: "Lỗi kết nối tới máy chủ EmailJS."
        };
      }
    }

    return {
      success: false,
      notConfigured: true,
      message: "Chưa cấu hình dịch vụ gửi email."
    };
  }

  const EmailService = {
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

    setConfig: function (newConfig) {
      const merged = Object.assign({}, EmailService.getConfig(), newConfig || {});
      if (HK.Storage) {
        HK.Storage.set(STORAGE_KEY, merged);
      }
      window.HK_EMAIL_CONFIG = merged;
      return merged;
    },

    isConfigured: function () {
      const cfg = EmailService.getConfig();
      const hasGoogleScript = Boolean(
        cfg.googleScriptUrl &&
          /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(cfg.googleScriptUrl.trim())
      );
      const hasEmailJs = Boolean(cfg.serviceId && cfg.templateId && cfg.publicKey);
      return hasGoogleScript || hasEmailJs;
    },

    getLogs: function () {
      return HK.Storage ? HK.Storage.get(EMAIL_LOGS_KEY, []) : [];
    },

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
     * 1A. Gửi mã OTP kích hoạt tài khoản về Gmail thật
     */
    sendOTPEmail: async function ({ toEmail, toName, otpCode, expiresInMinutes = 2 }) {
      const subject = "[" + otpCode + "] Mã xác thực OTP đăng ký tài khoản HK Store";
      const htmlBody = buildHtmlOtpTemplate({ toName, otpCode, expiresInMinutes });
      const res = await dispatchRawEmail({
        toEmail,
        toName,
        subject,
        htmlBody,
        type: "otp",
        extraParams: {
          otpCode: otpCode,
          expiryMinutes: expiresInMinutes
        }
      });
      if (res.success) {
        res.message = "Mã xác thực OTP 6 chữ số đã được gửi về hộp thư Gmail: " + toEmail;
      }
      return res;
    },

    /**
     * 1B. Gửi Email Chào mừng thành viên sau khi xác thực OTP thành công
     */
    sendWelcomeEmail: async function ({ toEmail, toName }) {
      const subject = "[HK STORE] Chào mừng " + (toName || "bạn") + " gia nhập HK Store — Tài khoản đã kích hoạt!";
      const htmlBody = buildHtmlWelcomeTemplate({ toName, toEmail });
      return await dispatchRawEmail({
        toEmail,
        toName,
        subject,
        htmlBody,
        type: "welcome"
      });
    },

    /**
     * 2. Gửi Email Xác nhận Đặt hàng thành công (Kèm Hóa đơn chi tiết, link tải PDF & theo dõi vận đơn)
     */
    sendOrderConfirmationEmail: async function (order) {
      if (!order || !order.customerInfo || !order.customerInfo.email) {
        return { success: false, message: "Đơn hàng không có địa chỉ email khách hàng." };
      }
      const toEmail = order.customerInfo.email.trim();
      const toName = order.customerInfo.fullName || "Quý khách";
      const subject = `[HK STORE] Xác nhận đơn hàng #${order.id} & Hóa đơn điện tử PDF`;
      const htmlBody = buildOrderConfirmationTemplate(order);

      return await dispatchRawEmail({
        toEmail,
        toName,
        subject,
        htmlBody,
        type: "order_created",
        extraParams: {
          orderId: order.id
        }
      });
    },

    /**
     * 3. Gửi Email tự động khi trạng thái đơn hàng chuyển sang "Đang giao hàng" (shipping) hoặc "Giao thành công" (delivered)
     */
    sendOrderStatusEmail: async function (order, statusType) {
      if (!order || !order.customerInfo || !order.customerInfo.email) {
        return { success: false, message: "Đơn hàng không có địa chỉ email khách hàng." };
      }
      const cleanStatus = statusType || order.orderStatus;
      if (cleanStatus !== "shipping" && cleanStatus !== "delivered") {
        return { success: false, message: "Trạng thái không yêu cầu gửi email tự động." };
      }

      const toEmail = order.customerInfo.email.trim();
      const toName = order.customerInfo.fullName || "Quý khách";
      const subject =
        cleanStatus === "delivered"
          ? `[HK STORE] Đơn hàng #${order.id} đã giao thành công! 🎉`
          : `[HK STORE] Đơn hàng #${order.id} đang được giao đến bạn! ${
              order.trackingCode ? "(Mã VĐ: " + order.trackingCode + ")" : "🚚"
            }`;
      const htmlBody = buildOrderStatusTemplate(order, cleanStatus);

      return await dispatchRawEmail({
        toEmail,
        toName,
        subject,
        htmlBody,
        type: cleanStatus === "delivered" ? "order_delivered" : "order_shipping",
        extraParams: {
          orderId: order.id,
          orderStatus: cleanStatus,
          trackingCode: order.trackingCode || ""
        }
      });
    },

    /**
     * Mở cửa sổ / bản in Hóa đơn PDF chuẩn A4 cho Khách hàng & Admin (Lưu thành PDF hoặc In)
     */
    openPrintableInvoicePDF: function (orderOrId) {
      const order =
        typeof orderOrId === "string" && HK.Orders && HK.Orders.getById
          ? HK.Orders.getById(orderOrId)
          : orderOrId;

      if (!order || !order.id) {
        if (HK.UI && HK.UI.showToast) {
          HK.UI.showToast("Không tìm thấy dữ liệu đơn hàng để xuất hóa đơn PDF.", "error");
        }
        return;
      }

      const statusNames = {
        pending: "Chờ xác nhận",
        confirmed: "Đã xác nhận",
        shipping: "Đang giao hàng",
        delivered: "Đã giao thành công",
        cancelled: "Đã hủy"
      };

      const paymentStatusNames = {
        pending: "Chờ thanh toán",
        paid: "Đã thanh toán",
        refund_pending: "Chờ hoàn tiền",
        refunded: "Đã hoàn tiền"
      };

      let paymentMethodText = "Thanh toán khi nhận hàng (COD)";
      if (order.paymentMethod === "banking") paymentMethodText = "Chuyển khoản Ngân hàng (Vietcombank)";
      if (order.paymentMethod === "gateway") {
        paymentMethodText = order.paymentProvider === "momo" ? "Ví điện tử MoMo (QR)" : "Cổng VNPAY-QR";
      }

      const carrierCode = order.shippingCarrier || "spx";
      const carrierName =
        order.shippingCarrierName ||
        (HK.Orders && HK.Orders.getCarrierName ? HK.Orders.getCarrierName(carrierCode) : "Đơn vị vận chuyển");

      const itemsRows = (order.items || [])
        .map(
          (item, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>
              <strong>${escapeHtml(item.name)}</strong>
              <div style="font-size: 11px; color: #555;">SKU: ${escapeHtml(item.sku || "N/A")} | Size: ${escapeHtml(item.size)} | Màu: ${escapeHtml(item.colorName)}</div>
            </td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${formatMoney(item.price)}</td>
            <td style="text-align: right; font-weight: 700;">${formatMoney(item.lineTotal)}</td>
          </tr>
        `
        )
        .join("");

      const invoiceHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Hoa-Don-${escapeHtml(order.id)}-HKStore</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      color: #111111;
      background: #f3f3f1;
      margin: 0;
      padding: 24px;
    }
    .invoice-toolbar {
      max-width: 800px;
      margin: 0 auto 16px;
      background: #111111;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .invoice-toolbar-btn {
      background: #ffffff;
      color: #111111;
      border: none;
      padding: 8px 16px;
      font-weight: 800;
      font-size: 13px;
      border-radius: 4px;
      cursor: pointer;
      text-transform: uppercase;
    }
    .invoice-sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border: 1px solid #dddddd;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #111111;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 2px;
      margin: 0;
    }
    .brand-sub {
      font-size: 12px;
      color: #555555;
      margin-top: 4px;
    }
    .invoice-meta {
      text-align: right;
      font-size: 13px;
      line-height: 1.6;
    }
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
      font-size: 13px;
      line-height: 1.65;
    }
    .info-box {
      background: #f9f9f7;
      border: 1px solid #e5e5e5;
      padding: 14px 16px;
      border-radius: 4px;
    }
    .info-box h4 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 6px;
    }
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 13px;
    }
    table.invoice-table th {
      background: #111111;
      color: #ffffff;
      padding: 10px 8px;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    table.invoice-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #e5e5e5;
    }
    .totals-box {
      width: 300px;
      margin-left: auto;
      font-size: 13px;
      line-height: 1.8;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
    }
    .totals-final {
      border-top: 2px solid #111111;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 16px;
      font-weight: 900;
    }
    .stamp-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #cccccc;
      font-size: 12px;
    }
    .verified-stamp {
      border: 2px solid #1b6e32;
      color: #1b6e32;
      padding: 8px 16px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-radius: 4px;
      transform: rotate(-2deg);
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-toolbar { display: none !important; }
      .invoice-sheet { border: none; box-shadow: none; padding: 15px; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="invoice-toolbar">
    <div>
      <strong>HÓA ĐƠN ĐIỆN TỬ PDF — #${escapeHtml(order.id)}</strong>
      <div style="font-size: 12px; color: #cccccc;">Chọn "Lưu dưới dạng PDF (Save as PDF)" trong hộp thoại in để tải file PDF về máy.</div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button type="button" class="invoice-toolbar-btn" onclick="window.print()">🖨️ In / Tải xuống PDF</button>
      <button type="button" class="invoice-toolbar-btn" style="background: #333; color: #fff;" onclick="window.close()">Đóng</button>
    </div>
  </div>

  <div class="invoice-sheet">
    <div class="invoice-header">
      <div>
        <h1 class="brand-title">HK STORE</h1>
        <div class="brand-sub">STREETWEAR MINIMALIST — HÓA ĐƠN BÁN HÀNG KIÊM PHIẾU XUẤT KHO</div>
        <div class="brand-sub">Showroom: 126 Thanh Vinh 10, P. Hoà Khánh Bắc, TP. Đà Nẵng | Hotline: 0965 811 846</div>
      </div>
      <div class="invoice-meta">
        <div><strong>MÃ HÓA ĐƠN:</strong> <span style="font-family: monospace; font-size: 15px;">#${escapeHtml(order.id)}</span></div>
        <div><strong>Ngày lập:</strong> ${escapeHtml(formatDateTime(order.createdAt))}</div>
        <div><strong>Trạng thái đơn:</strong> ${escapeHtml(statusNames[order.orderStatus] || order.orderStatus)}</div>
      </div>
    </div>

    <div class="grid-2col">
      <div class="info-box">
        <h4>Thông tin Khách hàng &amp; Nhận hàng</h4>
        <div><strong>Họ và tên:</strong> ${escapeHtml(order.customerInfo.fullName)}</div>
        <div><strong>Số điện thoại:</strong> ${escapeHtml(order.customerInfo.phone)}</div>
        <div><strong>Email:</strong> ${escapeHtml(order.customerInfo.email)}</div>
        <div><strong>Địa chỉ:</strong> ${escapeHtml(order.customerInfo.address)}</div>
        ${order.customerInfo.note ? `<div><strong>Ghi chú:</strong> ${escapeHtml(order.customerInfo.note)}</div>` : ""}
      </div>

      <div class="info-box">
        <h4>Thông tin Thanh toán &amp; Vận chuyển</h4>
        <div><strong>Phương thức:</strong> ${escapeHtml(paymentMethodText)}</div>
        <div><strong>TT Thanh toán:</strong> <strong>${escapeHtml(paymentStatusNames[order.paymentStatus] || order.paymentStatus)}</strong></div>
        <div><strong>Đơn vị vận chuyển:</strong> ${escapeHtml(order.trackingCode ? carrierName : "Tiêu chuẩn HK Store")}</div>
        <div><strong>Mã vận đơn:</strong> <span style="font-family: monospace; font-weight: 700;">${escapeHtml(order.trackingCode || "Đang cập nhật")}</span></div>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th style="width: 45px;">STT</th>
          <th style="text-align: left;">Tên sản phẩm / Quy cách</th>
          <th style="width: 65px;">SL</th>
          <th style="width: 120px; text-align: right;">Đơn giá</th>
          <th style="width: 130px; text-align: right;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row"><span>Tạm tính:</span> <strong>${formatMoney(order.subtotal)}</strong></div>
      <div class="totals-row"><span>Phí vận chuyển:</span> <strong>${order.shippingFee === 0 ? "MIỄN PHÍ (0 ₫)" : formatMoney(order.shippingFee)}</strong></div>
      <div class="totals-row totals-final"><span>TỔNG CỘNG:</span> <span>${formatMoney(order.total)}</span></div>
    </div>

    <div class="stamp-row">
      <div>
        <strong>Chính sách Đổi trả &amp; Bảo hành:</strong><br/>
        • Đổi size / mẫu miễn phí trong vòng 15 ngày kể từ ngày nhận hàng.<br/>
        • Vui lòng giữ nguyên tem mác và hóa đơn điện tử này khi cần hỗ trợ.
      </div>
      <div class="verified-stamp">
        ✓ XÁC THỰC BỞI HK STORE
      </div>
    </div>
  </div>

  <script>
    window.addEventListener("load", function() {
      setTimeout(function() { window.print(); }, 450);
    });
  </script>
</body>
</html>`;

      const printWin = window.open("", "_blank", "width=900,height=820,scrollbars=yes");
      if (printWin) {
        printWin.document.open();
        printWin.document.write(invoiceHtml);
        printWin.document.close();
      } else if (HK.UI && HK.UI.showToast) {
        HK.UI.showToast("Trình duyệt đang chặn cửa sổ bật lên (Pop-up). Vui lòng cho phép mở Pop-up để tải PDF!", "error");
      }
    }
  };

  HK.EmailService = EmailService;
})(window.HKStore);

/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Xác thực & Quản lý Tài khoản Demo
 * Lưu ý: Đây là xác thực mô phỏng trên localStorage dùng cho mục đích demo/học tập.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;

  const Auth = {
    // Chuẩn hóa & kiểm tra số điện thoại di động Việt Nam (cho phép gõ dấu cách, dấu chấm, gạch ngang)
    normalizePhone: function (rawPhone) {
      return String(rawPhone || "").replace(/[\s.-]/g, "").trim();
    },

    isValidPhone: function (rawPhone) {
      const cleaned = Auth.normalizePhone(rawPhone);
      return /^(0|\+84)[0-9]{9,10}$/.test(cleaned);
    },

    // Lấy đường dẫn returnUrl nội bộ an toàn (tránh open-redirect)
    getSafeReturnUrl: function (fallbackUrl = "index.html") {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw = (params.get("returnUrl") || "").trim();
        if (raw && /^[a-z0-9_-]+\.html(\?[a-z0-9_=&%-]*)?$/i.test(raw) && !/^login\.html/i.test(raw) && !/^register\.html/i.test(raw)) {
          return raw;
        }
      } catch (e) {}
      return fallbackUrl;
    },

    // Lấy thông tin tài khoản đang đăng nhập
    getCurrentUser: function () {
      return Storage.get(Storage.KEYS.SESSION, null);
    },

    // Kiểm tra xem đã đăng nhập chưa
    isLoggedIn: function () {
      return !!Auth.getCurrentUser();
    },

    // Kiểm tra xem tài khoản có quyền Admin không
    isAdmin: function () {
      const user = Auth.getCurrentUser();
      return user && user.role === "admin";
    },

    // Đăng nhập
    login: function (email, password) {
      if (!email || !password) {
        return { success: false, message: "Vui lòng nhập đầy đủ email và mật khẩu." };
      }

      const normalizedEmail = email.trim().toLowerCase();
      const users = Storage.get(Storage.KEYS.USERS, []);

      const user = users.find(
        (u) => u.email.trim().toLowerCase() === normalizedEmail && u.password === password
      );

      if (!user) {
        return {
          success: false,
          message: "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!"
        };
      }

      // Lưu phiên đăng nhập (không lưu password vào session)
      const sessionData = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role || "customer",
        loginAt: new Date().toISOString()
      };

      Storage.set(Storage.KEYS.SESSION, sessionData);

      // Tự động hợp nhất giỏ hàng của khách (guest) vào giỏ tài khoản nếu có
      if (HK.Cart && HK.Cart.mergeGuestCart) {
        HK.Cart.mergeGuestCart(user.id);
      }

      return { success: true, user: sessionData };
    },

    // Đăng ký tài khoản mới
    register: function ({ fullName, email, password, confirmPassword, phone, address }) {
      if (!fullName || fullName.trim().length < 2) {
        return { success: false, field: "name", message: "Vui lòng nhập họ và tên (tối thiểu 2 ký tự)." };
      }

      if (!email || !password) {
        return { success: false, field: !email ? "email" : "password", message: "Vui lòng nhập đầy đủ email và mật khẩu." };
      }

      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return { success: false, field: "email", message: "Định dạng email chưa hợp lệ (ví dụ: ten@email.com)." };
      }

      if (password.length < 8) {
        return { success: false, field: "password", message: "Mật khẩu phải có tối thiểu 8 ký tự." };
      }

      if (confirmPassword !== undefined && password !== confirmPassword) {
        return { success: false, field: "confirmPassword", message: "Mật khẩu xác nhận không khớp." };
      }

      const cleanedPhone = Auth.normalizePhone(phone);
      if (cleanedPhone && !Auth.isValidPhone(cleanedPhone)) {
        return { success: false, field: "phone", message: "Số điện thoại chưa hợp lệ (gồm 10 chữ số, bắt đầu bằng 0 hoặc +84)." };
      }

      const users = Storage.get(Storage.KEYS.USERS, []);
      const exists = users.some((u) => u.email.trim().toLowerCase() === normalizedEmail);

      if (exists) {
        return { success: false, field: "email", message: "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác." };
      }

      const newUser = {
        id: Storage.generateId("USER"),
        fullName: fullName.trim(),
        email: normalizedEmail,
        password: password,
        phone: cleanedPhone,
        address: address ? address.trim() : "",
        role: "customer", // Tài khoản đăng ký luôn có role là customer
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      Storage.set(Storage.KEYS.USERS, users);

      // Đăng nhập luôn sau khi đăng ký (tự động merge giỏ hàng khách vào tài khoản mới)
      return Auth.login(normalizedEmail, password);
    },

    // Cập nhật thông tin cá nhân
    updateProfile: function ({ fullName, phone, address }) {
      const currentUser = Auth.getCurrentUser();
      if (!currentUser) {
        return { success: false, message: "Bạn chưa đăng nhập." };
      }

      const trimmedName = (fullName !== undefined ? fullName : currentUser.fullName).trim();
      if (trimmedName.length < 2) {
        return { success: false, field: "name", message: "Họ và tên phải có tối thiểu 2 ký tự." };
      }

      const cleanedPhone = phone !== undefined ? Auth.normalizePhone(phone) : currentUser.phone;
      if (cleanedPhone && !Auth.isValidPhone(cleanedPhone)) {
        return { success: false, field: "phone", message: "Số điện thoại chưa hợp lệ (gồm 10 chữ số, bắt đầu bằng 0 hoặc +84)." };
      }

      const users = Storage.get(Storage.KEYS.USERS, []);
      const userIndex = users.findIndex((u) => u.id === currentUser.id);

      if (userIndex === -1) {
        return { success: false, message: "Không tìm thấy thông tin tài khoản." };
      }

      // Cập nhật trong danh sách users
      users[userIndex].fullName = trimmedName;
      users[userIndex].phone = cleanedPhone;
      users[userIndex].address = (address !== undefined ? address : currentUser.address).trim();
      Storage.set(Storage.KEYS.USERS, users);

      // Cập nhật session hiện tại
      currentUser.fullName = users[userIndex].fullName;
      currentUser.phone = users[userIndex].phone;
      currentUser.address = users[userIndex].address;
      Storage.set(Storage.KEYS.SESSION, currentUser);

      return { success: true, user: currentUser };
    },

    // Đăng xuất
    logout: function (redirectUrl = "index.html") {
      Storage.remove(Storage.KEYS.SESSION);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },

    // Bảo vệ trang yêu cầu đăng nhập
    requireAuth: function (returnUrl) {
      const user = Auth.getCurrentUser();
      if (!user) {
        const target = returnUrl || window.location.pathname.split("/").pop() + window.location.search;
        window.location.href = `login.html?returnUrl=${encodeURIComponent(target)}`;
        return false;
      }
      return true;
    },

    // Bảo vệ trang Admin
    requireAdmin: function () {
      const user = Auth.getCurrentUser();
      if (!user) {
        window.location.href = "login.html?returnUrl=admin.html";
        return false;
      }
      if (user.role !== "admin") {
        window.location.href = "index.html";
        return false;
      }
      return true;
    }
  };

  HK.Auth = Auth;
})(window.HKStore);

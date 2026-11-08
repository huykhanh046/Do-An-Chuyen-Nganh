/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Xác thực & Quản lý Tài khoản Demo
 * Lưu ý: Đây là xác thực mô phỏng trên localStorage dùng cho mục đích demo/học tập.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;

  // Cấu hình Rate Limiting (Giới hạn brute-force đăng nhập & đăng ký spam)
  const RATE_LIMIT_LOGIN_KEY = "hkstore_v1_rate_limit_login";
  const RATE_LIMIT_REG_KEY = "hkstore_v1_rate_limit_reg";
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // Khóa 15 phút nếu nhập sai quá 5 lần

  // Thuật toán băm mật khẩu chuẩn mật mã SHA-256 kèm Salt bảo vệ
  function sha256Sync(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = "";
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const temp1 =
          (hash[7] +
            (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
            ch +
            k[i] +
            (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) |
          0;
        const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  function generateSalt() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  function hashPassword(password, salt) {
    return sha256Sync(password + ":" + salt);
  }

  // Quản lý rate limit đăng nhập
  function getLoginRateLimit(email) {
    const data = Storage.get(RATE_LIMIT_LOGIN_KEY, {});
    const entry = data[email];
    if (!entry) return { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil && Date.now() > entry.lockedUntil) {
      delete data[email];
      Storage.set(RATE_LIMIT_LOGIN_KEY, data);
      return { count: 0, lockedUntil: 0 };
    }
    return entry;
  }

  function recordFailedLogin(email) {
    const data = Storage.get(RATE_LIMIT_LOGIN_KEY, {});
    const entry = data[email] || { count: 0, lockedUntil: 0 };
    entry.count = (entry.count || 0) + 1;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    data[email] = entry;
    Storage.set(RATE_LIMIT_LOGIN_KEY, data);
    return entry;
  }

  function clearLoginRateLimit(email) {
    const data = Storage.get(RATE_LIMIT_LOGIN_KEY, {});
    if (data[email]) {
      delete data[email];
      Storage.set(RATE_LIMIT_LOGIN_KEY, data);
    }
  }

  // Quản lý rate limit đăng ký
  function checkRegistrationRateLimit() {
    const data = Storage.get(RATE_LIMIT_REG_KEY, []);
    const now = Date.now();
    const recent = data.filter((ts) => now - ts < 10 * 60 * 1000);
    if (recent.length >= 5) {
      return false;
    }
    recent.push(now);
    Storage.set(RATE_LIMIT_REG_KEY, recent);
    return true;
  }

  const Auth = {
    // Thuật toán băm mật khẩu công khai để tái sử dụng
    hashPassword: function (password, salt) {
      const s = salt || generateSalt();
      return {
        salt: s,
        hash: hashPassword(password, s),
        combined: s + "$" + hashPassword(password, s)
      };
    },

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

    // Đăng nhập (kèm Rate Limiting chống Brute-force & xác thực mật khẩu băm)
    login: function (email, password) {
      if (!email || !password) {
        return { success: false, message: "Vui lòng nhập đầy đủ email và mật khẩu." };
      }

      const normalizedEmail = email.trim().toLowerCase();

      // 1. Kiểm tra Rate Limiting
      const rateLimit = getLoginRateLimit(normalizedEmail);
      if (rateLimit.lockedUntil && Date.now() < rateLimit.lockedUntil) {
        const minutesLeft = Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000);
        return {
          success: false,
          status: 429,
          rateLimited: true,
          message: `Bạn đã nhập sai quá ${MAX_FAILED_ATTEMPTS} lần. Vì lý do bảo mật, tài khoản tạm khóa trong ${minutesLeft} phút.`
        };
      }

      const users = Storage.get(Storage.KEYS.USERS, []);
      const userIndex = users.findIndex((u) => u.email.trim().toLowerCase() === normalizedEmail);

      let passwordValid = false;
      let matchedUser = null;

      if (userIndex !== -1) {
        matchedUser = users[userIndex];
        // Hỗ trợ mật khẩu băm mật mã (passwordHash)
        if (matchedUser.passwordHash) {
          const parts = matchedUser.passwordHash.split("$");
          const salt = parts[0];
          const storedHash = parts[1];
          if (hashPassword(password, salt) === storedHash) {
            passwordValid = true;
          }
        } else if (matchedUser.password && matchedUser.password === password) {
          // Tự động di chuyển (migrate) tài khoản seed cũ từ plaintext sang mật khẩu băm có salt
          passwordValid = true;
          const salt = generateSalt();
          matchedUser.passwordHash = salt + "$" + hashPassword(password, salt);
          delete matchedUser.password;
          users[userIndex] = matchedUser;
          Storage.set(Storage.KEYS.USERS, users);
        }
      }

      if (!passwordValid || !matchedUser) {
        const failedAttempt = recordFailedLogin(normalizedEmail);
        if (failedAttempt.count >= MAX_FAILED_ATTEMPTS) {
          return {
            success: false,
            status: 429,
            rateLimited: true,
            message: `Bạn đã nhập sai mật khẩu ${MAX_FAILED_ATTEMPTS} lần. Hệ thống tạm khóa đăng nhập trong 15 phút để bảo vệ tài khoản.`
          };
        }
        const remaining = MAX_FAILED_ATTEMPTS - failedAttempt.count;
        return {
          success: false,
          status: 401,
          message: `Email hoặc mật khẩu không chính xác. Bạn còn ${remaining} lần thử trước khi bị khóa tạm thời.`
        };
      }

      // Xóa bộ đếm sai khi đăng nhập thành công
      clearLoginRateLimit(normalizedEmail);

      // Lưu phiên đăng nhập (không lưu password vào session)
      const sessionData = {
        id: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email,
        phone: matchedUser.phone || "",
        address: matchedUser.address || "",
        role: matchedUser.role || "customer",
        loginAt: new Date().toISOString()
      };

      Storage.set(Storage.KEYS.SESSION, sessionData);

      // Tự động hợp nhất giỏ hàng của khách (guest) vào giỏ tài khoản nếu có
      if (HK.Cart && HK.Cart.mergeGuestCart) {
        HK.Cart.mergeGuestCart(matchedUser.id);
      }

      return { success: true, user: sessionData };
    },

    // Đăng ký tài khoản mới (Mật khẩu được băm có Salt + Rate limiting chống spam)
    register: function ({ fullName, email, password, confirmPassword, phone, address }) {
      if (!checkRegistrationRateLimit()) {
        return {
          success: false,
          status: 429,
          message: "Hệ thống đang ghi nhận quá nhiều lượt đăng ký. Vui lòng thử lại sau 10 phút."
        };
      }

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

      const salt = generateSalt();
      const newUser = {
        id: Storage.generateId("USER"),
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash: salt + "$" + hashPassword(password, salt),
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

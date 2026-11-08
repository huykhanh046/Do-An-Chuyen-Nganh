/**
 * HK STORE - STREETWEAR MINIMALIST
 * Quản lý LocalStorage & Các hàm tiện ích dùng chung
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const PREFIX = "hkstore_v1_";
  const KEYS = {
    PRODUCTS: PREFIX + "products",
    USERS: PREFIX + "users",
    ORDERS: PREFIX + "orders",
    SESSION: PREFIX + "session",
    INITIALIZED: PREFIX + "initialized",
    SEED_HASH: PREFIX + "seed_hash",
    GUEST_CART: PREFIX + "cart_guest",
    USER_CART_PREFIX: PREFIX + "cart_"
  };

  const Storage = {
    KEYS: KEYS,

    // Lấy dữ liệu an toàn từ localStorage
    get: function (key, defaultValue) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) {
          return defaultValue !== undefined ? defaultValue : null;
        }
        return JSON.parse(raw);
      } catch (err) {
        console.error(`[HKStore.Storage] Lỗi khi đọc key "${key}":`, err);
        return defaultValue !== undefined ? defaultValue : null;
      }
    },

    // Lưu dữ liệu an toàn vào localStorage
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.error(`[HKStore.Storage] Lỗi khi ghi key "${key}":`, err);
        if (err.name === "QuotaExceededError" || err.code === 22) {
          if (HK.UI && HK.UI.showToast) {
            HK.UI.showToast("Bộ nhớ trình duyệt (localStorage) đã đầy!", "error");
          } else {
            alert("Bộ nhớ trình duyệt đã đầy!");
          }
        }
        return false;
      }
    },

    // Xóa một key
    remove: function (key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (err) {
        console.error(`[HKStore.Storage] Lỗi khi xóa key "${key}":`, err);
        return false;
      }
    },

    // Tính hash nhanh để phát hiện khi source code seed.js được chỉnh sửa
    computeHash: function (obj) {
      const str = typeof obj === "string" ? obj : JSON.stringify(obj || {});
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return String(hash);
    },

    // Khởi tạo dữ liệu và tự động đồng bộ khi bạn chỉnh sửa trực tiếp trong source code seed.js
    initSeedData: function (forceReset = false) {
      if (!window.HK_SEED_DATA) return false;

      const isInitialized = Storage.get(KEYS.INITIALIZED, false);
      const currentSeedHash = Storage.computeHash(window.HK_SEED_DATA.products);
      const savedSeedHash = Storage.get(KEYS.SEED_HASH, null);

      // 1. Lần đầu tiên chạy
      if (!isInitialized || forceReset) {
        Storage.set(KEYS.PRODUCTS, window.HK_SEED_DATA.products);
        Storage.set(KEYS.USERS, window.HK_SEED_DATA.users);
        Storage.set(KEYS.ORDERS, window.HK_SEED_DATA.orders);
        Storage.set(KEYS.SEED_HASH, currentSeedHash);
        Storage.set(KEYS.INITIALIZED, true);

        if (forceReset) {
          Storage.remove(KEYS.SESSION);
          Storage.remove(KEYS.GUEST_CART);
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(KEYS.USER_CART_PREFIX)) {
              localStorage.removeItem(k);
            }
          }
        }

        console.log("[HKStore] Đã khởi tạo dữ liệu ban đầu thành công.");
        return true;
      }

      // 2. Khi bạn chỉnh sửa dữ liệu trong source code seed.js:
      // Tự động nhận diện thay đổi và cập nhật danh sách sản phẩm mới, KHÔNG reset giỏ hàng hay đơn hàng
      if (savedSeedHash !== null && savedSeedHash !== currentSeedHash) {
        Storage.set(KEYS.PRODUCTS, window.HK_SEED_DATA.products);
        Storage.set(KEYS.SEED_HASH, currentSeedHash);
        console.log("[HKStore] Phát hiện thay đổi trong source code seed.js. Đã tự động cập nhật sản phẩm mới vào web.");
        return true;
      }

      return false;
    },

    // Tiện ích: Format tiền tệ VND
    formatCurrency: function (amount) {
      const num = Number(amount) || 0;
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
      }).format(num);
    },

    // Tiện ích: Format ngày giờ tiếng Việt
    formatDate: function (isoString) {
      if (!isoString) return "";
      try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        return new Intl.DateTimeFormat("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(d);
      } catch (e) {
        return isoString;
      }
    },

    // Tiện ích: Chuẩn hóa chuỗi tìm kiếm (không dấu, thường)
    normalizeText: function (str) {
      if (!str) return "";
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .trim();
    },

    // Tiện ích: Tạo mã duy nhất (ID)
    generateId: function (prefix = "ID") {
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randPart = Math.floor(1000 + Math.random() * 9000);
      return `${prefix}-${datePart}-${randPart}`;
    },

    // Tiện ích: Escape HTML an toàn
    escapeHTML: function (str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    // Tiện ích: Lấy tham số từ Query String URL
    getUrlParam: function (key) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(key);
    }
  };

  // Tự động kiểm tra và khởi tạo dữ liệu khi nạp script
  Storage.initSeedData(false);

  HK.Storage = Storage;
})(window.HKStore);

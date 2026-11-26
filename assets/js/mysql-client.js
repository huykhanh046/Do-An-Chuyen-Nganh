/**
 * HK STORE - STREETWEAR MINIMALIST
 * MySQL Database Client Adapter & Fullstack Sync Layer
 *
 * Kết nối toàn bộ giao diện Frontend & Admin Dashboard với Backend Node.js / MySQL 8.0+.
 * - Tự động đồng bộ dữ liệu thực từ MySQL (hydrate) khi tải trang.
 * - Mọi thao tác CRUD (Đăng nhập, Đăng ký, Sản phẩm, Giỏ hàng, Đơn hàng, Đánh giá, Yêu thích)
 *   đều ghi trực tiếp xuống MySQL thông qua REST API.
 * - Fallback tự động về localStorage nếu chạy trang web tĩnh không có backend server.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const STORAGE_KEY = "hkstore_v1_mysql_config";
  const TOKEN_KEY = "hkstore_v1_auth_token";
  const REVIEWS_KEY = "hkstore_v1_reviews";
  const WISHLIST_KEY = "hkstore_v1_wishlist";

  const DEFAULT_CONFIG = {
    enabled: true,
    apiUrl: "http://localhost:3001/api"
  };

  function getConfig() {
    try {
      const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
      if (origin === "http://localhost:3001" || origin === "http://127.0.0.1:3001") {
        return { enabled: true, apiUrl: "/api" };
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {}
    return { ...DEFAULT_CONFIG };
  }

  function setConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  async function apiFetch(endpoint, options = {}, timeoutMs = 6000) {
    const cfg = getConfig();
    const url = `${cfg.apiUrl}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    const token = getToken();
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timer);
      let data = {};
      try {
        data = await res.json();
      } catch (e) {}
      return {
        ok: res.ok,
        status: res.status,
        networkError: false,
        data
      };
    } catch (err) {
      clearTimeout(timer);
      return {
        ok: false,
        status: 0,
        networkError: true,
        error: err.name === "AbortError" ? "Hết thời gian phản hồi (Timeout)" : "Không thể kết nối Backend MySQL (Port 3001)."
      };
    }
  }

  let hydratePromise = null;

  const MySQLClient = {
    isOnline: false,
    ready: Promise.resolve(false),

    getConfig: getConfig,
    setConfig: setConfig,
    getToken: getToken,
    setToken: setToken,

    /**
     * Đồng bộ toàn bộ dữ liệu từ MySQL xuống bộ nhớ đệm Frontend (HK.Storage)
     */
    hydrate: async function (force = false) {
      if (hydratePromise && !force) return hydratePromise;

      hydratePromise = (async () => {
        const res = await apiFetch("/bootstrap", { method: "GET" }, 2500);
        if (!res.ok || !res.data || res.data.status !== "ok") {
          MySQLClient.isOnline = false;
          hydratePromise = null;
          return false;
        }

        MySQLClient.isOnline = true;
        const payload = res.data;
        const Storage = HK.Storage;

        if (Storage) {
          if (Array.isArray(payload.products)) {
            Storage.setRaw(Storage.KEYS.PRODUCTS, payload.products);
          }

          if (payload.reviews && typeof payload.reviews === "object") {
            Storage.setRaw(REVIEWS_KEY, payload.reviews);
          }

          if (payload.tokenInvalid) {
            setToken(null);
            Storage.remove(Storage.KEYS.SESSION);
          }

          if (payload.currentUser) {
            Storage.setRaw(Storage.KEYS.SESSION, {
              ...payload.currentUser,
              loginAt: new Date().toISOString()
            });

            if (Array.isArray(payload.cart)) {
              Storage.setRaw(Storage.KEYS.USER_CART_PREFIX + payload.currentUser.id, payload.cart);
            }
            if (Array.isArray(payload.wishlist)) {
              Storage.setRaw(WISHLIST_KEY, payload.wishlist);
            }
            if (Array.isArray(payload.orders)) {
              Storage.setRaw(Storage.KEYS.ORDERS, payload.orders);
            }
            if (Array.isArray(payload.users)) {
              Storage.setRaw(Storage.KEYS.USERS, payload.users);
            }
          }

          Storage.setRaw(Storage.KEYS.INITIALIZED, true);
        }

        if (HK.Cart && typeof HK.Cart.updateBadge === "function") {
          HK.Cart.updateBadge(false);
        }

        MySQLClient.updateStatusBadge(true);

        if (typeof window !== "undefined" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("hkstore:mysql-synced", { detail: { online: true } }));
        }

        hydratePromise = null;
        return true;
      })();

      MySQLClient.ready = hydratePromise;
      return hydratePromise;
    },

    /**
     * Kiểm tra trạng thái kết nối tới MySQL Backend
     */
    checkConnection: async function () {
      const res = await apiFetch("/health", { method: "GET" }, 3500);
      if (res.networkError) {
        return {
          ok: false,
          status: 0,
          error: "Không thể kết nối đến máy chủ Backend (Port 3001). Vui lòng chạy lệnh: npm start"
        };
      }
      return {
        ok: res.ok,
        status: res.status,
        data: res.data
      };
    },

    getStats: async function () {
      const res = await apiFetch("/stats", { method: "GET" });
      return res.ok ? res.data : { status: "error", message: (res.data && res.data.message) || res.error };
    },

    getUsers: async function () {
      const res = await apiFetch("/users", { method: "GET" });
      return res.ok ? res.data : { status: "error", message: (res.data && res.data.message) || res.error };
    },

    // --- AUTH & PROFILE ---
    login: async function (email, password) {
      return await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    },

    register: async function (payload) {
      return await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    updateProfile: async function (payload) {
      return await apiFetch("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },

    deleteUser: async function (userId) {
      return await apiFetch(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    },

    // --- PRODUCTS ---
    saveProduct: async function (productData) {
      const isEdit = Boolean(productData && productData.id && /^\d+$/.test(String(productData.id)));
      const endpoint = isEdit ? `/products/${encodeURIComponent(productData.id)}` : "/products";
      const method = isEdit ? "PUT" : "POST";
      return await apiFetch(endpoint, {
        method,
        body: JSON.stringify(productData)
      });
    },

    deleteProduct: async function (productId) {
      return await apiFetch(`/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
    },

    // --- CART ---
    addCartItem: async function (productId, variantId, quantity) {
      return await apiFetch("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId, variantId, quantity })
      });
    },

    updateCartItem: async function (variantId, quantity) {
      return await apiFetch(`/cart/items/${encodeURIComponent(variantId)}`, {
        method: "PUT",
        body: JSON.stringify({ quantity })
      });
    },

    removeCartItem: async function (variantId) {
      return await apiFetch(`/cart/items/${encodeURIComponent(variantId)}`, { method: "DELETE" });
    },

    clearCart: async function () {
      return await apiFetch("/cart", { method: "DELETE" });
    },

    mergeGuestCart: async function (items) {
      return await apiFetch("/cart/merge", {
        method: "POST",
        body: JSON.stringify({ items })
      });
    },

    // --- ORDERS ---
    createOrder: async function (payload) {
      return await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    cancelOrder: async function (orderId, reason) {
      return await apiFetch(`/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
    },

    updateOrderStatus: async function (orderId, orderStatus, extraData = {}) {
      return await apiFetch(`/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PUT",
        body: JSON.stringify({ orderStatus, ...extraData })
      });
    },

    updateTrackingInfo: async function (orderId, trackingData) {
      return await apiFetch(`/orders/${encodeURIComponent(orderId)}/tracking`, {
        method: "PUT",
        body: JSON.stringify(trackingData)
      });
    },

    updatePaymentStatus: async function (orderId, paymentStatus) {
      return await apiFetch(`/orders/${encodeURIComponent(orderId)}/payment`, {
        method: "PUT",
        body: JSON.stringify({ paymentStatus })
      });
    },

    // --- REVIEWS & WISHLIST ---
    addReview: async function (productId, reviewData) {
      return await apiFetch(`/products/${encodeURIComponent(productId)}/reviews`, {
        method: "POST",
        body: JSON.stringify(reviewData)
      });
    },

    toggleWishlist: async function (productId) {
      return await apiFetch("/wishlist/toggle", {
        method: "POST",
        body: JSON.stringify({ productId })
      });
    },

    /**
     * Cập nhật trạng thái hiển thị trên thanh công cụ Admin
     */
    updateStatusBadge: async function (knownOnline = null) {
      const badge = document.getElementById("mysql-db-status-indicator");
      if (!badge) return;

      if (knownOnline === true) {
        badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-right:6px;"></span>MySQL 8.0 (Online)`;
        badge.parentElement.style.backgroundColor = "#065f46";
        badge.parentElement.style.borderColor = "#10b981";
        return;
      }

      badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f59e0b; margin-right:6px;"></span>MySQL (Kiểm tra...)`;

      const health = await this.checkConnection();
      if (health.ok) {
        MySQLClient.isOnline = true;
        badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-right:6px;"></span>MySQL 8.0 (Online)`;
        badge.parentElement.style.backgroundColor = "#065f46";
        badge.parentElement.style.borderColor = "#10b981";
      } else {
        MySQLClient.isOnline = false;
        badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; margin-right:6px;"></span>MySQL (Offline)`;
        badge.parentElement.style.backgroundColor = "#1f2937";
        badge.parentElement.style.borderColor = "#4b5563";
      }
    },

    /**
     * Nạp lại dữ liệu từ database_setup.sql vào MySQL
     */
    runDatabaseSetup: async function () {
      const res = await apiFetch("/admin/run-database-setup", { method: "POST" }, 15000);
      if (res.ok && res.data && res.data.status === "ok") {
        await MySQLClient.hydrate(true);
        return res.data;
      }
      return {
        status: "error",
        message: (res.data && res.data.message) || res.error || "Không thể nạp database_setup.sql"
      };
    },

    /**
     * Mở Modal Quản lý Cơ sở dữ liệu MySQL (10 bảng)
     */
    openConfigModal: async function () {
      const existing = document.getElementById("hk-mysql-modal-backdrop");
      if (existing) existing.remove();

      const modalHtml = `
        <div id="hk-mysql-modal-backdrop" class="modal-backdrop" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
          <div class="modal-dialog" style="background:#fff; width:100%; max-width:720px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
            <div style="background:#0b192c; color:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.5rem;">🐬</span>
                <div>
                  <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#fff;">QUẢN LÝ CƠ SỞ DỮ LIỆU MYSQL 8.0+</h3>
                  <p style="margin:0; font-size:0.75rem; color:#94a3b8;">Hệ quản trị CSDL Quan hệ toàn diện cho HK Store (utf8mb4 / 10 bảng)</p>
                </div>
              </div>
              <button type="button" id="btn-close-mysql-modal" style="background:transparent; border:none; color:#cbd5e1; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
            </div>

            <div style="padding:20px; overflow-y:auto; font-size:0.875rem; line-height:1.5; color:#1e293b;">
              <div id="mysql-modal-status-box" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:600; color:#475569;">Trạng thái kết nối:</span>
                  <span id="mysql-modal-status-text" style="font-weight:700; color:#d97706;">Đang kiểm tra kết nối...</span>
                </div>
                <div id="mysql-modal-status-details" style="font-size:0.8rem; color:#64748b; margin-top:6px;"></div>
              </div>

              <div style="margin-bottom:16px; border:1px solid #cbd5e1; border-radius:8px; padding:12px 14px; background:#f0fdf4;">
                <div style="font-weight:700; color:#166534; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                  <span>🔒</span> 2 TÀI KHOẢN KIỂM THỬ CHUẨN LƯU TRÊN MYSQL
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.82rem;">
                  <div style="background:#fff; padding:8px 10px; border-radius:6px; border:1px solid #bbf7d0;">
                    <strong style="color:#0f172a;">🛡️ Quản trị viên (Admin)</strong><br/>
                    Email: <code>admin@hkstore.vn</code><br/>
                    Mật khẩu: <code>admin1234</code>
                  </div>
                  <div style="background:#fff; padding:8px 10px; border-radius:6px; border:1px solid #bbf7d0;">
                    <strong style="color:#0f172a;">👤 Khách hàng kiểm thử</strong><br/>
                    Email: <code>khach1@hkstore.vn</code><br/>
                    Mật khẩu: <code>khach1234</code> (Nguyễn Văn An)
                  </div>
                </div>
              </div>

              <div style="margin-bottom:16px;">
                <label style="font-weight:600; display:block; margin-bottom:4px; font-size:0.82rem;">Đường dẫn Backend REST API:</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" id="input-mysql-api-url" class="form-control" value="${getConfig().apiUrl}" style="flex:1; padding:6px 10px; font-size:0.85rem;" />
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-save-mysql-api-url">Lưu URL</button>
                </div>
                <small style="color:#64748b; font-size:0.75rem;">Mặc định: <code>http://localhost:3001/api</code> (hoặc <code>/api</code> khi mở tại port 3001)</small>
              </div>

              <div id="mysql-table-stats-container" style="display:none; margin-bottom:12px;">
                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:0.82rem;">📊 Thống kê 10 bảng CSDL MySQL (hk_store):</label>
                <div id="mysql-table-stats-content" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; font-size:0.76rem;"></div>
              </div>
            </div>

            <div style="background:#f1f5f9; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-top:1px solid #e2e8f0;">
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-retest-mysql" style="padding:6px 12px;">🔄 Kiểm tra lại</button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-sync-from-mysql" style="padding:6px 12px;">📥 Đồng bộ từ MySQL</button>
                <button type="button" class="btn btn-sm" id="btn-run-seed-mysql" style="padding:6px 12px; background:#0284c7; color:#fff; border:none;">⚡ Nạp database_setup.sql</button>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-close-mysql-footer" style="padding:6px 18px;">Đóng</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);

      const modalBackdrop = document.getElementById("hk-mysql-modal-backdrop");
      const closeModal = () => modalBackdrop.remove();
      document.getElementById("btn-close-mysql-modal").onclick = closeModal;
      document.getElementById("btn-close-mysql-footer").onclick = closeModal;
      modalBackdrop.onclick = (e) => {
        if (e.target === modalBackdrop) closeModal();
      };

      document.getElementById("btn-save-mysql-api-url").onclick = () => {
        const val = (document.getElementById("input-mysql-api-url").value || "").trim();
        if (val) {
          setConfig({ ...getConfig(), apiUrl: val });
          if (HK.UI && HK.UI.showToast) HK.UI.showToast("Đã lưu địa chỉ Backend API!", "success");
          testAndRenderModal();
        }
      };

      document.getElementById("btn-retest-mysql").onclick = () => testAndRenderModal();

      const syncBtn = document.getElementById("btn-sync-from-mysql");
      syncBtn.onclick = async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = "Đang đồng bộ...";
        const ok = await MySQLClient.hydrate(true);
        syncBtn.disabled = false;
        syncBtn.textContent = "📥 Đồng bộ từ MySQL";
        if (ok) {
          if (HK.UI && HK.UI.showToast) HK.UI.showToast("Đã đồng bộ toàn bộ dữ liệu mới nhất từ MySQL!", "success");
          testAndRenderModal();
        } else {
          if (HK.UI && HK.UI.showToast) HK.UI.showToast("Chưa kết nối được Backend MySQL.", "error");
        }
      };

      const runSeedBtn = document.getElementById("btn-run-seed-mysql");
      runSeedBtn.onclick = async () => {
        runSeedBtn.disabled = true;
        runSeedBtn.textContent = "Đang nạp script SQL...";
        const res = await MySQLClient.runDatabaseSetup();
        runSeedBtn.disabled = false;
        runSeedBtn.textContent = "⚡ Nạp database_setup.sql";
        if (res.status === "ok") {
          if (HK.UI && HK.UI.showToast) HK.UI.showToast("Đã nạp thành công database_setup.sql (10 bảng) vào MySQL!", "success");
          testAndRenderModal();
        } else {
          alert("Lỗi khi nạp script: " + (res.message || "Không xác định"));
        }
      };

      async function testAndRenderModal() {
        const statusBox = document.getElementById("mysql-modal-status-box");
        const statusText = document.getElementById("mysql-modal-status-text");
        const statusDetails = document.getElementById("mysql-modal-status-details");
        const statsBox = document.getElementById("mysql-table-stats-container");
        const statsContent = document.getElementById("mysql-table-stats-content");

        statusText.innerHTML = `<span style="color:#d97706;">Đang kiểm tra kết nối...</span>`;
        statusDetails.innerHTML = "";

        const health = await MySQLClient.checkConnection();
        if (health.ok) {
          statusBox.style.background = "#f0fdf4";
          statusBox.style.borderColor = "#86efac";
          statusText.innerHTML = `<span style="color:#16a34a;">🟢 Kết nối MySQL thành công! (Database: ${health.data.database || "hk_store"})</span>`;
          statusDetails.innerHTML = `
            <strong>Phiên bản:</strong> ${health.data.version || "MySQL 8.0+"} |
            <strong>Máy chủ:</strong> ${health.data.host}:${health.data.port} |
            <strong>Người dùng:</strong> ${health.data.user}
          `;

          const stats = await MySQLClient.getStats();
          if (stats.status === "ok" && stats.stats) {
            statsBox.style.display = "block";
            const t = stats.stats;
            const cells = [
              ["users", t.users],
              ["addresses", t.user_addresses],
              ["categories", t.categories],
              ["products", t.products],
              ["variants", t.product_variants],
              ["cart_items", t.cart_items],
              ["orders", t.orders],
              ["order_items", t.order_items],
              ["reviews", t.product_reviews],
              ["wishlists", t.wishlists]
            ];
            statsContent.innerHTML = cells
              .map(
                ([name, val]) => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                  <strong>${name}:</strong> <span style="color:#0284c7; font-weight:700;">${val ?? 0}</span>
                </div>`
              )
              .join("");
          }
        } else {
          statusBox.style.background = "#fef2f2";
          statusBox.style.borderColor = "#fca5a5";
          statusText.innerHTML = `<span style="color:#dc2626;">🔴 Chưa thể kết nối Backend MySQL</span>`;
          statusDetails.innerHTML = `
            ${health.error || "Không thể gửi yêu cầu tới server"}<br/>
            <em>Khắc phục: Mở terminal chạy <code>npm start</code> và bật MySQL trong XAMPP (Port 3306).</em>
          `;
          statsBox.style.display = "none";
        }

        MySQLClient.updateStatusBadge(health.ok);
      }

      testAndRenderModal();
    }
  };

  HK.MySQL = MySQLClient;

  // Tự động đồng bộ dữ liệu từ MySQL ngay khi nạp script
  MySQLClient.ready = MySQLClient.hydrate();

  document.addEventListener("DOMContentLoaded", () => {
    MySQLClient.updateStatusBadge(MySQLClient.isOnline ? true : null);
  });
})(window.HKStore);

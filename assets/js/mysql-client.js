/**
 * HK STORE - STREETWEAR MINIMALIST
 * MySQL Database Client Adapter
 * 
 * Kết nối giao diện người dùng & Admin Dashboard với Backend Node.js / MySQL 8.0+
 * - Quản lý CSDL quan hệ chính xác: Bảng users, products, variants, orders, order_items.
 * - Giữ lại duy nhất 2 tài khoản chuẩn: admin@hkstore.vn và khach1@hkstore.vn.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const STORAGE_KEY = "hkstore_v1_mysql_config";
  const DEFAULT_CONFIG = {
    enabled: true,
    apiUrl: "http://localhost:3001/api"
  };

  function getConfig() {
    try {
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

  const MySQLClient = {
    getConfig: getConfig,
    setConfig: setConfig,

    /**
     * Kiểm tra trạng thái kết nối tới MySQL Backend
     */
    checkConnection: async function () {
      const cfg = getConfig();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch(`${cfg.apiUrl}/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal
        });
        clearTimeout(timer);
        const data = await res.json();
        return {
          ok: res.ok,
          status: res.status,
          data: data
        };
      } catch (err) {
        clearTimeout(timer);
        return {
          ok: false,
          status: 0,
          error: err.name === "AbortError" ? "Hết thời gian phản hồi (Timeout)" : "Không thể kết nối đến máy chủ Backend (Port 3001). Vui lòng chạy lệnh: npm start"
        };
      }
    },

    /**
     * Lấy số lượng bản ghi của các bảng từ MySQL
     */
    getStats: async function () {
      const cfg = getConfig();
      try {
        const res = await fetch(`${cfg.apiUrl}/stats`);
        return await res.json();
      } catch (err) {
        return { status: "error", message: err.message };
      }
    },

    /**
     * Lấy danh sách tài khoản hợp lệ từ MySQL
     */
    getUsers: async function () {
      const cfg = getConfig();
      try {
        const res = await fetch(`${cfg.apiUrl}/users`);
        return await res.json();
      } catch (err) {
        return { status: "error", message: err.message };
      }
    },

    /**
     * Cập nhật trạng thái hiển thị trên thanh công cụ Admin
     */
    updateStatusBadge: async function () {
      const badge = document.getElementById("mysql-db-status-indicator");
      if (!badge) return;

      badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f59e0b; margin-right:6px; animation:pulse 1.5s infinite;"></span>MySQL (Kiểm tra...)`;

      const health = await this.checkConnection();
      if (health.ok) {
        badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-right:6px;"></span>MySQL 8.0 (Online)`;
        badge.parentElement.style.backgroundColor = "#065f46";
        badge.parentElement.style.borderColor = "#10b981";
      } else {
        badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; margin-right:6px;"></span>MySQL (Chưa chạy)`;
        badge.parentElement.style.backgroundColor = "#1f2937";
        badge.parentElement.style.borderColor = "#4b5563";
      }
    },

    /**
     * Nạp lại dữ liệu từ database_setup.sql vào MySQL
     */
    runDatabaseSetup: async function () {
      const cfg = getConfig();
      try {
        const res = await fetch(`${cfg.apiUrl}/admin/run-database-setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        return await res.json();
      } catch (err) {
        return { status: "error", message: err.message };
      }
    },

    /**
     * Mở Modal Quản lý Cơ sở dữ liệu MySQL
     */
    openConfigModal: async function () {
      // Xóa modal cũ nếu có
      const existing = document.getElementById("hk-mysql-modal-backdrop");
      if (existing) existing.remove();

      const modalHtml = `
        <div id="hk-mysql-modal-backdrop" class="modal-backdrop" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
          <div class="modal-dialog" style="background:#fff; width:100%; max-width:680px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
            
            <!-- Header -->
            <div style="background:#0b192c; color:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.5rem;">🐬</span>
                <div>
                  <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#fff;">QUẢN LÝ CƠ SỞ DỮ LIỆU MYSQL 8.0+</h3>
                  <p style="margin:0; font-size:0.75rem; color:#94a3b8;">Hệ quản trị CSDL Quan hệ cho HK Store (Bảng mã: utf8mb4 / Port 3306)</p>
                </div>
              </div>
              <button type="button" id="btn-close-mysql-modal" style="background:transparent; border:none; color:#cbd5e1; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
            </div>

            <!-- Body -->
            <div style="padding:20px; overflow-y:auto; font-size:0.875rem; line-height:1.5; color:#1e293b;">
              
              <!-- 1. Trạng thái kết nối -->
              <div id="mysql-modal-status-box" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:600; color:#475569;">Trạng thái kết nối:</span>
                  <span id="mysql-modal-status-text" style="font-weight:700; color:#d97706;">Đang kiểm tra kết nối...</span>
                </div>
                <div id="mysql-modal-status-details" style="font-size:0.8rem; color:#64748b; margin-top:6px;"></div>
              </div>

              <!-- 2. Danh sách tài khoản chuẩn duy nhất -->
              <div style="margin-bottom:16px; border:1px solid #cbd5e1; border-radius:8px; padding:12px 14px; background:#f0fdf4;">
                <div style="font-weight:700; color:#166534; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                  <span>🔒</span> TÀI KHOẢN DUY NHẤT LƯU TRÊN MYSQL (Đã xóa bỏ tài khoản dư thừa)
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.82rem;">
                  <div style="background:#fff; padding:8px 10px; border-radius:6px; border:1px solid #bbf7d0;">
                    <strong style="color:#0f172a;">🛡️ Quản trị viên (Admin)</strong><br/>
                    Email: <code>admin@hkstore.vn</code><br/>
                    Mật khẩu: <code>admin1234</code><br/>
                    Quyền hạn: <em>Toàn quyền Dashboard</em>
                  </div>
                  <div style="background:#fff; padding:8px 10px; border-radius:6px; border:1px solid #bbf7d0;">
                    <strong style="color:#0f172a;">👤 Khách hàng kiểm thử</strong><br/>
                    Email: <code>khach1@hkstore.vn</code><br/>
                    Mật khẩu: <code>khach1234</code><br/>
                    Họ tên: <em>Nguyễn Văn An</em> (Quận 1, TP.HCM)
                  </div>
                </div>
              </div>

              <!-- 3. Cấu hình kết nối API & MySQL -->
              <div style="margin-bottom:16px;">
                <label style="font-weight:600; display:block; margin-bottom:4px; font-size:0.82rem;">Đường dẫn Backend REST API:</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" id="input-mysql-api-url" class="form-control" value="${getConfig().apiUrl}" style="flex:1; padding:6px 10px; font-size:0.85rem;" />
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-save-mysql-api-url">Lưu URL</button>
                </div>
                <small style="color:#64748b; font-size:0.75rem;">Mặc định: <code>http://localhost:3001/api</code> (Phục vụ từ lệnh <code>npm start</code>)</small>
              </div>

              <!-- 4. Hướng dẫn khởi chạy MySQL nhanh -->
              <div style="background:#0f172a; color:#f8fafc; border-radius:8px; padding:12px 14px; font-size:0.8rem; margin-bottom:16px;">
                <div style="font-weight:600; color:#38bdf8; margin-bottom:8px;">💻 CÁCH KHỞI CHẠY MYSQL CHO DỰ ÁN:</div>
                <ol style="margin:0; padding-left:18px;">
                  <li style="margin-bottom:4px;">Mở <strong>XAMPP</strong> hoặc <strong>Laragon</strong> / MySQL Service và bấm <strong>Start MySQL</strong> (Cổng 3306).</li>
                  <li style="margin-bottom:4px;">Mở Terminal tại thư mục dự án và chạy: <code>npm install</code> rồi <code>npm start</code></li>
                  <li>Nếu chưa nạp dữ liệu, bạn có thể chạy file <code>database_setup.sql</code> trong phpMyAdmin hoặc bấm nút bên dưới.</li>
                </ol>
              </div>

              <!-- 5. Thống kê bảng CSDL -->
              <div id="mysql-table-stats-container" style="display:none; margin-bottom:12px;">
                <label style="font-weight:600; display:block; margin-bottom:6px; font-size:0.82rem;">📊 Thống kê bảng CSDL MySQL (hk_store):</label>
                <div id="mysql-table-stats-content" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; font-size:0.78rem;"></div>
              </div>

            </div>

            <!-- Footer -->
            <div style="background:#f1f5f9; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0;">
              <div>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-retest-mysql" style="padding:6px 14px;">
                  🔄 Kiểm tra kết nối lại
                </button>
                <button type="button" class="btn btn-sm" id="btn-run-seed-mysql" style="padding:6px 14px; background:#0284c7; color:#fff; border:none; margin-left:6px;">
                  ⚡ Nạp database_setup.sql
                </button>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-close-mysql-footer" style="padding:6px 18px;">
                Đóng
              </button>
            </div>

          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);

      // Gắn sự kiện
      const closeBtn = document.getElementById("btn-close-mysql-modal");
      const closeFooter = document.getElementById("btn-close-mysql-footer");
      const retestBtn = document.getElementById("btn-retest-mysql");
      const runSeedBtn = document.getElementById("btn-run-seed-mysql");
      const saveUrlBtn = document.getElementById("btn-save-mysql-api-url");
      const modalBackdrop = document.getElementById("hk-mysql-modal-backdrop");

      const closeModal = () => modalBackdrop.remove();
      if (closeBtn) closeBtn.onclick = closeModal;
      if (closeFooter) closeFooter.onclick = closeModal;
      if (modalBackdrop) {
        modalBackdrop.onclick = (e) => {
          if (e.target === modalBackdrop) closeModal();
        };
      }

      if (saveUrlBtn) {
        saveUrlBtn.onclick = () => {
          const val = (document.getElementById("input-mysql-api-url").value || "").trim();
          if (val) {
            setConfig({ ...getConfig(), apiUrl: val });
            if (HK.UI && HK.UI.showToast) HK.UI.showToast("Đã lưu địa chỉ Backend API!", "success");
            testAndRenderModal();
          }
        };
      }

      if (retestBtn) {
        retestBtn.onclick = () => testAndRenderModal();
      }

      if (runSeedBtn) {
        runSeedBtn.onclick = async () => {
          runSeedBtn.disabled = true;
          runSeedBtn.textContent = "Đang nạp script SQL...";
          const res = await MySQLClient.runDatabaseSetup();
          runSeedBtn.disabled = false;
          runSeedBtn.textContent = "⚡ Nạp database_setup.sql";
          if (res.status === "ok") {
            if (HK.UI && HK.UI.showToast) HK.UI.showToast("Đã nạp thành công database_setup.sql vào MySQL!", "success");
            testAndRenderModal();
          } else {
            alert("Lỗi khi nạp script: " + (res.message || "Không xác định"));
          }
        };
      }

      // Kiểm tra và hiển thị dữ liệu lên modal
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

          // Lấy số liệu bảng
          const stats = await MySQLClient.getStats();
          if (stats.status === "ok" && stats.stats) {
            statsBox.style.display = "block";
            const tbls = stats.stats;
            statsContent.innerHTML = `
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>users:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.users ?? 0}</span> (Chỉ 2 tài khoản)
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>categories:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.categories ?? 0}</span>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>products:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.products ?? 0}</span>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>variants:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.product_variants ?? 0}</span>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>orders:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.orders ?? 0}</span>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>order_items:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.order_items ?? 0}</span>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>addresses:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.user_addresses ?? 0}</span>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px; border-radius:4px; text-align:center;">
                <strong>cart_items:</strong> <span style="color:#0284c7; font-weight:700;">${tbls.cart_items ?? 0}</span>
              </div>
            `;
          }
        } else {
          statusBox.style.background = "#fef2f2";
          statusBox.style.borderColor = "#fca5a5";
          statusText.innerHTML = `<span style="color:#dc2626;">🔴 Chưa thể kết nối Backend MySQL</span>`;
          statusDetails.innerHTML = `
            ${health.error || "Không thể gửi yêu cầu tới server"}<br/>
            <em>Khắc phục: Mở terminal chạy <code>npm start</code> và khởi động MySQL qua XAMPP / Laragon / Docker.</em>
          `;
          statsBox.style.display = "none";
        }

        MySQLClient.updateStatusBadge();
      }

      // Khởi chạy kiểm tra ngay khi mở modal
      testAndRenderModal();
    }
  };

  HK.MySQL = MySQLClient;

  // Tự động kiểm tra badge khi tải trang
  document.addEventListener("DOMContentLoaded", () => {
    MySQLClient.updateStatusBadge();
  });

})(window.HKStore);

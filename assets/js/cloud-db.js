/**
 * HK STORE - STREETWEAR MINIMALIST
 * Cơ sở dữ liệu Đám mây Tập trung — Centralized Cloud Database (Supabase PostgreSQL)
 *
 * Giải quyết triệt để vấn đề dữ liệu cục bộ (LocalStorage):
 * - Khi Admin thêm/sửa/xóa sản phẩm hoặc duyệt đơn hàng, gắn mã vận đơn trên máy tính,
 *   dữ liệu được đẩy tự động (Write-Through + Smart Merge) lên Supabase PostgreSQL.
 * - Khi khách hàng hoặc Admin truy cập từ Điện thoại / Máy tính khác, hệ thống tự động
 *   kéo dữ liệu mới nhất (Auto-Pull & Real-time Polling) về và cập nhật giao diện tức thì.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const CONFIG_STORAGE_KEY = "hkstore_v1_cloud_db_config";
  const DELETED_IDS_KEY = "hkstore_v1_deleted_ids";

  // Cấu hình Supabase PostgreSQL mặc định (Có thể điền trực tiếp tại đây để mọi thiết bị tự nhận)
  const DEFAULT_CLOUD_DB_CONFIG = {
    enabled: true,
    provider: "supabase", // 'supabase'
    supabaseUrl: "", // VD: "https://abcdefghijklm.supabase.co"
    supabaseAnonKey: "", // Anon Public Key từ Supabase Project Settings -> API
    tableName: "hkstore_cloud_state",
    pollIntervalMs: 10000 // Tự động đồng bộ mỗi 10 giây
  };

  let pollTimer = null;
  let isSyncing = false;
  let lastSyncTime = null;
  let lastSyncError = null;
  const pushTimers = {};

  function parseUrlCloudParams() {
    try {
      if (typeof window === "undefined" || !window.location || !window.location.search) return;
      const params = new URLSearchParams(window.location.search);
      const cloudUrl = (params.get("cloudUrl") || params.get("supabaseUrl") || "").trim();
      const cloudKey = (params.get("cloudKey") || params.get("supabaseKey") || "").trim();

      if (cloudUrl && cloudKey && /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(cloudUrl)) {
        const current = getSavedConfigRaw();
        const updated = {
          ... DEFAULT_CLOUD_DB_CONFIG,
          ...current,
          enabled: true,
          supabaseUrl: cloudUrl.replace(/\/+$/, ""),
          supabaseAnonKey: cloudKey
        };
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));

        // Làm sạch URL để gọn gàng sau khi đã lưu cấu hình trên điện thoại/máy tính
        if (window.history && window.history.replaceState) {
          params.delete("cloudUrl");
          params.delete("cloudKey");
          params.delete("supabaseUrl");
          params.delete("supabaseKey");
          const newQuery = params.toString();
          const cleanUrl = window.location.pathname + (newQuery ? "?" + newQuery : "") + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        setTimeout(() => {
          if (HK.UI && HK.UI.showToast) {
            HK.UI.showToast("Đã kết nối thiết bị này với Supabase Cloud Database thành công!", "success", 4500);
          }
        }, 600);
      }
    } catch (e) {
      // Bỏ qua nếu trình duyệt chặn
    }
  }

  function getSavedConfigRaw() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function getSeedCloudConfig() {
    try {
      if (window.HK_SEED_DATA && window.HK_SEED_DATA.cloudConfig) {
        return window.HK_SEED_DATA.cloudConfig;
      }
    } catch (e) {}
    return {};
  }

  const CloudDB = {
    DELETED_IDS_KEY: DELETED_IDS_KEY,

    getConfig: function () {
      const saved = getSavedConfigRaw();
      const seedCfg = getSeedCloudConfig();
      const merged = {
        ...DEFAULT_CLOUD_DB_CONFIG,
        ...seedCfg,
        ...saved
      };
      merged.supabaseUrl = String(merged.supabaseUrl || "").trim().replace(/\/+$/, "");
      merged.supabaseAnonKey = String(merged.supabaseAnonKey || "").trim();
      merged.tableName = String(merged.tableName || "hkstore_cloud_state").trim();
      return merged;
    },

    setConfig: function (newCfg) {
      const current = CloudDB.getConfig();
      const merged = {
        ...current,
        ...newCfg
      };
      merged.supabaseUrl = String(merged.supabaseUrl || "").trim().replace(/\/+$/, "");
      merged.supabaseAnonKey = String(merged.supabaseAnonKey || "").trim();
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}
      CloudDB.updateStatusBadge();
      return merged;
    },

    isConfigured: function () {
      const cfg = CloudDB.getConfig();
      return Boolean(
        cfg.enabled &&
          cfg.supabaseUrl &&
          cfg.supabaseAnonKey &&
          /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl)
      );
    },

    getStatus: function () {
      return {
        configured: CloudDB.isConfigured(),
        isSyncing: isSyncing,
        lastSyncTime: lastSyncTime,
        lastSyncError: lastSyncError
      };
    },

    // Lấy danh sách ID đã bị xóa vĩnh viễn (Tombstones) để không bị phục hồi từ máy khác hoặc seed.js
    getDeletedIds: function () {
      try {
        const raw = localStorage.getItem(DELETED_IDS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    },

    markDeleted: function (id) {
      if (!id) return;
      const list = CloudDB.getDeletedIds();
      if (!list.includes(id)) {
        list.push(id);
        try {
          localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(list));
        } catch (e) {}
        CloudDB.schedulePushKey(DELETED_IDS_KEY, list);
      }
    },

    // Hợp nhất thông minh 2 mảng dữ liệu theo ID & dấu thời gian (updatedAt / createdAt)
    mergeCollectionsById: function (cloudList, localList, deletedIds = [], preferSource = "newest") {
      if (!Array.isArray(cloudList) && !Array.isArray(localList)) return [];
      const safeCloud = Array.isArray(cloudList) ? cloudList : [];
      const safeLocal = Array.isArray(localList) ? localList : [];
      const deletedSet = new Set(Array.isArray(deletedIds) ? deletedIds : []);

      if (preferSource === "cloud_exact") {
        return safeCloud.filter((item) => item && item.id && !deletedSet.has(item.id));
      }

      const map = new Map();
      const orderKeys = [];

      const getTimestamp = (item) => {
        if (!item || typeof item !== "object") return 0;
        const tsStr = item.updatedAt || item.trackingUpdatedAt || item.lastLoginAt || item.createdAt;
        if (!tsStr) return 0;
        const t = new Date(tsStr).getTime();
        return isNaN(t) ? 0 : t;
      };

      // Đưa dữ liệu Cloud vào trước
      for (const item of safeCloud) {
        if (!item || !item.id || deletedSet.has(item.id)) continue;
        map.set(item.id, item);
        orderKeys.push(item.id);
      }

      // Hợp nhất dữ liệu Local
      for (const localItem of safeLocal) {
        if (!localItem || !localItem.id || deletedSet.has(localItem.id)) continue;
        if (!map.has(localItem.id)) {
          map.set(localItem.id, localItem);
          orderKeys.unshift(localItem.id);
        } else {
          const cloudItem = map.get(localItem.id);
          const cloudRev = Number(cloudItem._rev) || 0;
          const localRev = Number(localItem._rev) || 0;
          const cloudTs = getTimestamp(cloudItem);
          const localTs = getTimestamp(localItem);

          if (localRev !== cloudRev) {
            // Bản ghi có số phiên bản chỉnh sửa (_rev) cao hơn luôn được ưu tiên tuyệt đối (chống lệch múi giờ/đồng hồ giữa Điện thoại & Máy tính)
            map.set(localItem.id, localRev > cloudRev ? localItem : cloudItem);
          } else if (preferSource === "local") {
            if (localTs >= cloudTs) {
              map.set(localItem.id, localItem);
            }
          } else if (preferSource === "cloud") {
            map.set(localItem.id, cloudItem);
          } else {
            map.set(localItem.id, localTs > cloudTs ? localItem : cloudItem);
          }
        }
      }

      const seen = new Set();
      const result = [];
      for (const id of orderKeys) {
        if (!seen.has(id) && map.has(id)) {
          seen.add(id);
          result.push(map.get(id));
        }
      }
      return result;
    },

    // Gọi REST API của Supabase PostgreSQL
    supabaseFetch: async function (pathAndQuery, options = {}) {
      const cfg = CloudDB.getConfig();
      if (!CloudDB.isConfigured()) {
        throw new Error("Chưa cấu hình Supabase URL và Anon Key.");
      }

      const url = `${cfg.supabaseUrl}/rest/v1/${pathAndQuery}`;
      const headers = {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      };

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errDetail = "";
        try {
          const errJson = await response.json();
          errDetail = errJson.message || errJson.hint || errJson.error || JSON.stringify(errJson);
        } catch (e) {
          errDetail = `HTTP ${response.status}`;
        }
        throw new Error(errDetail);
      }

      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    },

    // Kiểm tra kết nối tới bảng PostgreSQL trên Supabase
    testConnection: async function (customCfg = null) {
      const cfg = customCfg || CloudDB.getConfig();
      const cleanUrl = String(cfg.supabaseUrl || "").trim().replace(/\/+$/, "");
      const cleanKey = String(cfg.supabaseAnonKey || "").trim();
      const table = String(cfg.tableName || "hkstore_cloud_state").trim();

      if (!cleanUrl || !cleanKey) {
        return { success: false, message: "Vui lòng nhập đầy đủ Supabase Project URL và Anon Public Key." };
      }

      try {
        const res = await fetch(`${cleanUrl}/rest/v1/${table}?select=key,updated_at&limit=5`, {
          method: "GET",
          headers: {
            apikey: cleanKey,
            Authorization: `Bearer ${cleanKey}`
          }
        });

        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const errData = await res.json();
            errMsg = errData.message || errData.error || errMsg;
          } catch (e) {}

          if (res.status === 404 || /relation .* does not exist|Could not find the table/i.test(errMsg)) {
            return {
              success: false,
              missingTable: true,
              message: `Kết nối Supabase thành công nhưng chưa có bảng "${table}". Vui lòng copy đoạn mã SQL ở Bước 1 và chạy trong Supabase SQL Editor!`
            };
          }
          return { success: false, message: `Lỗi xác thực Supabase: ${errMsg}` };
        }

        const rows = await res.json();
        return {
          success: true,
          rowsCount: Array.isArray(rows) ? rows.length : 0,
          message: "Kết nối Supabase PostgreSQL thành công!"
        };
      } catch (err) {
        return {
          success: false,
          message: "Không thể kết nối tới Supabase URL. Vui lòng kiểm tra lại đường dẫn Project URL."
        };
      }
    },

    // Đẩy 1 key lên Supabase PostgreSQL (Có debounce chống nghẽn mạng)
    schedulePushKey: function (key, value) {
      if (!CloudDB.isConfigured()) return;
      if (pushTimers[key]) {
        clearTimeout(pushTimers[key]);
      }
      pushTimers[key] = setTimeout(() => {
        CloudDB.pushKey(key, value).catch((err) => {
          console.warn(`[HKStore.CloudDB] Không thể đẩy key "${key}":`, err.message);
        });
      }, 120);
    },

    pushKey: async function (key, localValue) {
      if (!CloudDB.isConfigured()) return { success: false, reason: "not_configured" };
      const cfg = CloudDB.getConfig();
      const table = cfg.tableName;

      try {
        isSyncing = true;
        CloudDB.updateStatusBadge();

        let dataToSave = localValue;
        if (dataToSave === undefined && HK.Storage) {
          dataToSave = HK.Storage.get(key, []);
        }

        // Lấy dữ liệu hiện có trên Cloud để hợp nhất thông minh (tránh ghi đè mất đơn hàng mới từ điện thoại)
        const existingRows = await CloudDB.supabaseFetch(
          `${table}?key=eq.${encodeURIComponent(key)}&select=key,data`
        );
        const deletedRows = await CloudDB.supabaseFetch(
          `${table}?key=eq.${encodeURIComponent(DELETED_IDS_KEY)}&select=key,data`
        );

        let cloudDeletedIds = CloudDB.getDeletedIds();
        if (Array.isArray(deletedRows) && deletedRows[0] && Array.isArray(deletedRows[0].data)) {
          cloudDeletedIds = Array.from(new Set([...cloudDeletedIds, ...deletedRows[0].data]));
          try {
            localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(cloudDeletedIds));
          } catch (e) {}
        }

        if (key === DELETED_IDS_KEY) {
          dataToSave = cloudDeletedIds;
        } else if (Array.isArray(dataToSave)) {
          const cloudArr =
            Array.isArray(existingRows) && existingRows[0] && Array.isArray(existingRows[0].data)
              ? existingRows[0].data
              : [];
          dataToSave = CloudDB.mergeCollectionsById(cloudArr, dataToSave, cloudDeletedIds, "local");

          // Cập nhật ngược lại vào localStorage nếu có thêm bản ghi từ thiết bị khác
          if (HK.Storage && typeof HK.Storage.setRaw === "function") {
            HK.Storage.setRaw(key, dataToSave);
          }
        }

        await CloudDB.supabaseFetch(`${table}?on_conflict=key`, {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify([
            {
              key: key,
              data: dataToSave,
              updated_at: new Date().toISOString()
            }
          ])
        });

        lastSyncTime = new Date().toISOString();
        lastSyncError = null;
        isSyncing = false;
        CloudDB.updateStatusBadge();
        return { success: true };
      } catch (err) {
        lastSyncError = err.message;
        isSyncing = false;
        CloudDB.updateStatusBadge();
        return { success: false, message: err.message };
      }
    },

    // Đẩy toàn bộ dữ liệu hiện tại từ máy lên Supabase PostgreSQL
    pushAll: async function () {
      if (!CloudDB.isConfigured() || !HK.Storage) {
        return { success: false, message: "Chưa cấu hình kết nối Supabase." };
      }
      const KEYS = HK.Storage.KEYS;
      await CloudDB.pushKey(DELETED_IDS_KEY, CloudDB.getDeletedIds());
      const r1 = await CloudDB.pushKey(KEYS.PRODUCTS, HK.Storage.get(KEYS.PRODUCTS, []));
      const r2 = await CloudDB.pushKey(KEYS.ORDERS, HK.Storage.get(KEYS.ORDERS, []));
      const r3 = await CloudDB.pushKey(KEYS.USERS, HK.Storage.get(KEYS.USERS, []));

      if (!r1.success) return r1;
      if (!r2.success) return r2;
      if (!r3.success) return r3;
      return { success: true, message: "Đã đồng bộ toàn bộ Sản phẩm, Đơn hàng & Người dùng lên Supabase Cloud!" };
    },

    // Kéo toàn bộ dữ liệu mới nhất từ Supabase PostgreSQL về thiết bị hiện tại
    pullAll: async function (options = { silent: true }) {
      if (!CloudDB.isConfigured() || !HK.Storage) {
        return { success: false, reason: "not_configured" };
      }

      const cfg = CloudDB.getConfig();
      const table = cfg.tableName;
      const KEYS = HK.Storage.KEYS;

      try {
        isSyncing = true;
        CloudDB.updateStatusBadge();

        const rows = await CloudDB.supabaseFetch(`${table}?select=key,data,updated_at`);
        if (!Array.isArray(rows)) {
          isSyncing = false;
          CloudDB.updateStatusBadge();
          return { success: false };
        }

        // Nếu bảng trên Supabase hoàn toàn trống (mới tạo bảng lần đầu), tự động đẩy dữ liệu khởi tạo lên Cloud!
        if (rows.length === 0) {
          await CloudDB.pushAll();
          isSyncing = false;
          CloudDB.updateStatusBadge();
          return { success: true, initializedCloud: true, changedKeys: [] };
        }

        const rowMap = {};
        rows.forEach((r) => {
          if (r && r.key) rowMap[r.key] = r.data;
        });

        // 1. Đồng bộ danh sách ID đã xóa (Tombstones)
        let deletedIds = CloudDB.getDeletedIds();
        if (Array.isArray(rowMap[DELETED_IDS_KEY])) {
          deletedIds = Array.from(new Set([...deletedIds, ...rowMap[DELETED_IDS_KEY]]));
          try {
            localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(deletedIds));
          } catch (e) {}
        }

        const targetKeys = [KEYS.PRODUCTS, KEYS.ORDERS, KEYS.USERS];
        const changedKeys = [];

        for (const k of targetKeys) {
          const cloudData = rowMap[k];
          if (!Array.isArray(cloudData)) continue;

          const localData = HK.Storage.get(k, []);
          const merged = CloudDB.mergeCollectionsById(cloudData, localData, deletedIds, "cloud");

          const localJson = JSON.stringify(localData);
          const mergedJson = JSON.stringify(merged);

          if (localJson !== mergedJson) {
            HK.Storage.setRaw(k, merged);
            changedKeys.push(k);
          }

          // Nếu máy hiện tại có bản ghi mới mà trên Cloud chưa có (VD: vừa tạo khi mạng chập chờn), đẩy bổ sung lên Cloud
          if (JSON.stringify(cloudData) !== mergedJson) {
            CloudDB.schedulePushKey(k, merged);
          }
        }

        lastSyncTime = new Date().toISOString();
        lastSyncError = null;
        isSyncing = false;
        CloudDB.updateStatusBadge();

        if (changedKeys.length > 0) {
          CloudDB.notifyDataChanged(changedKeys);
          if (!options.silent && HK.UI && HK.UI.showToast) {
            HK.UI.showToast("Đã cập nhật dữ liệu mới nhất từ Supabase Cloud!", "success");
          }
        }

        return { success: true, changedKeys };
      } catch (err) {
        lastSyncError = err.message;
        isSyncing = false;
        CloudDB.updateStatusBadge();
        return { success: false, message: err.message };
      }
    },

    // Phát sự kiện để các trang tự động vẽ lại giao diện khi có dữ liệu mới từ Cloud
    notifyDataChanged: function (changedKeys) {
      if (typeof window === "undefined") return;
      if (HK.UI && typeof HK.UI.updateCartBadge === "function") {
        HK.UI.updateCartBadge();
      }
      if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("hkstore:cloud-sync", {
            detail: { changedKeys: changedKeys || [], timestamp: new Date().toISOString() }
          })
        );
      }
    },

    // Cập nhật huy hiệu trạng thái Cloud DB trên thanh Admin (nếu đang ở trang Admin)
    updateStatusBadge: function () {
      const badgeEl = document.getElementById("cloud-db-status-indicator");
      if (!badgeEl) return;

      if (!CloudDB.isConfigured()) {
        badgeEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9E9E9E;margin-right:6px;"></span>🗄️ Cloud DB: Local`;
        badgeEl.title = "Đang chạy chế độ LocalStorage. Bấm để kết nối Supabase PostgreSQL.";
        return;
      }

      if (isSyncing) {
        badgeEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F57C00;margin-right:6px;"></span>🗄️ Đang đồng bộ Cloud...`;
        return;
      }

      if (lastSyncError) {
        badgeEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#C62828;margin-right:6px;"></span>🗄️ Lỗi Cloud DB`;
        badgeEl.title = `Lỗi đồng bộ: ${lastSyncError}`;
        return;
      }

      badgeEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2E7D32;margin-right:6px;"></span>🗄️ Supabase Cloud: Online`;
      badgeEl.title = lastSyncTime
        ? `Đã đồng bộ với Supabase PostgreSQL lúc ${HK.Storage ? HK.Storage.formatDate(lastSyncTime) : lastSyncTime}`
        : "Đã kết nối Supabase PostgreSQL";
    },

    // Mã SQL chuẩn tạo bảng PostgreSQL & View trên Supabase
    getSupabaseSqlSchema: function () {
      return `-- ================================================================
-- HK STORE - SUPABASE POSTGRESQL SCHEMA (CHẠY TRONG SQL EDITOR)
-- ================================================================

-- 1. Tạo bảng lưu trữ tập trung (JSONB tốc độ cao)
CREATE TABLE IF NOT EXISTS public.hkstore_cloud_state (
  key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Bật Row Level Security (RLS) và cấp quyền đồng bộ cho Web App
ALTER TABLE public.hkstore_cloud_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public sync hkstore_cloud_state" ON public.hkstore_cloud_state;
CREATE POLICY "Allow public sync hkstore_cloud_state"
  ON public.hkstore_cloud_state
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Tạo View quan hệ để xem bảng Sản phẩm & Đơn hàng trực quan trên Supabase
CREATE OR REPLACE VIEW public.hkstore_products_view AS
SELECT
  item->>'id' AS id,
  item->>'name' AS name,
  item->>'categoryName' AS category,
  (item->>'price')::numeric AS price,
  item->>'status' AS status,
  jsonb_array_length(COALESCE(item->'variants', '[]'::jsonb)) AS variants_count,
  item->>'createdAt' AS created_at
FROM public.hkstore_cloud_state,
LATERAL jsonb_array_elements(data) AS item
WHERE key = 'hkstore_v1_products';

CREATE OR REPLACE VIEW public.hkstore_orders_view AS
SELECT
  item->>'id' AS order_id,
  item->'customerInfo'->>'fullName' AS customer_name,
  item->'customerInfo'->>'phone' AS customer_phone,
  item->'customerInfo'->>'email' AS customer_email,
  (item->>'total')::numeric AS total_vnd,
  item->>'orderStatus' AS order_status,
  item->>'paymentStatus' AS payment_status,
  item->>'trackingCode' AS tracking_code,
  item->>'createdAt' AS created_at
FROM public.hkstore_cloud_state,
LATERAL jsonb_array_elements(data) AS item
WHERE key = 'hkstore_v1_orders';`;
    },

    // Mở Modal Cấu hình & Đồng bộ Supabase PostgreSQL
    openConfigModal: function () {
      if (!HK.UI || !HK.UI.showModal) return;
      const cfg = CloudDB.getConfig();
      const esc = HK.Storage ? HK.Storage.escapeHTML : (s) => String(s || "");
      const isConnected = CloudDB.isConfigured() && !lastSyncError;
      const sqlCode = CloudDB.getSupabaseSqlSchema();

      const shareSyncUrl =
        cfg.supabaseUrl && cfg.supabaseAnonKey
          ? `${window.location.origin}/index.html?cloudUrl=${encodeURIComponent(cfg.supabaseUrl)}&cloudKey=${encodeURIComponent(cfg.supabaseAnonKey)}`
          : "";

      const html = `
        <div style="font-size: 0.85rem; line-height: 1.55; color: var(--color-primary);">
          <div style="padding: 10px 12px; border-radius: 4px; margin-bottom: 12px; background: ${
            isConnected ? "#EEF7F0" : "#FFF8E1"
          }; border: 1px solid ${isConnected ? "#B7DFB9" : "#FFE082"}; color: ${isConnected ? "#1B6E32" : "#8D6E63"};">
            <strong>Trạng thái hiện tại:</strong>
            ${
              isConnected
                ? `🟢 Đang kết nối trực tiếp với <strong>Supabase PostgreSQL</strong> (${esc(cfg.supabaseUrl)})`
                : `⚪ Đang chạy chế độ LocalStorage cục bộ. Hãy điền thông tin Supabase bên dưới để đồng bộ đa thiết bị (Máy tính &harr; Điện thoại).`
            }
          </div>

          <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; padding: 10px 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
              <strong style="font-size: 0.8rem;">Bước 1: Tạo bảng PostgreSQL trên Supabase (Miễn phí 100%)</strong>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-supabase-sql" style="padding: 3px 10px; font-size: 0.74rem;">
                📋 Sao chép mã SQL
              </button>
            </div>
            <ol style="padding-left: 18px; margin: 0 0 8px 0; font-size: 0.78rem; color: var(--color-text-muted);">
              <li>Đăng nhập <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" style="text-decoration: underline; font-weight: 700; color: #111;">supabase.com/dashboard</a> &rarr; bấm <strong>New Project</strong>.</li>
              <li>Vào menu <strong>SQL Editor</strong> bên trái &rarr; bấm <strong>New Query</strong> &rarr; dán mã SQL bên dưới và bấm <strong>Run</strong>:</li>
            </ol>
            <pre style="background: #111; color: #f8f8f8; padding: 8px 10px; border-radius: 4px; font-size: 0.72rem; overflow-x: auto; max-height: 110px; margin: 0;"><code>${esc(sqlCode)}</code></pre>
          </div>

          <div style="margin-bottom: 10px;">
            <strong style="font-size: 0.8rem; display: block; margin-bottom: 6px;">
              Bước 2: Nhập thông tin kết nối (Project Settings &rarr; API)
            </strong>
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.78rem;">Supabase Project URL <span class="required">*</span></label>
              <input
                type="url"
                id="cloud-db-supabase-url"
                class="form-control"
                placeholder="https://abcdefghijklm.supabase.co"
                value="${esc(cfg.supabaseUrl)}"
              />
            </div>
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.78rem;">Supabase Anon Public Key (<code>anon</code> <code>public</code>) <span class="required">*</span></label>
              <input
                type="text"
                id="cloud-db-supabase-key"
                class="form-control"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value="${esc(cfg.supabaseAnonKey)}"
                style="font-family: monospace; font-size: 0.78rem;"
              />
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-test-supabase-conn" style="font-size: 0.76rem; padding: 5px 10px;">
              🔍 Kiểm tra kết nối
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-force-sync-supabase" style="font-size: 0.76rem; padding: 5px 10px;">
              🔄 Đồng bộ 2 chiều ngay (Push &amp; Pull)
            </button>
            <span id="cloud-db-test-result" style="font-size: 0.76rem; font-weight: 700;"></span>
          </div>

          ${
            shareSyncUrl
              ? `
          <div style="background: #F4F6F8; border: 1px dashed var(--color-border-dark); padding: 8px 10px; border-radius: 4px; font-size: 0.76rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>📱 <strong>Đồng bộ nhanh sang Điện thoại:</strong> Mở link này trên điện thoại để tự động nối vào cùng Database Supabase:</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-mobile-sync-link" style="padding: 2px 8px; font-size: 0.72rem;">Sao chép Link Điện thoại</button>
            </div>
          </div>
          `
              : `<div class="text-muted" style="font-size: 0.75rem;">* Mẹo: Sau khi bấm Lưu, hệ thống sẽ tạo một Link Đồng Bộ Nhanh để bạn mở trên điện thoại hoặc bạn có thể gửi Project URL &amp; Anon Key cho trợ lý AI để gắn cố định vào mã nguồn Vercel.</div>`
          }
        </div>
      `;

      HK.UI.showModal({
        title: "CƠ SỞ DỮ LIỆU ĐÁM MÂY (SUPABASE POSTGRESQL)",
        content: html,
        confirmText: "Lưu & Đồng bộ lên Cloud",
        cancelText: "Đóng",
        onConfirm: () => {
          const urlVal = (document.getElementById("cloud-db-supabase-url")?.value || "").trim().replace(/\/+$/, "");
          const keyVal = (document.getElementById("cloud-db-supabase-key")?.value || "").trim();

          if (!urlVal && !keyVal) {
            CloudDB.setConfig({ enabled: false, supabaseUrl: "", supabaseAnonKey: "" });
            HK.UI.showToast("Đã tắt đồng bộ Cloud Database (chuyển về LocalStorage).", "info");
            return true;
          }

          if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(urlVal)) {
            HK.UI.showToast("Project URL không hợp lệ (Ví dụ đúng: https://abcdefgh.supabase.co)", "error");
            return false;
          }
          if (keyVal.length < 20) {
            HK.UI.showToast("Vui lòng dán đúng chuỗi Anon Public Key từ Supabase.", "error");
            return false;
          }

          CloudDB.setConfig({
            enabled: true,
            supabaseUrl: urlVal,
            supabaseAnonKey: keyVal
          });

          HK.UI.showToast("Đang kiểm tra và đồng bộ dữ liệu lên Supabase PostgreSQL...", "info");
          CloudDB.testConnection().then(async (testRes) => {
            if (!testRes.success) {
              HK.UI.showToast(testRes.message, "error", 6000);
              return;
            }
            await CloudDB.pushAll();
            await CloudDB.pullAll({ silent: false });
          });

          return true;
        }
      });

      setTimeout(() => {
        const copySqlBtn = document.getElementById("btn-copy-supabase-sql");
        if (copySqlBtn) {
          copySqlBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(sqlCode).then(() => {
              copySqlBtn.textContent = "Đã sao chép SQL ✓";
              if (HK.UI && HK.UI.showToast) {
                HK.UI.showToast("Đã sao chép lệnh SQL! Hãy dán vào Supabase SQL Editor và bấm Run.", "success");
              }
              setTimeout(() => {
                copySqlBtn.textContent = "📋 Sao chép mã SQL";
              }, 2500);
            });
          });
        }

        const testBtn = document.getElementById("btn-test-supabase-conn");
        const resultEl = document.getElementById("cloud-db-test-result");
        if (testBtn) {
          testBtn.addEventListener("click", async () => {
            const urlVal = (document.getElementById("cloud-db-supabase-url")?.value || "").trim().replace(/\/+$/, "");
            const keyVal = (document.getElementById("cloud-db-supabase-key")?.value || "").trim();
            testBtn.disabled = true;
            testBtn.textContent = "Đang kiểm tra...";
            if (resultEl) {
              resultEl.textContent = "";
            }

            const res = await CloudDB.testConnection({
              supabaseUrl: urlVal,
              supabaseAnonKey: keyVal,
              tableName: "hkstore_cloud_state"
            });

            testBtn.disabled = false;
            testBtn.textContent = "🔍 Kiểm tra kết nối";

            if (resultEl) {
              resultEl.style.color = res.success ? "#1B6E32" : "#C62828";
              resultEl.textContent = res.success ? "✓ Kết nối PostgreSQL thành công!" : `✕ ${res.message}`;
            }
            if (HK.UI && HK.UI.showToast) {
              HK.UI.showToast(res.message, res.success ? "success" : "error", 5000);
            }
          });
        }

        const syncNowBtn = document.getElementById("btn-force-sync-supabase");
        if (syncNowBtn) {
          syncNowBtn.addEventListener("click", async () => {
            const urlVal = (document.getElementById("cloud-db-supabase-url")?.value || "").trim().replace(/\/+$/, "");
            const keyVal = (document.getElementById("cloud-db-supabase-key")?.value || "").trim();
            if (urlVal && keyVal) {
              CloudDB.setConfig({ enabled: true, supabaseUrl: urlVal, supabaseAnonKey: keyVal });
            }
            if (!CloudDB.isConfigured()) {
              HK.UI.showToast("Vui lòng nhập Supabase URL và Anon Key trước khi đồng bộ.", "error");
              return;
            }
            syncNowBtn.disabled = true;
            syncNowBtn.textContent = "Đang đồng bộ...";
            const pushRes = await CloudDB.pushAll();
            await CloudDB.pullAll({ silent: true });
            syncNowBtn.disabled = false;
            syncNowBtn.textContent = "🔄 Đồng bộ 2 chiều ngay (Push & Pull)";

            if (pushRes.success) {
              HK.UI.showToast("Đã đồng bộ 2 chiều (Máy tính ⇄ Supabase Cloud) thành công!", "success");
            } else {
              HK.UI.showToast(pushRes.message || "Lỗi đồng bộ dữ liệu.", "error");
            }
          });
        }

        const copyLinkBtn = document.getElementById("btn-copy-mobile-sync-link");
        if (copyLinkBtn && shareSyncUrl) {
          copyLinkBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(shareSyncUrl).then(() => {
              copyLinkBtn.textContent = "Đã sao chép Link ✓";
              HK.UI.showToast("Đã sao chép Link đồng bộ cho Điện thoại!", "success");
            });
          });
        }
      }, 80);
    },

    // Khởi tạo bộ đồng bộ tự động (Chạy trên mọi trang của Website)
    init: function () {
      parseUrlCloudParams();

      if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
          CloudDB.updateStatusBadge();
          if (CloudDB.isConfigured()) {
            CloudDB.pullAll({ silent: true });
          }
        });

        // Tự động kéo dữ liệu mới nhất khi người dùng mở lại tab trên điện thoại/máy tính
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible" && CloudDB.isConfigured()) {
            CloudDB.pullAll({ silent: true });
          }
        });
      }

      if (typeof window !== "undefined") {
        if (typeof window.addEventListener === "function") {
          window.addEventListener("focus", () => {
            if (CloudDB.isConfigured()) {
              CloudDB.pullAll({ silent: true });
            }
          });
        }

        // Đồng bộ định kỳ thời gian thực (mỗi 10 giây)
        if (pollTimer) clearInterval(pollTimer);
        const intervalMs = CloudDB.getConfig().pollIntervalMs || 10000;
        pollTimer = setInterval(() => {
          if (
            typeof document !== "undefined" &&
            document.visibilityState === "visible" &&
            CloudDB.isConfigured() &&
            !isSyncing
          ) {
            CloudDB.pullAll({ silent: true });
          }
        }, intervalMs);
      }
    }
  };

  CloudDB.init();
  HK.CloudDB = CloudDB;
})(window.HKStore);

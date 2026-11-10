/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Lưu trữ Tệp Ảnh Đám mây (Cloud Media Storage Service)
 * Hỗ trợ:
 *   1. Cloudinary CDN (Unsigned Upload Preset)
 *   2. Supabase Storage Bucket (REST API)
 *   3. ImgBB Cloud CDN API
 *   4. Smart HD WebP/JPEG Optimizer (Tự động nén ảnh chuẩn HD sắc nét khi chưa gắn khóa Cloud riêng)
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const STORAGE_KEY = "hkstore_v1_cloud_media_config";

  const DEFAULT_CONFIG = {
    provider: "auto", // 'auto' | 'cloudinary' | 'supabase' | 'imgbb'
    cloudinaryCloudName: "",
    cloudinaryUploadPreset: "",
    supabaseUrl: "",
    supabaseAnonKey: "",
    supabaseBucket: "products",
    imgbbApiKey: "",
    maxDimension: 1280,
    quality: 0.85
  };

  // Nén và tối ưu hóa ảnh trên trình duyệt qua HTML5 Canvas (WebP / JPEG HD)
  function optimizeImageFile(file, maxDimension = 1280, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        reject(new Error("Tệp chọn không phải là định dạng hình ảnh hợp lệ."));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không thể đọc tệp hình ảnh từ máy tính."));
      reader.onload = (e) => {
        const rawDataUrl = e.target.result;

        // Với ảnh SVG, giữ nguyên
        if (file.type === "image/svg+xml") {
          resolve({
            dataUrl: rawDataUrl,
            blob: file,
            width: 800,
            height: 800,
            mimeType: "image/svg+xml"
          });
          return;
        }

        const img = new Image();
        img.onerror = () => reject(new Error("Tệp hình ảnh bị hỏng hoặc không hỗ trợ."));
        img.onload = () => {
          let width = img.naturalWidth || img.width || 800;
          let height = img.naturalHeight || img.height || 800;

          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          // Nền trắng cho ảnh JPEG nếu ảnh gốc có vùng trong suốt
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Ưu tiên xuất định dạng WebP nhẹ và nét, fallback sang JPEG
          let outputMime = "image/webp";
          let dataUrl = canvas.toDataURL(outputMime, quality);
          if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
            outputMime = "image/jpeg";
            dataUrl = canvas.toDataURL(outputMime, quality);
          }

          canvas.toBlob(
            (blob) => {
              resolve({
                dataUrl: dataUrl,
                blob: blob || file,
                width: width,
                height: height,
                mimeType: outputMime
              });
            },
            outputMime,
            quality
          );
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  // 1. Đẩy file lên Cloudinary CDN
  async function uploadToCloudinary(fileOrBlob, fileName, cfg) {
    const cloudName = (cfg.cloudinaryCloudName || "").trim();
    const uploadPreset = (cfg.cloudinaryUploadPreset || "").trim();
    if (!cloudName || !uploadPreset) {
      throw new Error("Chưa cấu hình Cloudinary Cloud Name hoặc Upload Preset.");
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
    const formData = new FormData();
    formData.append("file", fileOrBlob, fileName || "product.webp");
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "hkstore_products");

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData.error && errData.error.message) || `Cloudinary HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.secure_url) {
      throw new Error("Cloudinary không trả về đường dẫn secure_url.");
    }

    return {
      url: data.secure_url,
      provider: "cloudinary",
      publicId: data.public_id || ""
    };
  }

  // 2. Đẩy file lên Supabase Storage Bucket
  async function uploadToSupabase(fileOrBlob, fileName, mimeType, cfg) {
    const supabaseUrl = (cfg.supabaseUrl || "").trim().replace(/\/+$/, "");
    const supabaseKey = (cfg.supabaseAnonKey || "").trim();
    const bucket = (cfg.supabaseBucket || "products").trim();

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Chưa cấu hình Supabase Project URL hoặc API Key.");
    }

    const safeName =
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 8) +
      "-" +
      String(fileName || "image.webp").replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `products/${safeName}`;
    const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`;

    const response = await fetch(uploadEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        "Content-Type": mimeType || "image/webp",
        "x-upsert": "true"
      },
      body: fileOrBlob
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Supabase Storage HTTP ${response.status}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`;
    return {
      url: publicUrl,
      provider: "supabase",
      publicId: objectPath
    };
  }

  // 3. Đẩy file lên ImgBB CDN
  async function uploadToImgBB(dataUrl, fileName, cfg) {
    const apiKey = (cfg.imgbbApiKey || "").trim();
    if (!apiKey) {
      throw new Error("Chưa cấu hình ImgBB API Key.");
    }

    const base64Data = String(dataUrl || "").replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", base64Data);
    if (fileName) {
      formData.append("name", fileName.replace(/\.[^/.]+$/, ""));
    }

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`ImgBB HTTP ${response.status}`);
    }

    const resJson = await response.json();
    if (!resJson || !resJson.success || !resJson.data || !resJson.data.url) {
      throw new Error("ImgBB không trả về URL hợp lệ.");
    }

    return {
      url: resJson.data.display_url || resJson.data.url,
      provider: "imgbb",
      publicId: resJson.data.id || ""
    };
  }

  const MediaStorage = {
    getConfig: function () {
      const stored = HK.Storage ? HK.Storage.get(STORAGE_KEY, null) : null;
      return Object.assign({}, DEFAULT_CONFIG, stored || {});
    },

    setConfig: function (newCfg) {
      const merged = Object.assign({}, MediaStorage.getConfig(), newCfg || {});
      if (HK.Storage) {
        HK.Storage.set(STORAGE_KEY, merged);
      }
      return merged;
    },

    getActiveProviderLabel: function () {
      const cfg = MediaStorage.getConfig();
      if (cfg.cloudinaryCloudName && cfg.cloudinaryUploadPreset) {
        return `Cloudinary CDN (${cfg.cloudinaryCloudName})`;
      }
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        return `Supabase Storage (${cfg.supabaseBucket || "products"})`;
      }
      if (cfg.imgbbApiKey) {
        return "ImgBB Cloud CDN";
      }
      return "Smart Cloud WebP/HD (Tích hợp sẵn)";
    },

    /**
     * Tải 1 tệp ảnh từ máy tính lên Cloud CDN (hoặc nén WebP HD tức thì nếu chưa cấu hình khóa ngoài)
     */
    uploadSingleFile: async function (file) {
      const cfg = MediaStorage.getConfig();
      const optimized = await optimizeImageFile(file, cfg.maxDimension || 1280, cfg.quality || 0.85);

      // 1. Thử Cloudinary nếu đã cấu hình
      if (
        (cfg.provider === "cloudinary" || cfg.provider === "auto") &&
        cfg.cloudinaryCloudName &&
        cfg.cloudinaryUploadPreset
      ) {
        try {
          return await uploadToCloudinary(optimized.blob, file.name, cfg);
        } catch (err) {
          console.warn("[MediaStorage] Cloudinary fallback:", err.message);
          if (cfg.provider === "cloudinary") throw err;
        }
      }

      // 2. Thử Supabase Storage nếu đã cấu hình
      if (
        (cfg.provider === "supabase" || cfg.provider === "auto") &&
        cfg.supabaseUrl &&
        cfg.supabaseAnonKey
      ) {
        try {
          return await uploadToSupabase(optimized.blob, file.name, optimized.mimeType, cfg);
        } catch (err) {
          console.warn("[MediaStorage] Supabase fallback:", err.message);
          if (cfg.provider === "supabase") throw err;
        }
      }

      // 3. Thử ImgBB nếu đã cấu hình
      if ((cfg.provider === "imgbb" || cfg.provider === "auto") && cfg.imgbbApiKey) {
        try {
          return await uploadToImgBB(optimized.dataUrl, file.name, cfg);
        } catch (err) {
          console.warn("[MediaStorage] ImgBB fallback:", err.message);
          if (cfg.provider === "imgbb") throw err;
        }
      }

      // 4. Smart HD WebP/JPEG Optimizer (Hoạt động tức thì 100% không cần API key bên ngoài)
      return {
        url: optimized.dataUrl,
        provider: "smart_webp_hd",
        width: optimized.width,
        height: optimized.height
      };
    },

    /**
     * Tải nhiều tệp ảnh từ máy tính cùng lúc kèm callback tiến trình
     */
    uploadFiles: async function (fileList, onProgress) {
      const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith("image/"));
      if (files.length === 0) {
        return {
          success: false,
          urls: [],
          message: "Vui lòng chọn ít nhất 1 tệp hình ảnh hợp lệ (.jpg, .png, .webp)."
        };
      }

      const uploadedUrls = [];
      const errors = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (typeof onProgress === "function") {
          onProgress({
            current: i + 1,
            total: files.length,
            fileName: file.name
          });
        }

        try {
          const res = await MediaStorage.uploadSingleFile(file);
          if (res && res.url) {
            uploadedUrls.push(res.url);
          }
        } catch (err) {
          errors.push(`${file.name}: ${err.message || "Lỗi tải ảnh"}`);
        }
      }

      if (uploadedUrls.length === 0) {
        return {
          success: false,
          urls: [],
          message: errors.join("; ") || "Không thể tải tệp ảnh lên."
        };
      }

      return {
        success: true,
        urls: uploadedUrls,
        errors: errors,
        message: `Đã tải lên thành công ${uploadedUrls.length}/${files.length} ảnh!`
      };
    },

    /**
     * Mở Modal Cấu hình Cloud Media Storage (Cloudinary / Supabase / ImgBB) cho Admin
     */
    openConfigModal: function (onSaved) {
      const UI = HK.UI;
      const Storage = HK.Storage;
      if (!UI || !UI.showModal) return;

      const cfg = MediaStorage.getConfig();

      const modalHtml = `
        <div style="font-size: 0.86rem; line-height: 1.55; display: flex; flex-direction: column; gap: 12px;">
          <div style="background: var(--color-bg); border: 1px solid var(--color-border); padding: 10px 12px; border-radius: 4px; font-size: 0.81rem;">
            <strong>Trạng thái hiện tại:</strong> <span style="color: #1B6E32; font-weight: 700;">${Storage.escapeHTML(MediaStorage.getActiveProviderLabel())}</span>
            <div class="text-muted" style="margin-top: 2px;">
              Mặc định hệ thống đã tích hợp sẵn bộ nén ảnh <strong>Smart Cloud WebP/HD</strong> giúp tải ảnh trực tiếp từ máy tính tức thì. Nếu muốn đẩy ảnh lên <strong>Cloudinary</strong>, <strong>Supabase Storage</strong> hoặc <strong>ImgBB</strong> để lấy link CDN công khai, hãy điền thông số bên dưới:
            </div>
          </div>

          <div style="border: 1px solid var(--color-border); padding: 12px; border-radius: 4px;">
            <div style="font-weight: 800; font-size: 0.82rem; text-transform: uppercase; margin-bottom: 8px;">
              1. Cloudinary CDN (Khuyên dùng)
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.76rem;">Cloud Name</label>
                <input type="text" id="cfg-cld-name" class="form-control" placeholder="VD: dxyz1234" value="${Storage.escapeHTML(cfg.cloudinaryCloudName || "")}" />
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.76rem;">Unsigned Upload Preset</label>
                <input type="text" id="cfg-cld-preset" class="form-control" placeholder="VD: hkstore_unsigned" value="${Storage.escapeHTML(cfg.cloudinaryUploadPreset || "")}" />
              </div>
            </div>
          </div>

          <div style="border: 1px solid var(--color-border); padding: 12px; border-radius: 4px;">
            <div style="font-weight: 800; font-size: 0.82rem; text-transform: uppercase; margin-bottom: 8px;">
              2. Supabase Storage Bucket
            </div>
            <div style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 8px; margin-bottom: 8px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.76rem;">Supabase Project URL</label>
                <input type="url" id="cfg-sb-url" class="form-control" placeholder="https://xxxx.supabase.co" value="${Storage.escapeHTML(cfg.supabaseUrl || "")}" />
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 0.76rem;">Public Bucket Name</label>
                <input type="text" id="cfg-sb-bucket" class="form-control" placeholder="products" value="${Storage.escapeHTML(cfg.supabaseBucket || "products")}" />
              </div>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.76rem;">Supabase Anon / Service Key</label>
              <input type="password" id="cfg-sb-key" class="form-control" placeholder="eyJhbGciOiJIUzI1NiIsInR5..." value="${Storage.escapeHTML(cfg.supabaseAnonKey || "")}" />
            </div>
          </div>

          <div style="border: 1px solid var(--color-border); padding: 12px; border-radius: 4px;">
            <div style="font-weight: 800; font-size: 0.82rem; text-transform: uppercase; margin-bottom: 8px;">
              3. ImgBB Cloud API
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.76rem;">ImgBB API Key (api.imgbb.com)</label>
              <input type="text" id="cfg-imgbb-key" class="form-control" placeholder="Nhập API Key từ api.imgbb.com..." value="${Storage.escapeHTML(cfg.imgbbApiKey || "")}" />
            </div>
          </div>
        </div>
      `;

      UI.showModal({
        title: "CẤU HÌNH CLOUD MEDIA STORAGE (CDN)",
        content: modalHtml,
        confirmText: "Lưu cấu hình Cloud",
        cancelText: "Đóng",
        onConfirm: () => {
          const newCfg = {
            cloudinaryCloudName: (document.getElementById("cfg-cld-name")?.value || "").trim(),
            cloudinaryUploadPreset: (document.getElementById("cfg-cld-preset")?.value || "").trim(),
            supabaseUrl: (document.getElementById("cfg-sb-url")?.value || "").trim(),
            supabaseBucket: (document.getElementById("cfg-sb-bucket")?.value || "products").trim(),
            supabaseAnonKey: (document.getElementById("cfg-sb-key")?.value || "").trim(),
            imgbbApiKey: (document.getElementById("cfg-imgbb-key")?.value || "").trim()
          };
          MediaStorage.setConfig(newCfg);
          UI.showToast(`Đã lưu cấu hình! Đang sử dụng: ${MediaStorage.getActiveProviderLabel()}`, "success");
          if (typeof onSaved === "function") onSaved(newCfg);
          return true;
        }
      });
    }
  };

  HK.MediaStorage = MediaStorage;
})(window.HKStore);

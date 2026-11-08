/**
 * HK STORE — ACCESSIBLE STREETWEAR EDITORIAL (DESIGN DNA)
 * Module các tính năng Thời trang phổ biến (Modular Fashion E-Commerce Features)
 *
 * HƯỚNG DẪN TÙY CHỈNH / LƯỢC BỎ TÍNH NĂNG:
 * Bạn có thể bật (true) hoặc tắt (false) bất kỳ tính năng nào dưới đây chỉ với 1 dòng,
 * giao diện sẽ tự động thích ứng mượt mà mà không gây lỗi hệ thống.
 */
window.HK_FEATURE_FLAGS = Object.assign(
  {
    quickView: true,            // 1. Xem nhanh & Chọn size thêm giỏ ngay trên thẻ sản phẩm (Quick View Modal)
    wishlist: true,             // 2. Danh sách Yêu thích (Nút tim ♥ + Ngăn kéo quản lý đồ yêu thích)
    miniCartDrawer: true,       // 3. Ngăn kéo Giỏ hàng trượt nhanh + Thanh tiến trình Freeship 500k
    liveSearch: true,           // 4. Tìm kiếm gợi ý tức thì kèm ảnh sản phẩm & Phím tắt '/'
    sizeAdvisor: true,          // 5. Công cụ Gợi ý chọn Size thông minh theo Chiều cao & Cân nặng
    recentlyViewed: true,       // 6. Kệ Sản phẩm vừa xem gần đây (Recently Viewed)
    hoverSecondImage: true,     // 7. Tự động lật ảnh góc chụp thứ 2 & Chấm màu sắc / Size trên thẻ sản phẩm
    scrollProgressAndTop: true  // 8. Thanh tiến độ đọc trang, Nút lên đầu trang & Thanh Mua nhanh khi cuộn
  },
  window.HK_FEATURE_FLAGS || {}
);

window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;
  const WISHLIST_KEY = "hkstore_v1_wishlist";
  const RECENT_KEY = "hkstore_v1_recently_viewed";
  const FIT_PROFILE_KEY = "hkstore_v1_fit_profile";

  let activeSheetEl = null;
  let sheetCloseTimer = null;
  let previousSheetFocus = null;
  let globalDelegationBound = false;
  let scrollEngineBound = false;

  const Features = {
    flags: function () {
      return window.HK_FEATURE_FLAGS || {};
    },

    // Kiểm tra thiết bị cấu hình rất thấp hoặc bật giảm chuyển động (Design DNA Fallback Strategy)
    isLowMotionOrLowPower: function () {
      const reduced = HK.UI && HK.UI.shouldReduceMotion && HK.UI.shouldReduceMotion();
      const lowCores = typeof navigator !== "undefined" && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
      return Boolean(reduced || lowCores);
    },

    // Khởi tạo đồng bộ các tính năng trên trang hiện tại (được gọi tự động từ UI.initCommonUI)
    init: function () {
      const flags = Features.flags();

      Features.bindGlobalDelegation();

      if (flags.wishlist !== false) {
        Features.updateWishlistUI(false);
      }

      if (flags.liveSearch !== false) {
        Features.initLiveSearch();
      }

      if (flags.scrollProgressAndTop !== false) {
        Features.initScrollEffectsAndTop();
      }

      // Cập nhật số lượng sản phẩm thực tế trên các thẻ Bộ Sưu Tập ở Trang chủ
      Features.enhanceHomeCategoryCounts();
    },

    /* ========================================================================
       1. WISHLIST (DANH SÁCH YÊU THÍCH ♥ - TỰ ĐỘNG LỌC BỎ SẢN PHẨM ĐÃ XÓA)
       ======================================================================== */
    getRawWishlistIds: function () {
      const raw = Storage.get(WISHLIST_KEY, []);
      return Array.isArray(raw) ? raw : [];
    },

    // Chỉ trả về các sản phẩm đang hoạt động thực tế trong kho (An toàn tuyệt đối khi Admin xóa sản phẩm)
    getWishlistProducts: function () {
      if (!HK.Products) return [];
      const ids = Features.getRawWishlistIds();
      const validProducts = [];
      const cleanIds = [];

      ids.forEach((id) => {
        const p = HK.Products.getById(id);
        if (p && p.status !== "archived") {
          validProducts.push(p);
          cleanIds.push(p.id);
        }
      });

      if (cleanIds.length !== ids.length) {
        Storage.set(WISHLIST_KEY, cleanIds);
      }

      return validProducts;
    },

    isWishlisted: function (productId) {
      if (!productId) return false;
      const validIds = Features.getWishlistProducts().map((p) => p.id);
      return validIds.includes(productId);
    },

    toggleWishlist: function (productId, triggerBtn = null) {
      if (Features.flags().wishlist === false || !productId || !HK.Products) return false;

      const product = HK.Products.getById(productId);
      if (!product || product.status === "archived") {
        if (HK.UI) HK.UI.showToast("Sản phẩm không còn tồn tại trên hệ thống.", "error");
        return false;
      }

      const currentIds = Features.getWishlistProducts().map((p) => p.id);
      const idx = currentIds.indexOf(productId);
      let added = false;

      if (idx > -1) {
        currentIds.splice(idx, 1);
      } else {
        currentIds.unshift(productId);
        added = true;
      }

      Storage.set(WISHLIST_KEY, currentIds);
      Features.updateWishlistUI(true);

      if (triggerBtn && added && !Features.isLowMotionOrLowPower()) {
        triggerBtn.classList.remove("heart-pop");
        void triggerBtn.offsetWidth;
        triggerBtn.classList.add("heart-pop");
      }

      if (HK.UI) {
        HK.UI.showToast(
          added ? `Đã lưu "${product.name}" vào Yêu thích` : `Đã bỏ "${product.name}" khỏi Yêu thích`,
          added ? "success" : "info",
          2400
        );
      }

      // Nếu ngăn kéo Wishlist đang mở thì vẽ lại ngay
      if (activeSheetEl && activeSheetEl.dataset.sheetType === "wishlist") {
        Features.renderWishlistSheetBody();
      }

      return added;
    },

    updateWishlistUI: function (animateBadge = false) {
      const savedProducts = Features.getWishlistProducts();
      const savedSet = new Set(savedProducts.map((p) => p.id));
      const count = savedProducts.length;

      // Cập nhật badge trên Header
      document.querySelectorAll(".js-wishlist-badge").forEach((badge) => {
        const prev = badge.textContent;
        const next = String(count);
        badge.textContent = next;
        if (count > 0) {
          badge.style.display = "inline-flex";
          if (animateBadge && prev !== next) {
            badge.classList.remove("badge-pop");
            void badge.offsetWidth;
            badge.classList.add("badge-pop");
          }
        } else {
          badge.style.display = "none";
          badge.classList.remove("badge-pop");
        }
      });

      // Đồng bộ mọi nút trái tim trên trang
      document.querySelectorAll(".js-toggle-wishlist[data-product-id]").forEach((btn) => {
        const pid = btn.getAttribute("data-product-id");
        const active = savedSet.has(pid);
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.setAttribute("aria-label", active ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích");
      });
    },

    /* ========================================================================
       2. SIDE-SHEET ENGINE (DÙNG CHUNG CHO MINI-CART & WISHLIST DRAWER)
       ======================================================================== */
    ensureSideSheetElement: function () {
      let el = document.getElementById("hk-side-sheet");
      if (el) return el;

      el = document.createElement("div");
      el.id = "hk-side-sheet";
      el.className = "hk-side-sheet";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `
        <div class="hk-sheet-overlay js-close-side-sheet"></div>
        <div class="hk-sheet-panel">
          <div class="hk-sheet-header">
            <h3 class="hk-sheet-title" id="hk-sheet-title">GIỎ HÀNG</h3>
            <button type="button" class="hk-sheet-close js-close-side-sheet" aria-label="Đóng ngăn kéo">&times;</button>
          </div>
          <div id="hk-sheet-subbanner"></div>
          <div class="hk-sheet-body" id="hk-sheet-body"></div>
          <div class="hk-sheet-footer" id="hk-sheet-footer"></div>
        </div>
      `;
      document.body.appendChild(el);
      return el;
    },

    openSideSheet: function (type) {
      const el = Features.ensureSideSheetElement();
      if (sheetCloseTimer) {
        clearTimeout(sheetCloseTimer);
        sheetCloseTimer = null;
      }

      previousSheetFocus = document.activeElement;
      el.dataset.sheetType = type;
      el.inert = false;
      el.classList.remove("sheet-leaving");
      el.classList.add("sheet-open");
      el.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      activeSheetEl = el;

      if (type === "cart") {
        Features.renderMiniCartBody();
      } else if (type === "wishlist") {
        Features.renderWishlistSheetBody();
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add("sheet-active");
          const closeBtn = el.querySelector(".hk-sheet-close");
          if (closeBtn) closeBtn.focus();
        });
      });
    },

    closeSideSheet: function () {
      if (!activeSheetEl || !activeSheetEl.classList.contains("sheet-open")) return;
      const el = activeSheetEl;
      activeSheetEl = null;

      el.inert = true;
      el.setAttribute("aria-hidden", "true");
      el.classList.remove("sheet-active");
      el.classList.add("sheet-leaving");
      document.body.style.overflow = "";

      if (previousSheetFocus && typeof previousSheetFocus.focus === "function") {
        previousSheetFocus.focus();
      }

      sheetCloseTimer = setTimeout(() => {
        el.classList.remove("sheet-open", "sheet-leaving");
        el.inert = false;
        sheetCloseTimer = null;
      }, 360);
    },

    /* ========================================================================
       3. MINI-CART DRAWER + THANH TIẾN TRÌNH FREESHIP 500.000₫
       ======================================================================== */
    openMiniCart: function () {
      if (Features.flags().miniCartDrawer === false) {
        window.location.href = "cart.html";
        return;
      }
      Features.openSideSheet("cart");
    },

    renderMiniCartBody: function () {
      const el = document.getElementById("hk-side-sheet");
      if (!el || el.dataset.sheetType !== "cart" || !HK.Cart) return;

      const summary = HK.Cart.getCartSummary();
      const titleEl = el.querySelector("#hk-sheet-title");
      const bannerEl = el.querySelector("#hk-sheet-subbanner");
      const bodyEl = el.querySelector("#hk-sheet-body");
      const footerEl = el.querySelector("#hk-sheet-footer");

      if (titleEl) {
        titleEl.textContent = `GIỎ HÀNG (${summary.totalCount})`;
      }

      // Thanh tiến trình Freeship 500k
      const threshold = summary.freeShippingThreshold || 500000;
      const pct = Math.min(100, Math.round((summary.subtotal / threshold) * 100));
      const achieved = summary.subtotal >= threshold && summary.subtotal > 0;

      if (bannerEl) {
        if (summary.items.length === 0) {
          bannerEl.innerHTML = "";
        } else {
          bannerEl.innerHTML = `
            <div class="hk-freeship-box">
              <div class="hk-freeship-text">
                ${
                  achieved
                    ? `<strong class="text-success">Đơn hàng đã được MIỄN PHÍ VẬN CHUYỂN toàn quốc!</strong>`
                    : `Mua thêm <strong>${Storage.formatCurrency(summary.amountToFreeShipping)}</strong> để nhận <strong>Freeship 0₫</strong>`
                }
              </div>
              <div class="hk-freeship-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div class="hk-freeship-fill ${achieved ? "is-achieved" : ""}" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }
      }

      if (summary.items.length === 0) {
        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 48px 16px;">
            <svg style="width: 44px; height: 44px; margin: 0 auto 12px; color: var(--color-muted);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <h4 style="margin-bottom: 6px;">Giỏ hàng đang trống</h4>
            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 20px;">Hãy khám phá các thiết kế Streetwear mới nhất để lên đồ ngay hôm nay.</p>
            <a href="products.html" class="btn btn-primary btn-sm">Khám phá sản phẩm</a>
          </div>
        `;
        footerEl.style.display = "none";
        return;
      }

      footerEl.style.display = "flex";
      bodyEl.innerHTML = summary.items
        .map(
          (item) => `
          <div class="hk-sheet-item">
            <a href="product.html?id=${item.productId}">
              <img src="${item.image}" alt="${Storage.escapeHTML(item.name)}" class="hk-sheet-item-img" onerror="this.src='assets/images/placeholder.svg'" />
            </a>
            <div class="hk-sheet-item-info">
              <a href="product.html?id=${item.productId}" class="hk-sheet-item-name">${Storage.escapeHTML(item.name)}</a>
              <span class="hk-sheet-item-variant">Size: <strong>${Storage.escapeHTML(item.size)}</strong> · Màu: ${Storage.escapeHTML(item.colorName)}</span>
              <button type="button" class="hk-sheet-remove js-minicart-remove" data-pid="${item.productId}" data-vid="${item.variantId}">Xóa</button>
              <div class="hk-sheet-item-bottom">
                <div class="hk-mini-qty">
                  <button type="button" class="js-minicart-qty" data-pid="${item.productId}" data-vid="${item.variantId}" data-next="${item.quantity - 1}" aria-label="Giảm số lượng">&minus;</button>
                  <span>${item.quantity}</span>
                  <button type="button" class="js-minicart-qty" data-pid="${item.productId}" data-vid="${item.variantId}" data-next="${item.quantity + 1}" aria-label="Tăng số lượng">+</button>
                </div>
                <span class="hk-sheet-item-price">${Storage.formatCurrency(item.lineTotal)}</span>
              </div>
            </div>
          </div>
        `
        )
        .join("");

      footerEl.innerHTML = `
        <div class="hk-sheet-subtotal-row">
          <span class="text-muted">Tạm tính (${summary.totalCount} món):</span>
          <span class="hk-sheet-subtotal-val">${Storage.formatCurrency(summary.subtotal)}</span>
        </div>
        <div class="hk-sheet-actions">
          <a href="cart.html" class="btn btn-secondary btn-sm">Xem giỏ hàng</a>
          <a href="checkout.html" class="btn btn-primary btn-sm">Thanh toán ngay</a>
        </div>
      `;
    },

    renderWishlistSheetBody: function () {
      const el = document.getElementById("hk-side-sheet");
      if (!el || el.dataset.sheetType !== "wishlist") return;

      const items = Features.getWishlistProducts();
      const titleEl = el.querySelector("#hk-sheet-title");
      const bannerEl = el.querySelector("#hk-sheet-subbanner");
      const bodyEl = el.querySelector("#hk-sheet-body");
      const footerEl = el.querySelector("#hk-sheet-footer");

      if (titleEl) titleEl.textContent = `SẢN PHẨM YÊU THÍCH (${items.length})`;
      if (bannerEl) bannerEl.innerHTML = "";

      if (items.length === 0) {
        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 48px 16px;">
            <svg style="width: 44px; height: 44px; margin: 0 auto 12px; color: var(--color-muted);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <h4 style="margin-bottom: 6px;">Chưa có sản phẩm yêu thích</h4>
            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 20px;">Nhấn biểu tượng trái tim trên sản phẩm bạn ưng ý để lưu lại xem sau.</p>
            <a href="products.html" class="btn btn-primary btn-sm">Dạo xem Bộ sưu tập</a>
          </div>
        `;
        footerEl.style.display = "none";
        return;
      }

      const canQuickView = Features.flags().quickView !== false;
      bodyEl.innerHTML = items
        .map((p) => {
          const img = (p.images && p.images[0]) || "assets/images/placeholder.svg";
          return `
            <div class="hk-sheet-item">
              <a href="product.html?id=${p.id}">
                <img src="${img}" alt="${Storage.escapeHTML(p.name)}" class="hk-sheet-item-img" onerror="this.src='assets/images/placeholder.svg'" />
              </a>
              <div class="hk-sheet-item-info">
                <a href="product.html?id=${p.id}" class="hk-sheet-item-name">${Storage.escapeHTML(p.name)}</a>
                <span class="hk-sheet-item-variant">${Storage.escapeHTML(p.categoryName || "")}</span>
                <span class="hk-sheet-item-price" style="margin-top: 2px;">${Storage.formatCurrency(p.price)}</span>
                <div class="hk-sheet-item-bottom" style="margin-top: 8px;">
                  ${
                    canQuickView
                      ? `<button type="button" class="btn btn-primary btn-sm js-wishlist-to-qv" data-product-id="${p.id}" style="padding: 5px 10px; font-size: 0.74rem;">Chọn size & Thêm giỏ</button>`
                      : `<a href="product.html?id=${p.id}" class="btn btn-primary btn-sm" style="padding: 5px 10px; font-size: 0.74rem;">Xem chi tiết</a>`
                  }
                  <button type="button" class="hk-sheet-remove js-toggle-wishlist" data-product-id="${p.id}">Bỏ lưu</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      footerEl.style.display = "flex";
      footerEl.innerHTML = `
        <a href="products.html" class="btn btn-secondary btn-sm btn-block">Tiếp tục khám phá sản phẩm</a>
      `;
    },

    /* ========================================================================
       4. QUICK VIEW MODAL (XEM NHANH & CHỌN SIZE/MÀU THÊM GIỎ TRỰC TIẾP)
       ======================================================================== */
    openQuickView: function (productId) {
      if (Features.flags().quickView === false || !HK.Products || !HK.UI) return;

      const product = HK.Products.getById(productId);
      if (!product || product.status === "archived") {
        HK.UI.showToast("Sản phẩm không còn tồn tại hoặc đã ngừng kinh doanh.", "error");
        return;
      }

      if (Features.flags().recentlyViewed !== false) {
        Features.recordRecentlyViewed(product.id);
      }

      const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : ["assets/images/placeholder.svg"];
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const firstAvail = variants.find((v) => (Number(v.stock) || 0) > 0) || variants[0] || null;

      let qvSize = firstAvail ? firstAvail.size : null;
      let qvColor = firstAvail ? firstAvail.colorName : null;
      let qvQty = 1;

      const sizeSet = new Set();
      const colorMap = new Map();
      variants.forEach((v) => {
        if (v.size) sizeSet.add(v.size);
        if (v.colorName && !colorMap.has(v.colorName)) {
          colorMap.set(v.colorName, v.colorCode || "#111111");
        }
      });

      const sizesHtml = Array.from(sizeSet)
        .map(
          (s) =>
            `<button type="button" class="variant-btn js-qv-size ${s === qvSize ? "active" : ""}" data-size="${Storage.escapeHTML(s)}">${Storage.escapeHTML(s)}</button>`
        )
        .join("");

      const colorsHtml = Array.from(colorMap.entries())
        .map(
          ([cName, cCode]) => `
          <button type="button" class="variant-btn js-qv-color ${cName === qvColor ? "active" : ""}" data-color="${Storage.escapeHTML(cName)}">
            <span class="color-swatch-circle" style="background-color: ${Storage.escapeHTML(cCode)};"></span>
            ${Storage.escapeHTML(cName)}
          </button>`
        )
        .join("");

      const thumbsHtml =
        images.length > 1
          ? `<div class="hk-qv-thumbs">
              ${images
                .map(
                  (img, i) => `
                <button type="button" class="hk-qv-thumb ${i === 0 ? "active" : ""} js-qv-thumb" data-img="${img}" aria-label="Ảnh ${i + 1}">
                  <img src="${img}" alt="" onerror="this.src='assets/images/placeholder.svg'" />
                </button>`
                )
                .join("")}
            </div>`
          : "";

      const hasOrig = product.originalPrice && product.originalPrice > product.price;

      const contentHtml = `
        <div class="hk-qv-grid">
          <div>
            <div class="hk-qv-main-img-wrap">
              <img src="${images[0]}" alt="${Storage.escapeHTML(product.name)}" class="hk-qv-main-img" id="js-qv-main-img" onerror="this.src='assets/images/placeholder.svg'" />
            </div>
            ${thumbsHtml}
          </div>

          <div class="hk-qv-info">
            <div>
              <span class="card-category">${Storage.escapeHTML(product.categoryName || "")}</span>
              <h3 style="font-size: 1.35rem; margin-top: 4px;">${Storage.escapeHTML(product.name)}</h3>
              <div class="card-rating" style="margin-top: 6px;">
                <span class="star">★</span>
                <span>${product.rating || "5.0"}</span>
                <span class="text-muted">(${product.reviewCount || 0} đánh giá) · ${Storage.escapeHTML(product.fit || "Oversize Fit")}</span>
              </div>
            </div>

            <div class="hk-qv-price-row">
              <span class="hk-qv-price" id="js-qv-price">${Storage.formatCurrency(product.price)}</span>
              ${hasOrig ? `<span class="card-price-original">${Storage.formatCurrency(product.originalPrice)}</span>` : ""}
            </div>

            <div>
              <div class="selector-label"><span>Kích cỡ (Size)</span></div>
              <div class="variant-picker-grid">${sizesHtml}</div>
            </div>

            <div>
              <div class="selector-label"><span>Màu sắc</span></div>
              <div class="variant-picker-grid">${colorsHtml}</div>
            </div>

            <div id="js-qv-stock" class="stock-indicator">Đang kiểm tra tồn kho...</div>

            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <div class="qty-control">
                <button type="button" class="qty-btn" id="js-qv-minus" aria-label="Giảm">&minus;</button>
                <input type="number" id="js-qv-qty" class="qty-input" value="1" min="1" max="99" aria-label="Số lượng" />
                <button type="button" class="qty-btn" id="js-qv-plus" aria-label="Tăng">+</button>
              </div>
              <button type="button" class="btn btn-primary" id="js-qv-add-cart" style="flex: 1;">
                Thêm vào giỏ hàng
              </button>
            </div>

            <p class="text-muted" style="font-size: 0.84rem; line-height: 1.55;">
              ${Storage.escapeHTML(product.description || "")}
            </p>

            <div>
              <a href="product.html?id=${product.id}" class="section-link" style="font-size: 0.8rem;">
                Xem trang chi tiết sản phẩm đầy đủ &rarr;
              </a>
            </div>
          </div>
        </div>
      `;

      const modalRef = HK.UI.showModal({
        title: "XEM NHANH SẢN PHẨM",
        content: contentHtml,
        showFooter: false,
        extraClass: "hk-quickview-modal"
      });

      const root = modalRef.element;
      if (!root) return;

      const priceEl = root.querySelector("#js-qv-price");
      if (priceEl && HK.UI.animateNumberCounter) {
        HK.UI.animateNumberCounter(priceEl, product.price, 650);
      }

      const mainImg = root.querySelector("#js-qv-main-img");
      root.querySelectorAll(".js-qv-thumb").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll(".js-qv-thumb").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          if (mainImg) mainImg.src = btn.getAttribute("data-img");
        });
      });

      const stockEl = root.querySelector("#js-qv-stock");
      const addBtn = root.querySelector("#js-qv-add-cart");
      const qtyInput = root.querySelector("#js-qv-qty");

      const getMatchedVariant = () => variants.find((v) => v.size === qvSize && v.colorName === qvColor) || null;

      const refreshQvStock = () => {
        // Cập nhật trạng thái chéo Size x Màu (gạch mờ các tổ hợp không có sẵn / hết hàng)
        root.querySelectorAll(".js-qv-size").forEach((sBtn) => {
          const sVal = sBtn.getAttribute("data-size");
          const pair = variants.find((v) => v.size === sVal && v.colorName === qvColor);
          sBtn.classList.toggle("is-unavailable", !pair || (Number(pair.stock) || 0) <= 0);
        });
        root.querySelectorAll(".js-qv-color").forEach((cBtn) => {
          const cVal = cBtn.getAttribute("data-color");
          const pair = variants.find((v) => v.size === qvSize && v.colorName === cVal);
          cBtn.classList.toggle("is-unavailable", !pair || (Number(pair.stock) || 0) <= 0);
        });

        const matched = getMatchedVariant();
        if (!matched) {
          stockEl.textContent = "Tổ hợp Size và Màu này không có sẵn — vui lòng chọn màu/size khác.";
          stockEl.className = "stock-indicator text-danger";
          addBtn.disabled = true;
          return null;
        }
        const st = Number(matched.stock) || 0;
        if (st <= 0) {
          stockEl.textContent = "Tạm hết hàng cho biến thể này";
          stockEl.className = "stock-indicator text-danger";
          addBtn.disabled = true;
        } else {
          if (qvQty > st) {
            qvQty = st;
            qtyInput.value = qvQty;
          }
          if (st <= 5) {
            stockEl.textContent = `Sắp hết hàng — Chỉ còn ${st} sản phẩm`;
            stockEl.className = "stock-indicator text-warning";
          } else {
            stockEl.textContent = `Còn hàng (${st} sản phẩm sẵn sàng giao)`;
            stockEl.className = "stock-indicator text-success";
          }
          addBtn.disabled = false;
        }
        return matched;
      };

      const colorList = Array.from(colorMap.keys());
      root.querySelectorAll(".js-qv-size").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll(".js-qv-size").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          qvSize = btn.getAttribute("data-size");
          refreshQvStock();
        });
      });

      root.querySelectorAll(".js-qv-color").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll(".js-qv-color").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          qvColor = btn.getAttribute("data-color");
          const cIdx = colorList.indexOf(qvColor);
          if (cIdx >= 0 && images[cIdx] && mainImg) {
            mainImg.src = images[cIdx];
            root.querySelectorAll(".js-qv-thumb").forEach((tb, idx) => tb.classList.toggle("active", idx === cIdx));
          }
          refreshQvStock();
        });
      });

      root.querySelector("#js-qv-minus").addEventListener("click", () => {
        qvQty = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
        qtyInput.value = qvQty;
      });

      root.querySelector("#js-qv-plus").addEventListener("click", () => {
        const v = refreshQvStock();
        const max = v ? Number(v.stock) || 1 : 99;
        qvQty = Math.min(max, (parseInt(qtyInput.value, 10) || 1) + 1);
        qtyInput.value = qvQty;
      });

      qtyInput.addEventListener("change", () => {
        const v = refreshQvStock();
        const max = v ? Number(v.stock) || 1 : 99;
        qvQty = Math.min(max, Math.max(1, parseInt(qtyInput.value, 10) || 1));
        qtyInput.value = qvQty;
      });

      addBtn.addEventListener("click", () => {
        const v = refreshQvStock();
        if (!v || (Number(v.stock) || 0) <= 0) return;
        const res = HK.Cart.addToCart(product.id, v.id, qvQty);
        if (res.success) {
          modalRef.close();
          if (Features.flags().miniCartDrawer !== false) {
            setTimeout(() => Features.openMiniCart(), 140);
          } else {
            HK.UI.showToast(res.message, "success");
          }
        } else {
          HK.UI.showToast(res.message, "error");
        }
      });

      refreshQvStock();
    },

    /* ========================================================================
       5. LIVE INSTANT SEARCH DROPDOWN (TÌM KIẾM TỨC THÌ KÈM ẢNH + PHÍM TẮT '/')
       ======================================================================== */
    initLiveSearch: function () {
      const searchBox = document.querySelector(".js-live-search-box");
      const input = document.querySelector(".js-live-search-input");
      if (!searchBox || !input || searchBox.dataset.liveBound === "true") return;
      searchBox.dataset.liveBound = "true";

      const dropdown = document.createElement("div");
      dropdown.className = "live-search-dropdown";
      dropdown.setAttribute("role", "region");
      dropdown.setAttribute("aria-label", "Gợi ý tìm kiếm nhanh");
      searchBox.appendChild(dropdown);

      let timer = null;

      const renderPopularSuggestions = () => {
        const tags = [
          { label: "Áo thun Oversize", href: "products.html?category=ao-thun" },
          { label: "Hoodie & Sweater", href: "products.html?category=hoodie-sweater" },
          { label: "Quần Cargo", href: "products.html?q=cargo" },
          { label: "Áo khoác", href: "products.html?category=ao-khoac" },
          { label: "Phụ kiện", href: "products.html?category=phu-kien" }
        ];
        dropdown.innerHTML = `
          <div class="live-search-section-label">TỪ KHÓA PHỔ BIẾN</div>
          <div class="live-search-tags">
            ${tags.map((t) => `<a href="${t.href}" class="live-search-tag">${Storage.escapeHTML(t.label)}</a>`).join("")}
          </div>
        `;
      };

      const renderMatches = (q) => {
        if (!HK.Products) return;
        const trimmed = q.trim();
        if (!trimmed) {
          renderPopularSuggestions();
          return;
        }

        const res = HK.Products.filterAndSort({ query: trimmed, pageSize: 5 });
        if (res.items.length === 0) {
          dropdown.innerHTML = `
            <div class="live-search-section-label">KẾT QUẢ TÌM KIẾM</div>
            <div class="live-search-empty">Không tìm thấy sản phẩm khớp với "<strong>${Storage.escapeHTML(trimmed)}</strong>"</div>
          `;
          return;
        }

        dropdown.innerHTML = `
          <div class="live-search-section-label">SẢN PHẨM GỢI Ý (${res.totalResults})</div>
          <div>
            ${res.items
              .map((p) => {
                const img = (p.images && p.images[0]) || "assets/images/placeholder.svg";
                return `
                  <a href="product.html?id=${p.id}" class="live-search-item">
                    <img src="${img}" alt="" class="live-search-thumb" onerror="this.src='assets/images/placeholder.svg'" />
                    <div class="live-search-meta">
                      <div class="live-search-title">${Storage.escapeHTML(p.name)}</div>
                      <div class="live-search-sub">${Storage.escapeHTML(p.categoryName || "")}</div>
                    </div>
                    <div class="live-search-price">${Storage.formatCurrency(p.price)}</div>
                  </a>
                `;
              })
              .join("")}
          </div>
          <a href="products.html?q=${encodeURIComponent(trimmed)}" class="live-search-footer">
            Xem tất cả ${res.totalResults} kết quả cho "${Storage.escapeHTML(trimmed)}" &rarr;
          </a>
        `;
      };

      input.addEventListener("focus", () => {
        renderMatches(input.value);
        dropdown.classList.add("is-open");
      });

      input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          renderMatches(input.value);
          dropdown.classList.add("is-open");
        }, 120);
      });

      document.addEventListener("click", (e) => {
        if (!searchBox.contains(e.target)) {
          dropdown.classList.remove("is-open");
        }
      });

      searchBox.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          dropdown.classList.remove("is-open");
          input.blur();
          return;
        }
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && dropdown.classList.contains("is-open")) {
          const links = Array.from(dropdown.querySelectorAll("a[href]"));
          if (links.length === 0) return;
          e.preventDefault();
          const curIdx = links.indexOf(document.activeElement);
          if (e.key === "ArrowDown") {
            const nextIdx = curIdx < 0 ? 0 : (curIdx + 1) % links.length;
            links[nextIdx].focus();
          } else {
            if (curIdx <= 0) {
              input.focus();
            } else {
              links[curIdx - 1].focus();
            }
          }
        }
      });
    },

    /* ========================================================================
       6. SMART SIZE ADVISOR (GỢI Ý CHỌN SIZE THEO CHIỀU CAO & CÂN NẶNG)
       ======================================================================== */
    calculateRecommendedSize: function (heightCm, weightKg, fitPref = "standard") {
      const h = Number(heightCm) || 170;
      const w = Number(weightKg) || 63;

      // Tính bậc size cơ sở (0: S, 1: M, 2: L, 3: XL) theo chuẩn form Streetwear HK Store
      let hIdx = 1;
      if (h < 165) hIdx = 0;
      else if (h < 175) hIdx = 1;
      else if (h <= 182) hIdx = 2;
      else hIdx = 3;

      let wIdx = 1;
      if (w <= 58) wIdx = 0;
      else if (w <= 70) wIdx = 1;
      else if (w <= 82) wIdx = 2;
      else wIdx = 3;

      let baseIdx = Math.max(hIdx, wIdx);
      if (fitPref === "slim" && Math.abs(hIdx - wIdx) <= 1 && w <= 72) {
        baseIdx = Math.min(hIdx, wIdx);
      } else if (fitPref === "baggy") {
        baseIdx = Math.min(3, baseIdx + 1);
      }

      const map = ["S", "M", "L", "XL"];
      return map[Math.max(0, Math.min(3, baseIdx))];
    },

    mountProductSizeAdvisor: function (product, onSelectSize) {
      if (Features.flags().sizeAdvisor === false || !product) return;
      const sizeContainer = document.getElementById("size-picker-container");
      if (!sizeContainer || !sizeContainer.parentElement) return;

      const availableSizes = Array.from(new Set((product.variants || []).map((v) => v.size)));
      // Bỏ qua nếu là phụ kiện One size
      const standardSizes = ["S", "M", "L", "XL"];
      if (!availableSizes.some((s) => standardSizes.includes(s))) return;

      const existing = document.getElementById("hk-fit-finder-card");
      if (existing) existing.remove();

      const saved = Storage.get(FIT_PROFILE_KEY, { height: 170, weight: 63, pref: "standard" });
      let height = Number(saved.height) || 170;
      let weight = Number(saved.weight) || 63;
      let pref = saved.pref || "standard";

      const card = document.createElement("div");
      card.id = "hk-fit-finder-card";
      card.className = "hk-fit-finder-card";

      const initialRec = Features.calculateRecommendedSize(height, weight, pref);

      card.innerHTML = `
        <button type="button" class="hk-fit-finder-toggle" id="js-fit-finder-toggle" aria-expanded="false">
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>
            Gợi ý chọn Size theo Chiều cao & Cân nặng
          </span>
          <span class="hk-fit-finder-badge" id="js-fit-badge-summary">Đề xuất: ${initialRec}</span>
        </button>

        <div class="hk-fit-finder-body">
          <div class="hk-fit-sliders-grid">
            <div class="hk-fit-field">
              <label for="js-fit-height"><span>Chiều cao</span><strong id="js-fit-height-val">${height} cm</strong></label>
              <input type="range" id="js-fit-height" min="150" max="195" value="${height}" />
            </div>
            <div class="hk-fit-field">
              <label for="js-fit-weight"><span>Cân nặng</span><strong id="js-fit-weight-val">${weight} kg</strong></label>
              <input type="range" id="js-fit-weight" min="42" max="102" value="${weight}" />
            </div>
          </div>

          <div>
            <div style="font-size: 0.76rem; font-weight: 700; margin-bottom: 6px; color: var(--color-muted);">SỞ THÍCH MẶC:</div>
            <div class="hk-fit-pref-row">
              <button type="button" class="hk-fit-pref-btn ${pref === "slim" ? "active" : ""}" data-pref="slim">Vừa gọn</button>
              <button type="button" class="hk-fit-pref-btn ${pref === "standard" ? "active" : ""}" data-pref="standard">Chuẩn Oversize</button>
              <button type="button" class="hk-fit-pref-btn ${pref === "baggy" ? "active" : ""}" data-pref="baggy">Rộng thùng thình</button>
            </div>
          </div>

          <div class="hk-fit-result-box">
            <div>
              <span style="font-size: 0.8rem; color: var(--color-muted);">Size phù hợp nhất với bạn: </span>
              <strong class="hk-fit-size-highlight" id="js-fit-rec-size">Size ${initialRec}</strong>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="js-fit-apply-btn">Chọn Size ${initialRec}</button>
          </div>
        </div>
      `;

      sizeContainer.parentElement.appendChild(card);

      const toggleBtn = card.querySelector("#js-fit-finder-toggle");
      const hInput = card.querySelector("#js-fit-height");
      const wInput = card.querySelector("#js-fit-weight");
      const hVal = card.querySelector("#js-fit-height-val");
      const wVal = card.querySelector("#js-fit-weight-val");
      const recEl = card.querySelector("#js-fit-rec-size");
      const badgeEl = card.querySelector("#js-fit-badge-summary");
      const applyBtn = card.querySelector("#js-fit-apply-btn");

      const refreshRecommendation = () => {
        const rec = Features.calculateRecommendedSize(height, weight, pref);
        hVal.textContent = `${height} cm`;
        wVal.textContent = `${weight} kg`;
        recEl.textContent = `Size ${rec}`;
        badgeEl.textContent = `Đề xuất: ${rec}`;
        const existsOnProduct = availableSizes.includes(rec);
        applyBtn.textContent = existsOnProduct ? `Chọn Size ${rec}` : `Sản phẩm không có Size ${rec}`;
        applyBtn.disabled = !existsOnProduct;
        Storage.set(FIT_PROFILE_KEY, { height, weight, pref });
        return rec;
      };

      toggleBtn.addEventListener("click", () => {
        const expanded = card.classList.toggle("is-expanded");
        toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
      });

      hInput.addEventListener("input", () => {
        height = Number(hInput.value);
        refreshRecommendation();
      });

      wInput.addEventListener("input", () => {
        weight = Number(wInput.value);
        refreshRecommendation();
      });

      card.querySelectorAll(".hk-fit-pref-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          card.querySelectorAll(".hk-fit-pref-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          pref = btn.getAttribute("data-pref");
          refreshRecommendation();
        });
      });

      applyBtn.addEventListener("click", () => {
        const rec = refreshRecommendation();
        if (typeof onSelectSize === "function") {
          onSelectSize(rec);
        } else {
          const sizeBtn = document.querySelector(`.js-size-btn[data-size="${rec}"]`);
          if (sizeBtn) sizeBtn.click();
        }
        if (HK.UI) HK.UI.showToast(`Đã áp dụng Size ${rec} theo số đo (${height}cm, ${weight}kg)`, "success", 2400);
      });

      refreshRecommendation();
    },

    /* ========================================================================
       7. RECENTLY VIEWED PRODUCTS (SẢN PHẨM VỪA XEM GẦN ĐÂY)
       ======================================================================== */
    recordRecentlyViewed: function (productId) {
      if (Features.flags().recentlyViewed === false || !productId) return;
      const list = Storage.get(RECENT_KEY, []);
      const arr = Array.isArray(list) ? list.filter((id) => id !== productId) : [];
      arr.unshift(productId);
      Storage.set(RECENT_KEY, arr.slice(0, 8));
    },

    getRecentlyViewedProducts: function (excludeId = null, limit = 4) {
      if (Features.flags().recentlyViewed === false || !HK.Products) return [];
      const raw = Storage.get(RECENT_KEY, []);
      if (!Array.isArray(raw)) return [];

      const items = [];
      const validIds = [];

      raw.forEach((id) => {
        const p = HK.Products.getById(id);
        if (p && p.status !== "archived") {
          validIds.push(p.id);
          if (p.id !== excludeId && items.length < limit) {
            items.push(p);
          }
        }
      });

      if (validIds.length !== raw.length) {
        Storage.set(RECENT_KEY, validIds);
      }

      return items;
    },

    renderRecentlyViewedSection: function (containerEl, excludeProductId = null) {
      if (Features.flags().recentlyViewed === false || !containerEl || !HK.UI) return;
      const items = Features.getRecentlyViewedProducts(excludeProductId, 4);
      if (items.length === 0) {
        containerEl.style.display = "none";
        return;
      }

      containerEl.style.display = "block";
      containerEl.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">SẢN PHẨM BẠN VỪA XEM</h2>
        </div>
        <div class="products-grid">
          ${items.map((p) => HK.UI.renderProductCard(p)).join("")}
        </div>
      `;
      HK.UI.initNumberCounters(containerEl);
      HK.UI.initScrollReveals(containerEl);
    },

    /* ========================================================================
       8. SCROLL PROGRESS BAR, NAVBAR ELEVATION, BACK TO TOP & STICKY BUY BAR
       ======================================================================== */
    initScrollEffectsAndTop: function () {
      if (scrollEngineBound) return;
      scrollEngineBound = true;

      const progressBar = document.createElement("div");
      progressBar.className = "hk-scroll-progress";
      progressBar.setAttribute("aria-hidden", "true");
      document.body.appendChild(progressBar);

      const topBtn = document.createElement("button");
      topBtn.type = "button";
      topBtn.className = "hk-back-to-top";
      topBtn.setAttribute("aria-label", "Cuộn lên đầu trang");
      topBtn.title = "Lên đầu trang";
      topBtn.innerHTML = `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m18 15-6-6-6 6"/></svg>`;
      document.body.appendChild(topBtn);

      topBtn.addEventListener("click", () => {
        window.scrollTo({
          top: 0,
          behavior: Features.isLowMotionOrLowPower() ? "auto" : "smooth"
        });
      });

      let ticking = false;
      const updateOnScroll = () => {
        ticking = false;
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = docHeight > 40 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;

        progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;

        const navbar = document.querySelector(".navbar");
        if (navbar) {
          navbar.classList.toggle("navbar-scrolled", scrollTop > 20);
        }

        topBtn.classList.toggle("is-visible", scrollTop > 420);

        // Kiểm tra Sticky Buy Bar trên trang product.html
        const stickyBar = document.getElementById("hk-sticky-buy-bar");
        const mainAddBtn = document.getElementById("btn-add-to-cart");
        if (stickyBar && mainAddBtn) {
          const rect = mainAddBtn.getBoundingClientRect();
          const showSticky = rect.bottom < 72;
          stickyBar.classList.toggle("is-visible", showSticky);
          document.body.classList.toggle("has-sticky-buy-bar", showSticky);
        }
      };

      window.addEventListener(
        "scroll",
        () => {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(updateOnScroll);
          }
        },
        { passive: true }
      );

      requestAnimationFrame(updateOnScroll);
    },

    // Gắn Thanh Mua Nhanh dính đáy màn hình trên trang Chi tiết sản phẩm (product.html)
    mountProductStickyBar: function (product, getSelectedStateFn) {
      if (Features.flags().scrollProgressAndTop === false || !product) return;
      const existing = document.getElementById("hk-sticky-buy-bar");
      if (existing) existing.remove();

      const img = (product.images && product.images[0]) || "assets/images/placeholder.svg";
      const bar = document.createElement("div");
      bar.id = "hk-sticky-buy-bar";
      bar.className = "hk-sticky-buy-bar";
      bar.innerHTML = `
        <div class="container hk-sticky-buy-inner">
          <div class="hk-sticky-product-summary">
            <img src="${img}" alt="" class="hk-sticky-thumb" onerror="this.src='assets/images/placeholder.svg'" />
            <div style="min-width: 0;">
              <div class="hk-sticky-title">${Storage.escapeHTML(product.name)}</div>
              <div class="hk-sticky-meta" id="js-sticky-variant-label">Đang chọn biến thể...</div>
            </div>
          </div>
          <div class="hk-sticky-cta-group">
            <span class="hk-sticky-price">${Storage.formatCurrency(product.price)}</span>
            <button type="button" class="btn btn-primary btn-sm" id="js-sticky-add-btn">Thêm vào giỏ</button>
          </div>
        </div>
      `;
      document.body.appendChild(bar);

      const syncLabel = () => {
        if (typeof getSelectedStateFn !== "function") return;
        const st = getSelectedStateFn();
        const label = bar.querySelector("#js-sticky-variant-label");
        const btn = bar.querySelector("#js-sticky-add-btn");
        if (label && st) {
          label.textContent = `Size: ${st.size || "-"} · Màu: ${st.color || "-"}`;
        }
        if (btn) {
          const mainBtn = document.getElementById("btn-add-to-cart");
          btn.disabled = Boolean(mainBtn && mainBtn.disabled);
        }
      };

      bar.querySelector("#js-sticky-add-btn").addEventListener("click", () => {
        const mainBtn = document.getElementById("btn-add-to-cart");
        if (mainBtn && !mainBtn.disabled) {
          mainBtn.click();
          if (Features.flags().miniCartDrawer !== false) {
            setTimeout(() => Features.openMiniCart(), 120);
          }
        }
      });

      syncLabel();
      return { sync: syncLabel };
    },

    // Bổ sung số lượng sản phẩm thực tế vào 5 thẻ Danh mục trên Trang chủ
    enhanceHomeCategoryCounts: function () {
      const cards = document.querySelectorAll(".categories-showcase .category-card");
      if (!cards || cards.length === 0 || !HK.Products) return;

      const all = HK.Products.getAll(false);
      cards.forEach((card) => {
        const href = card.getAttribute("href") || "";
        const match = href.match(/category=([a-z0-9-]+)/i);
        const catKey = match ? match[1] : null;
        if (!catKey) return;

        const count = all.filter((p) => p.category === catKey).length;
        const content = card.querySelector(".category-card-content");
        const nameEl = card.querySelector(".category-card-name");
        if (!content || !nameEl || content.dataset.enhanced === "true") return;
        content.dataset.enhanced = "true";

        content.innerHTML = `
          <div>
            <h3 class="category-card-name">${Storage.escapeHTML(nameEl.textContent)}</h3>
            <span class="category-card-count">${count} sản phẩm</span>
          </div>
          <span class="category-card-arrow" aria-hidden="true">&rarr;</span>
        `;
      });
    },

    /* ========================================================================
       9. GLOBAL EVENT DELEGATION (GỌN NHẸ & KHÔNG TRÙNG LẶP LISTENER)
       ======================================================================== */
    bindGlobalDelegation: function () {
      if (globalDelegationBound) return;
      globalDelegationBound = true;

      // Đồng bộ Mini-Cart mỗi khi giỏ hàng thay đổi
      document.addEventListener("hk:cart-updated", () => {
        if (activeSheetEl && activeSheetEl.dataset.sheetType === "cart") {
          Features.renderMiniCartBody();
        }
      });

      // Phím tắt '/' mở tìm kiếm & 'Escape' đóng ngăn kéo phụ
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && activeSheetEl) {
          Features.closeSideSheet();
        }

        if (
          e.key === "/" &&
          Features.flags().liveSearch !== false &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          const tag = document.activeElement ? document.activeElement.tagName : "";
          const isEditing =
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            Boolean(document.activeElement && document.activeElement.isContentEditable);
          if (!isEditing) {
            const searchInput = document.querySelector(".js-live-search-input");
            if (searchInput && searchInput.offsetParent !== null) {
              e.preventDefault();
              searchInput.focus();
            }
          }
        }
      });

      document.addEventListener("click", (e) => {
        // 1. Nút Tim Yêu thích trên thẻ sản phẩm hoặc trang chi tiết
        const wishBtn = e.target.closest(".js-toggle-wishlist");
        if (wishBtn) {
          e.preventDefault();
          e.stopPropagation();
          const pid = wishBtn.getAttribute("data-product-id");
          Features.toggleWishlist(pid, wishBtn);
          return;
        }

        // 2. Nút Mở ngăn kéo Wishlist trên Header
        if (e.target.closest(".js-open-wishlist")) {
          e.preventDefault();
          Features.openSideSheet("wishlist");
          return;
        }

        // 3. Nút Xem nhanh (Quick View) trên thẻ sản phẩm
        const qvBtn = e.target.closest(".js-quick-view");
        if (qvBtn) {
          e.preventDefault();
          e.stopPropagation();
          const pid = qvBtn.getAttribute("data-product-id");
          Features.openQuickView(pid);
          return;
        }

        // 4. Mở Quick View từ trong ngăn kéo Wishlist
        const wishToQv = e.target.closest(".js-wishlist-to-qv");
        if (wishToQv) {
          e.preventDefault();
          const pid = wishToQv.getAttribute("data-product-id");
          Features.closeSideSheet();
          setTimeout(() => Features.openQuickView(pid), 160);
          return;
        }

        // 5. Mở ngăn kéo Mini-Cart khi bấm icon Giỏ hàng trên Header (trừ khi đang ở cart.html hoặc checkout.html)
        const cartTrigger = e.target.closest(".js-header-cart-trigger");
        if (
          cartTrigger &&
          Features.flags().miniCartDrawer !== false &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey
        ) {
          const path = (window.location.pathname || "").toLowerCase();
          if (!path.endsWith("cart.html") && !path.endsWith("checkout.html")) {
            e.preventDefault();
            Features.openMiniCart();
            return;
          }
        }

        // 6. Nút tìm kiếm trên Mobile: mở Drawer và focus thẳng vào ô tìm kiếm
        const mobileSearchBtn = e.target.closest(".js-mobile-search-trigger");
        if (mobileSearchBtn && HK.UI && HK.UI.toggleMobileDrawer) {
          e.preventDefault();
          HK.UI.toggleMobileDrawer(true);
          setTimeout(() => {
            const drawerInput = document.querySelector(".drawer-search .search-input");
            if (drawerInput) drawerInput.focus();
          }, 180);
          return;
        }

        // 7. Đóng ngăn kéo phụ (Mini-Cart / Wishlist)
        if (e.target.closest(".js-close-side-sheet")) {
          e.preventDefault();
          Features.closeSideSheet();
          return;
        }

        // 8. Tăng/giảm số lượng hoặc xóa món trong Mini-Cart
        const qtyBtn = e.target.closest(".js-minicart-qty");
        if (qtyBtn && HK.Cart) {
          const pid = qtyBtn.getAttribute("data-pid");
          const vid = qtyBtn.getAttribute("data-vid");
          const next = parseInt(qtyBtn.getAttribute("data-next"), 10);
          const res = HK.Cart.updateQuantity(pid, vid, next);
          if (!res.success && res.message && HK.UI) {
            HK.UI.showToast(res.message, "info", 2200);
          }
          return;
        }

        const rmBtn = e.target.closest(".js-minicart-remove");
        if (rmBtn && HK.Cart) {
          const pid = rmBtn.getAttribute("data-pid");
          const vid = rmBtn.getAttribute("data-vid");
          const res = HK.Cart.removeItem(pid, vid);
          if (HK.UI && res && res.message) {
            HK.UI.showToast(res.message, "info", 2200);
          }
          return;
        }
      });
    }
  };

  HK.Features = Features;
})(window.HKStore);

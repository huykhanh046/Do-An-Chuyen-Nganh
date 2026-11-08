/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Chi tiết Sản phẩm (Product Detail)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Products = HKStore.Products;
  const Cart = HKStore.Cart;
  const UI = HKStore.UI;

  let currentProduct = null;
  let selectedSize = null;
  let selectedColor = null;
  let currentQuantity = 1;
  let stickyBarRef = null;

  function initProductPage() {
    UI.initCommonUI("products");

    const productId = Storage.getUrlParam("id");
    if (!productId) {
      renderNotFound("Không tìm thấy mã sản phẩm yêu cầu.");
      return;
    }

    currentProduct = Products.getById(productId);
    if (!currentProduct || currentProduct.status === "archived") {
      renderNotFound("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.");
      return;
    }

    if (HKStore.Features && HKStore.Features.recordRecentlyViewed) {
      HKStore.Features.recordRecentlyViewed(currentProduct.id);
    }

    renderProductDetail();
    renderProductReviews();
    renderRelatedProducts();

    const recentSection = document.getElementById("hk-recently-viewed-detail");
    if (recentSection && HKStore.Features && HKStore.Features.renderRecentlyViewedSection) {
      HKStore.Features.renderRecentlyViewedSection(recentSection, currentProduct.id);
    }
  }

  function renderNotFound(message) {
    const reviewsSec = document.getElementById("product-reviews-section");
    if (reviewsSec) reviewsSec.style.display = "none";

    const layout = document.getElementById("product-detail-layout");
    if (layout) {
      const activeProducts = Products.getAll(false).slice(0, 4);

      layout.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 20px;">
          <h1 style="font-size: 1.5rem; font-weight: 800; text-transform: uppercase;">Sản phẩm không còn trên hệ thống</h1>
          <p class="text-muted" style="margin-top: 8px; max-width: 500px; margin-left: auto; margin-right: auto;">
            ${Storage.escapeHTML(message)} Sản phẩm này có thể đã bị xóa hoặc ngừng kinh doanh trong hệ thống quản trị.
          </p>
          <a href="products.html" class="btn btn-primary" style="margin-top: 20px;">Xem tất cả sản phẩm đang bán</a>
        </div>

        ${
          activeProducts.length > 0
            ? `
          <div style="grid-column: 1 / -1; margin-top: 24px;">
            <h2 class="section-title" style="font-size: 1.2rem; margin-bottom: 16px;">GỢI Ý CÁC SẢN PHẨM KHÁC ĐANG CÓ SẴN</h2>
            <div class="products-grid">
              ${activeProducts.map((p) => UI.renderProductCard(p)).join("")}
            </div>
          </div>
        `
            : ""
        }
      `;
      UI.initNumberCounters(layout);
      UI.initScrollReveals(layout);
    }
  }

  function swapMainGalleryImage(nextSrc) {
    const mainImg = document.getElementById("detail-main-img");
    const thumbsWrap = document.getElementById("detail-thumbs-wrap");
    if (!mainImg || !nextSrc || mainImg.getAttribute("src") === nextSrc) return;

    if (thumbsWrap) {
      thumbsWrap.querySelectorAll(".thumb-item").forEach((t) => {
        const isMatch = t.getAttribute("data-img") === nextSrc;
        t.classList.toggle("active", isMatch);
        t.setAttribute("aria-pressed", isMatch ? "true" : "false");
      });
    }

    if (UI.shouldReduceMotion && UI.shouldReduceMotion()) {
      mainImg.src = nextSrc;
    } else {
      mainImg.classList.add("img-swapping");
      setTimeout(() => {
        mainImg.src = nextSrc;
        requestAnimationFrame(() => {
          mainImg.classList.remove("img-swapping");
        });
      }, 85);
    }
  }

  function getCareInstruction(product) {
    const mat = Storage.normalizeText(product.material || "");
    if (product.category === "phu-kien" || mat.includes("da") || mat.includes("pu") || mat.includes("kim loai") || mat.includes("canvas")) {
      return "Lau nhẹ bề mặt bằng khăn ẩm mềm, tránh ngâm nước hoặc giặt máy, bảo quản nơi khô thoáng.";
    }
    if (mat.includes("denim") || mat.includes("jean") || mat.includes("wash")) {
      return "Giặt riêng ở 1–2 lần đầu với nước lạnh, lộn trái sản phẩm và phơi bóng râm để giữ hiệu ứng wash bền màu.";
    }
    if (product.category === "ao-khoac" || mat.includes("du") || mat.includes("nylon") || mat.includes("parachute")) {
      return "Giặt tay hoặc giặt máy chế độ nhẹ trong túi giặt, kéo kín khóa kéo, không ủi trực tiếp ở nhiệt độ cao.";
    }
    return "Giặt nhẹ dưới 30°C, lộn trái khi giặt, không dùng thuốc tẩy mạnh và không sấy nhiệt cao để giữ phom đứng chuẩn.";
  }

  function renderProductDetail() {
    const p = currentProduct;

    // Cập nhật thẻ meta title
    document.title = `${p.name} | HK Store`;

    // Cập nhật Breadcrumb
    const breadcrumbTitle = document.getElementById("breadcrumb-product-name");
    const breadcrumbCat = document.getElementById("breadcrumb-category-link");
    if (breadcrumbTitle) breadcrumbTitle.textContent = p.name;
    if (breadcrumbCat) {
      breadcrumbCat.textContent = p.categoryName;
      breadcrumbCat.href = `products.html?category=${p.category}`;
    }

    // Gallery ảnh
    const mainImg = document.getElementById("detail-main-img");
    const thumbsWrap = document.getElementById("detail-thumbs-wrap");
    const images = p.images && p.images.length > 0 ? p.images : ["assets/images/placeholder.svg"];

    if (mainImg) {
      mainImg.src = images[0];
      mainImg.alt = p.name;
    }

    if (thumbsWrap) {
      thumbsWrap.innerHTML = images
        .map(
          (img, idx) => `
        <button type="button" class="thumb-item ${idx === 0 ? "active" : ""}" data-img="${img}" aria-label="Xem ảnh ${idx + 1}" aria-pressed="${idx === 0 ? "true" : "false"}">
          <img src="${img}" alt="${Storage.escapeHTML(p.name)} - Ảnh ${idx + 1}" onerror="this.src='assets/images/placeholder.svg'" />
        </button>`
        )
        .join("");

      thumbsWrap.querySelectorAll(".thumb-item").forEach((thumb) => {
        thumb.addEventListener("click", () => {
          const nextSrc = thumb.getAttribute("data-img");
          if (thumb.classList.contains("active")) return;
          swapMainGalleryImage(nextSrc);
        });
      });
    }

    // Lightbox phóng to ảnh chi tiết sản phẩm
    const mainImgWrap = document.getElementById("detail-main-img-wrap");
    if (mainImgWrap) {
      mainImgWrap.addEventListener("click", () => {
        if (!mainImg) return;
        UI.showModal({
          title: p.name,
          content: `<img src="${mainImg.src}" alt="${Storage.escapeHTML(p.name)}" class="hk-lightbox-img" onerror="this.src='assets/images/placeholder.svg'" />`,
          showFooter: false,
          extraClass: "hk-lightbox-modal"
        });
      });
    }

    // Thông tin cơ bản
    const titleEl = document.getElementById("detail-title");
    const priceEl = document.getElementById("detail-price");
    const originalPriceEl = document.getElementById("detail-price-original");
    const descEl = document.getElementById("detail-desc");
    const materialEl = document.getElementById("detail-material");
    const fitEl = document.getElementById("detail-fit");
    const careEl = document.getElementById("detail-care");
    const ratingEl = document.getElementById("detail-rating");

    if (titleEl) titleEl.textContent = p.name;
    if (priceEl) {
      priceEl.setAttribute("data-counter", p.price);
      UI.animateNumberCounter(priceEl, p.price, 850);
    }
    if (originalPriceEl) {
      if (p.originalPrice && p.originalPrice > p.price) {
        originalPriceEl.textContent = Storage.formatCurrency(p.originalPrice);
        originalPriceEl.style.display = "inline";
      } else {
        originalPriceEl.style.display = "none";
      }
    }
    if (descEl) descEl.textContent = p.description;
    if (materialEl) materialEl.textContent = p.material || "100% Cotton cao cấp";
    if (fitEl) fitEl.textContent = p.fit || "Standard Oversize";
    if (careEl) careEl.textContent = getCareInstruction(p);
    if (ratingEl) {
      ratingEl.innerHTML = `<span class="star" aria-hidden="true">★</span> ${p.rating || "5.0"} <span class="text-muted">(${p.reviewCount || 0} đánh giá)</span>`;
    }

    // Thiết lập Biến thể (Size & Màu sắc)
    setupVariantPickers();

    // Quantity Counter
    setupQuantityControl();

    // Nút Thêm vào giỏ & Mua ngay
    setupActionButtons();

    // Link hướng dẫn chọn size
    const sizeGuideLink = document.getElementById("btn-size-guide");
    if (sizeGuideLink) {
      sizeGuideLink.addEventListener("click", (e) => {
        e.preventDefault();
        UI.showPolicyModal("guide");
      });
    }

    // Tích hợp Công cụ gợi ý Size thông minh & Thanh Mua nhanh dính đáy (nếu bật trong HK_FEATURE_FLAGS)
    if (HKStore.Features) {
      if (HKStore.Features.mountProductSizeAdvisor) {
        HKStore.Features.mountProductSizeAdvisor(p, (recommendedSz) => {
          const btn = document.querySelector(`.js-size-btn[data-size="${recommendedSz}"]`);
          if (btn) btn.click();
        });
      }
      if (HKStore.Features.mountProductStickyBar) {
        stickyBarRef = HKStore.Features.mountProductStickyBar(p, () => ({
          size: selectedSize,
          color: selectedColor
        }));
      }
    }
  }

  // Khởi tạo các nút chọn Size và Màu
  function setupVariantPickers() {
    const p = currentProduct;
    const variants = p.variants || [];

    // Lấy danh sách size và màu duy nhất
    const sizeSet = new Set();
    const colorMap = new Map(); // colorName -> colorCode

    variants.forEach((v) => {
      sizeSet.add(v.size);
      if (!colorMap.has(v.colorName)) {
        colorMap.set(v.colorName, v.colorCode || "#111111");
      }
    });

    const sizes = Array.from(sizeSet);
    const colors = Array.from(colorMap.entries()).map(([name, code]) => ({ name, code }));

    // Mặc định chọn biến thể đầu tiên còn hàng
    const firstInStockVariant = variants.find((v) => Number(v.stock) > 0) || variants[0];
    if (firstInStockVariant) {
      selectedSize = firstInStockVariant.size;
      selectedColor = firstInStockVariant.colorName;
    }

    // Render Size Pickers
    const sizeContainer = document.getElementById("size-picker-container");
    if (sizeContainer) {
      sizeContainer.innerHTML = sizes
        .map(
          (s) => `<button type="button" class="variant-btn js-size-btn ${s === selectedSize ? "active" : ""}" data-size="${s}">${s}</button>`
        )
        .join("");

      sizeContainer.querySelectorAll(".js-size-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          sizeContainer.querySelectorAll(".js-size-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedSize = btn.getAttribute("data-size");
          updateVariantStockStatus();
        });
      });
    }

    // Render Color Pickers
    const colorContainer = document.getElementById("color-picker-container");
    if (colorContainer) {
      colorContainer.innerHTML = colors
        .map(
          (c, cIdx) => `
        <button type="button" class="variant-btn js-color-btn ${c.name === selectedColor ? "active" : ""}" data-color="${Storage.escapeHTML(c.name)}" data-color-idx="${cIdx}">
          <span class="color-swatch-circle" style="background-color: ${Storage.escapeHTML(c.code)};"></span>
          ${Storage.escapeHTML(c.name)}
        </button>`
        )
        .join("");

      colorContainer.querySelectorAll(".js-color-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          colorContainer.querySelectorAll(".js-color-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedColor = btn.getAttribute("data-color");

          const cIdx = Number(btn.getAttribute("data-color-idx")) || 0;
          if (Array.isArray(p.images) && p.images[cIdx]) {
            swapMainGalleryImage(p.images[cIdx]);
          }
          updateVariantStockStatus();
        });
      });
    }

    updateVariantStockStatus();
  }

  // Kiểm tra tồn kho của tổ hợp Size + Màu đang chọn & đánh dấu biến thể tạm hết
  function updateVariantStockStatus() {
    const p = currentProduct;
    const variants = p.variants || [];

    // Đánh dấu chéo các nút Size / Màu không còn tồn kho với lựa chọn hiện tại
    document.querySelectorAll(".js-size-btn").forEach((btn) => {
      const sz = btn.getAttribute("data-size");
      const v = variants.find((item) => item.size === sz && item.colorName === selectedColor);
      const out = !v || (Number(v.stock) || 0) <= 0;
      btn.classList.toggle("is-unavailable", out);
    });

    document.querySelectorAll(".js-color-btn").forEach((btn) => {
      const cl = btn.getAttribute("data-color");
      const v = variants.find((item) => item.size === selectedSize && item.colorName === cl);
      const out = !v || (Number(v.stock) || 0) <= 0;
      btn.classList.toggle("is-unavailable", out);
    });

    const matchedVariant = variants.find(
      (v) => v.size === selectedSize && v.colorName === selectedColor
    );

    const stockIndicator = document.getElementById("variant-stock-indicator");
    const addCartBtn = document.getElementById("btn-add-to-cart");
    const buyNowBtn = document.getElementById("btn-buy-now");
    const qtyInput = document.getElementById("input-qty");

    if (!matchedVariant) {
      if (stockIndicator) {
        stockIndicator.textContent = "Tổ hợp size và màu này hiện không có sẵn.";
        stockIndicator.className = "stock-indicator text-danger";
      }
      if (addCartBtn) addCartBtn.disabled = true;
      if (buyNowBtn) buyNowBtn.disabled = true;
      if (stickyBarRef) stickyBarRef.sync();
      return null;
    }

    const stock = Number(matchedVariant.stock) || 0;
    if (stock > 0 && currentQuantity > stock) {
      currentQuantity = stock;
      if (qtyInput) qtyInput.value = stock;
    }

    if (stock <= 0) {
      if (stockIndicator) {
        stockIndicator.textContent = "Hết hàng (Vui lòng chọn size hoặc màu khác)";
        stockIndicator.className = "stock-indicator text-danger";
      }
      if (addCartBtn) addCartBtn.disabled = true;
      if (buyNowBtn) buyNowBtn.disabled = true;
    } else if (stock <= 5) {
      if (stockIndicator) {
        stockIndicator.textContent = `Chỉ còn ${stock} sản phẩm trong kho (Sắp hết)`;
        stockIndicator.className = "stock-indicator text-warning";
      }
      if (addCartBtn) addCartBtn.disabled = false;
      if (buyNowBtn) buyNowBtn.disabled = false;
    } else {
      if (stockIndicator) {
        stockIndicator.textContent = `Còn hàng (${stock} sản phẩm có sẵn)`;
        stockIndicator.className = "stock-indicator text-success";
      }
      if (addCartBtn) addCartBtn.disabled = false;
      if (buyNowBtn) buyNowBtn.disabled = false;
    }

    if (stickyBarRef) stickyBarRef.sync();
    return matchedVariant;
  }

  // Điều khiển số lượng
  function setupQuantityControl() {
    const minusBtn = document.getElementById("btn-qty-minus");
    const plusBtn = document.getElementById("btn-qty-plus");
    const input = document.getElementById("input-qty");

    if (!input) return;

    if (minusBtn) {
      minusBtn.addEventListener("click", () => {
        let val = parseInt(input.value, 10) || 1;
        if (val > 1) {
          val--;
          input.value = val;
          currentQuantity = val;
        }
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener("click", () => {
        const variant = updateVariantStockStatus();
        const maxStock = variant ? Number(variant.stock) || 0 : 99;
        let val = parseInt(input.value, 10) || 1;
        if (val < maxStock) {
          val++;
          input.value = val;
          currentQuantity = val;
        } else {
          UI.showToast(`Bạn chỉ có thể đặt tối đa ${maxStock} sản phẩm`, "info");
        }
      });
    }

    input.addEventListener("change", () => {
      const variant = updateVariantStockStatus();
      const maxStock = variant ? Number(variant.stock) || 0 : 99;
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > maxStock) val = maxStock;
      input.value = val;
      currentQuantity = val;
    });
  }

  // Xử lý nút Thêm vào giỏ, Mua ngay & Yêu thích
  function setupActionButtons() {
    const addCartBtn = document.getElementById("btn-add-to-cart");
    const buyNowBtn = document.getElementById("btn-buy-now");
    const actionsWrap = document.querySelector(".detail-actions");

    // Gắn nút Lưu Yêu thích bên cạnh nút Mua nếu tính năng wishlist đang bật
    if (
      actionsWrap &&
      HKStore.Features &&
      (!window.HK_FEATURE_FLAGS || window.HK_FEATURE_FLAGS.wishlist !== false) &&
      !actionsWrap.querySelector(".detail-wishlist-btn")
    ) {
      const saved = HKStore.Features.isWishlisted(currentProduct.id);
      const wishBtn = document.createElement("button");
      wishBtn.type = "button";
      wishBtn.className = `btn detail-wishlist-btn js-toggle-wishlist ${saved ? "is-active" : ""}`;
      wishBtn.setAttribute("data-product-id", currentProduct.id);
      wishBtn.setAttribute("aria-label", saved ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích");
      wishBtn.setAttribute("aria-pressed", saved ? "true" : "false");
      wishBtn.title = "Lưu vào danh sách yêu thích";
      wishBtn.innerHTML = `<svg style="width: 22px; height: 22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      actionsWrap.appendChild(wishBtn);
    }

    if (addCartBtn) {
      addCartBtn.addEventListener("click", () => {
        const variant = updateVariantStockStatus();
        if (!variant || Number(variant.stock) <= 0) {
          UI.showToast("Biến thể này hiện đã hết hàng.", "error");
          return;
        }

        const res = Cart.addToCart(currentProduct.id, variant.id, currentQuantity);
        if (res.success) {
          if (
            HKStore.Features &&
            HKStore.Features.openMiniCart &&
            (!window.HK_FEATURE_FLAGS || window.HK_FEATURE_FLAGS.miniCartDrawer !== false)
          ) {
            HKStore.Features.openMiniCart();
          } else {
            UI.showToast(res.message, "success");
          }
        } else {
          UI.showToast(res.message, "error");
        }
      });
    }

    if (buyNowBtn) {
      buyNowBtn.addEventListener("click", () => {
        const variant = updateVariantStockStatus();
        if (!variant || Number(variant.stock) <= 0) {
          UI.showToast("Biến thể này hiện đã hết hàng.", "error");
          return;
        }

        const res = Cart.addToCart(currentProduct.id, variant.id, currentQuantity);
        if (res.success) {
          window.location.href = "checkout.html";
        } else {
          UI.showToast(res.message, "error");
        }
      });
    }
  }

  // Đánh giá thực tế từ khách hàng & Cảm nhận phom dáng (Hỗ trợ lưu thêm đánh giá mới vào localStorage)
  function getSeededReviewsForProduct(p) {
    if (p.category === "phu-kien") {
      return [
        {
          author: "Minh Khôi",
          rating: 5,
          fitSpec: "Đã mua: One size",
          fitFeel: "Hoàn thiện chắc chắn",
          date: "14/10/2026",
          comment: "Chất liệu dày dặn, đường may và khóa kim loại rất sắc nét. Phối cùng áo thun boxy và quần cargo cực hợp."
        },
        {
          author: "Thu Hà",
          rating: 5,
          fitSpec: "Đã mua: One size",
          fitFeel: "Dễ điều chỉnh kích cỡ",
          date: "02/10/2026",
          comment: "Đóng gói chỉn chu, lên phom cứng cáp đúng chất tối giản của HK Store, dùng đi học hay đi chơi đều tiện."
        }
      ];
    }

    if (p.category === "quan") {
      return [
        {
          author: "Hoàng Nam",
          rating: 5,
          fitSpec: "1m75 · 68kg · Size L",
          fitFeel: "Chuẩn phom ống rộng",
          date: "18/10/2026",
          comment: "Ống quần suông đứng dáng, phủ nhẹ lên giày sneaker rất đẹp. Lưng quần thoải mái, vải dày không bị nhăn nhàu."
        },
        {
          author: "Gia Bảo",
          rating: 5,
          fitSpec: "1m68 · 59kg · Size M",
          fitFeel: "Chuẩn bảng size",
          date: "06/10/2026",
          comment: "Mình chọn theo công cụ gợi ý size trên web là vừa in. Đường chỉ tỉ mỉ, túi hộp sâu đựng đồ thoải mái."
        }
      ];
    }

    return [
      {
        author: "Quốc Anh",
        rating: 5,
        fitSpec: "1m74 · 66kg · Size L",
        fitFeel: "Chuẩn phom Boxy Oversize",
        date: "20/10/2026",
        comment: "Vải định lượng cao cầm nặng tay, cổ bo dày không bị bai dão sau khi giặt. Mặc lên rũ vai đúng chất streetwear."
      },
      {
        author: "Khánh Linh",
        rating: 5,
        fitSpec: "1m62 · 50kg · Size S",
        fitFeel: "Rộng thoải mái",
        date: "09/10/2026",
        comment: "Màu thực tế trầm đẹp y hình, đường may giấu chỉ gọn gàng. Mình thích mặc trùm nhẹ nên chọn S rất ưng ý."
      }
    ];
  }

  function renderProductReviews() {
    const section = document.getElementById("product-reviews-section");
    if (!section || !currentProduct) return;

    const p = currentProduct;
    const REVIEWS_KEY = "hkstore_v1_reviews";
    const allStored = Storage.get(REVIEWS_KEY, {});
    const userReviews = Array.isArray(allStored[p.id]) ? allStored[p.id] : [];
    const seededReviews = getSeededReviewsForProduct(p);
    const combinedReviews = [...userReviews, ...seededReviews];

    const baseCount = Number(p.reviewCount) || seededReviews.length;
    const totalDisplayCount = baseCount + userReviews.length;
    const baseRating = Number(p.rating) || 4.9;
    const avgRating =
      userReviews.length > 0
        ? (
            (baseRating * baseCount + userReviews.reduce((s, r) => s + (Number(r.rating) || 5), 0)) /
            totalDisplayCount
          ).toFixed(1)
        : baseRating.toFixed(1);

    const ratingHeaderEl = document.getElementById("detail-rating");
    if (ratingHeaderEl) {
      ratingHeaderEl.innerHTML = `<span class="star" aria-hidden="true">★</span> ${avgRating} <span class="text-muted">(${totalDisplayCount} đánh giá)</span>`;
    }

    const loggedUser = HKStore.Auth && HKStore.Auth.getCurrentUser ? HKStore.Auth.getCurrentUser() : null;
    const defaultAuthor = loggedUser ? loggedUser.fullName : "";

    const renderStars = (n) => "★".repeat(Math.max(1, Math.min(5, Number(n) || 5)));

    section.innerHTML = `
      <div class="section-header">
        <div>
          <span class="section-subtitle">Trải nghiệm thực tế</span>
          <h2 class="section-title">ĐÁNH GIÁ &amp; CẢM NHẬN PHOM DÁNG</h2>
        </div>
      </div>

      <div class="reviews-layout">
        <aside class="reviews-summary-card">
          <div class="reviews-avg-row">
            <span class="reviews-avg-num">${avgRating}</span>
            <div>
              <div style="color: var(--color-primary); font-size: 1rem; letter-spacing: 2px;" aria-hidden="true">★★★★★</div>
              <span class="text-muted" style="font-size: 0.82rem;">Dựa trên ${totalDisplayCount} lượt đánh giá</span>
            </div>
          </div>

          <div class="reviews-fit-meter">
            <div style="display: flex; justify-content: space-between; font-weight: 700;">
              <span>Độ chuẩn phom Streetwear</span>
              <span class="tabular-nums">94%</span>
            </div>
            <div class="fit-meter-bar" aria-hidden="true">
              <div class="fit-meter-fill" style="width: 94%;"></div>
            </div>
            <p class="text-muted" style="font-size: 0.78rem; line-height: 1.5; margin-top: 2px;">
              Chọn đúng size thường mặc để lên dáng rộng thoải mái, hoặc lùi 1 size nếu thích mặc vừa gọn người.
            </p>
          </div>
        </aside>

        <div>
          <div class="reviews-list">
            ${combinedReviews
              .map(
                (rev) => `
              <article class="review-card">
                <div class="review-card-head">
                  <div>
                    <strong style="font-size: 0.92rem;">${Storage.escapeHTML(rev.author)}</strong>
                    <span style="margin-left: 8px; font-size: 0.85rem; letter-spacing: 1px;" aria-label="${rev.rating} trên 5 sao">${renderStars(rev.rating)}</span>
                  </div>
                  <span class="text-muted tabular-nums" style="font-size: 0.78rem;">${Storage.escapeHTML(rev.date)}</span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                  ${rev.fitSpec ? `<span class="review-fit-tag">${Storage.escapeHTML(rev.fitSpec)}</span>` : ""}
                  ${rev.fitFeel ? `<span class="review-fit-tag">${Storage.escapeHTML(rev.fitFeel)}</span>` : ""}
                </div>
                <p style="font-size: 0.88rem; line-height: 1.6; color: var(--color-primary);">${Storage.escapeHTML(rev.comment)}</p>
              </article>
            `
              )
              .join("")}
          </div>

          <div class="review-form-box">
            <h3 style="font-size: 1rem; font-weight: 800; letter-spacing: 0; margin-bottom: 12px;">Gửi nhận xét của bạn</h3>
            <form id="product-review-form" novalidate>
              <div class="form-row-2col">
                <div class="form-group">
                  <label class="form-label" for="rev-author">Tên hiển thị <span class="required">*</span></label>
                  <input type="text" id="rev-author" class="form-control" value="${Storage.escapeHTML(defaultAuthor)}" placeholder="Nguyễn Văn A" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="rev-rating">Mức độ hài lòng</label>
                  <select id="rev-rating" class="form-control">
                    <option value="5">5 sao - Rất hài lòng</option>
                    <option value="4">4 sao - Tốt</option>
                    <option value="3">3 sao - Bình thường</option>
                    <option value="2">2 sao - Chưa ưng ý</option>
                    <option value="1">1 sao - Kém</option>
                  </select>
                </div>
              </div>

              <div class="form-row-2col">
                <div class="form-group">
                  <label class="form-label" for="rev-fit-spec">Chiều cao / Cân nặng &amp; Size đã chọn</label>
                  <input type="text" id="rev-fit-spec" class="form-control" placeholder="VD: 1m72 · 64kg · Size L" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="rev-fit-feel">Cảm nhận phom dáng</label>
                  <select id="rev-fit-feel" class="form-control">
                    <option value="Chuẩn phom Oversize">Chuẩn phom Oversize</option>
                    <option value="Vừa vặn thoải mái">Vừa vặn thoải mái</option>
                    <option value="Hơi rộng so với bảng size">Hơi rộng so với bảng size</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="rev-comment">Chia sẻ chất liệu &amp; trải nghiệm mặc thực tế <span class="required">*</span></label>
                <textarea id="rev-comment" class="form-control" rows="3" placeholder="Chất vải, đường may, độ đứng phom khi mặc..." required></textarea>
              </div>

              <button type="submit" class="btn btn-primary btn-sm">Gửi đánh giá</button>
            </form>
          </div>
        </div>
      </div>
    `;

    const revForm = document.getElementById("product-review-form");
    if (revForm) {
      revForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const authorEl = document.getElementById("rev-author");
        const commentEl = document.getElementById("rev-comment");
        const ratingVal = Number(document.getElementById("rev-rating").value) || 5;
        const fitSpecVal = document.getElementById("rev-fit-spec").value.trim();
        const fitFeelVal = document.getElementById("rev-fit-feel").value;

        [authorEl, commentEl].forEach((el) => UI.clearFieldError && UI.clearFieldError(el));

        let invalidEl = null;
        if (!authorEl.value.trim()) {
          UI.setFieldError(authorEl, "Vui lòng nhập tên hiển thị của bạn.");
          invalidEl = invalidEl || authorEl;
        }
        if (!commentEl.value.trim() || commentEl.value.trim().length < 6) {
          UI.setFieldError(commentEl, "Vui lòng nhập nội dung nhận xét (tối thiểu 6 ký tự).");
          invalidEl = invalidEl || commentEl;
        }
        if (invalidEl) {
          invalidEl.focus();
          return;
        }

        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();

        const latestMap = Storage.get(REVIEWS_KEY, {});
        if (!Array.isArray(latestMap[p.id])) latestMap[p.id] = [];
        latestMap[p.id].unshift({
          author: authorEl.value.trim(),
          rating: ratingVal,
          fitSpec: fitSpecVal || (selectedSize ? `Đã chọn Size ${selectedSize}` : ""),
          fitFeel: fitFeelVal,
          date: `${dd}/${mm}/${yyyy}`,
          comment: commentEl.value.trim()
        });
        Storage.set(REVIEWS_KEY, latestMap);

        UI.showToast("Cảm ơn bạn đã chia sẻ đánh giá thực tế!", "success");
        renderProductReviews();
      });
    }
  }

  // Sản phẩm liên quan cùng danh mục
  function renderRelatedProducts() {
    const container = document.getElementById("related-products-grid");
    if (!container) return;

    const all = Products.getAll(false);
    const related = all
      .filter((p) => p.category === currentProduct.category && p.id !== currentProduct.id)
      .slice(0, 4);

    if (related.length === 0) {
      container.parentElement.style.display = "none";
      return;
    }

    container.innerHTML = related.map((p) => UI.renderProductCard(p)).join("");

    UI.initNumberCounters(container);
    UI.initScrollReveals(container);
  }

  document.addEventListener("DOMContentLoaded", initProductPage);
})();

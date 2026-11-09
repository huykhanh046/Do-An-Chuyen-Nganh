/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang chủ (Home Page)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Products = HKStore.Products;
  const UI = HKStore.UI;

  function initHomePage() {
    UI.initCommonUI("home");

    initHeroScrollAnimation();
    renderNewArrivals();
    renderLookbook();
    renderBestSellers();
  }

  // Hiệu ứng Animation thu phóng nhẹ & lướt theo nhịp cuộn trang bằng nội suy quán tính (Smooth Lerp 60fps)
  function initHeroScrollAnimation() {
    const heroBanner = document.querySelector(".hero-banner");
    const heroImg = document.querySelector(".hero-banner-img");
    if (!heroBanner || !heroImg) return;

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let targetScroll = window.scrollY || window.pageYOffset || 0;
    let currentScroll = targetScroll;
    let rafId = null;

    // Hiệu ứng thu phóng nhẹ khi vừa mở trang (từ 1.035 về 1.0)
    let introScaleOffset = 0.035;

    function animateFrame() {
      // Nội suy mượt (Lerp damping) tạo cảm giác lướt êm theo nhịp tay cuộn
      const diff = targetScroll - currentScroll;
      currentScroll += diff * 0.085;

      // Giảm dần độ thu phóng mở màn về 0 một cách mượt mà
      if (introScaleOffset > 0.0002) {
        introScaleOffset *= 0.94;
      } else {
        introScaleOffset = 0;
      }

      const bannerHeight = heroBanner.offsetHeight || 660;
      const clampedScroll = Math.max(0, Math.min(currentScroll, bannerHeight * 1.4));
      const progress = Math.min(clampedScroll / bannerHeight, 1);

      // Dịch chuyển lướt nhẹ theo chiều dọc (Parallax êm) + Thu phóng nhẹ nhàng (1.0 -> 1.055)
      const translateY = clampedScroll * 0.16;
      const scale = 1 + progress * 0.055 + introScaleOffset;

      heroImg.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;

      if (Math.abs(diff) > 0.15 || introScaleOffset > 0) {
        rafId = window.requestAnimationFrame(animateFrame);
      } else {
        currentScroll = targetScroll;
        rafId = null;
      }
    }

    function onScroll() {
      targetScroll = window.scrollY || window.pageYOffset || 0;
      if (!rafId) {
        rafId = window.requestAnimationFrame(animateFrame);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    // Khởi chạy nhịp mở màn ngay khi tải trang
    rafId = window.requestAnimationFrame(animateFrame);
  }

  // Render thẻ sản phẩm HTML (Sử dụng chuẩn Design DNA dùng chung từ UI.renderProductCard)
  function renderProductCardHTML(product) {
    return UI.renderProductCard(product);
  }

  // Sản phẩm mới nhất (New Arrivals)
  function renderNewArrivals() {
    const container = document.getElementById("new-arrivals-grid");
    if (!container) return;

    const res = Products.filterAndSort({
      sortBy: "newest",
      pageSize: 4
    });

    if (res.items.length === 0) {
      container.innerHTML = `<p class="text-muted">Chưa có sản phẩm mới nào.</p>`;
      return;
    }

    container.innerHTML = res.items.map(renderProductCardHTML).join("");
    UI.initNumberCounters(container);
    UI.initScrollReveals(container);
  }

  // Sản phẩm bán chạy (Best Sellers)
  function renderBestSellers() {
    const container = document.getElementById("best-sellers-grid");
    if (!container) return;

    const all = Products.getAll(false);
    // Ưu tiên sản phẩm có badge Bán chạy, sau đó theo rating
    const bestSellers = all
      .filter((p) => p.badge === "Bán chạy" || p.rating >= 4.8)
      .slice(0, 4);

    if (bestSellers.length === 0) {
      container.innerHTML = `<p class="text-muted">Đang cập nhật sản phẩm bán chạy.</p>`;
      return;
    }

    container.innerHTML = bestSellers.map(renderProductCardHTML).join("");
    UI.initNumberCounters(container);
    UI.initScrollReveals(container);
  }

  // Gợi ý phối đồ Lookbook (Được chọn động từ các sản phẩm đang có sẵn trong kho)
  function renderLookbook() {
    const container = document.getElementById("lookbook-items-list");
    if (!container) return;

    const all = Products.getAll(false);
    if (all.length === 0) {
      container.innerHTML = `<p class="text-muted" style="padding: 12px 0;">Chưa có sản phẩm nào trong cửa hàng.</p>`;
      return;
    }

    // Tự động tìm sản phẩm hợp lệ: 1 Áo (Áo thun/Hoodie/Áo khoác), 1 Quần, 1 Phụ kiện
    const topItem = all.find((p) => ["ao-thun", "hoodie-sweater", "ao-khoac"].includes(p.category)) || all[0];
    const bottomItem =
      all.find((p) => p.category === "quan" && p.id !== (topItem && topItem.id)) ||
      all.find((p) => p.id !== (topItem && topItem.id)) ||
      all[0];
    const accItem =
      all.find((p) => p.category === "phu-kien" && p.id !== (topItem && topItem.id) && p.id !== (bottomItem && bottomItem.id)) ||
      all.find((p) => p.id !== (topItem && topItem.id) && p.id !== (bottomItem && bottomItem.id)) ||
      all[0];

    const rawItems = [topItem, bottomItem, accItem].filter(Boolean);
    // Lọc trùng lặp phòng trường hợp kho có ít hơn 3 sản phẩm
    const selectedItems = [];
    const seenIds = new Set();
    for (const item of rawItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        selectedItems.push(item);
      }
    }

    container.innerHTML = selectedItems
      .map((p) => {
        const thumb = (Array.isArray(p.images) && p.images[0]) || "assets/images/placeholder.svg";
        const specText = [p.categoryName, p.fit || p.material].filter(Boolean).join(" · ");
        return `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="lookbook-item-row">
        <img src="${thumb}" alt="${Storage.escapeHTML(p.name)}" class="lookbook-item-thumb" loading="lazy" onerror="this.src='assets/images/placeholder.svg'" />
        <div class="lookbook-item-meta">
          <div class="lookbook-item-title">${Storage.escapeHTML(p.name)}</div>
          <div class="lookbook-item-spec">${Storage.escapeHTML(specText)}</div>
        </div>
        <span class="lookbook-item-arrow" aria-hidden="true">&rarr;</span>
      </a>
    `;
      })
      .join("");
    UI.initScrollReveals(container);
  }

  document.addEventListener("DOMContentLoaded", initHomePage);
})();

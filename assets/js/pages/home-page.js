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

  // Hiệu ứng Animation Parallax & Zoom mượt mà cho Banner khi lướt trang web (60fps)
  function initHeroScrollAnimation() {
    const heroBanner = document.querySelector(".hero-banner");
    const heroImg = document.querySelector(".hero-banner-img");
    if (!heroBanner || !heroImg) return;

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let ticking = false;

    function updateBannerOnScroll() {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const bannerHeight = heroBanner.offsetHeight || 680;

      if (scrollY <= bannerHeight * 1.25) {
        const progress = Math.min(Math.max(scrollY / bannerHeight, 0), 1);
        const translateY = (scrollY * 0.28).toFixed(2);
        const scale = (1 + progress * 0.09).toFixed(4);
        const brightness = (1 - progress * 0.18).toFixed(3);
        const sideInset = (progress * 18).toFixed(1);
        const radius = (progress * 10).toFixed(1);

        heroImg.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
        heroImg.style.filter = `brightness(${brightness})`;
        heroBanner.style.clipPath = `inset(0px ${sideInset}px 0px ${sideInset}px round 0px 0px ${radius}px ${radius}px)`;
      }

      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          window.requestAnimationFrame(updateBannerOnScroll);
          ticking = true;
        }
      },
      { passive: true }
    );

    updateBannerOnScroll();
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

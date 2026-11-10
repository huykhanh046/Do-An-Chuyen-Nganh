/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Danh sách Sản phẩm (Catalog & Filtering)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Products = HKStore.Products;
  const UI = HKStore.UI;

  // Trạng thái bộ lọc
  const filterState = {
    query: "",
    category: "all",
    priceMin: null,
    priceMax: null,
    sizes: [],
    colors: [],
    minRating: 0,
    inStockOnly: false,
    sortBy: "newest",
    page: 1,
    pageSize: 9
  };

  const CATEGORY_TITLES = {
    all: "TẤT CẢ SẢN PHẨM",
    "ao-thun": "ÁO THUN",
    "hoodie-sweater": "HOODIE & SWEATER",
    quan: "QUẦN CARGO & DENIM",
    "ao-khoac": "ÁO KHOÁC",
    "phu-kien": "PHỤ KIỆN"
  };

  let debounceTimer = null;

  function initProductsPage() {
    loadStateFromUrl();
    UI.initCommonUI(filterState.category !== "all" ? filterState.category : "products");
    syncInputsWithState();
    setupEventListeners();
    setupQuickCategoryPills();
    applyFilterAndRender();

    window.addEventListener("hkstore:cloud-sync", () => {
      applyFilterAndRender();
    });

    const recentSection = document.getElementById("hk-recently-viewed-catalog");
    if (recentSection && HKStore.Features && HKStore.Features.renderRecentlyViewedSection) {
      HKStore.Features.renderRecentlyViewedSection(recentSection, null);
    }
  }

  // Đọc tham số từ URL vào state
  function loadStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    if (params.has("q")) filterState.query = params.get("q") || "";
    if (params.has("category")) filterState.category = params.get("category") || "all";
    if (params.has("priceMin")) filterState.priceMin = Number(params.get("priceMin")) || null;
    if (params.has("priceMax")) filterState.priceMax = Number(params.get("priceMax")) || null;
    if (params.has("sort")) filterState.sortBy = params.get("sort") || "newest";
    if (params.has("page")) filterState.page = Number(params.get("page")) || 1;
    if (params.has("minRating")) filterState.minRating = Number(params.get("minRating")) || 0;
    if (params.has("inStock")) filterState.inStockOnly = params.get("inStock") === "true";

    if (params.has("sizes")) {
      const s = params.get("sizes");
      filterState.sizes = s ? s.split(",") : [];
    }

    if (params.has("colors")) {
      const c = params.get("colors");
      filterState.colors = c ? c.split(",") : [];
    }
  }

  // Cập nhật URL phản ánh trạng thái hiện tại (không reload trang)
  function syncStateToUrl() {
    const params = new URLSearchParams();

    if (filterState.query) params.set("q", filterState.query);
    if (filterState.category && filterState.category !== "all") params.set("category", filterState.category);
    if (filterState.priceMin !== null) params.set("priceMin", filterState.priceMin);
    if (filterState.priceMax !== null) params.set("priceMax", filterState.priceMax);
    if (filterState.sortBy !== "newest") params.set("sort", filterState.sortBy);
    if (filterState.page > 1) params.set("page", filterState.page);
    if (filterState.minRating > 0) params.set("minRating", filterState.minRating);
    if (filterState.inStockOnly) params.set("inStock", "true");
    if (filterState.sizes.length > 0) params.set("sizes", filterState.sizes.join(","));
    if (filterState.colors.length > 0) params.set("colors", filterState.colors.join(","));

    const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    window.history.replaceState({}, "", newUrl);
  }

  // Đồng bộ UI form với state
  function syncInputsWithState() {
    // Search input
    const searchInputs = document.querySelectorAll(".js-catalog-search");
    searchInputs.forEach((i) => (i.value = filterState.query));

    // Category radios
    const catRadios = document.querySelectorAll('input[name="filter-cat"]');
    catRadios.forEach((r) => {
      r.checked = r.value === filterState.category;
    });

    // Sort select
    const sortSelect = document.getElementById("catalog-sort");
    if (sortSelect) sortSelect.value = filterState.sortBy;

    // Price inputs
    const minInput = document.getElementById("price-min");
    const maxInput = document.getElementById("price-max");
    if (minInput) minInput.value = filterState.priceMin !== null ? filterState.priceMin : "";
    if (maxInput) maxInput.value = filterState.priceMax !== null ? filterState.priceMax : "";

    // Size checkboxes
    const sizeBoxes = document.querySelectorAll('input[name="filter-size"]');
    sizeBoxes.forEach((cb) => {
      cb.checked = filterState.sizes.includes(cb.value);
    });

    // Color checkboxes
    const colorBoxes = document.querySelectorAll('input[name="filter-color"]');
    colorBoxes.forEach((cb) => {
      cb.checked = filterState.colors.includes(cb.value);
    });

    // In stock
    const inStockBox = document.getElementById("filter-in-stock");
    if (inStockBox) inStockBox.checked = filterState.inStockOnly;

    // Rating
    const ratingSelect = document.getElementById("filter-rating");
    if (ratingSelect) ratingSelect.value = filterState.minRating;

    // Tự động mở nhóm thu gọn nếu đang có bộ lọc màu sắc hoặc đánh giá từ URL
    if (filterState.colors.length > 0) {
      const firstColor = document.querySelector('input[name="filter-color"]');
      const details = firstColor && firstColor.closest("details");
      if (details) details.open = true;
    }
    if (filterState.minRating > 0 && ratingSelect) {
      const details = ratingSelect.closest("details");
      if (details) details.open = true;
    }
  }

  // Đăng ký các sự kiện tương tác
  function setupEventListeners() {
    // Search với Debounce 300ms
    const searchInputs = document.querySelectorAll(".js-catalog-search");
    searchInputs.forEach((input) => {
      input.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          filterState.query = e.target.value.trim();
          filterState.page = 1;
          syncStateToUrl();
          applyFilterAndRender();
        }, 300);
      });
    });

    // Category Change
    const catRadios = document.querySelectorAll('input[name="filter-cat"]');
    catRadios.forEach((r) => {
      r.addEventListener("change", (e) => {
        filterState.category = e.target.value;
        filterState.page = 1;
        syncStateToUrl();
        applyFilterAndRender();
      });
    });

    // Sort Change
    const sortSelect = document.getElementById("catalog-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        filterState.sortBy = e.target.value;
        syncStateToUrl();
        applyFilterAndRender();
      });
    }

    // Price Range Filter Button & Enter Key
    const applyPriceBtn = document.getElementById("btn-apply-price");
    const minPriceInput = document.getElementById("price-min");
    const maxPriceInput = document.getElementById("price-max");

    const triggerPriceFilter = () => {
      const minVal = minPriceInput ? minPriceInput.value.trim() : "";
      const maxVal = maxPriceInput ? maxPriceInput.value.trim() : "";
      let pMin = minVal !== "" ? Math.max(0, Number(minVal)) : null;
      let pMax = maxVal !== "" ? Math.max(0, Number(maxVal)) : null;

      if (pMin !== null && isNaN(pMin)) pMin = null;
      if (pMax !== null && isNaN(pMax)) pMax = null;

      if (pMin !== null && pMax !== null && pMin > pMax) {
        const tmp = pMin;
        pMin = pMax;
        pMax = tmp;
        if (minPriceInput) minPriceInput.value = pMin;
        if (maxPriceInput) maxPriceInput.value = pMax;
        UI.showToast("Đã tự động sắp xếp lại khoảng giá Từ - Đến hợp lệ.", "info");
      }

      filterState.priceMin = pMin;
      filterState.priceMax = pMax;
      filterState.page = 1;
      syncStateToUrl();
      applyFilterAndRender();
    };

    if (applyPriceBtn) {
      applyPriceBtn.addEventListener("click", triggerPriceFilter);
    }
    [minPriceInput, maxPriceInput].forEach((inp) => {
      if (inp) {
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            triggerPriceFilter();
          }
        });
      }
    });

    // Sizes Change
    const sizeBoxes = document.querySelectorAll('input[name="filter-size"]');
    sizeBoxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        const checkedSizes = [];
        sizeBoxes.forEach((b) => {
          if (b.checked) checkedSizes.push(b.value);
        });
        filterState.sizes = checkedSizes;
        filterState.page = 1;
        syncStateToUrl();
        applyFilterAndRender();
      });
    });

    // Colors Change
    const colorBoxes = document.querySelectorAll('input[name="filter-color"]');
    colorBoxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        const checkedColors = [];
        colorBoxes.forEach((b) => {
          if (b.checked) checkedColors.push(b.value);
        });
        filterState.colors = checkedColors;
        filterState.page = 1;
        syncStateToUrl();
        applyFilterAndRender();
      });
    });

    // In Stock Change
    const inStockBox = document.getElementById("filter-in-stock");
    if (inStockBox) {
      inStockBox.addEventListener("change", (e) => {
        filterState.inStockOnly = e.target.checked;
        filterState.page = 1;
        syncStateToUrl();
        applyFilterAndRender();
      });
    }

    // Rating Change
    const ratingSelect = document.getElementById("filter-rating");
    if (ratingSelect) {
      ratingSelect.addEventListener("change", (e) => {
        filterState.minRating = Number(e.target.value);
        filterState.page = 1;
        syncStateToUrl();
        applyFilterAndRender();
      });
    }

    // Reset Filters Button
    const resetBtns = document.querySelectorAll(".js-reset-filters");
    resetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterState.query = "";
        filterState.category = "all";
        filterState.priceMin = null;
        filterState.priceMax = null;
        filterState.sizes = [];
        filterState.colors = [];
        filterState.minRating = 0;
        filterState.inStockOnly = false;
        filterState.sortBy = "newest";
        filterState.page = 1;

        syncInputsWithState();
        syncStateToUrl();
        applyFilterAndRender();
      });
    });

    // Tablet & Mobile Filter Drawer Toggle + Scrim Backdrop
    const toggleFilterBtn = document.getElementById("js-toggle-filter-drawer");
    const closeFilterBtn = document.getElementById("js-close-filter-drawer");
    const filterSidebar = document.getElementById("catalog-sidebar");
    const filterBackdrop = document.getElementById("js-filter-drawer-backdrop");

    const openFilterDrawer = () => {
      if (!filterSidebar) return;
      filterSidebar.classList.add("filter-drawer-open");
      if (filterBackdrop) {
        filterBackdrop.classList.add("is-open");
        filterBackdrop.setAttribute("aria-hidden", "false");
      }
      if (toggleFilterBtn) toggleFilterBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };

    const closeFilterDrawer = () => {
      if (!filterSidebar || !filterSidebar.classList.contains("filter-drawer-open")) return;
      filterSidebar.classList.remove("filter-drawer-open");
      if (filterBackdrop) {
        filterBackdrop.classList.remove("is-open");
        filterBackdrop.setAttribute("aria-hidden", "true");
      }
      if (toggleFilterBtn) toggleFilterBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    if (toggleFilterBtn && filterSidebar) {
      toggleFilterBtn.addEventListener("click", openFilterDrawer);
    }
    if (closeFilterBtn && filterSidebar) {
      closeFilterBtn.addEventListener("click", closeFilterDrawer);
    }
    if (filterBackdrop) {
      filterBackdrop.addEventListener("click", closeFilterDrawer);
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFilterDrawer();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 992) closeFilterDrawer();
    });
  }

  // Khởi tạo thanh chọn nhanh Danh mục (Quick Category Pills) phía trên lưới sản phẩm
  function setupQuickCategoryPills() {
    const container = document.getElementById("js-catalog-quick-pills");
    if (!container) return;

    container.querySelectorAll(".hk-cat-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const cat = pill.getAttribute("data-cat") || "all";
        filterState.category = cat;
        filterState.page = 1;
        syncInputsWithState();
        syncStateToUrl();
        applyFilterAndRender();
      });
    });
  }

  // Hiển thị các nhãn bộ lọc đang bật (Active Filter Chips) giúp khách hàng dễ kiểm soát & gỡ từng tiêu chí
  function renderActiveFilterChips() {
    const pillsWrap = document.getElementById("js-catalog-quick-pills");
    if (pillsWrap) {
      pillsWrap.querySelectorAll(".hk-cat-pill").forEach((p) => {
        const isActive = p.getAttribute("data-cat") === filterState.category;
        p.classList.toggle("active", isActive);
        p.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    const chipContainer = document.getElementById("js-active-filter-chips");
    if (!chipContainer) return;

    const chips = [];
    if (filterState.query) {
      chips.push({ label: `Từ khóa: "${filterState.query}"`, clear: () => (filterState.query = "") });
    }
    if (filterState.priceMin !== null || filterState.priceMax !== null) {
      const fromTxt = filterState.priceMin !== null ? Storage.formatCurrency(filterState.priceMin) : "0₫";
      const toTxt = filterState.priceMax !== null ? Storage.formatCurrency(filterState.priceMax) : "Trở lên";
      chips.push({
        label: `Giá: ${fromTxt} - ${toTxt}`,
        clear: () => {
          filterState.priceMin = null;
          filterState.priceMax = null;
        }
      });
    }
    filterState.sizes.forEach((sz) => {
      chips.push({
        label: `Size: ${sz}`,
        clear: () => {
          filterState.sizes = filterState.sizes.filter((s) => s !== sz);
        }
      });
    });
    filterState.colors.forEach((cl) => {
      chips.push({
        label: `Màu: ${cl}`,
        clear: () => {
          filterState.colors = filterState.colors.filter((c) => c !== cl);
        }
      });
    });
    if (filterState.minRating > 0) {
      chips.push({
        label: `Từ ${filterState.minRating}★`,
        clear: () => (filterState.minRating = 0)
      });
    }
    if (filterState.inStockOnly) {
      chips.push({
        label: "Còn hàng",
        clear: () => (filterState.inStockOnly = false)
      });
    }

    if (chips.length === 0) {
      chipContainer.innerHTML = "";
      return;
    }

    chipContainer.innerHTML = chips
      .map(
        (c, idx) => `
        <span class="hk-filter-chip">
          ${Storage.escapeHTML(c.label)}
          <button type="button" data-chip-idx="${idx}" aria-label="Gỡ bộ lọc ${Storage.escapeHTML(c.label)}">&times;</button>
        </span>`
      )
      .join("");

    chipContainer.querySelectorAll("button[data-chip-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-chip-idx"));
        if (chips[idx]) {
          chips[idx].clear();
          filterState.page = 1;
          syncInputsWithState();
          syncStateToUrl();
          applyFilterAndRender();
        }
      });
    });
  }

  // Thực hiện lọc và vẽ lại danh sách
  function applyFilterAndRender() {
    const result = Products.filterAndSort({
      category: filterState.category,
      priceMin: filterState.priceMin,
      priceMax: filterState.priceMax,
      sizes: filterState.sizes,
      colors: filterState.colors,
      minRating: filterState.minRating,
      inStockOnly: filterState.inStockOnly,
      query: filterState.query,
      sortBy: filterState.sortBy,
      page: filterState.page,
      pageSize: filterState.pageSize
    });

    renderCatalogHeading();
    renderActiveFilterChips();
    renderResultsCount(result.totalResults);
    renderProductsGrid(result.items);
    renderPagination(result);
  }

  function renderCatalogHeading() {
    const titleEl = document.getElementById("catalog-page-title");
    const crumbEl = document.getElementById("catalog-breadcrumb-current");
    const catTitle = CATEGORY_TITLES[filterState.category] || "TẤT CẢ SẢN PHẨM";

    if (titleEl) {
      titleEl.textContent =
        filterState.category === "all" && filterState.query
          ? `KẾT QUẢ CHO "${filterState.query.toUpperCase()}"`
          : catTitle;
    }
    if (crumbEl) {
      crumbEl.textContent =
        filterState.category === "all"
          ? "Tất cả sản phẩm"
          : catTitle.charAt(0) + catTitle.slice(1).toLowerCase();
    }
  }

  function renderResultsCount(count) {
    const el = document.getElementById("results-count-text");
    if (el) {
      el.textContent = `Hiển thị ${count} sản phẩm phù hợp`;
    }
  }

  function renderProductsGrid(items) {
    const grid = document.getElementById("catalog-products-grid");
    if (!grid) return;

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h2 style="font-size: 1.25rem; margin-bottom: 6px;">Không tìm thấy sản phẩm</h2>
          <p class="text-muted">Không có sản phẩm nào phù hợp với bộ lọc bạn đã chọn. Hãy thử tìm kiếm hoặc nới lỏng bộ lọc.</p>
          <button type="button" class="btn btn-secondary btn-sm js-reset-filters" style="margin-top: 16px;">Xóa bộ lọc</button>
        </div>
      `;
      // Gắn sự kiện cho nút xóa bộ lọc trong empty state
      grid.querySelector(".js-reset-filters").addEventListener("click", () => {
        const mainReset = document.querySelector(".js-reset-filters");
        if (mainReset) mainReset.click();
      });
      return;
    }

    grid.innerHTML = items.map((p) => UI.renderProductCard(p)).join("");

    UI.initNumberCounters(grid);
    UI.initScrollReveals(grid);
  }

  function renderPagination(result) {
    const container = document.getElementById("catalog-pagination");
    if (!container) return;

    if (result.totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    let html = `
      <button type="button" class="page-btn js-page-change" aria-label="Trang trước" data-page="${result.currentPage - 1}" ${
      result.currentPage === 1 ? "disabled" : ""
    }>&laquo;</button>
    `;

    for (let i = 1; i <= result.totalPages; i++) {
      const isCurrent = i === result.currentPage;
      html += `
        <button type="button" class="page-btn js-page-change ${isCurrent ? "active" : ""}" data-page="${i}" aria-label="Trang ${i}" ${
        isCurrent ? 'aria-current="page"' : ""
      }>
          ${i}
        </button>
      `;
    }

    html += `
      <button type="button" class="page-btn js-page-change" aria-label="Trang sau" data-page="${result.currentPage + 1}" ${
      result.currentPage === result.totalPages ? "disabled" : ""
    }>&raquo;</button>
    `;

    container.innerHTML = html;

    container.querySelectorAll(".js-page-change").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetPage = Number(btn.getAttribute("data-page"));
        if (targetPage >= 1 && targetPage <= result.totalPages) {
          filterState.page = targetPage;
          syncStateToUrl();
          applyFilterAndRender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initProductsPage);
})();

/**
 * HK STORE - STREETWEAR MINIMALIST
 * Giao diện Dùng chung (UI Components: Header, Footer, Toast, Modal, Drawer)
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;
  let activeModalElement = null;
  let previousActiveElement = null;
  let counterObserver = null;
  let revealObserver = null;
  let drawerCloseTimer = null;
  let tabSwitchTimer = null;
  let toastSeq = 0;

  // Đường cong lò xo chuẩn Animate UI cho Web Animations API (spring.highlight: stiffness 500, damping 40)
  const SPRING_HIGHLIGHT_EASING =
    "linear(0, 0.0461, 0.1513, 0.2802, 0.4113, 0.5325, 0.6383, 0.7266, 0.798, 0.8541, 0.8972, 0.9294, 0.953, 0.9699, 0.9817, 0.9897, 0.995, 0.9983, 1.0002, 1.0013, 1)";
  const SPRING_TOAST_EASING =
    "linear(0, 0.0739, 0.2382, 0.4295, 0.6097, 0.7598, 0.8734, 0.952, 1.0011, 1.0275, 1.0382, 1.0388, 1.034, 1.0268, 1.0193, 1.0126, 1.0073, 1.0035, 1.0009, 0.9994, 1)";

  const UI = {
    // Kiểm tra cài đặt giảm chuyển động của hệ điều hành (Animate UI Rule A1)
    shouldReduceMotion: function () {
      return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    },

    // Nạp phông chữ Google Fonts chuẩn Design DNA (Montserrat toàn diện) với fallback an toàn khi offline
    injectDesignDNAFonts: function () {
      if (document.getElementById("hk-design-dna-fonts")) return;
      const link = document.createElement("link");
      link.id = "hk-design-dna-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap";
      document.head.appendChild(link);
    },

    // Khởi tạo giao diện chung (Header, Footer, Toast Container, Event Listeners, Number Counters, Scroll Reveals, Fashion Features)
    initCommonUI: function (activeNavKey = "") {
      UI.injectDesignDNAFonts();
      UI.renderHeader(activeNavKey);
      UI.renderFooter();
      UI.initToastContainer();
      UI.setupGlobalEvents();
      if (HK.Cart && HK.Cart.updateBadge) {
        HK.Cart.updateBadge(false);
      }
      UI.initNumberCounters();
      UI.initScrollReveals();
      if (HK.Features && typeof HK.Features.init === "function") {
        HK.Features.init();
      }
    },

    // Animation đếm số (CountingNumber - spring.number: cuộn mượt không vượt lố, hỗ trợ trình đọc màn hình)
    animateNumberCounter: function (el, targetValue, duration = 950) {
      if (!el) return;
      const finalFormatted = Storage.formatCurrency(targetValue);

      if (UI.shouldReduceMotion() || document.visibilityState === "hidden") {
        el.textContent = finalFormatted;
        el.removeAttribute("aria-label");
        return;
      }

      // Đảm bảo trình đọc màn hình đọc giá cuối cùng thay vì các số đang chạy (recipes/page.md)
      el.setAttribute("aria-label", finalFormatted);

      const startTime = performance.now();
      const startVal = 0;

      function update(currentTime) {
        if (document.visibilityState === "hidden" || UI.shouldReduceMotion()) {
          el.textContent = finalFormatted;
          el.removeAttribute("aria-label");
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Đường cong tương đương spring.number (stiffness: 90, damping: 50 - không overshoot)
        const eased = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 4);
        const currentVal = Math.round(startVal + (targetValue - startVal) * eased);

        el.textContent = Storage.formatCurrency(currentVal);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = finalFormatted;
          el.removeAttribute("aria-label");
          el.classList.add("counter-finished");
        }
      }

      requestAnimationFrame(update);
    },

    // Theo dõi các phần tử giá tiền khi khách hàng cuộn/lướt tới (IntersectionObserver)
    initNumberCounters: function (root = document) {
      const elements = root.querySelectorAll("[data-counter]:not(.counter-observed)");
      if (!elements || elements.length === 0) return;

      if (!("IntersectionObserver" in window) || UI.shouldReduceMotion()) {
        elements.forEach((el) => {
          el.classList.add("counter-observed");
          const val = Number(el.getAttribute("data-counter")) || 0;
          el.textContent = Storage.formatCurrency(val);
        });
        return;
      }

      if (!counterObserver) {
        counterObserver = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const el = entry.target;
                obs.unobserve(el);
                const val = Number(el.getAttribute("data-counter"));
                if (!isNaN(val)) {
                  UI.animateNumberCounter(el, val);
                }
              }
            });
          },
          {
            rootMargin: "0px 0px -20px 0px",
            threshold: 0.1
          }
        );
      }

      elements.forEach((el) => {
        el.classList.add("counter-observed");
        const val = Number(el.getAttribute("data-counter")) || 0;
        el.setAttribute("aria-label", Storage.formatCurrency(val));
        el.textContent = Storage.formatCurrency(0);
        counterObserver.observe(el);
      });
    },

    // Hiệu ứng xuất hiện theo cuộn trang chuẩn Animate UI (recipes/page.md & Rule A17)
    initScrollReveals: function (root = document) {
      document.documentElement.classList.add("aui-ready");

      // Gắn tự động cho các khối nội dung (không bao giờ ẩn tiêu đề chính h1.hero-title lúc tải trang)
      const autoSelectors = [
        ".hero-actions",
        ".values-strip .value-item",
        ".categories-showcase .category-card",
        ".lookbook-image-wrap",
        ".lookbook-item-row",
        ".product-card",
        ".order-card",
        ".stat-card",
        ".auth-wrapper"
      ];

      const candidates = root.querySelectorAll(autoSelectors.join(", "));
      candidates.forEach((el) => {
        if (!el.classList.contains("aui-reveal")) {
          el.classList.add("aui-reveal");
          if (el.matches(".hero-actions")) {
            el.classList.add("aui-reveal--text");
          }
        }
      });

      const targets = root.querySelectorAll(".aui-reveal:not(.aui-observed)");
      if (!targets || targets.length === 0) return;

      const revealImmediately = (el, delayMs = 0) => {
        if (el.classList.contains("aui-revealed")) return;
        if (revealObserver) revealObserver.unobserve(el);
        el.style.setProperty("--aui-delay", `${delayMs}ms`);
        requestAnimationFrame(() => {
          el.classList.add("aui-revealed");
          const settleDelay = (UI.shouldReduceMotion() ? 320 : 620) + delayMs;
          setTimeout(() => {
            el.classList.add("aui-settled");
            el.style.removeProperty("--aui-delay");
          }, settleDelay);
        });
      };

      // Animate UI Rule A17: Nếu phần tử nhận focus từ bàn phím trước khi cuộn tới -> hiện ngay lập tức
      if (!UI._revealFocusBound) {
        UI._revealFocusBound = true;
        document.addEventListener(
          "focusin",
          (e) => {
            const unrevealed = e.target && e.target.closest ? e.target.closest(".aui-reveal:not(.aui-revealed)") : null;
            if (unrevealed) {
              revealImmediately(unrevealed, 0);
            }
          },
          true
        );
      }

      if (!("IntersectionObserver" in window)) {
        targets.forEach((el) => {
          el.classList.add("aui-observed", "aui-revealed", "aui-settled");
        });
        return;
      }

      if (!revealObserver) {
        revealObserver = new IntersectionObserver(
          (entries) => {
            // Stagger trong từng khung nhìn (within each view), không tính theo tổng danh sách (recipes/page.md)
            let batchIndex = 0;
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const delay = UI.shouldReduceMotion() ? 0 : Math.min(batchIndex * 65, 260);
                batchIndex++;
                revealImmediately(entry.target, delay);
              }
            });
          },
          {
            rootMargin: "0px 0px -30px 0px",
            threshold: 0.08
          }
        );
      }

      targets.forEach((el) => {
        el.classList.add("aui-observed");
        revealObserver.observe(el);
      });
    },

    // Bề mặt Highlight trượt mượt theo chuột & bàn phím trên thanh điều hướng (spring.highlight)
    initNavHighlight: function (headerContainer) {
      const navMenu = headerContainer.querySelector(".nav-menu");
      if (!navMenu) return;

      const highlight = document.createElement("span");
      highlight.className = "nav-highlight";
      highlight.setAttribute("aria-hidden", "true");
      navMenu.insertBefore(highlight, navMenu.firstChild);

      let currentAnim = null;
      let isVisible = false;

      const moveToLink = (link) => {
        if (!link) return;
        const menuRect = navMenu.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        const targetX = linkRect.left - menuRect.left;
        const targetY = linkRect.top - menuRect.top;
        const targetW = linkRect.width;
        const targetH = linkRect.height;

        if (!isVisible || UI.shouldReduceMotion() || !highlight.animate) {
          if (currentAnim) currentAnim.cancel();
          highlight.style.width = `${targetW}px`;
          highlight.style.height = `${targetH}px`;
          highlight.style.transform = `translate(${targetX}px, ${targetY}px)`;
          highlight.style.opacity = "1";
          isVisible = true;
          return;
        }

        const currentRect = highlight.getBoundingClientRect();
        const fromX = currentRect.left - menuRect.left;
        const fromY = currentRect.top - menuRect.top;
        const fromW = currentRect.width || targetW;
        const fromH = currentRect.height || targetH;

        if (currentAnim) currentAnim.cancel();
        highlight.style.width = `${targetW}px`;
        highlight.style.height = `${targetH}px`;
        highlight.style.transform = `translate(${targetX}px, ${targetY}px)`;
        highlight.style.opacity = "1";

        try {
          currentAnim = highlight.animate(
            [
              {
                transform: `translate(${fromX}px, ${fromY}px)`,
                width: `${fromW}px`,
                height: `${fromH}px`
              },
              {
                transform: `translate(${targetX}px, ${targetY}px)`,
                width: `${targetW}px`,
                height: `${targetH}px`
              }
            ],
            {
              duration: 300,
              easing: CSS.supports("transition-timing-function: linear(0, 1)")
                ? SPRING_HIGHLIGHT_EASING
                : "cubic-bezier(0.23, 1, 0.32, 1)"
            }
          );
        } catch (err) {
          // Fallback an toàn cho trình duyệt cũ
        }
      };

      const hideHighlight = () => {
        highlight.style.opacity = "0";
        isVisible = false;
      };

      const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)");
      navMenu.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("pointerenter", () => {
          if (!canHover || canHover.matches) moveToLink(link);
        });
        // Rule A2: Bàn phím tạo chuyển động giống hệt con trỏ chuột
        link.addEventListener("focus", () => moveToLink(link));
      });

      navMenu.addEventListener("pointerleave", hideHighlight);
      navMenu.addEventListener("focusout", (e) => {
        if (!navMenu.contains(e.relatedTarget)) hideHighlight();
      });
    },

    // Hiển thị Header đồng bộ trên các trang
    renderHeader: function (activeNavKey) {
      const headerContainer = document.getElementById("hk-header");
      if (!headerContainer) return;

      const user = HK.Auth ? HK.Auth.getCurrentUser() : null;
      const isAdmin = user && user.role === "admin";

      const navItems = [
        { key: "home", label: "Trang chủ", href: "index.html" },
        { key: "products", label: "Tất cả sản phẩm", href: "products.html" },
        { key: "ao-thun", label: "Áo thun", href: "products.html?category=ao-thun" },
        { key: "hoodie-sweater", label: "Hoodie & Sweater", href: "products.html?category=hoodie-sweater" },
        { key: "quan", label: "Quần", href: "products.html?category=quan" },
        { key: "ao-khoac", label: "Áo khoác", href: "products.html?category=ao-khoac" },
        { key: "phu-kien", label: "Phụ kiện", href: "products.html?category=phu-kien" }
      ];

      const navHtml = navItems
        .map(
          (item) => `
        <a href="${item.href}" class="nav-link ${activeNavKey === item.key ? "active" : ""}">
          ${item.label}
        </a>`
        )
        .join("");

      const userMenuHtml = user
        ? `
        <div class="user-dropdown">
          <a href="${isAdmin ? "admin.html" : "account.html"}" class="header-action-btn" title="Tài khoản">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span class="user-name-text">${Storage.escapeHTML(user.fullName.split(" ").pop())}</span>
          </a>
          <div class="dropdown-content">
            <div class="dropdown-header">
              <strong>${Storage.escapeHTML(user.fullName)}</strong>
              <small>${user.email}</small>
              ${isAdmin ? '<span class="badge badge-admin">Quản trị viên</span>' : ""}
            </div>
            ${
              isAdmin
                ? '<a href="admin.html" class="dropdown-item">Quản trị hệ thống</a>'
                : '<a href="account.html" class="dropdown-item">Đơn hàng của tôi</a>'
            }
            <a href="account.html" class="dropdown-item">Thông tin cá nhân</a>
            <button type="button" class="dropdown-item js-logout-btn">Đăng xuất</button>
          </div>
        </div>
      `
        : `
        <a href="login.html" class="header-action-btn" title="Đăng nhập">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="desktop-only">Đăng nhập</span>
        </a>
      `;

      headerContainer.innerHTML = `
        <header class="navbar">
          <div class="container navbar-inner">
            <!-- Mobile Menu Toggle Button -->
            <button type="button" class="mobile-toggle-btn js-mobile-menu-toggle" aria-label="Mở menu điều hướng">
              <span class="hamburger-bar"></span>
              <span class="hamburger-bar"></span>
              <span class="hamburger-bar"></span>
            </button>

            <!-- Brand Logo -->
            <a href="index.html" class="brand-logo" aria-label="HK Store Trang chủ">
              HK STORE
            </a>

            <!-- Desktop Navigation -->
            <nav class="nav-menu nav-desktop-only" aria-label="Menu chính">
              ${navHtml}
            </nav>

            <!-- Header Actions -->
            <div class="header-actions">
              <!-- Quick Search Button/Form -->
              <div class="search-box nav-desktop-only js-live-search-box">
                <form action="products.html" method="GET" class="search-form">
                  <input type="text" name="q" autocomplete="off" placeholder="Tìm áo, hoodie, cargo..." class="search-input js-live-search-input" />
                  <kbd class="search-shortcut-kbd" aria-hidden="true">/</kbd>
                  <button type="submit" class="search-btn" aria-label="Tìm kiếm">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </button>
                </form>
              </div>

              <!-- Mobile/Tablet Search Icon -->
              <a href="products.html" class="header-action-btn nav-mobile-only js-mobile-search-trigger" aria-label="Tìm kiếm">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </a>

              <!-- User Account Menu -->
              ${userMenuHtml}

              ${
                !window.HK_FEATURE_FLAGS || window.HK_FEATURE_FLAGS.wishlist !== false
                  ? `
              <!-- Wishlist Button -->
              <button type="button" class="header-action-btn wishlist-header-btn js-open-wishlist" aria-label="Danh sách yêu thích" title="Sản phẩm yêu thích">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="wishlist-badge js-wishlist-badge" style="display: none;">0</span>
              </button>
              `
                  : ""
              }

              <!-- Cart Button -->
              <a href="cart.html" class="header-action-btn cart-btn js-header-cart-trigger" aria-label="Giỏ hàng" title="Giỏ hàng">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span class="cart-badge js-cart-badge" style="display: none;">0</span>
              </a>
            </div>
          </div>
        </header>

        <!-- Mobile Drawer Navigation -->
        <div class="mobile-drawer js-mobile-drawer" aria-hidden="true">
          <div class="drawer-overlay js-close-mobile-drawer"></div>
          <div class="drawer-content">
            <div class="drawer-header">
              <span class="drawer-title">DANH MỤC</span>
              <button type="button" class="drawer-close-btn js-close-mobile-drawer" aria-label="Đóng menu">&times;</button>
            </div>
            <div class="drawer-search">
              <form action="products.html" method="GET" class="search-form">
                <input type="text" name="q" placeholder="Tìm áo, quần, hoodie..." class="search-input" />
                <button type="submit" class="search-btn" aria-label="Tìm">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </button>
              </form>
            </div>
            <nav class="drawer-nav">
              ${navHtml}
              <hr class="drawer-divider" />
              ${
                user
                  ? `
                  <a href="account.html" class="nav-link">Đơn hàng của tôi</a>
                  <a href="account.html" class="nav-link">Tài khoản (${Storage.escapeHTML(user.fullName)})</a>
                  ${isAdmin ? '<a href="admin.html" class="nav-link font-bold">Khu vực Quản trị Admin</a>' : ""}
                  <button type="button" class="nav-link drawer-logout-btn js-logout-btn">Đăng xuất</button>
                `
                  : `
                  <a href="login.html" class="nav-link">Đăng nhập</a>
                  <a href="register.html" class="nav-link">Đăng ký tài khoản</a>
                `
              }
            </nav>
          </div>
        </div>
      `;

      // Gắn sự kiện đăng xuất
      const logoutBtns = headerContainer.querySelectorAll(".js-logout-btn");
      logoutBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          HK.Auth.logout("index.html");
        });
      });

      // Khởi tạo bề mặt Highlight trượt chuẩn Animate UI cho menu ngang
      UI.initNavHighlight(headerContainer);
    },

    // Hiển thị Footer đồng bộ
    renderFooter: function () {
      const footerContainer = document.getElementById("hk-footer");
      if (!footerContainer) return;

      footerContainer.innerHTML = `
        <footer class="site-footer">
          <div class="container footer-grid">
            <!-- Cột 1: Thương hiệu -->
            <div class="footer-col brand-col">
              <h3 class="footer-brand">HK STORE</h3>
              <p class="footer-desc">
                Thương hiệu thời trang đường phố (Streetwear) tối giản, hiện đại và đậm chất cá tính. Tự do thể hiện bản sắc riêng qua từng form dáng.
              </p>
              <div class="footer-demo-note">
                <small>* Bản quyền thiết kế HK Store © 2026. Dự án thương mại điện tử mẫu thuần HTML5/CSS3/JS.</small>
              </div>
            </div>

            <!-- Cột 2: Danh mục mua sắm -->
            <div class="footer-col">
              <h4 class="footer-title">BỘ SƯU TẬP</h4>
              <ul class="footer-links">
                <li><a href="products.html?category=ao-thun">Áo thun Oversize</a></li>
                <li><a href="products.html?category=hoodie-sweater">Hoodie & Sweater</a></li>
                <li><a href="products.html?category=quan">Quần Cargo & Denim</a></li>
                <li><a href="products.html?category=ao-khoac">Áo khoác Bomber & Windbreaker</a></li>
                <li><a href="products.html?category=phu-kien">Phụ kiện Streetwear</a></li>
              </ul>
            </div>

            <!-- Cột 3: Chính sách & Trợ giúp -->
            <div class="footer-col">
              <h4 class="footer-title">TRỢ GIÚP & CHÍNH SÁCH</h4>
              <ul class="footer-links">
                <li><a href="#" class="js-open-policy" data-policy="guide">Hướng dẫn chọn size</a></li>
                <li><a href="#" class="js-open-policy" data-policy="shipping">Chính sách vận chuyển</a></li>
                <li><a href="#" class="js-open-policy" data-policy="return">Chính sách đổi trả 15 ngày</a></li>
                <li><a href="#" class="js-open-policy" data-policy="terms">Điều khoản dịch vụ</a></li>
              </ul>
            </div>

                        <!-- Cột 4: Thông tin liên hệ -->
            <div class="footer-col">
              <h4 class="footer-title">LIÊN HỆ & SHOWROOM</h4>
              <p class="footer-contact-item"><strong>Store:</strong> 126 Thanh Vinh 10, Phường Hoà Khánh Bắc, Thành Phố Đà Nẵng</p>
              <p class="footer-contact-item"><strong>Hotline:</strong> 0965 811 846 (09:00 - 21:00)</p>
              <p class="footer-contact-item"><strong>Email:</strong> support@hkstore.vn</p>
              <div class="footer-badges">
                <span class="badge-tag">Streetwear</span>
                <span class="badge-tag">Minimalist</span>
                <span class="badge-tag">Original</span>
              </div>
            </div>

            <!-- Cột 5: Fanpage Facebook -->
            <div class="footer-col footer-col-fanpage">
              <h4 class="footer-title">FANPAGE</h4>
              <div class="fb-fanpage-card">
                <div class="fb-fanpage-body">
                  <a href="https://www.facebook.com/profile.php?id=61563069746975" target="_blank" rel="noopener noreferrer" class="fb-fanpage-avatar-frame" aria-label="HK Store Fanpage">
                    <span class="fb-fanpage-avatar-circle">
                      <span class="fb-fanpage-avatar-text">hk</span>
                    </span>
                  </a>
                  <div class="fb-fanpage-info">
                    <a href="https://www.facebook.com/profile.php?id=61563069746975" target="_blank" rel="noopener noreferrer" class="fb-fanpage-name">
                      <span>HK STORE</span>
                      <svg class="fb-verified-badge" viewBox="0 0 24 24" aria-label="Đã xác minh">
                        <circle cx="12" cy="12" r="10" fill="#1877F2"></circle>
                        <path d="M9.8 16.2L6.3 12.7l1.4-1.4 2.1 2.1 6.5-6.5 1.4 1.4-7.9 7.9z" fill="#FFFFFF"></path>
                      </svg>
                    </a>
                    <div class="fb-fanpage-followers">128.450 người theo dõi</div>
                  </div>
                </div>
                <div class="fb-fanpage-actions">
                  <a href="https://www.facebook.com/profile.php?id=61563069746975" target="_blank" rel="noopener noreferrer" class="fb-fanpage-btn">
                    <svg class="fb-icon-square" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="2" y="2" width="20" height="20" rx="2" fill="#385898"></rect>
                      <path d="M15.5 8.5h-1.8c-.6 0-.9.3-.9.9v1.4h2.6l-.4 2.6h-2.2V20h-2.7v-6.6H8v-2.6h2.1V9.1c0-2.1 1.2-3.3 3.2-3.3.9 0 1.7.1 2.2.1v2.6z" fill="#FFFFFF"></path>
                    </svg>
                    <span>Theo dõi Trang</span>
                  </a>
                  <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.facebook.com%2Fprofile.php%3Fid%3D61563069746975" target="_blank" rel="noopener noreferrer" class="fb-fanpage-btn">
                    <svg class="fb-icon-share" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l7-7-7-7z" fill="#4B4F56"></path>
                    </svg>
                    <span>Chia sẻ</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="footer-bottom">
            <div class="container footer-bottom-inner">
              <span>© 2026 HK Store. All rights reserved.</span>
              <span>Hệ thống bán hàng thời trang online demo chạy trên LocalStorage.</span>
            </div>
          </div>
        </footer>
      `;
    },

    // Container thông báo Toast
    initToastContainer: function () {
      if (!document.getElementById("toast-container")) {
        const div = document.createElement("div");
        div.id = "toast-container";
        div.className = "toast-container";
        div.setAttribute("aria-live", "polite");
        document.body.appendChild(div);
      }
    },

    // Hiển thị Toast thông báo chuẩn Animate UI (recipes/toast.md: spring.toast, FLIP stack, dismiss tại chỗ)
    showToast: function (message, type = "info", duration = 3500) {
      UI.initToastContainer();
      const container = document.getElementById("toast-container");

      // Ghi nhận vị trí các toast cũ trước khi thêm mới để hiệu ứng trượt nhường chỗ (FLIP)
      const existingToasts = Array.from(container.querySelectorAll(".toast:not(.toast-leaving)"));
      const beforeTops = new Map();
      if (!UI.shouldReduceMotion()) {
        existingToasts.forEach((t) => beforeTops.set(t, t.getBoundingClientRect().top));
      }

      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.dataset.toastId = `toast-${++toastSeq}`;

      let iconSvg = "";
      if (type === "success") {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (type === "error") {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      } else {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
      }

      toast.innerHTML = `
        ${iconSvg}
        <span class="toast-message">${Storage.escapeHTML(message)}</span>
        <button type="button" class="toast-close" aria-label="Đóng">&times;</button>
      `;

      container.appendChild(toast);

      // Di chuyển các toast phía trên nhường chỗ mượt mà trên spring.toast
      if (!UI.shouldReduceMotion() && existingToasts.length > 0) {
        existingToasts.forEach((t) => {
          const oldTop = beforeTops.get(t);
          const newTop = t.getBoundingClientRect().top;
          const dy = oldTop - newTop;
          if (Math.abs(dy) > 0.5 && t.animate) {
            try {
              t.animate(
                [{ translate: `0 ${dy}px` }, { translate: "0 0px" }],
                {
                  duration: 510,
                  easing: CSS.supports("transition-timing-function: linear(0, 1)")
                    ? SPRING_TOAST_EASING
                    : "cubic-bezier(0.23, 1, 0.32, 1)"
                }
              );
            } catch (err) {}
          }
        });
      }

      // Animation nổi lên từ cạnh màn hình trên spring.toast
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add("toast-show");
        });
      });

      const settleTimer = setTimeout(() => {
        if (!toast.classList.contains("toast-leaving")) {
          toast.classList.add("toast-settled");
        }
      }, 530);

      let isRemoving = false;
      const removeToast = () => {
        if (isRemoving) return;
        isRemoving = true;
        clearTimeout(settleTimer);
        toast.inert = true;
        toast.classList.remove("toast-settled", "toast-show");
        toast.classList.add("toast-leaving");

        setTimeout(() => {
          const siblings = Array.from(container.querySelectorAll(".toast:not(.toast-leaving)")).filter(
            (t) => t !== toast
          );
          const siblingTops = new Map();
          if (!UI.shouldReduceMotion()) {
            siblings.forEach((s) => siblingTops.set(s, s.getBoundingClientRect().top));
          }

          if (toast.parentElement) toast.parentElement.removeChild(toast);

          if (!UI.shouldReduceMotion() && siblings.length > 0) {
            siblings.forEach((s) => {
              const oldTop = siblingTops.get(s);
              const newTop = s.getBoundingClientRect().top;
              const dy = oldTop - newTop;
              if (Math.abs(dy) > 0.5 && s.animate) {
                try {
                  s.animate(
                    [{ translate: `0 ${dy}px` }, { translate: "0 0px" }],
                    {
                      duration: 510,
                      easing: CSS.supports("transition-timing-function: linear(0, 1)")
                        ? SPRING_TOAST_EASING
                        : "cubic-bezier(0.23, 1, 0.32, 1)"
                    }
                  );
                } catch (err) {}
              }
            });
          }
        }, 210);
      };

      const timer = setTimeout(removeToast, duration);
      toast.querySelector(".toast-close").addEventListener("click", () => {
        clearTimeout(timer);
        removeToast();
      });
    },

    // Render Thẻ Sản Phẩm Thời Trang Dùng Chung (Design DNA: 2nd Hover Image, Wishlist ♥, Quick View, Swatches & Sizes, NumberCounter)
    renderProductCard: function (product) {
      if (!product) return "";
      const flags = window.HK_FEATURE_FLAGS || {};
      const enableSecondImg = flags.hoverSecondImage !== false;
      const enableWishlist = flags.wishlist !== false;
      const enableQuickView = flags.quickView !== false;

      const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : ["assets/images/placeholder.svg"];
      const defaultImage = images[0];
      const secondImage = enableSecondImg && images.length > 1 && images[1] && images[1] !== defaultImage ? images[1] : null;

      const variants = Array.isArray(product.variants) ? product.variants : [];
      const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const isOutOfStock = variants.length > 0 && totalStock <= 0;

      const hasOriginalPrice = product.originalPrice && product.originalPrice > product.price;
      const discountPct = hasOriginalPrice
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;

      // Nhãn trạng thái góc trên trái
      const badges = [];
      if (isOutOfStock) {
        badges.push(`<span class="badge badge-out card-badge">Hết hàng</span>`);
      } else {
        if (product.badge) {
          let bClass = "badge-new";
          if (product.badge === "Bán chạy") bClass = "badge-hot";
          if (product.badge === "Giảm giá") bClass = "badge-sale";
          badges.push(`<span class="badge ${bClass} card-badge">${Storage.escapeHTML(product.badge)}</span>`);
        }
        if (discountPct > 0) {
          badges.push(`<span class="badge badge-sale card-badge">-${discountPct}%</span>`);
        }
      }
      const badgesHtml = badges.length > 0 ? `<div class="card-badges-stack">${badges.join("")}</div>` : "";

      // Trạng thái Yêu thích (Wishlist)
      const isSaved = Boolean(enableWishlist && HK.Features && HK.Features.isWishlisted && HK.Features.isWishlisted(product.id));
      const wishlistBtnHtml = enableWishlist
        ? `
          <button type="button" class="card-wishlist-btn js-toggle-wishlist ${isSaved ? "is-active" : ""}" data-product-id="${product.id}" aria-label="${isSaved ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}" aria-pressed="${isSaved ? "true" : "false"}" title="Yêu thích">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>`
        : "";

      // Nút Xem nhanh & Chọn biến thể
      const quickViewBtnHtml = enableQuickView
        ? `
          <button type="button" class="card-quickview-btn js-quick-view" data-product-id="${product.id}" aria-label="Xem nhanh ${Storage.escapeHTML(product.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Chọn nhanh</span>
          </button>`
        : "";

      // Chấm màu sắc & Size còn hàng trên thẻ sản phẩm
      let variantsPreviewHtml = "";
      if (enableSecondImg && variants.length > 0) {
        const colorMap = new Map();
        const inStockSizes = new Set();
        variants.forEach((v) => {
          if (v.colorName && !colorMap.has(v.colorName)) {
            colorMap.set(v.colorName, v.colorCode || "#111111");
          }
          if ((Number(v.stock) || 0) > 0 && v.size) {
            inStockSizes.add(v.size);
          }
        });

        const colorEntries = Array.from(colorMap.entries());
        const visibleColors = colorEntries.slice(0, 4);
        const extraColors = colorEntries.length - visibleColors.length;

        const dotsHtml = visibleColors
          .map(
            ([cName, cCode]) =>
              `<span class="card-color-dot" style="background-color: ${Storage.escapeHTML(cCode)};" title="${Storage.escapeHTML(cName)}"></span>`
          )
          .join("");

        const sizesArr = Array.from(inStockSizes);
        const sizesText = isOutOfStock
          ? "Tạm hết hàng"
          : sizesArr.length > 0
          ? sizesArr.join(" · ")
          : "";

        variantsPreviewHtml = `
          <div class="card-variants-preview">
            <div class="card-color-dots">
              ${dotsHtml}
              ${extraColors > 0 ? `<span class="card-color-more">+${extraColors}</span>` : ""}
            </div>
            <span class="card-sizes-hint ${isOutOfStock ? "is-out" : ""}">${Storage.escapeHTML(sizesText)}</span>
          </div>`;
      }

      return `
        <article class="product-card ${secondImage ? "has-second-image" : ""}" data-product-card-id="${product.id}">
          <div class="card-image-wrap">
            <a href="product.html?id=${product.id}" class="card-image-link">
              <img src="${defaultImage}" alt="${Storage.escapeHTML(product.name)}" class="card-image" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/images/placeholder.svg';" />
              ${
                secondImage
                  ? `<img src="${secondImage}" alt="" aria-hidden="true" class="card-image-secondary" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display='none';" />`
                  : ""
              }
            </a>
            ${badgesHtml}
            ${wishlistBtnHtml}
            ${quickViewBtnHtml}
          </div>
          <div class="card-body">
            <div class="card-meta-top">
              <span class="card-category">${Storage.escapeHTML(product.categoryName || "")}</span>
              <div class="card-rating" aria-label="Đánh giá ${product.rating || "5.0"} trên 5">
                <span class="star" aria-hidden="true">★</span>
                <span>${product.rating || "5.0"}</span>
              </div>
            </div>
            <h3 class="card-title">
              <a href="product.html?id=${product.id}">${Storage.escapeHTML(product.name)}</a>
            </h3>
            ${variantsPreviewHtml}
            <div class="card-price-row">
              <span class="card-price ${hasOriginalPrice ? "is-sale" : ""}" data-counter="${product.price}">${Storage.formatCurrency(product.price)}</span>
              ${hasOriginalPrice ? `<span class="card-price-original">${Storage.formatCurrency(product.originalPrice)}</span>` : ""}
            </div>
          </div>
        </article>
      `;
    },

    // Hiển thị Modal tùy biến chuẩn Animate UI (recipes/modal.md & Rule A17 & Rule B5)
    showModal: function ({
      title = "",
      content = "",
      confirmText = "Xác nhận",
      cancelText = "Hủy",
      showCancel = true,
      showFooter = true,
      extraClass = "",
      onConfirm = null,
      onCancel = null
    }) {
      previousActiveElement = document.activeElement;

      // Xóa ngay modal cũ nếu đang mở đè
      if (activeModalElement && activeModalElement.parentElement) {
        activeModalElement.parentElement.removeChild(activeModalElement);
      }

      const modalOverlay = document.createElement("div");
      modalOverlay.className = `modal-overlay ${extraClass}`.trim();
      modalOverlay.setAttribute("role", "dialog");
      modalOverlay.setAttribute("aria-modal", "true");
      modalOverlay.setAttribute("aria-labelledby", "modal-title");

      modalOverlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-header">
            <h3 id="modal-title" class="modal-title">${Storage.escapeHTML(title)}</h3>
            <button type="button" class="modal-close js-modal-close" aria-label="Đóng modal">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          ${
            showFooter
              ? `
          <div class="modal-footer">
            ${showCancel ? `<button type="button" class="btn btn-secondary js-modal-cancel">${Storage.escapeHTML(cancelText)}</button>` : ""}
            ${confirmText ? `<button type="button" class="btn btn-primary js-modal-confirm">${Storage.escapeHTML(confirmText)}</button>` : ""}
          </div>`
              : ""
          }
        </div>
      `;

      document.body.appendChild(modalOverlay);
      activeModalElement = modalOverlay;

      // Animate UI Rule A17: Chuyển focus ngay lúc modal mở, không đợi hết animation
      const getFocusable = () =>
        Array.from(
          modalOverlay.querySelectorAll(
            "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
          )
        );
      const initialFocusable = getFocusable();
      if (initialFocusable.length > 0) {
        initialFocusable[0].focus();
      }

      // Focus trap bàn phím (Tab / Shift+Tab) bên trong Modal
      modalOverlay.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });

      // Bắt đầu animation mở (spring.dialog + backdrop fade)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          modalOverlay.classList.add("modal-active");
        });
      });

      const settleTimer = setTimeout(() => {
        if (!modalOverlay.classList.contains("modal-leaving")) {
          modalOverlay.classList.add("modal-settled");
        }
      }, 750);

      let isClosing = false;
      const closeModal = () => {
        if (isClosing) return;
        isClosing = true;
        clearTimeout(settleTimer);

        // Animate UI Rule A17: Vô hiệu tương tác phần tử đang thoát (inert) & trả focus về nút gốc ngay khi bắt đầu đóng
        modalOverlay.inert = true;
        if (activeModalElement === modalOverlay) {
          activeModalElement = null;
        }
        if (previousActiveElement && typeof previousActiveElement.focus === "function") {
          previousActiveElement.focus();
        }

        // Nội dung thoát nhanh trên transition.dismiss (200ms), nền mờ đợi 400ms mới gỡ khỏi DOM (Rule B5)
        modalOverlay.classList.remove("modal-settled", "modal-active");
        modalOverlay.classList.add("modal-leaving");

        setTimeout(() => {
          if (modalOverlay.parentElement) {
            modalOverlay.parentElement.removeChild(modalOverlay);
          }
        }, 400);
      };

      // Sự kiện nút đóng
      modalOverlay.querySelector(".js-modal-close").addEventListener("click", () => {
        if (onCancel) onCancel();
        closeModal();
      });

      if (showFooter && showCancel) {
        modalOverlay.querySelector(".js-modal-cancel").addEventListener("click", () => {
          if (onCancel) onCancel();
          closeModal();
        });
      }

      if (showFooter && confirmText) {
        modalOverlay.querySelector(".js-modal-confirm").addEventListener("click", () => {
          if (onConfirm) onConfirm();
          closeModal();
        });
      }

      // Đóng khi click ngoài backdrop
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          if (onCancel) onCancel();
          closeModal();
        }
      });

      return { close: closeModal, element: modalOverlay };
    },

    // Hiển thị hộp thoại xác nhận nhanh
    showConfirm: function (message, onConfirm, onCancel = null) {
      UI.showModal({
        title: "Xác nhận hành động",
        content: `<p class="modal-desc">${Storage.escapeHTML(message)}</p>`,
        confirmText: "Đồng ý",
        cancelText: "Hủy bỏ",
        onConfirm: onConfirm,
        onCancel: onCancel
      });
    },

    // Hiển thị modal chính sách mẫu
    showPolicyModal: function (policyKey) {
      let title = "Chính sách HK Store";
      let content = "";

      switch (policyKey) {
        case "guide":
          title = "Bảng thông số chọn Size Streetwear";
          content = `
            <div class="size-guide-modal-content">
              <p>Form dáng của HK Store thiết kế theo chuẩn Boxy Oversize rộng vai, đứng form. Nếu muốn mặc gọn vừa người, bạn có thể chọn lùi 1 size.</p>
              <div style="overflow-x: auto;">
                <table class="table-size-guide">
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Chiều cao / Cân nặng</th>
                      <th>Rộng vai</th>
                      <th>Ngang ngực</th>
                      <th>Dài áo / Quần</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><strong>S</strong></td><td>1m55 - 1m65 · 45 - 58kg</td><td>52 cm</td><td>55 cm</td><td>68cm / 96cm</td></tr>
                    <tr><td><strong>M</strong></td><td>1m65 - 1m75 · 59 - 70kg</td><td>55 cm</td><td>58 cm</td><td>72cm / 100cm</td></tr>
                    <tr><td><strong>L</strong></td><td>1m75 - 1m82 · 71 - 82kg</td><td>58 cm</td><td>61 cm</td><td>75cm / 104cm</td></tr>
                    <tr><td><strong>XL</strong></td><td>Trên 1m80 · 83 - 98kg</td><td>61 cm</td><td>64 cm</td><td>78cm / 108cm</td></tr>
                  </tbody>
                </table>
              </div>
              <small class="text-muted">* Sai số may mặc ±1.5cm. Phụ kiện (mũ, thắt lưng, túi) thiết kế One Size có khóa điều chỉnh linh hoạt.</small>
            </div>
          `;
          break;
        case "shipping":
          title = "Chính sách Vận chuyển";
          content = `
            <div class="policy-modal-content">
              <p><strong>1. Phí giao hàng:</strong></p>
              <ul>
                <li>Phí vận chuyển tiêu chuẩn toàn quốc: 30.000₫</li>
                <li>MIỄN PHÍ VẬN CHUYỂN với mọi đơn hàng có giá trị từ 500.000₫ trở lên.</li>
              </ul>
              <p><strong>2. Thời gian giao hàng dự kiến:</strong></p>
              <ul>
                <li>Nội thành Đà Nẵng, TP.HCM &amp; Hà Nội: 1 - 2 ngày làm việc.</li>
                <li>Các tỉnh thành khác trên toàn quốc: 2 - 4 ngày làm việc.</li>
              </ul>
              <p><strong>3. Đồng kiểm khi nhận hàng:</strong> Quý khách được phép kiểm tra ngoại quan kiện hàng trước khi nhận và thanh toán (COD).</p>
            </div>
          `;
          break;
        case "return":
          title = "Chính sách Đổi trả 15 ngày";
          content = `
            <div class="policy-modal-content">
              <p><strong>Điều kiện đổi trả:</strong></p>
              <ul>
                <li>Sản phẩm còn nguyên tem mác, chưa qua giặt là hoặc sử dụng.</li>
                <li>Thời hạn đổi trả trong vòng 15 ngày kể từ ngày nhận hàng.</li>
                <li>Hỗ trợ đổi size miễn phí nếu sản phẩm không vừa vặn.</li>
                <li>Hoàn tiền 100% nếu sản phẩm có lỗi từ nhà sản xuất hoặc sai mẫu mã.</li>
              </ul>
            </div>
          `;
          break;
        case "terms":
        default:
          title = "Điều khoản Dịch vụ & Giới hạn Demo";
          content = `
            <div class="policy-modal-content">
              <p><strong>Lưu ý quan trọng về hệ thống thử nghiệm:</strong></p>
              <ul>
                <li>Hệ thống HK Store này được xây dựng hoàn toàn bằng HTML5, CSS3 và JavaScript thuần chạy trên trình duyệt người dùng.</li>
                <li>Dữ liệu giỏ hàng, tài khoản và đơn hàng được lưu trữ tạm thời trong localStorage của trình duyệt hiện tại.</li>
                <li>Xác thực, phân quyền và các cổng thanh toán đều là mô phỏng.Tuyệt đối không nhập thông tin ngân hàng thật hoặc mật khẩu thật.</li>
              </ul>
            </div>
          `;
          break;
      }

      UI.showModal({
        title: title,
        content: content,
        confirmText: "Đã hiểu",
        showCancel: false
      });
    },

    // Hiển thị hoặc xóa thông báo lỗi inline ngay dưới trường nhập liệu (Accessible Form Validation)
    setFieldError: function (inputEl, message) {
      if (!inputEl) return;
      inputEl.classList.add("is-invalid");
      inputEl.setAttribute("aria-invalid", "true");
      const group = inputEl.closest(".form-group") || inputEl.parentElement;
      if (!group) return;
      let errEl = group.querySelector(".field-error-msg");
      if (!errEl) {
        errEl = document.createElement("span");
        errEl.className = "field-error-msg";
        errEl.setAttribute("role", "alert");
        group.appendChild(errEl);
      }
      errEl.textContent = message;
    },

    clearFieldError: function (inputEl) {
      if (!inputEl) return;
      inputEl.classList.remove("is-invalid");
      inputEl.removeAttribute("aria-invalid");
      const group = inputEl.closest(".form-group") || inputEl.parentElement;
      if (!group) return;
      const errEl = group.querySelector(".field-error-msg");
      if (errEl) errEl.remove();
    },

    copyText: function (text, successMsg = "Đã sao chép vào bộ nhớ tạm!") {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => UI.showToast(successMsg, "success", 2200),
          () => UI.showToast(`Mã: ${text}`, "info", 3000)
        );
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          UI.showToast(successMsg, "success", 2200);
        } catch (err) {
          UI.showToast(`Mã: ${text}`, "info", 3000);
        }
        document.body.removeChild(ta);
      }
    },

    // Xử lý các sự kiện toàn cục: Phím Escape, Click mở drawer, Click mở chính sách, Sao chép nhanh
    setupGlobalEvents: function () {
      if (UI._globalEventsBound) return;
      UI._globalEventsBound = true;

      // Global Error Handler bảo mật giao diện (ngăn lộ file paths & stack trace thô ra ngoài)
      window.addEventListener("error", (event) => {
        console.warn("[HKStore Security Guard] Unhandled script error:", event.message);
      });

      window.addEventListener("unhandledrejection", (event) => {
        console.warn("[HKStore Security Guard] Unhandled promise rejection:", event.reason);
      });

      // Tự động xóa lỗi inline khi người dùng sửa lại nội dung ô nhập
      document.addEventListener("input", (e) => {
        if (e.target && e.target.classList && e.target.classList.contains("is-invalid")) {
          UI.clearFieldError(e.target);
        }
      });

      // Đóng modal / drawer / dropdown khi bấm Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (activeModalElement) {
            const closeBtn = activeModalElement.querySelector(".js-modal-close");
            if (closeBtn) closeBtn.click();
          }

          const drawer = document.querySelector(".js-mobile-drawer");
          if (drawer && drawer.classList.contains("drawer-open") && !drawer.classList.contains("drawer-leaving")) {
            UI.toggleMobileDrawer(false);
          }

          if (document.activeElement && document.activeElement.closest(".user-dropdown")) {
            document.activeElement.blur();
          }
        }
      });

      // Mobile Drawer Toggle, Policy Popup & Copy Button
      document.addEventListener("click", (e) => {
        if (e.target.closest(".js-mobile-menu-toggle")) {
          UI.toggleMobileDrawer(true);
        } else if (e.target.closest(".js-close-mobile-drawer")) {
          UI.toggleMobileDrawer(false);
        }

        const copyBtn = e.target.closest(".js-copy-text");
        if (copyBtn) {
          e.preventDefault();
          const val = copyBtn.getAttribute("data-copy") || "";
          UI.copyText(val, `Đã sao chép: ${val}`);
          return;
        }

        // Mở popup chính sách
        const policyTrigger = e.target.closest(".js-open-policy");
        if (policyTrigger) {
          e.preventDefault();
          const policyKey = policyTrigger.getAttribute("data-policy") || "terms";
          UI.showPolicyModal(policyKey);
        }
      });
    },

    // Bật/tắt Drawer Mobile Menu chuẩn Animate UI (recipes/sheet.md: 400ms ease.drawer in, 160ms ease.in out, interruptible)
    toggleMobileDrawer: function (open) {
      const drawer = document.querySelector(".js-mobile-drawer");
      if (!drawer) return;

      if (drawerCloseTimer) {
        clearTimeout(drawerCloseTimer);
        drawerCloseTimer = null;
      }

      if (open) {
        drawer.inert = false;
        drawer.classList.remove("drawer-leaving");
        drawer.classList.add("drawer-open");
        drawer.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            drawer.classList.add("drawer-active");
            const closeBtn = drawer.querySelector(".js-close-mobile-drawer");
            if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();
          });
        });
      } else {
        if (!drawer.classList.contains("drawer-open")) return;
        // Rule A17: Vô hiệu tương tác phần tử đang đóng (inert) & trả focus ngay cho nút mở
        drawer.inert = true;
        drawer.setAttribute("aria-hidden", "true");
        const toggleBtn = document.querySelector(".js-mobile-menu-toggle");
        if (toggleBtn && typeof toggleBtn.focus === "function") toggleBtn.focus();

        drawer.classList.remove("drawer-active");
        drawer.classList.add("drawer-leaving");
        document.body.style.overflow = "";

        drawerCloseTimer = setTimeout(() => {
          drawer.classList.remove("drawer-open", "drawer-leaving");
          drawer.inert = false;
          drawerCloseTimer = null;
        }, 400);
      }
    },

    // Chuyển đổi nội dung Tab mượt mà chuẩn Animate UI (recipes/indicator.md: panelOut -> panelIn)
    switchTabPane: function (allPanes, nextPane, direction = 1, onBeforeShow = null) {
      if (!nextPane) return;
      const panes = Array.from(allPanes);

      if (tabSwitchTimer) {
        clearTimeout(tabSwitchTimer);
        tabSwitchTimer = null;
        panes.forEach((p) => {
          if (p !== nextPane) {
            p.classList.remove("aui-panel-leaving", "aui-panel-entering", "active");
            p.style.display = "none";
            p.inert = false;
          }
        });
      }

      const currentPane = panes.find((p) => p !== nextPane && p.style.display !== "none" && p.offsetParent !== null);
      const shiftSign = direction >= 0 ? "var(--shift-tabs)" : "calc(-1 * var(--shift-tabs))";

      const showNext = () => {
        if (onBeforeShow) onBeforeShow();
        panes.forEach((p) => {
          if (p !== nextPane) {
            p.classList.remove("aui-panel-leaving", "aui-panel-entering", "active");
            p.style.display = "none";
            p.inert = false;
          }
        });
        nextPane.inert = false;
        nextPane.style.setProperty("--panel-shift", shiftSign);
        nextPane.style.display = "block";
        nextPane.classList.remove("aui-panel-leaving");
        nextPane.classList.add("active", "aui-panel-entering");
        UI.initScrollReveals(nextPane);
        UI.initNumberCounters(nextPane);
      };

      if (!currentPane) {
        showNext();
        return;
      }

      currentPane.inert = true;
      currentPane.style.setProperty("--panel-shift", shiftSign);
      currentPane.classList.remove("aui-panel-entering");
      currentPane.classList.add("aui-panel-leaving");

      tabSwitchTimer = setTimeout(() => {
        tabSwitchTimer = null;
        showNext();
      }, 150);
    }
  };

  HK.UI = UI;
})(window.HKStore);

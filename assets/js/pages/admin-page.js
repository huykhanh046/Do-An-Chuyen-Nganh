/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Bảng Điều khiển Quản trị Hệ thống (Admin Dashboard)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Auth = HKStore.Auth;
  const Products = HKStore.Products;
  const Orders = HKStore.Orders;
  const UI = HKStore.UI;

  const TAB_ORDER = ["overview", "products", "orders"];
  let currentTab = ""; // 'overview' | 'products' | 'orders'

  function initAdminPage() {
    // 1. Kiểm tra quyền Admin
    if (!Auth.requireAdmin()) return;

    UI.initToastContainer();
    UI.setupGlobalEvents();
    setupSidebar();
    switchTab("overview", true);
  }

  // Chuyển đổi các Tab quản trị
  function setupSidebar() {
    const navItems = document.querySelectorAll(".js-admin-nav-item");
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        if (tab !== currentTab) switchTab(tab, false);
      });
    });

    // Nút đăng xuất admin
    const logoutBtn = document.getElementById("btn-admin-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        Auth.logout("index.html");
      });
    }
  }

  function switchTab(tabKey, isInitial = false) {
    const prevIdx = TAB_ORDER.indexOf(currentTab);
    const nextIdx = TAB_ORDER.indexOf(tabKey);
    const direction = prevIdx === -1 || nextIdx >= prevIdx ? 1 : -1;
    currentTab = tabKey;

    // Cập nhật giao diện menu
    document.querySelectorAll(".js-admin-nav-item").forEach((item) => {
      if (item.getAttribute("data-tab") === tabKey) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Tiêu đề trang
    const titleEl = document.getElementById("admin-header-title");
    if (titleEl) {
      if (tabKey === "overview") titleEl.textContent = "TỔNG QUAN HỆ THỐNG";
      if (tabKey === "products") titleEl.textContent = "QUẢN LÝ SẢN PHẨM & TỒN KHO";
      if (tabKey === "orders") titleEl.textContent = "QUẢN LÝ ĐƠN HÀNG";
    }

    const renderTabData = () => {
      if (tabKey === "overview") renderOverviewTab();
      if (tabKey === "products") renderProductsTab();
      if (tabKey === "orders") renderOrdersTab();
    };

    const allPanes = document.querySelectorAll(".js-admin-tab-content");
    const activePane = document.getElementById(`admin-pane-${tabKey}`);

    // Trang tải lần đầu hiển thị tức thì (recipes/indicator.md: Nothing moves on page load)
    if (isInitial || !UI.switchTabPane) {
      allPanes.forEach((pane) => {
        pane.style.display = pane === activePane ? "block" : "none";
      });
      renderTabData();
      if (activePane && UI.initScrollReveals) UI.initScrollReveals(activePane);
    } else {
      UI.switchTabPane(allPanes, activePane, direction, renderTabData);
    }
  }

  // 2. TAB TỔNG QUAN (OVERVIEW)
  function renderOverviewTab() {
    const stats = Orders.getStatistics();

    const statProducts = document.getElementById("stat-products");
    const statOrders = document.getElementById("stat-orders");
    const statPending = document.getElementById("stat-pending");
    const statRevenue = document.getElementById("stat-revenue");

    if (statProducts) statProducts.textContent = stats.totalActiveProducts;
    if (statOrders) statOrders.textContent = stats.totalOrders;
    if (statPending) statPending.textContent = stats.pendingOrders;
    if (statRevenue) {
      if (UI.animateNumberCounter) {
        UI.animateNumberCounter(statRevenue, stats.revenue, 900);
      } else {
        statRevenue.textContent = Storage.formatCurrency(stats.revenue);
      }
    }

    // Bảng cảnh báo sắp hết hàng (1-5 đơn vị)
    const lowStockTbody = document.getElementById("tbody-low-stock");
    if (lowStockTbody) {
      if (stats.lowStockVariants.length === 0) {
        lowStockTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Không có biến thể nào sắp hết hàng.</td></tr>`;
      } else {
        lowStockTbody.innerHTML = stats.lowStockVariants
          .map(
            (v) => `
          <tr>
            <td><strong>${Storage.escapeHTML(v.productName)}</strong></td>
            <td><code>${Storage.escapeHTML(v.sku)}</code></td>
            <td>${Storage.escapeHTML(v.size)}</td>
            <td>${Storage.escapeHTML(v.colorName)}</td>
            <td><span class="badge badge-hot">Còn ${v.stock}</span></td>
          </tr>
        `
          )
          .join("");
      }
    }

    // Bảng cảnh báo hết hàng (0 đơn vị)
    const outStockTbody = document.getElementById("tbody-out-of-stock");
    if (outStockTbody) {
      if (stats.outOfStockVariants.length === 0) {
        outStockTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Tất cả sản phẩm đều đang còn hàng.</td></tr>`;
      } else {
        outStockTbody.innerHTML = stats.outOfStockVariants
          .map(
            (v) => `
          <tr>
            <td><strong>${Storage.escapeHTML(v.productName)}</strong></td>
            <td><code>${Storage.escapeHTML(v.sku)}</code></td>
            <td>${Storage.escapeHTML(v.size)}</td>
            <td>${Storage.escapeHTML(v.colorName)}</td>
            <td><span class="badge" style="background:#000; color:#fff;">HẾT HÀNG (0)</span></td>
          </tr>
        `
          )
          .join("");
      }
    }
  }

  // 3. TAB QUẢN LÝ SẢN PHẨM & TỒN KHO
  function renderProductsTab() {
    // Tự động xóa sạch các sản phẩm đã từng bị đưa vào 'archived' trước đây theo yêu cầu Admin
    const allStored = Storage.get(Storage.KEYS.PRODUCTS, []);
    const cleanList = allStored.filter((p) => p.status !== "archived");
    if (cleanList.length !== allStored.length) {
      Storage.set(Storage.KEYS.PRODUCTS, cleanList);
    }

    const list = cleanList;
    const tbody = document.getElementById("tbody-products-list");
    const searchInput = document.getElementById("admin-prod-search");
    const catSelect = document.getElementById("admin-prod-cat-filter");

    function filterAndRender() {
      const q = searchInput ? Storage.normalizeText(searchInput.value) : "";
      const cat = catSelect ? catSelect.value : "all";

      let filtered = list;

      if (q) {
        filtered = filtered.filter(
          (p) =>
            Storage.normalizeText(p.name).includes(q) ||
            (p.variants || []).some((v) => Storage.normalizeText(v.sku).includes(q))
        );
      }

      if (cat !== "all") {
        filtered = filtered.filter((p) => p.category === cat);
      }

      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Không tìm thấy sản phẩm nào.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered
        .map((p) => {
          const totalStock = (p.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
          const isArchived = p.status === "archived";

          return `
          <tr style="${isArchived ? "opacity: 0.6; background-color: #F9F9F9;" : ""}">
            <td>
              <div style="display: flex; gap: 8px; align-items: center;">
                <img src="${(p.images && p.images[0]) || "assets/images/placeholder.svg"}" alt="" style="width: 40px; aspect-ratio: 3/4; object-fit: cover; border-radius: 2px;" onerror="this.src='assets/images/placeholder.svg'" />
                <div>
                  <strong>${Storage.escapeHTML(p.name)}</strong>
                  <div><small class="text-muted">ID: ${p.id}</small></div>
                </div>
              </div>
            </td>
            <td>${Storage.escapeHTML(p.categoryName)}</td>
            <td class="font-bold">${Storage.formatCurrency(p.price)}</td>
            <td>${(p.variants || []).length} biến thể</td>
            <td>
              <strong>${totalStock}</strong> cái
              ${totalStock === 0 ? '<span class="badge" style="background:#000; color:#fff; margin-left: 4px;">Hết</span>' : ""}
            </td>
            <td>
              ${
                isArchived
                  ? '<span class="badge" style="background: #9E9E9E; color: #fff;">Lưu trữ</span>'
                  : '<span class="badge" style="background: #2E7D32; color: #fff;">Đang bán</span>'
              }
            </td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn btn-secondary btn-sm js-edit-product" data-id="${p.id}">Sửa</button>
                <button type="button" class="btn btn-danger btn-sm js-delete-product" data-id="${p.id}">Xóa vĩnh viễn</button>
              </div>
            </td>
          </tr>
        `;
        })
        .join("");

      // Gắn sự kiện các nút
      tbody.querySelectorAll(".js-edit-product").forEach((btn) => {
        btn.addEventListener("click", () => openProductModal(btn.getAttribute("data-id")));
      });

      tbody.querySelectorAll(".js-delete-product").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          UI.showConfirm(
            "Bạn có chắc chắn muốn xóa vĩnh viễn sản phẩm này? Sản phẩm sẽ bị xóa hoàn toàn khỏi hệ thống (các đơn hàng cũ đã từng mua sản phẩm này vẫn được giữ nguyên đầy đủ giá trị và sẽ hiển thị chi tiết sản phẩm dưới dạng Data ẩn).",
            () => {
              const res = Products.deleteProduct(id);
              if (res.success) {
                UI.showToast("Đã xóa sản phẩm", "success");
                renderProductsTab();
                renderOverviewTab();
              } else {
                UI.showToast(res.message, "error");
              }
            }
          );
        });
      });
    }

    if (searchInput) searchInput.oninput = filterAndRender;
    if (catSelect) catSelect.onchange = filterAndRender;

    // Nút Thêm sản phẩm mới
    const addBtn = document.getElementById("btn-add-product");
    if (addBtn) {
      addBtn.onclick = () => openProductModal(null);
    }

    // Nút Xuất file seed.js để lưu trực tiếp vào source code
    const exportBtn = document.getElementById("btn-export-seed");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const products = Storage.get(Storage.KEYS.PRODUCTS, []);
        const users = Storage.get(Storage.KEYS.USERS, []);
        const orders = Storage.get(Storage.KEYS.ORDERS, []);

        const fileContent = `/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dữ liệu hạt giống (Seed Data) chuẩn từ Admin Dashboard.
 * Cập nhật lúc: ${new Date().toLocaleString("vi-VN")}
 */
window.HK_SEED_DATA = {
  products: ${JSON.stringify(products, null, 2)},
  users: ${JSON.stringify(users, null, 2)},
  orders: ${JSON.stringify(orders, null, 2)}
};
`;

        const blob = new Blob([fileContent], { type: "application/javascript;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "seed.js";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        UI.showToast("Đã lưu sản phẩm", "success");
      };
    }

    filterAndRender();
  }

  // Modal Thêm / Chỉnh sửa Sản phẩm & Biến thể
  function openProductModal(productId = null) {
    const isEdit = !!productId;
    const prod = isEdit ? Products.getById(productId) : null;

    const categories = [
      { id: "ao-thun", name: "Áo thun" },
      { id: "hoodie-sweater", name: "Hoodie & Sweater" },
      { id: "quan", name: "Quần" },
      { id: "ao-khoac", name: "Áo khoác" },
      { id: "phu-kien", name: "Phụ kiện" }
    ];

    const currentVariants = prod ? JSON.parse(JSON.stringify(prod.variants || [])) : [
      { id: Storage.generateId("var"), sku: "", size: "M", colorName: "Đen Than", colorCode: "#111111", stock: 10 }
    ];

    const modalContent = `
      <form id="admin-product-form" style="display: flex; flex-direction: column; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Tên sản phẩm <span class="required">*</span></label>
          <input type="text" id="m-prod-name" class="form-control" value="${prod ? Storage.escapeHTML(prod.name) : ""}" required />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Danh mục <span class="required">*</span></label>
            <select id="m-prod-cat" class="form-control">
              ${categories
                .map(
                  (c) => `
                <option value="${c.id}" data-name="${c.name}" ${prod && prod.category === c.id ? "selected" : ""}>${c.name}</option>
              `
                )
                .join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nhãn (Badge)</label>
            <select id="m-prod-badge" class="form-control">
              <option value="" ${!prod || !prod.badge ? "selected" : ""}>Không có</option>
              <option value="Mới" ${prod && prod.badge === "Mới" ? "selected" : ""}>Mới</option>
              <option value="Bán chạy" ${prod && prod.badge === "Bán chạy" ? "selected" : ""}>Bán chạy</option>
              <option value="Giảm giá" ${prod && prod.badge === "Giảm giá" ? "selected" : ""}>Giảm giá</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Giá bán (VND) <span class="required">*</span></label>
            <input type="number" id="m-prod-price" class="form-control" min="0" step="1000" value="${prod ? prod.price : ""}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Giá gốc (VND, nếu có)</label>
            <input type="number" id="m-prod-orig-price" class="form-control" min="0" step="1000" value="${prod && prod.originalPrice ? prod.originalPrice : ""}" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Chất liệu</label>
            <input type="text" id="m-prod-material" class="form-control" value="${prod ? Storage.escapeHTML(prod.material || "") : "100% Cotton định lượng cao"}" />
          </div>
          <div class="form-group">
            <label class="form-label">Phom dáng</label>
            <input type="text" id="m-prod-fit" class="form-control" value="${prod ? Storage.escapeHTML(prod.fit || "") : "Boxy Oversize"}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">URL Ảnh sản phẩm (Mỗi ảnh một dòng hoặc cách nhau dấu phẩy)</label>
          <textarea id="m-prod-images" class="form-control" rows="2">${prod && prod.images ? prod.images.join("\n") : "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800"}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Mô tả chi tiết</label>
          <textarea id="m-prod-desc" class="form-control" rows="3">${prod ? Storage.escapeHTML(prod.description || "") : ""}</textarea>
        </div>

        <!-- Quản lý Biến thể -->
        <div style="border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="form-label" style="margin-bottom: 0;">DANH SÁCH BIẾN THỂ (SKU, Size, Màu, Tồn kho) <span class="required">*</span></label>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-variant-row">+ Thêm biến thể</button>
          </div>

          <table class="variants-editor-table">
            <thead>
              <tr>
                <th>Mã SKU <span class="required">*</span></th>
                <th>Size</th>
                <th>Tên Màu</th>
                <th>Mã Màu (HEX)</th>
                <th>Tồn kho</th>
                <th>Xóa</th>
              </tr>
            </thead>
            <tbody id="m-variant-tbody"></tbody>
          </table>
        </div>
      </form>
    `;

    const modal = UI.showModal({
      title: isEdit ? `Chỉnh sửa: ${prod.name}` : "Thêm Sản phẩm Streetwear Mới",
      content: modalContent,
      confirmText: "Lưu sản phẩm",
      cancelText: "Hủy bỏ",
      onConfirm: () => {
        saveProductFromModal(isEdit ? prod.id : null, modal);
      }
    });

    const vTbody = document.getElementById("m-variant-tbody");

    function syncVariantsFromDOM() {
      if (!vTbody) return;
      const rows = vTbody.querySelectorAll("tr");
      rows.forEach((row, idx) => {
        if (!currentVariants[idx]) return;
        currentVariants[idx].id = row.getAttribute("data-variant-id") || currentVariants[idx].id || Storage.generateId("var");
        currentVariants[idx].sku = row.querySelector(".v-sku").value.trim();
        currentVariants[idx].size = row.querySelector(".v-size").value;
        currentVariants[idx].colorName = row.querySelector(".v-color-name").value.trim();
        currentVariants[idx].colorCode = row.querySelector(".v-color-code").value.trim() || "#111111";
        currentVariants[idx].stock = Number(row.querySelector(".v-stock").value) || 0;
      });
    }

    function renderVariantRows() {
      if (!vTbody) return;
      vTbody.innerHTML = currentVariants
        .map(
          (v, idx) => `
        <tr data-idx="${idx}" data-variant-id="${Storage.escapeHTML(v.id || "")}">
          <td><input type="text" class="variant-input v-sku" value="${Storage.escapeHTML(v.sku || "")}" placeholder="HK-SKU-01" required /></td>
          <td>
            <select class="variant-input v-size">
              <option value="S" ${v.size === "S" ? "selected" : ""}>S</option>
              <option value="M" ${v.size === "M" ? "selected" : ""}>M</option>
              <option value="L" ${v.size === "L" ? "selected" : ""}>L</option>
              <option value="XL" ${v.size === "XL" ? "selected" : ""}>XL</option>
              <option value="One size" ${v.size === "One size" ? "selected" : ""}>One size</option>
            </select>
          </td>
          <td><input type="text" class="variant-input v-color-name" value="${Storage.escapeHTML(v.colorName || "")}" placeholder="Đen Than" required /></td>
          <td><input type="text" class="variant-input v-color-code" value="${Storage.escapeHTML(v.colorCode || "#111111")}" style="max-width: 80px;" /></td>
          <td><input type="number" class="variant-input v-stock" value="${v.stock !== undefined ? v.stock : 10}" min="0" step="1" required /></td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-danger js-remove-variant" data-idx="${idx}" aria-label="Xóa biến thể">&times;</button>
          </td>
        </tr>
      `
        )
        .join("");

      vTbody.querySelectorAll(".js-remove-variant").forEach((btn) => {
        btn.addEventListener("click", () => {
          syncVariantsFromDOM();
          const idx = Number(btn.getAttribute("data-idx"));
          if (currentVariants.length <= 1) {
            UI.showToast("Sản phẩm phải có ít nhất 1 biến thể!", "error");
            return;
          }
          currentVariants.splice(idx, 1);
          renderVariantRows();
        });
      });
    }

    const addVRowBtn = document.getElementById("btn-add-variant-row");
    if (addVRowBtn) {
      addVRowBtn.addEventListener("click", () => {
        syncVariantsFromDOM();
        currentVariants.push({
          id: Storage.generateId("var"),
          sku: "",
          size: "L",
          colorName: "Đen Than",
          colorCode: "#111111",
          stock: 5
        });
        renderVariantRows();
      });
    }

    renderVariantRows();
  }

  function saveProductFromModal(existingId, modal) {
    const name = document.getElementById("m-prod-name").value.trim();
    const catSelect = document.getElementById("m-prod-cat");
    const category = catSelect.value;
    const categoryName = catSelect.options[catSelect.selectedIndex].getAttribute("data-name");
    const badge = document.getElementById("m-prod-badge").value || null;
    const price = Number(document.getElementById("m-prod-price").value);
    const origPriceVal = document.getElementById("m-prod-orig-price").value;
    const originalPrice = origPriceVal !== "" ? Number(origPriceVal) : null;
    const material = document.getElementById("m-prod-material").value.trim();
    const fit = document.getElementById("m-prod-fit").value.trim();
    const desc = document.getElementById("m-prod-desc").value.trim();

    const rawImages = document.getElementById("m-prod-images").value;
    const images = rawImages
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s !== "");

    // Thu thập dữ liệu các dòng biến thể (giữ nguyên ID biến thể cũ để không làm mất sản phẩm trong giỏ khách hàng)
    const rows = document.querySelectorAll("#m-variant-tbody tr");
    const variants = [];

    rows.forEach((row) => {
      const existingVarId = row.getAttribute("data-variant-id");
      const sku = row.querySelector(".v-sku").value.trim();
      const size = row.querySelector(".v-size").value;
      const colorName = row.querySelector(".v-color-name").value.trim();
      const colorCode = row.querySelector(".v-color-code").value.trim() || "#111111";
      const stock = Number(row.querySelector(".v-stock").value);

      variants.push({
        id: existingVarId || Storage.generateId("var"),
        sku,
        size,
        colorName,
        colorCode,
        stock
      });
    });

    const productPayload = {
      id: existingId,
      name,
      category,
      categoryName,
      badge,
      price,
      originalPrice,
      material,
      fit,
      description: desc,
      images: images.length > 0 ? images : ["assets/images/placeholder.svg"],
      variants,
      status: "active"
    };

    const res = Products.saveProduct(productPayload);
    if (res.success) {
      UI.showToast("Đã lưu sản phẩm", "success");
      modal.close();
      renderProductsTab();
    } else {
      UI.showToast(res.message, "error");
    }
  }

  // 4. TAB QUẢN LÝ ĐƠN HÀNG
  function renderOrdersTab() {
    const list = Orders.getAll();
    const tbody = document.getElementById("tbody-orders-list");
    const searchInput = document.getElementById("admin-order-search");
    const statusSelect = document.getElementById("admin-order-status-filter");
    const paymentSelect = document.getElementById("admin-order-payment-filter");

    const statusNames = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao",
      delivered: "Đã giao",
      cancelled: "Đã hủy"
    };

    const paymentStatusNames = {
      pending: "Chờ thanh toán",
      paid: "Đã thanh toán",
      refund_pending: "Chờ hoàn tiền",
      refunded: "Đã hoàn tiền"
    };

    function filterAndRender() {
      const q = searchInput ? Storage.normalizeText(searchInput.value) : "";
      const st = statusSelect ? statusSelect.value : "all";
      const pay = paymentSelect ? paymentSelect.value : "all";

      let filtered = list;

      if (q) {
        filtered = filtered.filter(
          (o) =>
            Storage.normalizeText(o.id).includes(q) ||
            Storage.normalizeText(o.customerInfo.fullName).includes(q) ||
            Storage.normalizeText(o.customerInfo.phone).includes(q) ||
            Storage.normalizeText(o.trackingCode || "").includes(q)
        );
      }

      if (st !== "all") {
        filtered = filtered.filter((o) => o.orderStatus === st);
      }

      if (pay !== "all") {
        filtered = filtered.filter((o) => o.paymentStatus === pay);
      }

      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Không tìm thấy đơn hàng nào.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered
        .map((ord) => {
          return `
          <tr>
            <td><strong>${ord.id}</strong></td>
            <td>
              <strong>${Storage.escapeHTML(ord.customerInfo.fullName)}</strong>
              <div><small class="text-muted">${Storage.escapeHTML(ord.customerInfo.phone)}</small></div>
            </td>
            <td><small>${Storage.formatDate(ord.createdAt)}</small></td>
            <td class="font-bold">${Storage.formatCurrency(ord.total)}</td>
            <td>
              <span class="badge badge-status-${ord.orderStatus}">
                ${statusNames[ord.orderStatus] || ord.orderStatus}
              </span>
              ${ord.trackingCode ? `<div style="margin-top: 4px; font-size: 0.73rem; color: var(--color-text-muted);">Mã VĐ: <strong style="color: var(--color-primary); font-family: monospace;">${Storage.escapeHTML(ord.trackingCode)}</strong></div>` : ""}
            </td>
            <td>
              <span class="badge badge-payment-${ord.paymentStatus}">
                ${paymentStatusNames[ord.paymentStatus] || ord.paymentStatus}
              </span>
            </td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm js-view-admin-order" data-id="${ord.id}">
                Chi tiết & Xử lý
              </button>
            </td>
          </tr>
        `;
        })
        .join("");

      tbody.querySelectorAll(".js-view-admin-order").forEach((btn) => {
        btn.addEventListener("click", () => openAdminOrderModal(btn.getAttribute("data-id")));
      });
    }

    if (searchInput) searchInput.oninput = filterAndRender;
    if (statusSelect) statusSelect.onchange = filterAndRender;
    if (paymentSelect) paymentSelect.onchange = filterAndRender;

    filterAndRender();
  }

  // Modal Chi tiết & Thao tác Đơn hàng dành riêng cho Admin
  function openAdminOrderModal(orderId) {
    const order = Orders.getById(orderId);
    if (!order) return;

    const statusNames = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao",
      delivered: "Đã giao",
      cancelled: "Đã hủy"
    };

    const paymentStatusNames = {
      pending: "Chờ thanh toán",
      paid: "Đã thanh toán",
      refund_pending: "Chờ hoàn tiền",
      refunded: "Đã hoàn tiền"
    };

    const carriers = Orders.getCarriers ? Orders.getCarriers() : [
      { code: "spx", name: "SPX Express (Shopee)" },
      { code: "ghn", name: "GHN - Giao Hàng Nhanh" },
      { code: "ghtk", name: "GHTK - Giao Hàng Tiết Kiệm" },
      { code: "viettelpost", name: "Viettel Post" },
      { code: "jt", name: "J&T Express" },
      { code: "vnpost", name: "VNPost - Bưu điện Việt Nam" },
      { code: "ninjavan", name: "Ninja Van" },
      { code: "other", name: "Đơn vị vận chuyển khác" }
    ];
    const currentCarrier = order.shippingCarrier || "spx";
    const currentTracking = order.trackingCode || "";
    const currentCarrierName =
      order.shippingCarrierName || (Orders.getCarrierName ? Orders.getCarrierName(currentCarrier) : currentCarrier);
    const trackingUrl =
      currentTracking && Orders.getCarrierTrackingUrl
        ? Orders.getCarrierTrackingUrl(currentCarrier, currentTracking)
        : "#";

    const modalContent = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background-color: var(--color-bg); padding: 12px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Mã đơn: <strong>${order.id}</strong></span>
            <span>Ngày đặt: ${Storage.formatDate(order.createdAt)}</span>
          </div>
          <div>Khách hàng: <strong>${Storage.escapeHTML(order.customerInfo.fullName)}</strong> (${Storage.escapeHTML(order.customerInfo.phone)})</div>
          <div>Địa chỉ: ${Storage.escapeHTML(order.customerInfo.address)}</div>
          ${order.customerInfo.note ? `<div>Ghi chú: <em>${Storage.escapeHTML(order.customerInfo.note)}</em></div>` : ""}
        </div>

        <div>
          <h4 style="font-size: 0.85rem; margin-bottom: 6px; text-transform: uppercase;">Sản phẩm trong đơn:</h4>
          <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 2px;">
            ${order.items
              .map((i, idx) => {
                const currentProd = Products.getById(i.productId);
                const isHiddenData = !currentProd;

                if (isHiddenData) {
                  return `
                    <div style="padding: 10px 12px; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; background-color: #FAFAFA;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <span class="badge badge-out" style="font-size: 0.66rem; padding: 2px 6px;">Ngừng KD</span>
                          <strong>${Storage.escapeHTML(i.name)}</strong>
                          <span class="text-muted">× ${i.quantity}</span>
                          <button type="button" class="btn btn-sm js-toggle-hidden-item" data-target="admin-hidden-detail-${idx}" style="padding: 2px 8px; font-size: 0.72rem; border: 1px solid var(--color-border-dark); background: #fff; cursor: pointer;">
                            Xem bản lưu
                          </button>
                        </div>
                        <div class="tabular-nums" style="font-weight: 700; color: #111;">${Storage.formatCurrency(i.lineTotal)}</div>
                      </div>
                      <div id="admin-hidden-detail-${idx}" style="display: none; margin-top: 6px; padding: 6px 10px; background-color: #EFEFEA; border-radius: 2px; font-size: 0.78rem; color: #555;">
                        <strong>Bản chụp lịch sử:</strong> ${Storage.escapeHTML(i.name)} | SKU: <code>${Storage.escapeHTML(i.sku || "N/A")}</code> | Size: ${Storage.escapeHTML(i.size)} | Màu: ${Storage.escapeHTML(i.colorName)} | Đơn giá: ${Storage.formatCurrency(i.price)}
                      </div>
                    </div>
                  `;
                }

                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--color-border); font-size: 0.85rem;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <img src="${i.image}" alt="" style="width: 32px; aspect-ratio: 3/4; object-fit: cover; border-radius: 2px;" onerror="this.src='assets/images/placeholder.svg'" />
                      <div>
                        <strong>${Storage.escapeHTML(i.name)}</strong>
                        <div class="text-muted" style="font-size: 0.78rem;">SKU: ${Storage.escapeHTML(i.sku)} | ${Storage.escapeHTML(i.size)} - ${Storage.escapeHTML(i.colorName)} × ${i.quantity}</div>
                      </div>
                    </div>
                    <div class="tabular-nums" style="font-weight: 700;">${Storage.formatCurrency(i.lineTotal)}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
          <div class="tabular-nums" style="text-align: right; margin-top: 6px; font-weight: 800; font-size: 1.05rem;">
            Tổng tiền: ${Storage.formatCurrency(order.total)}
          </div>
        </div>

        <!-- CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG -->
        <div style="border-top: 1px solid var(--color-border); padding-top: 12px;">
          <h4 style="font-size: 0.85rem; margin-bottom: 6px; text-transform: uppercase;">Xử lý Trạng thái Đơn hàng:</h4>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span>Trạng thái hiện tại: <span class="badge badge-status-${order.orderStatus}">${statusNames[order.orderStatus]}</span></span>

            ${
              order.orderStatus === "pending"
                ? `<button type="button" class="btn btn-primary btn-sm js-order-transition" data-status="confirmed">Xác nhận đơn</button>
                   <button type="button" class="btn btn-danger btn-sm js-order-transition" data-status="cancelled">Hủy đơn</button>`
                : ""
            }

            ${
              order.orderStatus === "confirmed"
                ? `<button type="button" class="btn btn-primary btn-sm js-order-transition" data-status="shipping">Giao hàng cho shipper</button>
                   <button type="button" class="btn btn-danger btn-sm js-order-transition" data-status="cancelled">Hủy đơn</button>`
                : ""
            }

            ${
              order.orderStatus === "shipping"
                ? order.paymentMethod === "cod" && order.paymentStatus === "pending"
                  ? `<button type="button" class="btn btn-primary btn-sm js-admin-cod-deliver">Xác nhận Đã giao &amp; Đã thu tiền COD</button>`
                  : `<button type="button" class="btn btn-primary btn-sm js-order-transition" data-status="delivered">Đánh dấu Đã giao thành công</button>`
                : ""
            }
          </div>
        </div>

        <!-- MÃ VẬN ĐƠN GIAO HÀNG (HIỂN THỊ KHI ĐƠN ĐÃ XÁC NHẬN / ĐANG GIAO / ĐÃ GIAO) -->
        ${
          order.orderStatus !== "cancelled"
            ? `
        <div style="border-top: 1px solid var(--color-border); padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <h4 style="font-size: 0.85rem; margin: 0; text-transform: uppercase;">Mã vận đơn giao hàng:</h4>
            ${
              currentTracking
                ? `<span style="font-size: 0.78rem; background: #EEF7F0; color: #1B6E32; padding: 3px 8px; border-radius: 3px; font-weight: 600;">
                     ✓ Đã gắn mã: <strong style="font-family: monospace;">${Storage.escapeHTML(currentTracking)}</strong> (${Storage.escapeHTML(currentCarrierName)})
                     <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="margin-left: 6px; text-decoration: underline; color: #111;">Tra cứu ↗</a>
                   </span>`
                : `<span class="text-muted" style="font-size: 0.78rem;">Chưa gắn mã vận đơn</span>`
            }
          </div>
          <div style="background: var(--color-bg); padding: 10px 12px; border-radius: 4px; border: 1px solid var(--color-border);">
            <div style="display: grid; grid-template-columns: 1fr 1.2fr auto; gap: 8px; align-items: center;">
              <select id="admin-shipping-carrier" class="form-control" style="height: 36px; padding: 0 8px; font-size: 0.82rem;">
                ${carriers
                  .map(
                    (c) =>
                      `<option value="${Storage.escapeHTML(c.code)}" ${
                        c.code === currentCarrier ? "selected" : ""
                      }>${Storage.escapeHTML(c.name)}</option>`
                  )
                  .join("")}
              </select>
              <input
                type="text"
                id="admin-tracking-code"
                class="form-control"
                style="height: 36px; padding: 0 10px; font-size: 0.84rem; font-family: monospace; text-transform: uppercase;"
                placeholder="Nhập mã vận đơn (VD: SPXVN0394812)..."
                value="${Storage.escapeHTML(currentTracking)}"
              />
              <button type="button" class="btn btn-primary btn-sm js-save-tracking-code" style="height: 36px; white-space: nowrap;">
                Lưu mã vận đơn
              </button>
            </div>
            <div class="text-muted" style="font-size: 0.74rem; margin-top: 6px;">
              Admin lên đơn ở sàn TMĐT / Đơn vị vận chuyển rồi nhập mã vận đơn vào đây để khách hàng theo dõi tiến trình đơn hàng.
            </div>
          </div>
        </div>
        `
            : ""
        }

        <!-- CẬP NHẬT TRẠNG THÁI THANH TOÁN -->
        <div style="border-top: 1px solid var(--color-border); padding-top: 12px;">
          <h4 style="font-size: 0.85rem; margin-bottom: 6px; text-transform: uppercase;">Thanh toán (${
            order.paymentMethod === "gateway"
              ? order.paymentProvider === "momo"
                ? "VÍ MOMO QR"
                : order.paymentProvider === "vnpay"
                ? "VNPAY-QR"
                : "VNPAY / MOMO QR"
              : order.paymentMethod.toUpperCase()
          }):</h4>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span>Trạng thái: <span class="badge badge-payment-${order.paymentStatus}">${paymentStatusNames[order.paymentStatus] || order.paymentStatus}</span></span>
            ${order.paymentRef ? `<span class="text-muted" style="font-size: 0.8rem;">Mã phiên QR: <code>${Storage.escapeHTML(order.paymentRef)}</code></span>` : ""}

            ${
              order.paymentMethod === "banking" && order.paymentStatus === "pending"
                ? `<button type="button" class="btn btn-secondary btn-sm js-confirm-banking">Xác nhận đã nhận tiền chuyển khoản</button>`
                : ""
            }

            ${
              order.paymentStatus === "refund_pending"
                ? `<button type="button" class="btn btn-danger btn-sm js-confirm-refund">Xác nhận đã hoàn tiền (Mô phỏng)</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    const modal = UI.showModal({
      title: `Chi tiết Đơn hàng: ${order.id}`,
      content: modalContent,
      confirmText: "Đóng",
      showCancel: false
    });

    // Sự kiện bật/tắt xem chi tiết data ẩn trong đơn hàng
    document.querySelectorAll(".js-toggle-hidden-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const el = document.getElementById(targetId);
        if (el) {
          const isCurrentlyHidden = el.style.display === "none";
          el.style.display = isCurrentlyHidden ? "block" : "none";
          btn.textContent = isCurrentlyHidden ? "Ẩn bản lưu" : "Xem bản lưu";
        }
      });
    });

    // Sự kiện Lưu mã vận đơn giao hàng
    const saveTrackingBtn = document.querySelector(".js-save-tracking-code");
    if (saveTrackingBtn) {
      saveTrackingBtn.addEventListener("click", () => {
        const carrierEl = document.getElementById("admin-shipping-carrier");
        const codeEl = document.getElementById("admin-tracking-code");
        const shippingCarrier = carrierEl ? carrierEl.value : "spx";
        const trackingCode = codeEl ? codeEl.value.trim() : "";

        if (!trackingCode) {
          UI.showToast("Vui lòng nhập mã vận đơn giao hàng!", "error");
          if (codeEl) codeEl.focus();
          return;
        }

        const res = Orders.updateTrackingInfo(order.id, { shippingCarrier, trackingCode });
        if (res.success) {
          UI.showToast(res.message, "success");
          modal.close();
          renderOrdersTab();
          openAdminOrderModal(order.id);
        } else {
          UI.showToast(res.message, "error");
        }
      });
    }

    // Sự kiện chuyển trạng thái
    document.querySelectorAll(".js-order-transition").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextStatus = btn.getAttribute("data-status");
        if (nextStatus === "cancelled") {
          UI.showConfirm(
            "Xác nhận hủy đơn hàng này? Toàn bộ số lượng sản phẩm sẽ được hoàn lại kho đúng 1 lần.",
            () => {
              const res = Orders.cancelOrder(order.id, "Admin hủy đơn");
              modal.close();
              UI.showToast(res.message, res.success ? "success" : "error");
              renderOrdersTab();
              renderOverviewTab();
            }
          );
        } else {
          const carrierEl = document.getElementById("admin-shipping-carrier");
          const codeEl = document.getElementById("admin-tracking-code");
          const extraData = {};
          if (carrierEl && carrierEl.value) extraData.shippingCarrier = carrierEl.value;
          if (codeEl && codeEl.value.trim()) extraData.trackingCode = codeEl.value.trim();

          const res = Orders.updateOrderStatus(order.id, nextStatus, extraData);
          modal.close();
          UI.showToast(res.message, res.success ? "success" : "error");
          renderOrdersTab();
          renderOverviewTab();

          // Khi chuyển sang trạng thái Đang giao (shipping), mở lại modal để Admin tiện nhập/kiểm tra Mã vận đơn
          if (res.success && nextStatus === "shipping" && !extraData.trackingCode) {
            openAdminOrderModal(order.id);
            const newCodeEl = document.getElementById("admin-tracking-code");
            if (newCodeEl) newCodeEl.focus();
          }
        }
      });
    });

    // Sự kiện giao COD & thu tiền
    const codDeliverBtn = document.querySelector(".js-admin-cod-deliver");
    if (codDeliverBtn) {
      codDeliverBtn.addEventListener("click", () => {
        UI.showConfirm("Xác nhận đã giao hàng thành công và thu đủ tiền mặt từ khách hàng?", () => {
          const res = Orders.confirmCodDeliveredWithCash(order.id);
          modal.close();
          UI.showToast(res.message, "success");
          renderOrdersTab();
          renderOverviewTab();
        });
      });
    }

    // Sự kiện xác nhận đã nhận tiền chuyển khoản
    const bankingBtn = document.querySelector(".js-confirm-banking");
    if (bankingBtn) {
      bankingBtn.addEventListener("click", () => {
        const res = Orders.confirmBankTransfer(order.id);
        modal.close();
        UI.showToast(res.message, "success");
        renderOrdersTab();
        renderOverviewTab();
      });
    }

    // Sự kiện hoàn tiền
    const refundBtn = document.querySelector(".js-confirm-refund");
    if (refundBtn) {
      refundBtn.addEventListener("click", () => {
        const res = Orders.confirmRefund(order.id);
        modal.close();
        UI.showToast(res.message, "success");
        renderOrdersTab();
        renderOverviewTab();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initAdminPage);
})();

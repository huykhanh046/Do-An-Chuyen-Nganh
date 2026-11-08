/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Giỏ hàng (Cart Service)
 * Hỗ trợ giỏ khách (Guest Cart) và giỏ riêng theo từng tài khoản (User Cart).
 * Tự động hợp nhất (merge) giỏ hàng khi đăng nhập.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;

  const Cart = {
    // Xác định key lưu trữ giỏ hàng hiện tại (khách hoặc theo user ID)
    getStorageKey: function (customUserId = null) {
      if (customUserId) {
        return Storage.KEYS.USER_CART_PREFIX + customUserId;
      }
      const currentUser = HK.Auth ? HK.Auth.getCurrentUser() : null;
      if (currentUser && currentUser.id) {
        return Storage.KEYS.USER_CART_PREFIX + currentUser.id;
      }
      return Storage.KEYS.GUEST_CART;
    },

    // Lấy danh sách item thô trong giỏ hàng [{ productId, variantId, quantity }]
    getRawItems: function (customUserId = null) {
      const key = Cart.getStorageKey(customUserId);
      return Storage.get(key, []);
    },

    // Lưu danh sách item thô
    saveRawItems: function (items, customUserId = null) {
      const key = Cart.getStorageKey(customUserId);
      Storage.set(key, items);
      Cart.updateBadge();
      if (typeof document !== "undefined" && typeof CustomEvent === "function") {
        document.dispatchEvent(new CustomEvent("hk:cart-updated"));
      }
    },

    // Thêm sản phẩm vào giỏ hàng
    addToCart: function (productId, variantId, quantity = 1) {
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return { success: false, message: "Số lượng thêm vào giỏ không hợp lệ." };
      }

      const product = HK.Products.getById(productId);
      if (!product || product.status === "archived") {
        return { success: false, message: "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh." };
      }

      const variant = (product.variants || []).find((v) => v.id === variantId);
      if (!variant) {
        return { success: false, message: "Biến thể sản phẩm (size/màu) không hợp lệ." };
      }

      const availableStock = Number(variant.stock) || 0;
      if (availableStock <= 0) {
        return { success: false, message: "Biến thể này hiện đã hết hàng." };
      }

      const items = Cart.getRawItems();
      const existingIndex = items.findIndex(
        (i) => i.productId === productId && i.variantId === variantId
      );

      let newQuantity = qty;
      if (existingIndex > -1) {
        newQuantity = items[existingIndex].quantity + qty;
      }

      if (newQuantity > availableStock) {
        return {
          success: false,
          message: `Rất tiếc! Số lượng tối đa có thể thêm là ${availableStock} (Hiện bạn đã có ${
            existingIndex > -1 ? items[existingIndex].quantity : 0
          } trong giỏ).`
        };
      }

      if (existingIndex > -1) {
        items[existingIndex].quantity = newQuantity;
      } else {
        items.push({
          productId: productId,
          variantId: variantId,
          quantity: qty,
          addedAt: new Date().toISOString()
        });
      }

      Cart.saveRawItems(items);
      return { success: true, message: `Đã thêm vào giỏ hàng (${variant.size} - ${variant.colorName}).` };
    },

    // Cập nhật số lượng của một dòng trong giỏ
    updateQuantity: function (productId, variantId, newQuantity) {
      const qty = parseInt(newQuantity, 10);
      const items = Cart.getRawItems();
      const index = items.findIndex(
        (i) => i.productId === productId && i.variantId === variantId
      );

      if (index === -1) {
        return { success: false, message: "Sản phẩm không có trong giỏ hàng." };
      }

      if (qty <= 0) {
        // Nếu số lượng <= 0 thì coi như xóa
        return Cart.removeItem(productId, variantId);
      }

      const product = HK.Products.getById(productId);
      const variant = product ? (product.variants || []).find((v) => v.id === variantId) : null;
      const stock = variant ? Number(variant.stock) || 0 : 0;

      if (qty > stock) {
        items[index].quantity = stock;
        Cart.saveRawItems(items);
        return {
          success: false,
          adjusted: true,
          message: `Số lượng đã được tự động điều chỉnh về mức tồn kho tối đa (${stock}).`
        };
      }

      items[index].quantity = qty;
      Cart.saveRawItems(items);
      return { success: true, message: "Đã cập nhật số lượng." };
    },

    // Xóa một item khỏi giỏ
    removeItem: function (productId, variantId) {
      const items = Cart.getRawItems();
      const filtered = items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
      );
      Cart.saveRawItems(filtered);
      return { success: true, message: "Đã xóa sản phẩm khỏi giỏ hàng." };
    },

    // Xóa sạch toàn bộ giỏ
    clearCart: function (customUserId = null) {
      Cart.saveRawItems([], customUserId);
    },

    // Tính toán chi tiết giỏ hàng và dữ liệu hiển thị (luôn lấy giá và tồn kho thời gian thực)
    getCartSummary: function (customUserId = null) {
      const rawItems = Cart.getRawItems(customUserId);
      const items = [];
      let subtotal = 0;
      let totalCount = 0;
      let hasStockIssues = false;

      for (const item of rawItems) {
        const product = HK.Products.getById(item.productId);
        if (!product || product.status === "archived") {
          continue; // Bỏ qua sản phẩm đã bị xóa hoặc ngừng bán
        }

        const variant = (product.variants || []).find((v) => v.id === item.variantId);
        if (!variant) continue;

        const currentStock = Number(variant.stock) || 0;
        const validQuantity = Math.min(item.quantity, currentStock);

        if (validQuantity < item.quantity) {
          hasStockIssues = true;
        }

        const unitPrice = Number(product.price) || 0;
        const lineTotal = unitPrice * item.quantity;

        subtotal += lineTotal;
        totalCount += item.quantity;

        items.push({
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          categoryName: product.categoryName,
          image: (product.images && product.images[0]) || "assets/images/placeholder.svg",
          sku: variant.sku,
          size: variant.size,
          colorName: variant.colorName,
          colorCode: variant.colorCode,
          unitPrice: unitPrice,
          originalPrice: product.originalPrice,
          quantity: item.quantity,
          stock: currentStock,
          lineTotal: lineTotal,
          isOutOfStock: currentStock <= 0,
          isOverStock: item.quantity > currentStock
        });
      }

      // Phí vận chuyển: 30.000đ; Miễn phí nếu tạm tính >= 500.000đ
      const shippingFee = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
      const total = subtotal + shippingFee;

      return {
        items: items,
        totalCount: totalCount,
        subtotal: subtotal,
        shippingFee: shippingFee,
        total: total,
        freeShippingThreshold: 500000,
        amountToFreeShipping: Math.max(0, 500000 - subtotal),
        hasStockIssues: hasStockIssues
      };
    },

    // Hợp nhất giỏ hàng của khách (guest) vào giỏ của tài khoản khi đăng nhập
    mergeGuestCart: function (userId) {
      if (!userId) return;

      const guestItems = Storage.get(Storage.KEYS.GUEST_CART, []);
      if (!guestItems || guestItems.length === 0) return;

      const userKey = Storage.KEYS.USER_CART_PREFIX + userId;
      const userItems = Storage.get(userKey, []);

      let adjustedCount = 0;

      for (const gItem of guestItems) {
        const product = HK.Products.getById(gItem.productId);
        const variant = product ? (product.variants || []).find((v) => v.id === gItem.variantId) : null;
        const stock = variant ? Number(variant.stock) || 0 : 0;

        if (stock <= 0) continue; // Hết hàng thì bỏ qua

        const existingIndex = userItems.findIndex(
          (u) => u.productId === gItem.productId && u.variantId === gItem.variantId
        );

        if (existingIndex > -1) {
          const totalQty = userItems[existingIndex].quantity + gItem.quantity;
          if (totalQty > stock) {
            userItems[existingIndex].quantity = stock;
            adjustedCount++;
          } else {
            userItems[existingIndex].quantity = totalQty;
          }
        } else {
          const addQty = Math.min(gItem.quantity, stock);
          if (addQty < gItem.quantity) adjustedCount++;
          userItems.push({
            productId: gItem.productId,
            variantId: gItem.variantId,
            quantity: addQty,
            addedAt: new Date().toISOString()
          });
        }
      }

      // Lưu giỏ tài khoản
      Storage.set(userKey, userItems);

      // XÓA giỏ khách để tránh cộng dồn lặp lại ở lần sau
      Storage.remove(Storage.KEYS.GUEST_CART);

      // Cập nhật huy hiệu
      Cart.updateBadge();

      if (HK.UI && HK.UI.showToast) {
        if (adjustedCount > 0) {
          HK.UI.showToast("Đã đồng bộ giỏ hàng và điều chỉnh một số món theo tồn kho thực tế.", "info");
        } else {
          HK.UI.showToast("Đã đồng bộ giỏ hàng vào tài khoản của bạn.", "success");
        }
      }
    },

    // Cập nhật số lượng hiển thị trên icon giỏ hàng ở header (hỗ trợ hiệu ứng pop chuẩn Animate UI khi thay đổi)
    updateBadge: function (animate = true) {
      const summary = Cart.getCartSummary();
      const badgeElements = document.querySelectorAll(".js-cart-badge");
      badgeElements.forEach((badge) => {
        const prevText = badge.textContent;
        const nextText = String(summary.totalCount);
        badge.textContent = nextText;

        if (summary.totalCount > 0) {
          badge.classList.remove("hidden");
          badge.style.display = "inline-flex";
          if (animate && prevText !== nextText) {
            badge.classList.remove("badge-pop");
            void badge.offsetWidth;
            badge.classList.add("badge-pop");
          }
        } else {
          badge.classList.remove("badge-pop");
          badge.classList.add("hidden");
          badge.style.display = "none";
        }
      });
    }
  };

  HK.Cart = Cart;
})(window.HKStore);

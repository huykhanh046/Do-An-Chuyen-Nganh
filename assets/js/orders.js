/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Đơn hàng & Quản lý Kho (Orders Service)
 * Đảm bảo tính nhất quán dữ liệu, snapshot sản phẩm, trừ tồn kho và hoàn kho một lần duy nhất.
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;

  const Orders = {
    // Lấy toàn bộ đơn hàng (cho Admin)
    getAll: function () {
      return Storage.get(Storage.KEYS.ORDERS, []);
    },

    // Lấy danh sách đơn hàng của một người dùng cụ thể
    getByUserId: function (userId) {
      if (!userId) return [];
      const orders = Orders.getAll();
      return orders
        .filter((ord) => ord.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    // Lấy chi tiết một đơn hàng theo ID
    getById: function (orderId) {
      if (!orderId) return null;
      const orders = Orders.getAll();
      return orders.find((o) => o.id === orderId) || null;
    },

    // Tạo đơn hàng mới từ giỏ hàng hiện tại
    createOrder: function ({ customerInfo, paymentMethod, paymentProvider = null, paymentRef = null, paymentStatus = "pending" }) {
      const currentUser = HK.Auth.getCurrentUser();
      if (!currentUser) {
        return { success: false, message: "Bạn cần đăng nhập để hoàn tất đặt hàng." };
      }

      // 1. Kiểm tra giỏ hàng
      const summary = HK.Cart.getCartSummary(currentUser.id);
      if (!summary.items || summary.items.length === 0) {
        return { success: false, message: "Giỏ hàng của bạn đang trống." };
      }

      // 2. KIỂM TRA LẠI GIÁ VÀ TỒN KHO THỜI GIAN THỰC NGAY TRƯỚC KHI TẠO ĐƠN
      const products = Storage.get(Storage.KEYS.PRODUCTS, []);
      const orderItems = [];

      for (const cartItem of summary.items) {
        const prod = products.find((p) => p.id === cartItem.productId);
        if (!prod || prod.status === "archived") {
          return {
            success: false,
            message: `Sản phẩm "${cartItem.name}" không còn tồn tại hoặc đã ngừng kinh doanh. Vui lòng kiểm tra lại giỏ hàng.`
          };
        }

        const variant = (prod.variants || []).find((v) => v.id === cartItem.variantId);
        if (!variant) {
          return {
            success: false,
            message: `Biến thể size ${cartItem.size} - màu ${cartItem.colorName} của sản phẩm "${cartItem.name}" không còn tồn tại.`
          };
        }

        const currentStock = Number(variant.stock) || 0;
        if (currentStock < cartItem.quantity) {
          return {
            success: false,
            message: `Biến thể "${cartItem.name}" (${variant.size} - ${variant.colorName}) chỉ còn ${currentStock} cái trong kho (Bạn đặt ${cartItem.quantity}). Vui lòng điều chỉnh lại số lượng.`
          };
        }

        // Tạo bản chụp dữ liệu (SNAPSHOT) để tránh bị thay đổi khi sau này sản phẩm sửa giá/sửa tên
        orderItems.push({
          productId: prod.id,
          variantId: variant.id,
          name: prod.name,
          image: (prod.images && prod.images[0]) || "assets/images/placeholder.svg",
          sku: variant.sku,
          size: variant.size,
          colorName: variant.colorName,
          price: Number(prod.price),
          quantity: cartItem.quantity,
          lineTotal: Number(prod.price) * cartItem.quantity
        });
      }

      // 3. TRỪ TỒN KHO TỪ DANH SÁCH SẢN PHẨM
      for (const item of orderItems) {
        const prod = products.find((p) => p.id === item.productId);
        const variant = prod.variants.find((v) => v.id === item.variantId);
        variant.stock = Number(variant.stock) - item.quantity;
      }
      Storage.set(Storage.KEYS.PRODUCTS, products);

      // 4. TÍNH TOÁN LẠI TỔNG TIỀN TỪ DỮ LIỆU ĐƠN THỰC TẾ
      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const shippingFee = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
      const total = subtotal + shippingFee;

      // 5. TẠO BẢN GHI ĐƠN HÀNG
      const newOrder = {
        id: Storage.generateId("ORD"),
        userId: currentUser.id,
        customerInfo: {
          fullName: customerInfo.fullName.trim(),
          email: customerInfo.email.trim(),
          phone: customerInfo.phone.trim(),
          address: customerInfo.address.trim(),
          note: (customerInfo.note || "").trim()
        },
        items: orderItems,
        subtotal: subtotal,
        shippingFee: shippingFee,
        total: total,
        paymentMethod: paymentMethod, // 'cod' | 'banking' | 'gateway'
        paymentProvider: paymentProvider, // 'vnpay' | 'momo' | null
        paymentRef: paymentRef, // Mã phiên giao dịch QR (nếu có)
        paymentStatus: paymentStatus, // 'pending' | 'paid' | 'refund_pending' | 'refunded'
        orderStatus: "pending", // Mặc định là 'pending' (Chờ xác nhận)
        restocked: false, // Cờ kiểm soát hoàn kho chỉ chạy 1 lần khi hủy
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const orders = Orders.getAll();
      orders.unshift(newOrder);
      const saveOrderSuccess = Storage.set(Storage.KEYS.ORDERS, orders);

      if (!saveOrderSuccess) {
        // Rollback kho nếu lưu đơn thất bại
        for (const item of orderItems) {
          const prod = products.find((p) => p.id === item.productId);
          const variant = prod.variants.find((v) => v.id === item.variantId);
          variant.stock = Number(variant.stock) + item.quantity;
        }
        Storage.set(Storage.KEYS.PRODUCTS, products);
        return { success: false, message: "Lỗi lưu trữ dữ liệu. Vui lòng thử lại!" };
      }

      // 6. XÓA SẠCH GIỎ HÀNG CỦA TÀI KHOẢN SAU KHI ĐẶT THÀNH CÔNG
      HK.Cart.clearCart(currentUser.id);

      return {
        success: true,
        order: newOrder,
        message: "Đặt hàng thành công!"
      };
    },

    // Khách hàng hoặc Admin hủy đơn hàng
    cancelOrder: function (orderId, reason = "Khách hàng yêu cầu hủy") {
      const orders = Orders.getAll();
      const index = orders.findIndex((o) => o.id === orderId);

      if (index === -1) {
        return { success: false, message: "Không tìm thấy đơn hàng." };
      }

      const order = orders[index];

      // Chỉ được hủy khi đơn ở trạng thái 'pending' (hoặc 'confirmed' nếu là Admin)
      const currentUser = HK.Auth.getCurrentUser();
      const isAdmin = currentUser && currentUser.role === "admin";

      if (!isAdmin) {
        if (order.orderStatus !== "pending") {
          return { success: false, message: "Chỉ có thể hủy đơn hàng khi đơn đang ở trạng thái 'Chờ xác nhận'." };
        }
        if (order.userId !== currentUser.id) {
          return { success: false, message: "Bạn không có quyền thao tác trên đơn hàng này." };
        }
      } else {
        if (order.orderStatus !== "pending" && order.orderStatus !== "confirmed") {
          return { success: false, message: "Không thể hủy đơn hàng đang giao hoặc đã giao thành công." };
        }
      }

      // HOÀN KHO ĐÚNG 1 LẦN DUY NHẤT
      if (!order.restocked) {
        const products = Storage.get(Storage.KEYS.PRODUCTS, []);
        for (const item of order.items) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod && prod.variants) {
            const variant = prod.variants.find((v) => v.id === item.variantId);
            if (variant) {
              variant.stock = Number(variant.stock) + item.quantity;
            }
          }
        }
        Storage.set(Storage.KEYS.PRODUCTS, products);
        order.restocked = true;
      }

      // Nếu đơn đã thanh toán thì chuyển trạng thái thanh toán sang 'refund_pending' (Chờ hoàn tiền)
      if (order.paymentStatus === "paid") {
        order.paymentStatus = "refund_pending";
      }

      order.orderStatus = "cancelled";
      order.cancelReason = reason;
      order.updatedAt = new Date().toISOString();

      orders[index] = order;
      Storage.set(Storage.KEYS.ORDERS, orders);

      return { success: true, order: order, message: "Đã hủy đơn hàng và hoàn lại tồn kho thành công." };
    },

    // Cập nhật trạng thái đơn hàng (Luồng Admin)
    // Luồng chuẩn: "pending" (Chờ xác nhận) -> "confirmed" (Đã xác nhận) -> "shipping" (Đang giao) -> "delivered" (Đã giao)
    updateOrderStatus: function (orderId, newStatus) {
      const orders = Orders.getAll();
      const index = orders.findIndex((o) => o.id === orderId);
      if (index === -1) return { success: false, message: "Không tìm thấy đơn hàng." };

      const order = orders[index];

      // Đơn đã hủy hoặc đã giao không được phép quay lại trạng thái trước
      if (order.orderStatus === "cancelled") {
        return { success: false, message: "Đơn hàng đã hủy, không thể thay đổi trạng thái." };
      }
      if (order.orderStatus === "delivered" && newStatus !== "delivered") {
        return { success: false, message: "Đơn hàng đã giao thành công, không thể đổi về trạng thái trước đó." };
      }

      const validTransitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["shipping", "cancelled"],
        shipping: ["delivered"],
        delivered: []
      };

      const allowed = validTransitions[order.orderStatus] || [];
      if (!allowed.includes(newStatus)) {
        return {
          success: false,
          message: `Không thể chuyển trạng thái từ "${order.orderStatus}" sang "${newStatus}".`
        };
      }

      order.orderStatus = newStatus;
      order.updatedAt = new Date().toISOString();

      orders[index] = order;
      Storage.set(Storage.KEYS.ORDERS, orders);

      return { success: true, order: order, message: "Đã cập nhật trạng thái đơn hàng." };
    },

    // Cập nhật trạng thái thanh toán
    updatePaymentStatus: function (orderId, newStatus) {
      const orders = Orders.getAll();
      const index = orders.findIndex((o) => o.id === orderId);
      if (index === -1) return { success: false, message: "Không tìm thấy đơn hàng." };

      orders[index].paymentStatus = newStatus;
      orders[index].updatedAt = new Date().toISOString();

      Storage.set(Storage.KEYS.ORDERS, orders);
      return { success: true, order: orders[index], message: "Đã cập nhật trạng thái thanh toán." };
    },

    // Xác nhận đã nhận tiền chuyển khoản (Mô phỏng thao tác Admin)
    confirmBankTransfer: function (orderId) {
      return Orders.updatePaymentStatus(orderId, "paid");
    },

    // Xác nhận đã thu tiền khi giao hàng COD (Admin/Shipper)
    confirmCodDeliveredWithCash: function (orderId) {
      const orders = Orders.getAll();
      const index = orders.findIndex((o) => o.id === orderId);
      if (index === -1) return { success: false, message: "Không tìm thấy đơn hàng." };

      orders[index].orderStatus = "delivered";
      orders[index].paymentStatus = "paid";
      orders[index].updatedAt = new Date().toISOString();

      Storage.set(Storage.KEYS.ORDERS, orders);
      return { success: true, order: orders[index], message: "Đã xác nhận giao hàng và thu tiền COD thành công." };
    },

    // Xác nhận đã hoàn tiền mô phỏng (Admin)
    confirmRefund: function (orderId) {
      return Orders.updatePaymentStatus(orderId, "refunded");
    },

    // Tính toán số liệu thống kê Dashboard Admin theo thời gian thực
    getStatistics: function () {
      const products = HK.Products.getAll(false);
      const orders = Orders.getAll();

      const totalActiveProducts = products.length;
      const totalOrders = orders.length;
      const pendingOrders = orders.filter((o) => o.orderStatus === "pending").length;

      // Doanh thu chỉ tính từ đơn hàng đã giao (delivered) VÀ đã thanh toán (paid)
      const revenue = orders
        .filter((o) => o.orderStatus === "delivered" && o.paymentStatus === "paid")
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      // Thống kê tồn kho biến thể
      const lowStockVariants = [];
      const outOfStockVariants = [];

      for (const prod of products) {
        if (!prod.variants) continue;
        for (const v of prod.variants) {
          const s = Number(v.stock) || 0;
          const info = {
            productId: prod.id,
            productName: prod.name,
            sku: v.sku,
            size: v.size,
            colorName: v.colorName,
            stock: s
          };
          if (s === 0) {
            outOfStockVariants.push(info);
          } else if (s >= 1 && s <= 5) {
            lowStockVariants.push(info);
          }
        }
      }

      return {
        totalActiveProducts,
        totalOrders,
        pendingOrders,
        revenue,
        lowStockVariants,
        outOfStockVariants
      };
    }
  };

  HK.Orders = Orders;
})(window.HKStore);

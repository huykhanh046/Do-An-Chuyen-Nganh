/**
 * HK STORE - STREETWEAR MINIMALIST
 * Dịch vụ Quản lý Sản phẩm & Biến thể
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage;

  const Products = {
    // Lấy toàn bộ danh sách sản phẩm
    getAll: function (includeArchived = false) {
      const list = Storage.get(Storage.KEYS.PRODUCTS, []);
      if (includeArchived) return list;
      return list.filter((p) => p.status !== "archived");
    },

    // Lấy chi tiết sản phẩm theo ID
    getById: function (id) {
      if (!id) return null;
      const list = Storage.get(Storage.KEYS.PRODUCTS, []);
      return list.find((p) => p.id === id) || null;
    },

    // Tìm kiếm, lọc và phân trang nâng cao
    filterAndSort: function (options = {}) {
      const {
        category = "all",
        priceMin = null,
        priceMax = null,
        sizes = [], // Mảng các size, ví dụ: ['M', 'L']
        colors = [], // Mảng mã hoặc tên màu
        minRating = 0,
        inStockOnly = false,
        query = "",
        sortBy = "newest", // newest | price-asc | price-desc | rating-desc
        page = 1,
        pageSize = 8
      } = options;

      let list = Products.getAll(false);

      // 1. Lọc theo từ khóa tìm kiếm (tên hoặc mô tả, không phân biệt dấu/hoa thường)
      if (query && query.trim() !== "") {
        const normalizedQuery = Storage.normalizeText(query);
        list = list.filter((p) => {
          const normName = Storage.normalizeText(p.name);
          const normDesc = Storage.normalizeText(p.description);
          return normName.includes(normalizedQuery) || normDesc.includes(normalizedQuery);
        });
      }

      // 2. Lọc theo danh mục
      if (category && category !== "all") {
        list = list.filter((p) => p.category === category);
      }

      // 3. Lọc theo khoảng giá
      if (priceMin !== null && !isNaN(priceMin)) {
        list = list.filter((p) => p.price >= Number(priceMin));
      }
      if (priceMax !== null && !isNaN(priceMax)) {
        list = list.filter((p) => p.price <= Number(priceMax));
      }

      // 4. Lọc theo điểm đánh giá tối thiểu
      if (minRating > 0) {
        list = list.filter((p) => (p.rating || 0) >= Number(minRating));
      }

      // 5. Lọc kết hợp biến thể (Size, Màu, Còn hàng) trên CÙNG MỘT BIẾN THỂ phù hợp
      const hasSizeFilter = Array.isArray(sizes) && sizes.length > 0;
      const hasColorFilter = Array.isArray(colors) && colors.length > 0;

      if (hasSizeFilter || hasColorFilter || inStockOnly) {
        list = list.filter((p) => {
          if (!p.variants || !Array.isArray(p.variants) || p.variants.length === 0) {
            return false;
          }

          // Kiểm tra xem sản phẩm có ít nhất 1 biến thể thỏa mãn TẤT CẢ các tiêu chí này không
          return p.variants.some((v) => {
            // Kiểm tra size (OR trong nhóm sizes)
            if (hasSizeFilter && !sizes.includes(v.size)) {
              return false;
            }

            // Kiểm tra màu (OR trong nhóm colors)
            if (hasColorFilter && !colors.includes(v.colorName) && !colors.includes(v.colorCode)) {
              return false;
            }

            // Kiểm tra còn hàng
            if (inStockOnly && (Number(v.stock) || 0) <= 0) {
              return false;
            }

            return true;
          });
        });
      }

      // 6. Sắp xếp danh sách
      list.sort((a, b) => {
        switch (sortBy) {
          case "price-asc":
            return a.price - b.price;
          case "price-desc":
            return b.price - a.price;
          case "rating-desc":
            return (b.rating || 0) - (a.rating || 0);
          case "newest":
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

      // 7. Phân trang
      const totalResults = list.length;
      const totalPages = Math.ceil(totalResults / pageSize) || 1;
      const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const items = list.slice(startIndex, startIndex + pageSize);

      return {
        items: items,
        totalResults: totalResults,
        totalPages: totalPages,
        currentPage: currentPage,
        pageSize: pageSize
      };
    },

    // Kiểm tra SKU có bị trùng lặp không (ngoại trừ biến thể hiện tại)
    isSkuTaken: function (sku, currentVariantId = null) {
      if (!sku) return false;
      const normalizedSku = sku.trim().toUpperCase();
      const allProducts = Storage.get(Storage.KEYS.PRODUCTS, []);

      for (const prod of allProducts) {
        if (!prod.variants) continue;
        for (const v of prod.variants) {
          if (v.id !== currentVariantId && (v.sku || "").trim().toUpperCase() === normalizedSku) {
            return true;
          }
        }
      }
      return false;
    },

    // Thêm hoặc Cập nhật sản phẩm
    saveProduct: function (productData) {
      if (!productData.name || productData.name.trim() === "") {
        return { success: false, message: "Tên sản phẩm không được để trống." };
      }

      const price = Number(productData.price);
      if (isNaN(price) || price < 0) {
        return { success: false, message: "Giá bán phải là số nguyên không âm." };
      }

      let originalPrice = null;
      if (productData.originalPrice !== null && productData.originalPrice !== "" && productData.originalPrice !== undefined) {
        originalPrice = Number(productData.originalPrice);
        if (isNaN(originalPrice) || originalPrice < price) {
          return { success: false, message: "Giá gốc (nếu có) không được thấp hơn giá bán." };
        }
      }

      // Kiểm tra biến thể
      if (!productData.variants || !Array.isArray(productData.variants) || productData.variants.length === 0) {
        return { success: false, message: "Sản phẩm phải có ít nhất một biến thể (size, màu, tồn kho)." };
      }

      // Kiểm tra tính hợp lệ của từng biến thể
      const variantPairs = new Set();
      for (const v of productData.variants) {
        if (!v.size || !v.colorName) {
          return { success: false, message: "Biến thể phải có đầy đủ Size và Màu sắc." };
        }

        const pairKey = `${v.size.trim().toLowerCase()}__${v.colorName.trim().toLowerCase()}`;
        if (variantPairs.has(pairKey)) {
          return { success: false, message: `Trùng lặp biến thể cùng Size (${v.size}) và Màu (${v.colorName})!` };
        }
        variantPairs.add(pairKey);

        const stock = Number(v.stock);
        if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
          return { success: false, message: "Tồn kho biến thể phải là số nguyên không âm." };
        }

        if (Products.isSkuTaken(v.sku, v.id)) {
          return { success: false, message: `Mã SKU "${v.sku}" đã được sử dụng ở sản phẩm khác.` };
        }
      }

      const allProducts = Storage.get(Storage.KEYS.PRODUCTS, []);
      const isNew = !productData.id;

      let finalProduct;
      if (isNew) {
        finalProduct = {
          ...productData,
          id: Storage.generateId("sp"),
          price: price,
          originalPrice: originalPrice,
          rating: productData.rating || 5.0,
          reviewCount: productData.reviewCount || 0,
          status: productData.status || "active",
          createdAt: new Date().toISOString()
        };
        allProducts.unshift(finalProduct);
      } else {
        const index = allProducts.findIndex((p) => p.id === productData.id);
        if (index === -1) {
          return { success: false, message: "Không tìm thấy sản phẩm cần cập nhật." };
        }
        finalProduct = {
          ...allProducts[index],
          ...productData,
          price: price,
          originalPrice: originalPrice,
          updatedAt: new Date().toISOString()
        };
        allProducts[index] = finalProduct;
      }

      Storage.set(Storage.KEYS.PRODUCTS, allProducts);
      return { success: true, product: finalProduct };
    },

    // Kiểm tra sản phẩm đã phát sinh trong đơn hàng nào chưa
    hasOrders: function (productId) {
      const orders = Storage.get(Storage.KEYS.ORDERS, []);
      return orders.some((ord) => (ord.items || []).some((item) => item.productId === productId));
    },

    // Lưu trữ (ngừng bán) sản phẩm
    archiveProduct: function (id) {
      const allProducts = Storage.get(Storage.KEYS.PRODUCTS, []);
      const index = allProducts.findIndex((p) => p.id === id);
      if (index === -1) return { success: false, message: "Không tìm thấy sản phẩm." };

      allProducts[index].status = "archived";
      allProducts[index].updatedAt = new Date().toISOString();
      Storage.set(Storage.KEYS.PRODUCTS, allProducts);
      return { success: true, message: "Đã chuyển sản phẩm vào danh sách lưu trữ (ngừng bán)." };
    },

    // Xóa vĩnh viễn sản phẩm khỏi hệ thống theo yêu cầu Admin
    deleteProduct: function (id) {
      const allProducts = Storage.get(Storage.KEYS.PRODUCTS, []);
      const index = allProducts.findIndex((p) => p.id === id);
      if (index === -1) return { success: false, message: "Không tìm thấy sản phẩm." };

      // Đánh dấu ID đã xóa trên Cloud Database để không bị hồi sinh từ thiết bị khác hoặc seed.js
      if (HK.CloudDB && typeof HK.CloudDB.markDeleted === "function") {
        HK.CloudDB.markDeleted(id);
      }

      // Xóa hoàn toàn khỏi cơ sở dữ liệu localStorage & đẩy lên Cloud DB
      allProducts.splice(index, 1);
      Storage.set(Storage.KEYS.PRODUCTS, allProducts);

      return {
        success: true,
        archived: false,
        message: "Đã xóa sản phẩm"
      };
    }
  };

  HK.Products = Products;
})(window.HKStore);

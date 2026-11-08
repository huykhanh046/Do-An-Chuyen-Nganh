/**
 * HK STORE - STREETWEAR MINIMALIST
 * Logic Trang Giỏ hàng (Cart Page)
 */
(function () {
  "use strict";

  const Storage = HKStore.Storage;
  const Cart = HKStore.Cart;
  const UI = HKStore.UI;

  function initCartPage() {
    UI.initCommonUI();
    renderCart();
  }

  function renderCart() {
    const summary = Cart.getCartSummary();
    const tableBody = document.getElementById("cart-items-body");
    const emptyState = document.getElementById("cart-empty-state");
    const contentLayout = document.getElementById("cart-content-layout");

    if (!summary.items || summary.items.length === 0) {
      if (contentLayout) contentLayout.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    if (contentLayout) contentLayout.style.display = "grid";

    // Vẽ từng dòng sản phẩm
    if (tableBody) {
      tableBody.innerHTML = summary.items
        .map((item) => {
          return `
          <tr data-prod="${item.productId}" data-variant="${item.variantId}">
            <td>
              <div class="cart-item-info">
                <img src="${item.image}" alt="${Storage.escapeHTML(item.name)}" class="cart-item-img" onerror="this.src='assets/images/placeholder.svg'" />
                <div>
                  <div class="cart-item-title">
                    <a href="product.html?id=${item.productId}">${Storage.escapeHTML(item.name)}</a>
                  </div>
                  <div class="cart-item-variant">
                    <span>Size: <strong>${Storage.escapeHTML(item.size)}</strong></span> |
                    <span>Màu: <strong>${Storage.escapeHTML(item.colorName)}</strong></span>
                    ${item.isOverStock ? `<p class="text-danger"><small>Vượt tồn kho (Còn ${item.stock})</small></p>` : ""}
                  </div>
                </div>
              </div>
            </td>
            <td>${Storage.formatCurrency(item.unitPrice)}</td>
            <td>
              <div class="qty-control">
                <button type="button" class="qty-btn js-cart-minus" aria-label="Giảm số lượng">-</button>
                <input type="number" class="qty-input js-cart-qty-input" value="${item.quantity}" min="1" max="${item.stock}" aria-label="Số lượng ${Storage.escapeHTML(item.name)}" />
                <button type="button" class="qty-btn js-cart-plus" aria-label="Tăng số lượng">+</button>
              </div>
            </td>
            <td class="font-bold">${Storage.formatCurrency(item.lineTotal)}</td>
            <td>
              <button type="button" class="btn btn-sm btn-danger js-cart-remove" title="Xóa món này" aria-label="Xóa ${Storage.escapeHTML(item.name)}">
                &times;
              </button>
            </td>
          </tr>
        `;
        })
        .join("");

      // Gắn sự kiện tăng giảm số lượng & xóa
      tableBody.querySelectorAll("tr").forEach((row) => {
        const prodId = row.getAttribute("data-prod");
        const variantId = row.getAttribute("data-variant");
        const qtyInput = row.querySelector(".js-cart-qty-input");

        row.querySelector(".js-cart-minus").addEventListener("click", () => {
          let val = parseInt(qtyInput.value, 10) || 1;
          if (val > 1) {
            val--;
            Cart.updateQuantity(prodId, variantId, val);
            renderCart();
          } else {
            UI.showConfirm("Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?", () => {
              Cart.removeItem(prodId, variantId);
              renderCart();
            });
          }
        });

        row.querySelector(".js-cart-plus").addEventListener("click", () => {
          let val = parseInt(qtyInput.value, 10) || 1;
          val++;
          const res = Cart.updateQuantity(prodId, variantId, val);
          if (!res.success && res.adjusted) {
            UI.showToast(res.message, "warning");
          }
          renderCart();
        });

        qtyInput.addEventListener("change", () => {
          let val = parseInt(qtyInput.value, 10);
          if (isNaN(val) || val < 1) val = 1;
          const res = Cart.updateQuantity(prodId, variantId, val);
          if (!res.success && res.adjusted) {
            UI.showToast(res.message, "warning");
          }
          renderCart();
        });

        row.querySelector(".js-cart-remove").addEventListener("click", () => {
          UI.showConfirm("Xác nhận xóa sản phẩm này?", () => {
            Cart.removeItem(prodId, variantId);
            renderCart();
            UI.showToast("Đã xóa sản phẩm khỏi giỏ hàng.", "info");
          });
        });
      });
    }

    // Cập nhật Thẻ Tóm tắt Giỏ hàng
    const subtotalEl = document.getElementById("cart-subtotal");
    const shippingEl = document.getElementById("cart-shipping");
    const totalEl = document.getElementById("cart-total");
    const freeShippingEl = document.getElementById("free-shipping-note");

    if (subtotalEl) subtotalEl.textContent = Storage.formatCurrency(summary.subtotal);
    if (shippingEl) {
      shippingEl.textContent = summary.shippingFee === 0 ? "MIỄN PHÍ" : Storage.formatCurrency(summary.shippingFee);
    }
    if (totalEl) totalEl.textContent = Storage.formatCurrency(summary.total);

    if (freeShippingEl) {
      if (summary.amountToFreeShipping > 0) {
        freeShippingEl.innerHTML = `Mua thêm <strong>${Storage.formatCurrency(
          summary.amountToFreeShipping
        )}</strong> để được <strong>MIỄN PHÍ VẬN CHUYỂN</strong>.`;
      } else {
        freeShippingEl.innerHTML = `<span class="text-success font-bold">✓ Đơn hàng của bạn đã đủ điều kiện miễn phí vận chuyển toàn quốc!</span>`;
      }
    }

    // Sự kiện xóa sạch giỏ
    const clearBtn = document.getElementById("btn-clear-cart");
    if (clearBtn) {
      clearBtn.onclick = () => {
        UI.showConfirm("Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng?", () => {
          Cart.clearCart();
          renderCart();
          UI.showToast("Đã xóa sạch giỏ hàng.", "info");
        });
      };
    }
  }

  document.addEventListener("DOMContentLoaded", initCartPage);
})();

-- ==============================================================================
-- HK STORE - E-COMMERCE DATABASE SETUP SCRIPT (MYSQL 8.0+)
-- Bảng mã: utf8mb4 / Collation: utf8mb4_unicode_ci
-- Tác giả: Database Architect
-- Mô tả: Khởi tạo toàn bộ cơ sở dữ liệu MySQL và nạp dữ liệu mẫu chuẩn hóa:
--       - DUY NHẤT 1 TÀI KHOẢN ADMIN (admin@hkstore.vn)
--       - DUY NHẤT 1 TÀI KHOẢN KHÁCH HÀNG KIỂM THỬ GỐC (khach1@hkstore.vn)
--       - Đã loại bỏ toàn bộ các tài khoản thử nghiệm dư thừa.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PHẦN 1: THIẾT LẬP MÔI TRƯỜNG & KHỞI TẠO DATABASE
-- ------------------------------------------------------------------------------
SET NAMES utf8mb4;
SET TIME_ZONE = '+07:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `hk_store`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `hk_store`;

-- ------------------------------------------------------------------------------
-- PHẦN 2: XÓA CÁC BẢNG CŨ THEO THỨ TỰ RÀNG BUỘC (Bảng con -> Bảng cha)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `product_variants`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `user_addresses`;
DROP TABLE IF EXISTS `users`;

-- ------------------------------------------------------------------------------
-- PHẦN 3: ĐỊNH NGHĨA CẤU TRÚC LƯỢC ĐỒ (SCHEMA) BẢNG (Bảng cha -> Bảng con)
-- ------------------------------------------------------------------------------

-- 1. Bảng users: Lưu tài khoản Quản trị viên và Khách hàng
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tài khoản',
  `full_name` VARCHAR(150) NOT NULL COMMENT 'Họ và tên',
  `email` VARCHAR(150) NOT NULL COMMENT 'Email đăng nhập duy nhất',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Mật khẩu mã hóa Bcrypt',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT 'Số điện thoại liên hệ',
  `avatar_url` VARCHAR(500) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện',
  `role` ENUM('customer', 'admin') NOT NULL DEFAULT 'customer' COMMENT 'Phân quyền tài khoản',
  `status` ENUM('active', 'banned') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái hoạt động',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm đăng ký',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản người dùng & quản trị';

-- 2. Bảng user_addresses: Sổ địa chỉ giao hàng
CREATE TABLE `user_addresses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính địa chỉ',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại users.id',
  `receiver_name` VARCHAR(150) NOT NULL COMMENT 'Tên người nhận hàng',
  `receiver_phone` VARCHAR(20) NOT NULL COMMENT 'Số điện thoại nhận hàng',
  `street_address` VARCHAR(255) NOT NULL COMMENT 'Số nhà, tên đường, tòa nhà',
  `ward` VARCHAR(100) NOT NULL COMMENT 'Phường / Xã',
  `district` VARCHAR(100) NOT NULL COMMENT 'Quận / Huyện',
  `city` VARCHAR(100) NOT NULL COMMENT 'Tỉnh / Thành phố',
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đánh dấu địa chỉ mặc định',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_addresses_user_id` (`user_id`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sổ địa chỉ nhận hàng';

-- 3. Bảng categories: Danh mục sản phẩm (Hỗ trợ phân cấp đa tầng)
CREATE TABLE `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính danh mục',
  `name` VARCHAR(100) NOT NULL COMMENT 'Tên danh mục',
  `slug` VARCHAR(120) NOT NULL COMMENT 'Đường dẫn SEO duy nhất',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả danh mục',
  `parent_id` INT UNSIGNED DEFAULT NULL COMMENT 'Danh mục cha (nếu có)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  INDEX `idx_categories_parent_id` (`parent_id`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục thời trang';

-- 4. Bảng products: Thông tin tổng quan sản phẩm
CREATE TABLE `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính sản phẩm',
  `category_id` INT UNSIGNED NOT NULL COMMENT 'Khóa ngoại categories.id',
  `name` VARCHAR(255) NOT NULL COMMENT 'Tên sản phẩm',
  `slug` VARCHAR(255) NOT NULL COMMENT 'Đường dẫn SEO duy nhất',
  `description` LONGTEXT DEFAULT NULL COMMENT 'Bài viết mô tả chi tiết',
  `base_price` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Giá niêm yết cơ bản (VNĐ)',
  `thumbnail_url` VARCHAR(500) DEFAULT NULL COMMENT 'Ảnh thumbnail đại diện',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '1: Đang bán, 0: Ngừng bán',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  INDEX `idx_products_category_id` (`category_id`),
  INDEX `idx_products_is_active` (`is_active`),
  INDEX `idx_products_base_price` (`base_price`),
  INDEX `idx_products_created_at` (`created_at`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sản phẩm bán hàng';

-- 5. Bảng product_variants: Biến thể Size, Màu sắc và Tồn kho SKU
CREATE TABLE `product_variants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính biến thể',
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại products.id',
  `sku` VARCHAR(100) NOT NULL COMMENT 'Mã quản lý tồn kho duy nhất',
  `size` VARCHAR(20) NOT NULL COMMENT 'Kích cỡ (S, M, L, XL...)',
  `color` VARCHAR(50) NOT NULL COMMENT 'Màu sắc (Đen, Trắng, Xám...)',
  `price` DECIMAL(12,0) NOT NULL COMMENT 'Giá bán thực tế biến thể (VNĐ)',
  `stock_quantity` INT NOT NULL DEFAULT 0 COMMENT 'Số lượng tồn kho',
  `image_url` VARCHAR(500) DEFAULT NULL COMMENT 'Ảnh tương ứng của biến thể',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variants_sku` (`sku`),
  UNIQUE KEY `uq_variants_product_size_color` (`product_id`, `size`, `color`),
  INDEX `idx_variants_product_id` (`product_id`),
  INDEX `idx_variants_stock` (`stock_quantity`),
  CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Biến thể size, màu sắc và kho SKU';

-- 6. Bảng cart_items: Giỏ hàng đồng bộ Database của tài khoản
CREATE TABLE `cart_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính mục giỏ hàng',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại users.id',
  `variant_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại product_variants.id',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT 'Số lượng chọn mua',
  `added_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm thêm vào giỏ',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_user_variant` (`user_id`, `variant_id`),
  INDEX `idx_cart_user_id` (`user_id`),
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Giỏ hàng lưu Database';

-- 7. Bảng orders: Thông tin tổng quan đơn hàng
CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính đơn hàng',
  `order_code` VARCHAR(50) NOT NULL COMMENT 'Mã đơn hàng hiển thị (VD: ORD-20261101-001)',
  `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Khóa ngoại users.id (SET NULL nếu user bị xóa)',
  `shipping_address_snapshot` TEXT NOT NULL COMMENT 'Bản chụp thông tin người nhận và địa chỉ lúc mua',
  `subtotal` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Tiền hàng trước ship (VNĐ)',
  `shipping_fee` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Phí giao hàng (VNĐ)',
  `total_amount` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Tổng thanh toán = subtotal + shipping_fee',
  `payment_method` ENUM('cod', 'bank_transfer', 'vnpay') NOT NULL DEFAULT 'cod' COMMENT 'Phương thức thanh toán',
  `payment_status` ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid' COMMENT 'Trạng thái thanh toán',
  `order_status` ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái đơn hàng',
  `shipping_carrier` VARCHAR(50) DEFAULT 'spx' COMMENT 'Đơn vị vận chuyển (spx, ghn, ghtk...)',
  `tracking_code` VARCHAR(50) DEFAULT NULL COMMENT 'Mã vận đơn giao hàng',
  `note` TEXT DEFAULT NULL COMMENT 'Ghi chú đơn hàng',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_code` (`order_code`),
  INDEX `idx_orders_user_id` (`user_id`),
  INDEX `idx_orders_status` (`order_status`),
  INDEX `idx_orders_payment_status` (`payment_status`),
  INDEX `idx_orders_tracking_code` (`tracking_code`),
  INDEX `idx_orders_created_at` (`created_at`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Đơn đặt hàng';

-- 8. Bảng order_items: Chi tiết các mặt hàng trong đơn (Bản chụp lịch sử snapshot)
CREATE TABLE `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính chi tiết đơn',
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại orders.id',
  `variant_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Khóa ngoại product_variants.id (SET NULL nếu biến thể bị xóa)',
  `product_name_snapshot` VARCHAR(255) NOT NULL COMMENT 'Bản chụp tên sản phẩm lúc mua',
  `variant_info_snapshot` VARCHAR(255) NOT NULL COMMENT 'Bản chụp SKU, Size, Màu sắc lúc mua',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT 'Số lượng sản phẩm',
  `unit_price` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Đơn giá lúc mua (VNĐ)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_order_items_order_id` (`order_id`),
  INDEX `idx_order_items_variant_id` (`variant_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết mặt hàng trong đơn hàng';

-- Kích hoạt lại kiểm tra ràng buộc khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- PHẦN 4: NẠP DỮ LIỆU MẪU CHUẨN HÓA (SEED DATA)
-- ------------------------------------------------------------------------------

-- 1. Nạp users: CHỈ GIỮ LẠI ĐÚNG 2 TÀI KHOẢN CHUẨN CỦA DỰ ÁN
-- [1] Tài khoản Quản trị viên: admin@hkstore.vn (Mật khẩu: admin1234)
-- [2] Tài khoản Khách hàng gốc: khach1@hkstore.vn (Mật khẩu: khach1234)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `avatar_url`, `role`, `status`, `created_at`) VALUES
(1, 'Quản Trị Viên HK', 'admin@hkstore.vn', '$2y$10$wT6gqL/dM85QWv77vH0E.eQG48vD1a9O5Q0Wp.XoYx1e1c.9PZ.aG', '0965811846', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80', 'admin', 'active', '2026-01-01 00:00:00'),
(2, 'Nguyễn Văn An', 'khach1@hkstore.vn', '$2y$10$eE2K/J9sW5t5l1w6.4g8Pe7R9u0A1b2C3d4E5f6G7h8I9j0K1l2M3', '0901234567', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', 'customer', 'active', '2026-08-15 10:00:00');

-- 2. Nạp sổ địa chỉ user_addresses (Gắn với tài khoản khách hàng Nguyễn Văn An)
INSERT INTO `user_addresses` (`id`, `user_id`, `receiver_name`, `receiver_phone`, `street_address`, `ward`, `district`, `city`, `is_default`) VALUES
(1, 2, 'Nguyễn Văn An', '0901234567', '123 Đường Lê Lợi', 'Phường Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', 1),
(2, 2, 'Nguyễn Văn An (Cơ quan)', '0901234567', 'Tòa nhà Bitexco, Số 2 Hải Triều', 'Phường Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', 0);

-- 3. Nạp danh mục categories (4 danh mục đặc trưng của HK Store)
INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `parent_id`) VALUES
(1, 'Áo Thun', 'ao-thun', 'Áo thun Oversize, Boxy Fit chất liệu 100% Cotton định lượng cao thoáng mát', NULL),
(2, 'Áo Khoác & Hoodie', 'ao-khoac-hoodie', 'Áo khoác Bomber, Varsity Jacket và Hoodie nỉ bông ấm áp cá tính', NULL),
(3, 'Quần Streetwear', 'quan-streetwear', 'Quần Cargo Pants nhiều túi đa năng, Quần Jean Baggy ống suông phong cách đường phố', NULL),
(4, 'Phụ Kiện', 'phu-kien', 'Nón lưỡi trai Washed Denim, Túi Mini Crossbody, Phụ kiện phong cách tối giản', NULL);

-- 4. Nạp sản phẩm products (8 sản phẩm thời trang Streetwear thực tế)
INSERT INTO `products` (`id`, `category_id`, `name`, `slug`, `description`, `base_price`, `thumbnail_url`, `is_active`) VALUES
(1, 1, 'Áo Thun Boxy Heavyweight Minimalist', 'ao-thun-boxy-heavyweight-minimalist', 'Chất vải 100% Cotton định lượng 260gsm dày dặn, form dáng Boxy tôn dáng, bo cổ dệt 3cm không bai dão sau nhiều lần giặt.', 350000, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/ig-@mikeysvendetta.jpg', 1),
(2, 1, 'Áo Thun Acid Wash Vintage Graphic', 'ao-thun-acid-wash-vintage-graphic', 'Hiệu ứng wash loang xám cổ điển phong cách Grunge đường phố, in lụa thủ công sắc nét bền bỉ.', 390000, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80', 1),
(3, 2, 'Áo Khoác Bomber Varsity Phối Tay Da', 'ao-khoac-bomber-varsity-phoi-tay-da', 'Thân dạ ép Hàn Quốc giữ nhiệt tối đa, phối tay da PU cao cấp chống nứt, cúc bấm kim loại đúc nguyên khối cá tính.', 850000, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80', 1),
(4, 2, 'Áo Hoodie Zip Nỉ Bông Boxy Fit', 'ao-hoodie-zip-ni-bong-boxy-fit', 'Nỉ chân cua cào bông mềm mịn, khóa kéo zip 2 chiều tiện lợi tạo kiểu, mũ 2 lớp đứng form giữ ấm mùa đông.', 550000, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80', 1),
(5, 3, 'Quần Jean Baggy Rách Gối Xanh Nhạt', 'quan-jean-baggy-rach-goi-xanh-nhat', 'Denim 14oz không co giãn giữ form suông rộng, wash màu vintage kết hợp rách gối nhẹ tạo điểm nhấn năng động.', 490000, 'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80', 1),
(6, 3, 'Quần Cargo Pants 6 Túi Ống Suông', 'quan-cargo-pants-6-tui-ong-suong', 'Vải Kaki Cotton chéo dày dặn đứng dáng, 6 túi nắp gập tiện dụng đựng điện thoại, ví tiền và phụ kiện.', 450000, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80', 1),
(7, 4, 'Nón Lưỡi Trai Washed Denim Cap', 'non-luoi-trai-washed-denim-cap', 'Chất liệu Denim giặt wash xước bụi bặm, khóa cài đồng dập logo chìm, form nón ôm đầu thoải mái.', 190000, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80', 1),
(8, 4, 'Túi Đeo Chéo Mini Crossbody Bag', 'tui-deo-cheo-mini-crossbody-bag', 'Vải Cordura trượt nước chống bám bụi, nhiều ngăn tiện lợi với khóa kéo chống nước YKK độ bền cao.', 280000, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', 1);

-- 5. Nạp biến thể chi tiết product_variants (2–3 biến thể / sản phẩm, gắn SKU, size, màu, giá và tồn kho)
INSERT INTO `product_variants` (`id`, `product_id`, `sku`, `size`, `color`, `price`, `stock_quantity`, `image_url`) VALUES
-- Sản phẩm 1: Áo Thun Boxy Heavyweight
(1, 1, 'AT-BOXY-BLK-M', 'M', 'Đen', 350000, 45, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/ig-@mikeysvendetta.jpg'),
(2, 1, 'AT-BOXY-BLK-L', 'L', 'Đen', 350000, 30, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/ig-@mikeysvendetta.jpg'),
(3, 1, 'AT-BOXY-WHT-L', 'L', 'Trắng', 350000, 25, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),

-- Sản phẩm 2: Áo Thun Acid Wash
(4, 2, 'AT-ACID-GRY-M', 'M', 'Xám Wash', 390000, 20, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),
(5, 2, 'AT-ACID-GRY-L', 'L', 'Xám Wash', 390000, 15, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),

-- Sản phẩm 3: Áo Khoác Bomber Varsity
(6, 3, 'AK-VARSITY-BLK-L', 'L', 'Đen', 850000, 12, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80'),
(7, 3, 'AK-VARSITY-BLK-XL', 'XL', 'Đen', 850000, 8, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80'),
(8, 3, 'AK-VARSITY-GRN-L', 'L', 'Xanh Rêu', 850000, 10, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80'),

-- Sản phẩm 4: Áo Hoodie Zip Nỉ Bông
(9, 4, 'HD-ZIP-BLK-M', 'M', 'Đen', 550000, 22, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),
(10, 4, 'HD-ZIP-BLK-L', 'L', 'Đen', 550000, 18, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),
(11, 4, 'HD-ZIP-GRY-L', 'L', 'Xám Tiêu', 550000, 14, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),

-- Sản phẩm 5: Quần Jean Baggy
(12, 5, 'QJ-BAGGY-BLU-M', 'M', 'Xanh Nhạt', 490000, 35, 'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80'),
(13, 5, 'QJ-BAGGY-BLU-L', 'L', 'Xanh Nhạt', 490000, 40, 'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80'),

-- Sản phẩm 6: Quần Cargo Pants 6 Túi
(14, 6, 'QC-CARGO-BLK-M', 'M', 'Đen', 450000, 25, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(15, 6, 'QC-CARGO-BLK-L', 'L', 'Đen', 450000, 20, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(16, 6, 'QC-CARGO-KHA-L', 'L', 'Khaki Be', 450000, 16, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),

-- Sản phẩm 7: Nón Lưỡi Trai Washed Denim
(17, 7, 'PK-CAP-BLK-ONESIZE', 'One Size', 'Đen', 190000, 50, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'),
(18, 7, 'PK-CAP-BLU-ONESIZE', 'One Size', 'Xanh Denim', 190000, 45, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'),

-- Sản phẩm 8: Túi Đeo Chéo Mini Crossbody
(19, 8, 'PK-BAG-BLK-ONESIZE', 'One Size', 'Đen', 280000, 30, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'),
(20, 8, 'PK-BAG-GRY-ONESIZE', 'One Size', 'Xám Khói', 280000, 25, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80');

-- 6. Nạp giỏ hàng mẫu cart_items (Gắn với tài khoản khách hàng Nguyễn Văn An)
INSERT INTO `cart_items` (`id`, `user_id`, `variant_id`, `quantity`, `added_at`) VALUES
(1, 2, 6, 1, '2026-11-08 10:00:00'), -- Nguyễn Văn An đang để Áo Bomber Varsity (L - Đen) trong giỏ
(2, 2, 17, 1, '2026-11-08 10:05:00'); -- Nguyễn Văn An đang để Nón Cap Đen trong giỏ

-- 7. Nạp đơn đặt hàng orders: TẤT CẢ 5 ĐƠN HÀNG ĐỀU THUỘC TÀI KHOẢN KHÁCH HÀNG KIỂM THỬ GỐC (user_id = 2)
-- Đơn hàng >= 500,000 VNĐ được Miễn phí vận chuyển (shipping_fee = 0), ngược lại phí ship chuẩn 30,000 VNĐ.
INSERT INTO `orders` (`id`, `order_code`, `user_id`, `shipping_address_snapshot`, `subtotal`, `shipping_fee`, `total_amount`, `payment_method`, `payment_status`, `order_status`, `shipping_carrier`, `tracking_code`, `note`, `created_at`) VALUES
-- Đơn 1: Chờ xác nhận (Pending - COD - Chưa thanh toán)
(1, 'ORD-20261101-001', 2, 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 700000, 0, 700000, 'cod', 'unpaid', 'pending', 'spx', NULL, 'Vui lòng gọi trước khi giao 15 phút', '2026-11-01 08:30:00'),

-- Đơn 2: Đã xác nhận (Confirmed - Chuyển khoản ngân hàng - Đã nhận tiền)
(2, 'ORD-20261102-002', 2, 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 580000, 0, 580000, 'bank_transfer', 'paid', 'confirmed', 'ghn', NULL, 'Giao trong giờ hành chính', '2026-11-02 10:15:00'),

-- Đơn 3: Đang giao hàng (Shipping - VNPAY - Đã gắn mã vận đơn)
(3, 'ORD-20261103-003', 2, 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 1340000, 0, 1340000, 'vnpay', 'paid', 'shipping', 'spx', 'SPXVN0987654321', 'Giao hàng hỏa tốc', '2026-11-03 14:00:00'),

-- Đơn 4: Giao thành công (Completed - COD - Đã thanh toán tiền mặt)
(4, 'ORD-20261104-004', 2, 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 830000, 0, 830000, 'cod', 'paid', 'completed', 'ghtk', 'GHTKVN123456789', 'Để hàng tại quầy lễ tân nếu đi vắng', '2026-11-04 16:20:00'),

-- Đơn 5: Đã hủy (Cancelled - VNPAY - Đã hoàn tiền cho khách)
(5, 'ORD-20261105-005', 2, 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 450000, 30000, 480000, 'vnpay', 'refunded', 'cancelled', 'spx', NULL, 'Khách hàng đổi ý muốn chọn size khác, đã hoàn tiền tự động qua cổng VNPAY', '2026-11-05 09:10:00');

-- 8. Nạp chi tiết sản phẩm đơn hàng order_items (Số lượng và đơn giá nhân ra khớp chính xác 100% với subtotal của bảng orders)
INSERT INTO `order_items` (`id`, `order_id`, `variant_id`, `product_name_snapshot`, `variant_info_snapshot`, `quantity`, `unit_price`, `created_at`) VALUES
-- Chi tiết cho Đơn 1: Subtotal = 2 x 350,000 = 700,000 VNĐ
(1, 1, 1, 'Áo Thun Boxy Heavyweight Minimalist', 'SKU: AT-BOXY-BLK-M | Size: M | Màu: Đen', 2, 350000, '2026-11-01 08:30:00'),

-- Chi tiết cho Đơn 2: Subtotal = (1 x 390,000) + (1 x 190,000) = 580,000 VNĐ
(2, 2, 4, 'Áo Thun Acid Wash Vintage Graphic', 'SKU: AT-ACID-GRY-M | Size: M | Màu: Xám Wash', 1, 390000, '2026-11-02 10:15:00'),
(3, 2, 17, 'Nón Lưỡi Trai Washed Denim Cap', 'SKU: PK-CAP-BLK-ONESIZE | Size: One Size | Màu: Đen', 1, 190000, '2026-11-02 10:15:00'),

-- Chi tiết cho Đơn 3: Subtotal = (1 x 850,000) + (1 x 490,000) = 1,340,000 VNĐ
(4, 3, 6, 'Áo Khoác Bomber Varsity Phối Tay Da', 'SKU: AK-VARSITY-BLK-L | Size: L | Màu: Đen', 1, 850000, '2026-11-03 14:00:00'),
(5, 3, 13, 'Quần Jean Baggy Rách Gối Xanh Nhạt', 'SKU: QJ-BAGGY-BLU-L | Size: L | Màu: Xanh Nhạt', 1, 490000, '2026-11-03 14:00:00'),

-- Chi tiết cho Đơn 4: Subtotal = (1 x 550,000) + (1 x 280,000) = 830,000 VNĐ
(6, 4, 10, 'Áo Hoodie Zip Nỉ Bông Boxy Fit', 'SKU: HD-ZIP-BLK-L | Size: L | Màu: Đen', 1, 550000, '2026-11-04 16:20:00'),
(7, 4, 19, 'Túi Đeo Chéo Mini Crossbody Bag', 'SKU: PK-BAG-BLK-ONESIZE | Size: One Size | Màu: Đen', 1, 280000, '2026-11-04 16:20:00'),

-- Chi tiết cho Đơn 5: Subtotal = 1 x 450,000 = 450,000 VNĐ (+ Ship 30,000 = 480,000 VNĐ)
(8, 5, 15, 'Quần Cargo Pants 6 Túi Ống Suông', 'SKU: QC-CARGO-BLK-L | Size: L | Màu: Đen', 1, 450000, '2026-11-05 09:10:00');

-- ------------------------------------------------------------------------------
-- PHẦN 5: BÁO CÁO TỔNG HỢP KIỂM ĐỊNH SAU KHI NẠP DỮ LIỆU
-- ------------------------------------------------------------------------------
SELECT 'users (Chỉ 2 tài khoản)' AS 'Kiểm tra', COUNT(*) AS 'Tổng số dòng' FROM `users`
UNION ALL
SELECT 'user_addresses', COUNT(*) FROM `user_addresses`
UNION ALL
SELECT 'categories', COUNT(*) FROM `categories`
UNION ALL
SELECT 'products', COUNT(*) FROM `products`
UNION ALL
SELECT 'product_variants', COUNT(*) FROM `product_variants`
UNION ALL
SELECT 'cart_items', COUNT(*) FROM `cart_items`
UNION ALL
SELECT 'orders (5 trạng thái)', COUNT(*) FROM `orders`
UNION ALL
SELECT 'order_items', COUNT(*) FROM `order_items`;

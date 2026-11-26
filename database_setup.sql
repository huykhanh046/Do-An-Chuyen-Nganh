-- ==============================================================================
-- HK STORE - E-COMMERCE DATABASE SETUP SCRIPT (MYSQL 8.0+ / MARIADB 10.11+)
-- Bảng mã: utf8mb4 / Collation: utf8mb4_unicode_ci
-- Tác giả: Database Architect
-- Mô tả: Khởi tạo toàn bộ 10 bảng CSDL MySQL cho HK Store và nạp dữ liệu mẫu:
--       - DUY NHẤT 1 TÀI KHOẢN ADMIN (admin@hkstore.vn / admin1234)
--       - DUY NHẤT 1 TÀI KHOẢN KHÁCH HÀNG KIỂM THỬ GỐC (khach1@hkstore.vn / khach1234)
--       - Đầy đủ danh mục, sản phẩm, biến thể, giỏ hàng, đơn hàng, đánh giá, yêu thích.
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
DROP TABLE IF EXISTS `wishlists`;
DROP TABLE IF EXISTS `product_reviews`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `product_variants`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `user_addresses`;
DROP TABLE IF EXISTS `users`;

-- ------------------------------------------------------------------------------
-- PHẦN 3: ĐỊNH NGHĨA CẤU TRÚC LƯỢC ĐỒ (SCHEMA) 10 BẢNG (Bảng cha -> Bảng con)
-- ------------------------------------------------------------------------------

-- 1. Bảng users: Lưu tài khoản Quản trị viên và Khách hàng
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tài khoản',
  `full_name` VARCHAR(150) NOT NULL COMMENT 'Họ và tên',
  `email` VARCHAR(150) NOT NULL COMMENT 'Email đăng nhập duy nhất',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Mật khẩu băm Scrypt (scrypt$salt$hash)',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT 'Số điện thoại liên hệ',
  `address` VARCHAR(500) DEFAULT '' COMMENT 'Địa chỉ giao hàng mặc định',
  `avatar_url` VARCHAR(500) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện',
  `role` ENUM('customer', 'admin') NOT NULL DEFAULT 'customer' COMMENT 'Phân quyền tài khoản',
  `status` ENUM('active', 'banned') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái hoạt động',
  `is_email_verified` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đã xác thực Gmail OTP hay chưa',
  `email_verified_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm xác thực Gmail',
  `last_login_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Lần đăng nhập gần nhất',
  `login_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tổng số lần đăng nhập',
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
  `ward` VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'Phường / Xã',
  `district` VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'Quận / Huyện',
  `city` VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'Tỉnh / Thành phố',
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
  `badge` VARCHAR(50) DEFAULT NULL COMMENT 'Nhãn nổi bật (Mới, Bán chạy, Giảm giá)',
  `description` LONGTEXT DEFAULT NULL COMMENT 'Bài viết mô tả chi tiết',
  `base_price` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Giá bán thực tế (VNĐ)',
  `original_price` DECIMAL(12,0) DEFAULT NULL COMMENT 'Giá gốc trước giảm (VNĐ)',
  `material` VARCHAR(255) DEFAULT '100% Cotton định lượng cao' COMMENT 'Chất liệu vải',
  `fit` VARCHAR(100) DEFAULT 'Boxy Oversize' COMMENT 'Form dáng sản phẩm',
  `thumbnail_url` VARCHAR(500) DEFAULT NULL COMMENT 'Ảnh thumbnail đại diện',
  `images_json` TEXT DEFAULT NULL COMMENT 'Danh sách URL ảnh dạng JSON array',
  `rating` DECIMAL(3,1) NOT NULL DEFAULT 5.0 COMMENT 'Điểm đánh giá trung bình',
  `review_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lượt đánh giá',
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
  `size` VARCHAR(20) NOT NULL COMMENT 'Kích cỡ (S, M, L, XL, One size...)',
  `color` VARCHAR(50) NOT NULL COMMENT 'Tên màu sắc (Đen, Trắng, Xám...)',
  `color_code` VARCHAR(20) NOT NULL DEFAULT '#111111' COMMENT 'Mã màu HEX hiển thị swatch',
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
  `customer_name` VARCHAR(150) DEFAULT NULL COMMENT 'Tên người nhận',
  `customer_email` VARCHAR(150) DEFAULT NULL COMMENT 'Email nhận hóa đơn',
  `customer_phone` VARCHAR(20) DEFAULT NULL COMMENT 'SĐT người nhận',
  `customer_address` VARCHAR(500) DEFAULT NULL COMMENT 'Địa chỉ giao hàng',
  `shipping_address_snapshot` TEXT NOT NULL COMMENT 'Bản chụp thông tin người nhận và địa chỉ lúc mua',
  `subtotal` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Tiền hàng trước ship (VNĐ)',
  `shipping_fee` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Phí giao hàng (VNĐ)',
  `total_amount` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Tổng thanh toán = subtotal + shipping_fee',
  `payment_method` ENUM('cod', 'banking', 'bank_transfer', 'gateway', 'vnpay', 'momo') NOT NULL DEFAULT 'cod' COMMENT 'Phương thức thanh toán',
  `payment_provider` VARCHAR(30) DEFAULT NULL COMMENT 'Cổng thanh toán QR (vnpay, momo)',
  `payment_ref` VARCHAR(100) DEFAULT NULL COMMENT 'Mã phiên giao dịch thanh toán QR',
  `payment_status` ENUM('pending', 'unpaid', 'paid', 'refund_pending', 'refunded') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái thanh toán',
  `order_status` ENUM('pending', 'confirmed', 'shipping', 'delivered', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái đơn hàng',
  `shipping_carrier` VARCHAR(50) DEFAULT '' COMMENT 'Mã đơn vị vận chuyển (spx, ghn, ghtk...)',
  `shipping_carrier_name` VARCHAR(100) DEFAULT '' COMMENT 'Tên hiển thị đơn vị vận chuyển',
  `tracking_code` VARCHAR(50) DEFAULT NULL COMMENT 'Mã vận đơn giao hàng',
  `tracking_updated_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm cập nhật mã vận đơn',
  `restocked` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đánh dấu đã hoàn kho khi hủy đơn',
  `cancel_reason` VARCHAR(500) DEFAULT NULL COMMENT 'Lý do hủy đơn',
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
  `product_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Khóa ngoại products.id (tham chiếu mềm)',
  `variant_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Khóa ngoại product_variants.id (SET NULL nếu biến thể bị xóa)',
  `product_name_snapshot` VARCHAR(255) NOT NULL COMMENT 'Bản chụp tên sản phẩm lúc mua',
  `variant_info_snapshot` VARCHAR(255) NOT NULL COMMENT 'Bản chụp SKU, Size, Màu sắc lúc mua',
  `sku_snapshot` VARCHAR(100) DEFAULT NULL COMMENT 'Bản chụp SKU',
  `size_snapshot` VARCHAR(30) DEFAULT NULL COMMENT 'Bản chụp Size',
  `color_name_snapshot` VARCHAR(60) DEFAULT NULL COMMENT 'Bản chụp tên màu',
  `image_snapshot` VARCHAR(500) DEFAULT NULL COMMENT 'Bản chụp ảnh sản phẩm',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT 'Số lượng sản phẩm',
  `unit_price` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Đơn giá lúc mua (VNĐ)',
  `line_total` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Thành tiền = unit_price * quantity',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_order_items_order_id` (`order_id`),
  INDEX `idx_order_items_variant_id` (`variant_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết mặt hàng trong đơn hàng';

-- 9. Bảng product_reviews: Đánh giá và cảm nhận form dáng từ khách hàng
CREATE TABLE `product_reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính đánh giá',
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại products.id',
  `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Khóa ngoại users.id (NULL nếu khách vãng lai)',
  `author_name` VARCHAR(150) NOT NULL COMMENT 'Tên hiển thị người đánh giá',
  `rating` TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Số sao đánh giá (1-5)',
  `fit_spec` VARCHAR(120) DEFAULT '' COMMENT 'Chiều cao, cân nặng & size đã chọn',
  `fit_feel` VARCHAR(100) DEFAULT 'Chuẩn form Oversize' COMMENT 'Cảm nhận form dáng',
  `comment` TEXT NOT NULL COMMENT 'Nội dung nhận xét',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_reviews_product_id` (`product_id`),
  INDEX `idx_reviews_user_id` (`user_id`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Đánh giá sản phẩm';

-- 10. Bảng wishlists: Danh sách sản phẩm yêu thích đồng bộ theo tài khoản
CREATE TABLE `wishlists` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính wishlist',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại users.id',
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT 'Khóa ngoại products.id',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlists_user_product` (`user_id`, `product_id`),
  INDEX `idx_wishlists_user_id` (`user_id`),
  CONSTRAINT `fk_wishlists_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wishlists_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sản phẩm yêu thích';

-- Kích hoạt lại kiểm tra ràng buộc khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- PHẦN 4: NẠP DỮ LIỆU MẪU CHUẨN HÓA (SEED DATA)
-- ------------------------------------------------------------------------------

-- 1. Nạp users: CHỈ GIỮ LẠI ĐÚNG 2 TÀI KHOẢN CHUẨN CỦA DỰ ÁN
-- [1] Tài khoản Quản trị viên: admin@hkstore.vn (Mật khẩu gốc: admin1234)
-- [2] Tài khoản Khách hàng gốc: khach1@hkstore.vn (Mật khẩu gốc: khach1234)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `phone`, `address`, `avatar_url`, `role`, `status`, `is_email_verified`, `email_verified_at`, `created_at`) VALUES
(1, 'Quản trị viên HK', 'admin@hkstore.vn', 'scrypt$7e8dee074bbd6c2725c50cb0811bed86$65555c74e56bdacb18f64b42fb39a30f9da4c5fbda8212322da142308020b32e8d8766f03383a8ffc23e0f55074e9aad29a9239ad7f423363748595ae2bd99ae', '0965811846', 'Showroom HK Store - 126 Thanh Vinh 10, Phường Hoà Khánh Bắc, TP. Đà Nẵng', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80', 'admin', 'active', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
(2, 'Nguyễn Văn An', 'khach1@hkstore.vn', 'scrypt$265ca56369af11114f314d004050147b$88a16f0d0e27d1132b15ada0c232e82f5f667384bea61054f429841c5d1292b0782023351f9fd5b4bf3b3d5d134001b6c189a3de7056e7d324c668fb9b2a6417', '0901234567', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', 'customer', 'active', 1, '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- 2. Nạp sổ địa chỉ user_addresses (Gắn với tài khoản khách hàng Nguyễn Văn An)
INSERT INTO `user_addresses` (`id`, `user_id`, `receiver_name`, `receiver_phone`, `street_address`, `ward`, `district`, `city`, `is_default`) VALUES
(1, 2, 'Nguyễn Văn An', '0901234567', '123 Đường Lê Lợi', 'Phường Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', 1),
(2, 2, 'Nguyễn Văn An (Cơ quan)', '0901234567', 'Tòa nhà Bitexco, Số 2 Hải Triều', 'Phường Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', 0);

-- 3. Nạp danh mục categories (5 danh mục khớp 100% với Frontend HK Store)
INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `parent_id`) VALUES
(1, 'Áo thun', 'ao-thun', 'Áo thun Oversize, Boxy Fit chất liệu 100% Cotton định lượng cao thoáng mát', NULL),
(2, 'Hoodie & Sweater', 'hoodie-sweater', 'Áo Hoodie nỉ bông và Sweater form rộng ấm áp cá tính', NULL),
(3, 'Quần', 'quan', 'Quần Cargo Pants nhiều túi đa năng, Quần Jean Baggy ống suông đường phố', NULL),
(4, 'Áo khoác', 'ao-khoac', 'Áo khoác Bomber, Varsity Jacket và Workwear Jacket đứng form', NULL),
(5, 'Phụ kiện', 'phu-kien', 'Nón lưỡi trai Washed Denim, Túi Mini Crossbody, Phụ kiện phong cách tối giản', NULL);

-- 4. Nạp sản phẩm products (8 sản phẩm Streetwear thực tế phủ đủ 5 danh mục)
INSERT INTO `products` (`id`, `category_id`, `name`, `slug`, `badge`, `description`, `base_price`, `original_price`, `material`, `fit`, `thumbnail_url`, `images_json`, `rating`, `review_count`, `is_active`, `created_at`) VALUES
(1, 1, 'Áo Thun Boxy Heavyweight Minimalist', 'ao-thun-boxy-heavyweight-minimalist', 'Mới', 'Chất vải 100% Cotton định lượng 260gsm dày dặn, form dáng Boxy tôn dáng, bo cổ dệt 3cm không bai dão sau nhiều lần giặt.', 350000, NULL, '100% Cotton 260gsm', 'Boxy Oversize', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01RhOyGV1pvKazoF0FF_!!2211437675422.webp', '["https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01RhOyGV1pvKazoF0FF_!!2211437675422.webp","https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01wy9qx31pvKaypdPOn_!!2211437675422.webp"]', 5.0, 2, 1, '2026-11-08 09:19:05'),
(2, 1, 'Áo Thun Acid Wash Vintage Graphic', 'ao-thun-acid-wash-vintage-graphic', 'Bán chạy', 'Hiệu ứng wash loang xám cổ điển phong cách Grunge đường phố, in lụa thủ công sắc nét bền bỉ.', 390000, 450000, 'Cotton Compact 250gsm', 'Oversize Fit', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80', '["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80"]', 4.9, 1, 1, '2026-11-07 09:19:05'),
(3, 4, 'Áo Khoác Bomber Varsity Phối Tay Da', 'ao-khoac-bomber-varsity-phoi-tay-da', 'Bán chạy', 'Thân dạ ép Hàn Quốc giữ nhiệt tối đa, phối tay da PU cao cấp chống nứt, cúc bấm kim loại đúc nguyên khối cá tính.', 850000, NULL, 'Dạ ép Hàn Quốc & Da PU', 'Boxy Oversize', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/O1CN011RX7QH1pvKYVMc63m_!!2211437675422.webp', '["https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/O1CN011RX7QH1pvKYVMc63m_!!2211437675422.webp","https://6ae2d7c9faf5cc20900f415a.imgix.net/images1/O1CN018uJxB01pvKZXS5KkF_!!2211437675422.webp"]', 5.0, 1, 1, '2026-11-08 09:13:10'),
(4, 2, 'Áo Hoodie Zip Nỉ Bông Boxy Fit', 'ao-hoodie-zip-ni-bong-boxy-fit', 'Mới', 'Nỉ chân cua cào bông mềm mịn, khóa kéo zip 2 chiều tiện lợi tạo kiểu, mũ 2 lớp đứng form giữ ấm mùa đông.', 550000, NULL, 'Nỉ bông Cotton 380gsm', 'Boxy Oversize', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01ESr5I61pvKacPdlUo_!!2211437675422.webp', '["https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01ESr5I61pvKacPdlUo_!!2211437675422.webp","https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80"]', 5.0, 1, 1, '2026-11-08 09:23:00'),
(5, 3, 'Quần Jean Baggy Rách Gối Xanh Nhạt', 'quan-jean-baggy-rach-goi-xanh-nhat', 'Giảm giá', 'Denim 14oz không co giãn giữ form suông rộng, wash màu vintage kết hợp rách gối nhẹ tạo điểm nhấn năng động.', 380000, 450000, 'Denim 100% Cotton 14oz', 'Baggy Ống Suông', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01pvbNPp1pvKZ3SqDAO_!!2211437675422.webp', '["https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01pvbNPp1pvKZ3SqDAO_!!2211437675422.webp","https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01PZifYV1pvKZ42qR2l_!!2211437675422.webp"]', 4.9, 1, 1, '2026-11-08 09:21:10'),
(6, 3, 'Quần Cargo Pants 6 Túi Ống Suông', 'quan-cargo-pants-6-tui-ong-suong', 'Bán chạy', 'Vải Kaki Cotton chéo dày dặn đứng dáng, 6 túi nắp gập tiện dụng đựng điện thoại, ví tiền và phụ kiện.', 450000, NULL, 'Kaki Cotton chéo cao cấp', 'Wide Cargo Fit', 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80', '["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80"]', 4.8, 0, 1, '2026-11-06 10:00:00'),
(7, 5, 'Nón Lưỡi Trai Washed Denim Cap', 'non-luoi-trai-washed-denim-cap', NULL, 'Chất liệu Denim giặt wash xước bụi bặm, khóa cài đồng dập logo chìm, form nón ôm đầu thoải mái.', 190000, NULL, 'Washed Denim Canvas', 'Free Size', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80', '["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80"]', 5.0, 0, 1, '2026-11-05 10:00:00'),
(8, 5, 'Túi Đeo Chéo Mini Crossbody Bag', 'tui-deo-cheo-mini-crossbody-bag', 'Mới', 'Vải Cordura trượt nước chống bám bụi, nhiều ngăn tiện lợi với khóa kéo chống nước YKK độ bền cao.', 280000, NULL, 'Cordura 1000D Trượt nước', 'Compact Utility', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80"]', 4.9, 0, 1, '2026-11-04 10:00:00');

-- 5. Nạp biến thể chi tiết product_variants (20 biến thể gắn SKU, size, màu, mã màu HEX, giá và tồn kho)
INSERT INTO `product_variants` (`id`, `product_id`, `sku`, `size`, `color`, `color_code`, `price`, `stock_quantity`, `image_url`) VALUES
-- Sản phẩm 1: Áo Thun Boxy Heavyweight
(1, 1, 'AT-BOXY-BLK-M', 'M', 'Đen', '#111111', 350000, 45, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01RhOyGV1pvKazoF0FF_!!2211437675422.webp'),
(2, 1, 'AT-BOXY-BLK-L', 'L', 'Đen', '#111111', 350000, 30, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01RhOyGV1pvKazoF0FF_!!2211437675422.webp'),
(3, 1, 'AT-BOXY-NVY-L', 'L', 'Xanh Than', '#003366', 350000, 25, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01wy9qx31pvKaypdPOn_!!2211437675422.webp'),

-- Sản phẩm 2: Áo Thun Acid Wash
(4, 2, 'AT-ACID-GRY-M', 'M', 'Xám Wash', '#6E7278', 390000, 20, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),
(5, 2, 'AT-ACID-GRY-L', 'L', 'Xám Wash', '#6E7278', 390000, 15, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),

-- Sản phẩm 3: Áo Khoác Bomber Varsity
(6, 3, 'AK-VARSITY-BLK-L', 'L', 'Đen', '#111111', 850000, 12, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/O1CN011RX7QH1pvKYVMc63m_!!2211437675422.webp'),
(7, 3, 'AK-VARSITY-BLK-XL', 'XL', 'Đen', '#111111', 850000, 8, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/O1CN011RX7QH1pvKYVMc63m_!!2211437675422.webp'),
(8, 3, 'AK-VARSITY-GRN-L', 'L', 'Xanh Rêu', '#3D5245', 850000, 4, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/images1/O1CN018uJxB01pvKZXS5KkF_!!2211437675422.webp'),

-- Sản phẩm 4: Áo Hoodie Zip Nỉ Bông
(9, 4, 'HD-ZIP-BLK-M', 'M', 'Đen', '#111111', 550000, 22, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01ESr5I61pvKacPdlUo_!!2211437675422.webp'),
(10, 4, 'HD-ZIP-BLK-L', 'L', 'Đen', '#111111', 550000, 18, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01ESr5I61pvKacPdlUo_!!2211437675422.webp'),
(11, 4, 'HD-ZIP-GRY-L', 'L', 'Xám Chuột', '#C0C0C0', 550000, 14, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),

-- Sản phẩm 5: Quần Jean Baggy
(12, 5, 'QJ-BAGGY-BLU-M', 'M', 'Xanh Nhạt', '#66CCFF', 380000, 35, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01pvbNPp1pvKZ3SqDAO_!!2211437675422.webp'),
(13, 5, 'QJ-BAGGY-BLU-L', 'L', 'Xanh Nhạt', '#66CCFF', 380000, 40, 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01pvbNPp1pvKZ3SqDAO_!!2211437675422.webp'),

-- Sản phẩm 6: Quần Cargo Pants 6 Túi
(14, 6, 'QC-CARGO-BLK-M', 'M', 'Đen', '#111111', 450000, 25, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(15, 6, 'QC-CARGO-BLK-L', 'L', 'Đen', '#111111', 450000, 20, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(16, 6, 'QC-CARGO-KHA-L', 'L', 'Khaki Be', '#C2B280', 450000, 16, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),

-- Sản phẩm 7: Nón Lưỡi Trai Washed Denim
(17, 7, 'PK-CAP-BLK-ONESIZE', 'One size', 'Đen', '#111111', 190000, 50, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'),
(18, 7, 'PK-CAP-BLU-ONESIZE', 'One size', 'Xanh Denim', '#4A6FA5', 190000, 45, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'),

-- Sản phẩm 8: Túi Đeo Chéo Mini Crossbody
(19, 8, 'PK-BAG-BLK-ONESIZE', 'One size', 'Đen', '#111111', 280000, 30, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'),
(20, 8, 'PK-BAG-GRY-ONESIZE', 'One size', 'Xám Khói', '#70757A', 280000, 25, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80');

-- 6. Nạp giỏ hàng mẫu cart_items (Gắn với tài khoản khách hàng Nguyễn Văn An)
INSERT INTO `cart_items` (`id`, `user_id`, `variant_id`, `quantity`, `added_at`) VALUES
(1, 2, 6, 1, '2026-11-08 10:00:00'),
(2, 2, 17, 1, '2026-11-08 10:05:00');

-- 7. Nạp đơn đặt hàng orders: TẤT CẢ 5 ĐƠN HÀNG ĐỀU THUỘC TÀI KHOẢN KHÁCH HÀNG KIỂM THỬ GỐC (user_id = 2)
-- Đơn hàng >= 500,000 VNĐ được Miễn phí vận chuyển (shipping_fee = 0), ngược lại phí ship chuẩn 30,000 VNĐ.
INSERT INTO `orders` (`id`, `order_code`, `user_id`, `customer_name`, `customer_email`, `customer_phone`, `customer_address`, `shipping_address_snapshot`, `subtotal`, `shipping_fee`, `total_amount`, `payment_method`, `payment_provider`, `payment_ref`, `payment_status`, `order_status`, `shipping_carrier`, `shipping_carrier_name`, `tracking_code`, `tracking_updated_at`, `restocked`, `cancel_reason`, `note`, `created_at`) VALUES
(1, 'ORD-20261101-001', 2, 'Nguyễn Văn An', 'khach1@hkstore.vn', '0901234567', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 700000, 0, 700000, 'cod', NULL, NULL, 'pending', 'pending', 'spx', 'SPX Express (Shopee)', NULL, NULL, 0, NULL, 'Vui lòng gọi trước khi giao 15 phút', '2026-11-01 08:30:00'),
(2, 'ORD-20261102-002', 2, 'Nguyễn Văn An', 'khach1@hkstore.vn', '0901234567', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 580000, 0, 580000, 'banking', NULL, NULL, 'paid', 'confirmed', 'ghn', 'GHN - Giao Hàng Nhanh', NULL, NULL, 0, NULL, 'Giao trong giờ hành chính', '2026-11-02 10:15:00'),
(3, 'ORD-20261103-003', 2, 'Nguyễn Văn An', 'khach1@hkstore.vn', '0901234567', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 1230000, 0, 1230000, 'gateway', 'vnpay', 'HKQR-VNPAY-272992', 'paid', 'shipping', 'spx', 'SPX Express (Shopee)', 'SPXVN0987654321', '2026-11-03 14:30:00', 0, NULL, 'Giao hàng hỏa tốc', '2026-11-03 14:00:00'),
(4, 'ORD-20261104-004', 2, 'Nguyễn Văn An', 'khach1@hkstore.vn', '0901234567', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 830000, 0, 830000, 'cod', NULL, NULL, 'paid', 'delivered', 'ghtk', 'GHTK - Giao Hàng Tiết Kiệm', 'GHTKVN123456789', '2026-11-04 17:00:00', 0, NULL, 'Để hàng tại quầy lễ tân nếu đi vắng', '2026-11-04 16:20:00'),
(5, 'ORD-20261105-005', 2, 'Nguyễn Văn An', 'khach1@hkstore.vn', '0901234567', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 450000, 30000, 480000, 'gateway', 'vnpay', 'HKQR-VNPAY-819204', 'refunded', 'cancelled', 'spx', 'SPX Express (Shopee)', NULL, NULL, 1, 'Khách hàng đổi ý muốn chọn size khác', 'Đã hoàn tiền tự động qua cổng VNPAY', '2026-11-05 09:10:00');

-- 8. Nạp chi tiết sản phẩm đơn hàng order_items (Khớp 100% với subtotal của bảng orders)
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `variant_id`, `product_name_snapshot`, `variant_info_snapshot`, `sku_snapshot`, `size_snapshot`, `color_name_snapshot`, `image_snapshot`, `quantity`, `unit_price`, `line_total`, `created_at`) VALUES
-- Đơn 1: 2 x 350,000 = 700,000 VNĐ
(1, 1, 1, 1, 'Áo Thun Boxy Heavyweight Minimalist', 'SKU: AT-BOXY-BLK-M | Size: M | Màu: Đen', 'AT-BOXY-BLK-M', 'M', 'Đen', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01RhOyGV1pvKazoF0FF_!!2211437675422.webp', 2, 350000, 700000, '2026-11-01 08:30:00'),
-- Đơn 2: 390,000 + 190,000 = 580,000 VNĐ
(2, 2, 2, 4, 'Áo Thun Acid Wash Vintage Graphic', 'SKU: AT-ACID-GRY-M | Size: M | Màu: Xám Wash', 'AT-ACID-GRY-M', 'M', 'Xám Wash', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80', 1, 390000, 390000, '2026-11-02 10:15:00'),
(3, 2, 7, 17, 'Nón Lưỡi Trai Washed Denim Cap', 'SKU: PK-CAP-BLK-ONESIZE | Size: One size | Màu: Đen', 'PK-CAP-BLK-ONESIZE', 'One size', 'Đen', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80', 1, 190000, 190000, '2026-11-02 10:15:00'),
-- Đơn 3: 850,000 + 380,000 = 1,230,000 VNĐ
(4, 3, 3, 6, 'Áo Khoác Bomber Varsity Phối Tay Da', 'SKU: AK-VARSITY-BLK-L | Size: L | Màu: Đen', 'AK-VARSITY-BLK-L', 'L', 'Đen', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/O1CN011RX7QH1pvKYVMc63m_!!2211437675422.webp', 1, 850000, 850000, '2026-11-03 14:00:00'),
(5, 3, 5, 13, 'Quần Jean Baggy Rách Gối Xanh Nhạt', 'SKU: QJ-BAGGY-BLU-L | Size: L | Màu: Xanh Nhạt', 'QJ-BAGGY-BLU-L', 'L', 'Xanh Nhạt', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01pvbNPp1pvKZ3SqDAO_!!2211437675422.webp', 1, 380000, 380000, '2026-11-03 14:00:00'),
-- Đơn 4: 550,000 + 280,000 = 830,000 VNĐ
(6, 4, 4, 10, 'Áo Hoodie Zip Nỉ Bông Boxy Fit', 'SKU: HD-ZIP-BLK-L | Size: L | Màu: Đen', 'HD-ZIP-BLK-L', 'L', 'Đen', 'https://6ae2d7c9faf5cc20900f415a.imgix.net/O1CN01ESr5I61pvKacPdlUo_!!2211437675422.webp', 1, 550000, 550000, '2026-11-04 16:20:00'),
(7, 4, 8, 19, 'Túi Đeo Chéo Mini Crossbody Bag', 'SKU: PK-BAG-BLK-ONESIZE | Size: One size | Màu: Đen', 'PK-BAG-BLK-ONESIZE', 'One size', 'Đen', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', 1, 280000, 280000, '2026-11-04 16:20:00'),
-- Đơn 5: 1 x 450,000 = 450,000 VNĐ (+ Ship 30,000 = 480,000 VNĐ)
(8, 5, 6, 15, 'Quần Cargo Pants 6 Túi Ống Suông', 'SKU: QC-CARGO-BLK-L | Size: L | Màu: Đen', 'QC-CARGO-BLK-L', 'L', 'Đen', 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80', 1, 450000, 450000, '2026-11-05 09:10:00');

-- 9. Nạp đánh giá sản phẩm mẫu (product_reviews)
INSERT INTO `product_reviews` (`id`, `product_id`, `user_id`, `author_name`, `rating`, `fit_spec`, `fit_feel`, `comment`, `created_at`) VALUES
(1, 1, 2, 'Nguyễn Văn An', 5, '1m72 · 64kg · Size M', 'Chuẩn form Oversize', 'Chất cotton dày 260gsm mặc rất đứng form, bo cổ dày không bị dão sau nhiều lần giặt.', '2026-11-06 11:20:00'),
(2, 4, 2, 'Nguyễn Văn An', 5, '1m72 · 64kg · Size L', 'Rộng thoải mái', 'Nỉ bông mềm ấm, khóa kéo zip 2 chiều rất mượt, lên dáng cực kỳ streetwear.', '2026-11-07 15:40:00');

-- 10. Nạp danh sách yêu thích mẫu (wishlists)
INSERT INTO `wishlists` (`id`, `user_id`, `product_id`, `created_at`) VALUES
(1, 2, 3, '2026-11-08 09:45:00');

-- ------------------------------------------------------------------------------
-- PHẦN 5: BÁO CÁO TỔNG HỢP KIỂM ĐỊNH SAU KHI NẠP DỮ LIỆU (10 BẢNG)
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
SELECT 'order_items', COUNT(*) FROM `order_items`
UNION ALL
SELECT 'product_reviews', COUNT(*) FROM `product_reviews`
UNION ALL
SELECT 'wishlists', COUNT(*) FROM `wishlists`;

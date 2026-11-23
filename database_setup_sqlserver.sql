-- ==============================================================================
-- HK STORE - E-COMMERCE DATABASE SETUP SCRIPT (MICROSOFT SQL SERVER 2019/2022/2025)
-- Quản trị qua: SQL Server Management Studio (SSMS)
-- Hệ thống: Microsoft SQL Server (T-SQL)
-- Dữ liệu chuẩn:
--   [1] Tài khoản Quản trị viên (Admin): admin@hkstore.vn (Mật khẩu: admin1234)
--   [2] Tài khoản Khách hàng gốc: khach1@hkstore.vn (Mật khẩu: khach1234)
--   Toàn bộ tài khoản thử nghiệm dư thừa đã được xóa sạch.
-- ==============================================================================

USE [master];
GO

-- 1. Tạo cơ sở dữ liệu hk_store nếu chưa tồn tại
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'hk_store')
BEGIN
    CREATE DATABASE [hk_store] COLLATE Vietnamese_CI_AS;
END
GO

USE [hk_store];
GO

-- 2. Xóa các bảng cũ theo thứ tự ràng buộc khóa ngoại (Bảng con -> Bảng cha)
IF OBJECT_ID(N'[dbo].[order_items]', N'U') IS NOT NULL DROP TABLE [dbo].[order_items];
IF OBJECT_ID(N'[dbo].[orders]', N'U') IS NOT NULL DROP TABLE [dbo].[orders];
IF OBJECT_ID(N'[dbo].[cart_items]', N'U') IS NOT NULL DROP TABLE [dbo].[cart_items];
IF OBJECT_ID(N'[dbo].[product_variants]', N'U') IS NOT NULL DROP TABLE [dbo].[product_variants];
IF OBJECT_ID(N'[dbo].[products]', N'U') IS NOT NULL DROP TABLE [dbo].[products];
IF OBJECT_ID(N'[dbo].[categories]', N'U') IS NOT NULL DROP TABLE [dbo].[categories];
IF OBJECT_ID(N'[dbo].[user_addresses]', N'U') IS NOT NULL DROP TABLE [dbo].[user_addresses];
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NOT NULL DROP TABLE [dbo].[users];
GO

-- ------------------------------------------------------------------------------
-- 3. ĐỊNH NGHĨA CẤU TRÚC BẢNG (T-SQL)
-- ------------------------------------------------------------------------------

-- 3.1 Bảng users
CREATE TABLE [dbo].[users] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [full_name] NVARCHAR(150) NOT NULL,
    [email] NVARCHAR(150) NOT NULL CONSTRAINT [uq_users_email] UNIQUE,
    [password_hash] NVARCHAR(255) NOT NULL,
    [phone] NVARCHAR(20) NULL,
    [avatar_url] NVARCHAR(500) NULL,
    [role] NVARCHAR(20) NOT NULL DEFAULT N'customer' CONSTRAINT [chk_users_role] CHECK ([role] IN (N'customer', N'admin')),
    [status] NVARCHAR(20) NOT NULL DEFAULT N'active' CONSTRAINT [chk_users_status] CHECK ([status] IN (N'active', N'banned')),
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- 3.2 Bảng user_addresses
CREATE TABLE [dbo].[user_addresses] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [user_id] BIGINT NOT NULL CONSTRAINT [fk_addresses_user] FOREIGN KEY REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
    [receiver_name] NVARCHAR(150) NOT NULL,
    [receiver_phone] NVARCHAR(20) NOT NULL,
    [street_address] NVARCHAR(255) NOT NULL,
    [ward] NVARCHAR(100) NOT NULL,
    [district] NVARCHAR(100) NOT NULL,
    [city] NVARCHAR(100) NOT NULL,
    [is_default] BIT NOT NULL DEFAULT 0,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- 3.3 Bảng categories
CREATE TABLE [dbo].[categories] (
    [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(100) NOT NULL,
    [slug] NVARCHAR(120) NOT NULL CONSTRAINT [uq_categories_slug] UNIQUE,
    [description] NVARCHAR(MAX) NULL,
    [parent_id] INT NULL CONSTRAINT [fk_categories_parent] FOREIGN KEY REFERENCES [dbo].[categories]([id]),
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- 3.4 Bảng products
CREATE TABLE [dbo].[products] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [category_id] INT NOT NULL CONSTRAINT [fk_products_category] FOREIGN KEY REFERENCES [dbo].[categories]([id]),
    [name] NVARCHAR(255) NOT NULL,
    [slug] NVARCHAR(255) NOT NULL CONSTRAINT [uq_products_slug] UNIQUE,
    [description] NVARCHAR(MAX) NULL,
    [base_price] DECIMAL(18,0) NOT NULL DEFAULT 0,
    [thumbnail_url] NVARCHAR(500) NULL,
    [is_active] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- 3.5 Bảng product_variants
CREATE TABLE [dbo].[product_variants] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [product_id] BIGINT NOT NULL CONSTRAINT [fk_variants_product] FOREIGN KEY REFERENCES [dbo].[products]([id]) ON DELETE CASCADE,
    [sku] NVARCHAR(100) NOT NULL CONSTRAINT [uq_variants_sku] UNIQUE,
    [size] NVARCHAR(20) NOT NULL,
    [color] NVARCHAR(50) NOT NULL,
    [price] DECIMAL(18,0) NOT NULL,
    [stock_quantity] INT NOT NULL DEFAULT 0,
    [image_url] NVARCHAR(500) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [uq_variants_product_size_color] UNIQUE ([product_id], [size], [color])
);
GO

-- 3.6 Bảng cart_items
CREATE TABLE [dbo].[cart_items] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [user_id] BIGINT NOT NULL CONSTRAINT [fk_cart_user] FOREIGN KEY REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
    [variant_id] BIGINT NOT NULL CONSTRAINT [fk_cart_variant] FOREIGN KEY REFERENCES [dbo].[product_variants]([id]) ON DELETE CASCADE,
    [quantity] INT NOT NULL DEFAULT 1,
    [added_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT [uq_cart_user_variant] UNIQUE ([user_id], [variant_id])
);
GO

-- 3.7 Bảng orders
CREATE TABLE [dbo].[orders] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [order_code] NVARCHAR(50) NOT NULL CONSTRAINT [uq_orders_code] UNIQUE,
    [user_id] BIGINT NULL CONSTRAINT [fk_orders_user] FOREIGN KEY REFERENCES [dbo].[users]([id]) ON DELETE SET NULL,
    [shipping_address_snapshot] NVARCHAR(MAX) NOT NULL,
    [subtotal] DECIMAL(18,0) NOT NULL DEFAULT 0,
    [shipping_fee] DECIMAL(18,0) NOT NULL DEFAULT 0,
    [total_amount] DECIMAL(18,0) NOT NULL DEFAULT 0,
    [payment_method] NVARCHAR(30) NOT NULL DEFAULT N'cod' CONSTRAINT [chk_orders_paymethod] CHECK ([payment_method] IN (N'cod', N'bank_transfer', N'vnpay')),
    [payment_status] NVARCHAR(30) NOT NULL DEFAULT N'unpaid' CONSTRAINT [chk_orders_paystatus] CHECK ([payment_status] IN (N'unpaid', N'paid', N'refunded')),
    [order_status] NVARCHAR(30) NOT NULL DEFAULT N'pending' CONSTRAINT [chk_orders_status] CHECK ([order_status] IN (N'pending', N'confirmed', N'shipping', N'completed', N'cancelled')),
    [shipping_carrier] NVARCHAR(50) DEFAULT N'spx',
    [tracking_code] NVARCHAR(50) NULL,
    [note] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- 3.8 Bảng order_items
CREATE TABLE [dbo].[order_items] (
    [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [order_id] BIGINT NOT NULL CONSTRAINT [fk_order_items_order] FOREIGN KEY REFERENCES [dbo].[orders]([id]) ON DELETE CASCADE,
    [variant_id] BIGINT NULL CONSTRAINT [fk_order_items_variant] FOREIGN KEY REFERENCES [dbo].[product_variants]([id]) ON DELETE SET NULL,
    [product_name_snapshot] NVARCHAR(255) NOT NULL,
    [variant_info_snapshot] NVARCHAR(255) NOT NULL,
    [quantity] INT NOT NULL DEFAULT 1,
    [unit_price] DECIMAL(18,0) NOT NULL DEFAULT 0,
    [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------------------------
-- 4. NẠP DỮ LIỆU MẪU (SEED DATA - CHỈ 2 TÀI KHOẢN CHUẨN)
-- ------------------------------------------------------------------------------

-- 4.1 Nạp users
SET IDENTITY_INSERT [dbo].[users] ON;
INSERT INTO [dbo].[users] ([id], [full_name], [email], [password_hash], [phone], [avatar_url], [role], [status], [created_at]) VALUES
(1, N'Quản Trị Viên HK', N'admin@hkstore.vn', N'$2y$10$wT6gqL/dM85QWv77vH0E.eQG48vD1a9O5Q0Wp.XoYx1e1c.9PZ.aG', N'0965811846', N'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80', N'admin', N'active', '2026-01-01 00:00:00'),
(2, N'Nguyễn Văn An', N'khach1@hkstore.vn', N'$2y$10$eE2K/J9sW5t5l1w6.4g8Pe7R9u0A1b2C3d4E5f6G7h8I9j0K1l2M3', N'0901234567', N'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', N'customer', N'active', '2026-08-15 10:00:00');
SET IDENTITY_INSERT [dbo].[users] OFF;
GO

-- 4.2 Nạp user_addresses
SET IDENTITY_INSERT [dbo].[user_addresses] ON;
INSERT INTO [dbo].[user_addresses] ([id], [user_id], [receiver_name], [receiver_phone], [street_address], [ward], [district], [city], [is_default]) VALUES
(1, 2, N'Nguyễn Văn An', N'0901234567', N'123 Đường Lê Lợi', N'Phường Bến Nghé', N'Quận 1', N'TP. Hồ Chí Minh', 1),
(2, 2, N'Nguyễn Văn An (Cơ quan)', N'0901234567', N'Tòa nhà Bitexco, Số 2 Hải Triều', N'Phường Bến Nghé', N'Quận 1', N'TP. Hồ Chí Minh', 0);
SET IDENTITY_INSERT [dbo].[user_addresses] OFF;
GO

-- 4.3 Nạp categories
SET IDENTITY_INSERT [dbo].[categories] ON;
INSERT INTO [dbo].[categories] ([id], [name], [slug], [description], [parent_id]) VALUES
(1, N'Áo Thun', N'ao-thun', N'Áo thun Oversize, Boxy Fit chất liệu 100% Cotton định lượng cao thoáng mát', NULL),
(2, N'Áo Khoác & Hoodie', N'ao-khoac-hoodie', N'Áo khoác Bomber, Varsity Jacket và Hoodie nỉ bông ấm áp cá tính', NULL),
(3, N'Quần Streetwear', N'quan-streetwear', N'Quần Cargo Pants nhiều túi đa năng, Quần Jean Baggy ống suông phong cách đường phố', NULL),
(4, N'Phụ Kiện', N'phu-kien', N'Nón lưỡi trai Washed Denim, Túi Mini Crossbody, Phụ kiện phong cách tối giản', NULL);
SET IDENTITY_INSERT [dbo].[categories] OFF;
GO

-- 4.4 Nạp products
SET IDENTITY_INSERT [dbo].[products] ON;
INSERT INTO [dbo].[products] ([id], [category_id], [name], [slug], [description], [base_price], [thumbnail_url], [is_active]) VALUES
(1, 1, N'Áo Thun Boxy Heavyweight Minimalist', N'ao-thun-boxy-heavyweight-minimalist', N'Chất vải 100% Cotton định lượng 260gsm dày dặn, form dáng Boxy tôn dáng, bo cổ dệt 3cm không bai dão sau nhiều lần giặt.', 350000, N'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/ig-@mikeysvendetta.jpg', 1),
(2, 1, N'Áo Thun Acid Wash Vintage Graphic', N'ao-thun-acid-wash-vintage-graphic', N'Hiệu ứng wash loang xám cổ điển phong cách Grunge đường phố, in lụa thủ công sắc nét bền bỉ.', 390000, N'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80', 1),
(3, 2, N'Áo Khoác Bomber Varsity Phối Tay Da', N'ao-khoac-bomber-varsity-phoi-tay-da', N'Thân dạ ép Hàn Quốc giữ nhiệt tối đa, phối tay da PU cao cấp chống nứt, cúc bấm kim loại đúc nguyên khối cá tính.', 850000, N'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80', 1),
(4, 2, N'Áo Hoodie Zip Nỉ Bông Boxy Fit', N'ao-hoodie-zip-ni-bong-boxy-fit', N'Nỉ chân cua cào bông mềm mịn, khóa kéo zip 2 chiều tiện lợi tạo kiểu, mũ 2 lớp đứng form giữ ấm mùa đông.', 550000, N'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80', 1),
(5, 3, N'Quần Jean Baggy Rách Gối Xanh Nhạt', N'quan-jean-baggy-rach-goi-xanh-nhat', N'Denim 14oz không co giãn giữ form suông rộng, wash màu vintage kết hợp rách gối nhẹ tạo điểm nhấn năng động.', 490000, N'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80', 1),
(6, 3, N'Quần Cargo Pants 6 Túi Ống Suông', N'quan-cargo-pants-6-tui-ong-suong', N'Vải Kaki Cotton chéo dày dặn đứng dáng, 6 túi nắp gập tiện dụng đựng điện thoại, ví tiền và phụ kiện.', 450000, N'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80', 1),
(7, 4, N'Nón Lưỡi Trai Washed Denim Cap', N'non-luoi-trai-washed-denim-cap', N'Chất liệu Denim giặt wash xước bụi bặm, khóa cài đồng dập logo chìm, form nón ôm đầu thoải mái.', 190000, N'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80', 1),
(8, 4, N'Túi Đeo Chéo Mini Crossbody Bag', N'tui-deo-cheo-mini-crossbody-bag', N'Vải Cordura trượt nước chống bám bụi, nhiều ngăn tiện lợi với khóa kéo chống nước YKK độ bền cao.', 280000, N'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', 1);
SET IDENTITY_INSERT [dbo].[products] OFF;
GO

-- 4.5 Nạp product_variants
SET IDENTITY_INSERT [dbo].[product_variants] ON;
INSERT INTO [dbo].[product_variants] ([id], [product_id], [sku], [size], [color], [price], [stock_quantity], [image_url]) VALUES
(1, 1, N'AT-BOXY-BLK-M', N'M', N'Đen', 350000, 45, N'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/ig-@mikeysvendetta.jpg'),
(2, 1, N'AT-BOXY-BLK-L', N'L', N'Đen', 350000, 30, N'https://6ae2d7c9faf5cc20900f415a.imgix.net/sandbox/ig-@mikeysvendetta.jpg'),
(3, 1, N'AT-BOXY-WHT-L', N'L', N'Trắng', 350000, 25, N'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),
(4, 2, N'AT-ACID-GRY-M', N'M', N'Xám Wash', 390000, 20, N'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),
(5, 2, N'AT-ACID-GRY-L', N'L', N'Xám Wash', 390000, 15, N'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'),
(6, 3, N'AK-VARSITY-BLK-L', N'L', N'Đen', 850000, 12, N'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80'),
(7, 3, N'AK-VARSITY-BLK-XL', N'XL', N'Đen', 850000, 8, N'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80'),
(8, 3, N'AK-VARSITY-GRN-L', N'L', N'Xanh Rêu', 850000, 10, N'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80'),
(9, 4, N'HD-ZIP-BLK-M', N'M', N'Đen', 550000, 22, N'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),
(10, 4, N'HD-ZIP-BLK-L', N'L', N'Đen', 550000, 18, N'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),
(11, 4, N'HD-ZIP-GRY-L', N'L', N'Xám Tiêu', 550000, 14, N'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'),
(12, 5, N'QJ-BAGGY-BLU-M', N'M', N'Xanh Nhạt', 490000, 35, N'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80'),
(13, 5, N'QJ-BAGGY-BLU-L', N'L', N'Xanh Nhạt', 490000, 40, N'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80'),
(14, 6, N'QC-CARGO-BLK-M', N'M', N'Đen', 450000, 25, N'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(15, 6, N'QC-CARGO-BLK-L', N'L', N'Đen', 450000, 20, N'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(16, 6, N'QC-CARGO-KHA-L', N'L', N'Khaki Be', 450000, 16, N'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'),
(17, 7, N'PK-CAP-BLK-ONESIZE', N'One Size', N'Đen', 190000, 50, N'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'),
(18, 7, N'PK-CAP-BLU-ONESIZE', N'One Size', N'Xanh Denim', 190000, 45, N'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80'),
(19, 8, N'PK-BAG-BLK-ONESIZE', N'One Size', N'Đen', 280000, 30, N'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'),
(20, 8, N'PK-BAG-GRY-ONESIZE', N'One Size', N'Xám Khói', 280000, 25, N'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80');
SET IDENTITY_INSERT [dbo].[product_variants] OFF;
GO

-- 4.6 Nạp cart_items
SET IDENTITY_INSERT [dbo].[cart_items] ON;
INSERT INTO [dbo].[cart_items] ([id], [user_id], [variant_id], [quantity], [added_at]) VALUES
(1, 2, 6, 1, '2026-11-08 10:00:00'),
(2, 2, 17, 1, '2026-11-08 10:05:00');
SET IDENTITY_INSERT [dbo].[cart_items] OFF;
GO

-- 4.7 Nạp orders (5 đơn hàng, đều thuộc user 2)
SET IDENTITY_INSERT [dbo].[orders] ON;
INSERT INTO [dbo].[orders] ([id], [order_code], [user_id], [shipping_address_snapshot], [subtotal], [shipping_fee], [total_amount], [payment_method], [payment_status], [order_status], [shipping_carrier], [tracking_code], [note], [created_at]) VALUES
(1, N'ORD-20261101-001', 2, N'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 700000, 0, 700000, N'cod', N'unpaid', N'pending', N'spx', NULL, N'Vui lòng gọi trước khi giao 15 phút', '2026-11-01 08:30:00'),
(2, N'ORD-20261102-002', 2, N'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 580000, 0, 580000, N'bank_transfer', N'paid', N'confirmed', N'ghn', NULL, N'Giao trong giờ hành chính', '2026-11-02 10:15:00'),
(3, N'ORD-20261103-003', 2, N'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 1340000, 0, 1340000, N'vnpay', N'paid', N'shipping', N'spx', N'SPXVN0987654321', N'Giao hàng hỏa tốc', '2026-11-03 14:00:00'),
(4, N'ORD-20261104-004', 2, N'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 830000, 0, 830000, N'cod', N'paid', N'completed', N'ghtk', N'GHTKVN123456789', N'Để hàng tại quầy lễ tân nếu đi vắng', '2026-11-04 16:20:00'),
(5, N'ORD-20261105-005', 2, N'Người nhận: Nguyễn Văn An | SĐT: 0901234567 | Địa chỉ: 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 450000, 30000, 480000, N'vnpay', N'refunded', N'cancelled', N'spx', NULL, N'Khách hàng đổi ý muốn chọn size khác, đã hoàn tiền tự động qua cổng VNPAY', '2026-11-05 09:10:00');
SET IDENTITY_INSERT [dbo].[orders] OFF;
GO

-- 4.8 Nạp order_items
SET IDENTITY_INSERT [dbo].[order_items] ON;
INSERT INTO [dbo].[order_items] ([id], [order_id], [variant_id], [product_name_snapshot], [variant_info_snapshot], [quantity], [unit_price], [created_at]) VALUES
(1, 1, 1, N'Áo Thun Boxy Heavyweight Minimalist', N'SKU: AT-BOXY-BLK-M | Size: M | Màu: Đen', 2, 350000, '2026-11-01 08:30:00'),
(2, 2, 4, N'Áo Thun Acid Wash Vintage Graphic', N'SKU: AT-ACID-GRY-M | Size: M | Màu: Xám Wash', 1, 390000, '2026-11-02 10:15:00'),
(3, 2, 17, N'Nón Lưỡi Trai Washed Denim Cap', N'SKU: PK-CAP-BLK-ONESIZE | Size: One Size | Màu: Đen', 1, 190000, '2026-11-02 10:15:00'),
(4, 3, 6, N'Áo Khoác Bomber Varsity Phối Tay Da', N'SKU: AK-VARSITY-BLK-L | Size: L | Màu: Đen', 1, 850000, '2026-11-03 14:00:00'),
(5, 3, 13, N'Quần Jean Baggy Rách Gối Xanh Nhạt', N'SKU: QJ-BAGGY-BLU-L | Size: L | Màu: Xanh Nhạt', 1, 490000, '2026-11-03 14:00:00'),
(6, 4, 10, N'Áo Hoodie Zip Nỉ Bông Boxy Fit', N'SKU: HD-ZIP-BLK-L | Size: L | Màu: Đen', 1, 550000, '2026-11-04 16:20:00'),
(7, 4, 19, N'Túi Đeo Chéo Mini Crossbody Bag', N'SKU: PK-BAG-BLK-ONESIZE | Size: One Size | Màu: Đen', 1, 280000, '2026-11-04 16:20:00'),
(8, 5, 15, N'Quần Cargo Pants 6 Túi Ống Suông', N'SKU: QC-CARGO-BLK-L | Size: L | Màu: Đen', 1, 450000, '2026-11-05 09:10:00');
SET IDENTITY_INSERT [dbo].[order_items] OFF;
GO

-- ------------------------------------------------------------------------------
-- 5. KIỂM ĐỊNH TỔNG SỐ LƯỢNG BẢN GHI SAU KHI NẠP
-- ------------------------------------------------------------------------------
SELECT 'users (Chỉ 2 tài khoản chuẩn)' AS [Kiểm tra], COUNT(*) AS [Tổng số dòng] FROM [dbo].[users]
UNION ALL SELECT 'user_addresses', COUNT(*) FROM [dbo].[user_addresses]
UNION ALL SELECT 'categories', COUNT(*) FROM [dbo].[categories]
UNION ALL SELECT 'products', COUNT(*) FROM [dbo].[products]
UNION ALL SELECT 'product_variants', COUNT(*) FROM [dbo].[product_variants]
UNION ALL SELECT 'cart_items', COUNT(*) FROM [dbo].[cart_items]
UNION ALL SELECT 'orders (5 trạng thái)', COUNT(*) FROM [dbo].[orders]
UNION ALL SELECT 'order_items', COUNT(*) FROM [dbo].[order_items];
GO

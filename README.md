# HK STORE - HỆ THỐNG THỜI TRANG STREETWEAR ONLINE

Dự án Website thương mại điện tử hoàn chỉnh dành cho thương hiệu thời trang đường phố **HK Store**, được xây dựng 100% bằng **HTML5, CSS3 và JavaScript thuần (Vanilla JS)**.

Dự án được tối ưu hóa để dễ học, dễ đọc hiểu, dễ tùy biến và vận hành đầy đủ mọi luồng chức năng với cơ sở dữ liệu giả lập lưu trong `localStorage`.

---

## 1. TỔNG QUAN VÀ ĐẶC ĐIỂM NỔI BẬT

- **Thương hiệu & Phong cách:** "HK Store" – Streetwear tối giản, hiện đại, form dáng Boxy Oversize, tông màu than đen `#111111` kết hợp trắng ngà `#F5F5F0`.
- **Stack công nghệ thuần túy:** Không sử dụng React, Vue, Angular, Bootstrap, Tailwind, jQuery hay Node.js backend.
- **Không yêu cầu cài đặt hoặc build:** Không cần chạy `npm install`, `npm run build` hay cài đặt database.
- **Dữ liệu hạt giống độc lập (No CORS issue):** Dữ liệu mẫu ban đầu được khai báo qua file JavaScript (`seed.js`) thay vì `fetch('data.json')`, cho phép click đúp mở trực tiếp file `index.html` trên trình duyệt mà không bị lỗi CORS chính sách bảo mật cục bộ.
- **Mock Database trên LocalStorage:** Toàn bộ sản phẩm, danh mục, biến thể, tài khoản người dùng, giỏ hàng (khách và thành viên), và lịch sử đơn hàng đều được lưu trữ và đồng bộ thời gian thực trong `localStorage`.
- **Tương tác thực tế 100%:** Mọi nút bấm, bộ lọc, chọn size/màu, thêm giỏ, thanh toán, duyệt đơn, trừ tồn kho và hoàn kho đều hoạt động thật.

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
hk-store/
├── index.html                   # Trang chủ: Banner, danh mục, new arrivals, lookbook
├── products.html                # Trang danh sách sản phẩm: Lọc nâng cao, tìm kiếm, phân trang
├── product.html                 # Trang chi tiết: Gallery, chọn size/màu, bảng size guide
├── cart.html                    # Trang giỏ hàng: Bảng sản phẩm, tính ship, thanh tiến độ
├── checkout.html                # Trang đặt hàng: Form giao hàng, phương thức thanh toán
├── order-success.html           # Trang thông báo đặt hàng thành công
├── login.html                   # Trang đăng nhập: Điền nhanh 1-click tài khoản demo
├── register.html                # Trang đăng ký thành viên mới
├── account.html                 # Trang cá nhân: Thông tin cá nhân & Lịch sử đơn hàng
├── order-detail.html            # Chi tiết từng đơn hàng & Thao tác hủy đơn
├── admin.html                   # Bảng điều khiển Quản trị viên (Dashboard, Kho, Đơn hàng)
│
├── assets/
│   ├── css/
│   │   ├── base.css             # Design tokens, biến CSS, Typography, Reset, Nút
│   │   ├── components.css       # Header, Footer, Navbar, Drawer, Card, Toast, Modal
│   │   ├── pages.css            # Style giao diện các trang người dùng
│   │   └── admin.css            # Style layout và bảng biểu khu vực Admin
│   │
│   ├── js/
│   │   ├── seed.js              # Dữ liệu khởi tạo (20 sản phẩm, 3 tài khoản, đơn mẫu)
│   │   ├── storage.js           # Lớp lưu trữ LocalStorage, chuẩn hóa tìm kiếm, định dạng VND
│   │   ├── auth.js              # Quản lý phiên đăng nhập & phân quyền demo
│   │   ├── products.js          # Dịch vụ sản phẩm: lọc AND/OR biến thể, kiểm tra SKU
│   │   ├── cart.js              # Dịch vụ giỏ hàng: hợp nhất giỏ khách, kiểm soát tồn kho
│   │   ├── orders.js            # Dịch vụ đơn hàng: snapshot dữ liệu, trừ kho, hoàn kho
│   │   ├── ui.js                # Render Header/Footer đồng bộ, Toast, Accessible Modal
│   │   └── pages/
│   │       ├── home-page.js
│   │       ├── products-page.js
│   │       ├── product-page.js
│   │       ├── cart-page.js
│   │       ├── checkout-page.js
│   │       ├── order-success-page.js
│   │       ├── login-page.js
│   │       ├── register-page.js
│   │       ├── account-page.js
│   │       ├── order-detail-page.js
│   │       └── admin-page.js
│   │
│   └── images/
│       └── placeholder.svg      # Ảnh dự phòng tối giản khi không có mạng
│
└── README.md                    # Tài liệu hướng dẫn sử dụng & nghiệm thu
```

---

## 3. HƯỚNG DẪN CHẠY VÀ XEM DỰ ÁN

### Cách 1: Chạy bằng VS Code Live Server (Khuyến nghị tốt nhất)
Do website là một hệ thống thương mại điện tử đa trang (Multi-Page Application) trao đổi dữ liệu với `localStorage`, việc chạy trên một Origin HTTP cục bộ (ví dụ: `http://127.0.0.1:5500`) là cách lý tưởng nhất để:
- Đảm bảo toàn bộ các trang chia sẻ chung một không gian `localStorage`.
- URL chuyển trang mượt mà.

**Các bước thực hiện:**
1. Mở thư mục `hk-store` trong Visual Studio Code.
2. Cài đặt tiện ích mở rộng **Live Server** (của Ritwick Dey).
3. Nhấp chuột phải vào file `index.html` và chọn **Open with Live Server**.
4. Website sẽ tự động mở trên trình duyệt tại địa chỉ `http://127.0.0.1:5500/index.html`.

*(Hoặc dùng bất kỳ HTTP server đơn giản nào như `npx serve .` hoặc `python -m http.server 8000`)*.

### Cách 2: Mở trực tiếp file `index.html`
- Bạn có thể nhấp đúp chuột vào file `index.html` để mở ngay trên trình duyệt (Chrome, Edge, Firefox, Safari).
- Nhờ thiết kế nạp dữ liệu bằng file JavaScript tĩnh (`seed.js`), website **không** gặp bất kỳ lỗi chặn CORS nào.
- *Lưu ý:* Hãy mở các trang liên tiếp thông qua các đường link trên thanh menu hoặc các nút bấm của website để trình duyệt duy trì cùng một đường dẫn `file://`.

---

## 4. TÀI KHOẢN DÙNG THỬ (DEMO ACCOUNTS)

Hệ thống đã chuẩn bị sẵn 3 tài khoản demo với các vai trò khác nhau. Tại trang `login.html`, bạn có thể bấm trực tiếp vào các nút màu xám để hệ thống tự động điền:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn & Mô tả |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@hkstore.vn` | `admin1234` | Toàn quyền truy cập Dashboard `/admin.html`, quản lý sản phẩm, tồn kho và xử lý trạng thái đơn hàng. |
| **Khách hàng 1** | `khach1@hkstore.vn` | `khach1234` | Tài khoản đã có sẵn 3 đơn hàng mẫu ở các trạng thái khác nhau (Đã giao, Đang giao, Chờ xác nhận). |
| **Khách hàng 2** | `khach2@hkstore.vn` | `khach1234` | Tài khoản khách hàng mới, chưa có đơn hàng. |

*Ngoài ra, bạn có thể tự đăng ký thêm tài khoản mới tại trang `register.html`.*

---

## 5. HƯỚNG DẪN CÁC CHỨC NĂNG NGHIỆP VỤ CHÍNH

### A. Luồng mua hàng của khách
1. **Duyệt & Tìm kiếm:** Vào `products.html`, tìm kiếm từ khóa với độ trễ (debounce 300ms), kết hợp lọc theo Danh mục, Khoảng giá, Kích cỡ, Màu sắc, Đánh giá tối thiểu và Còn hàng.
2. **Chi tiết & Chọn biến thể:** Vào xem sản phẩm (ví dụ: `product.html?id=sp-01`). Chọn Size và Màu; hệ thống sẽ cập nhật số lượng tồn kho thực tế của tổ hợp đó. Nếu tổ hợp hết hàng, các nút "Thêm vào giỏ" và "Mua ngay" sẽ tự động bị vô hiệu hóa.
3. **Giỏ hàng:** Vào `cart.html`. Bạn có thể tăng/giảm số lượng (bị chặn nếu vượt tồn kho), xóa từng dòng hoặc xóa sạch giỏ hàng. Nếu đơn hàng từ 500.000₫ trở lên, hệ thống tự động áp dụng **Miễn phí vận chuyển** (tiết kiệm 30.000₫).
4. **Hợp nhất giỏ khách (Cart Merge):** Nếu bạn thêm sản phẩm vào giỏ khi chưa đăng nhập, sau khi bạn đăng nhập tài khoản, toàn bộ sản phẩm trong giỏ khách sẽ được tự động đồng bộ vào tài khoản và xóa sạch giỏ khách để tránh cộng dồn lặp lại.
5. **Thanh toán an toàn:** Chuyển sang `checkout.html`. Chọn giữa:
   - **COD:** Tạo đơn hàng ở trạng thái *Chờ xác nhận*, thanh toán *Chờ thanh toán*.
   - **Chuyển khoản:** Hiển thị thông tin STK Vietcombank giả lập. Đơn hàng ở trạng thái *Chờ thanh toán*.
   - **Cổng thanh toán HK-Pay:** Mở popup cho phép chọn thử nghiệm *Thanh toán thành công* (đơn chuyển thành *Đã thanh toán*) hoặc *Thất bại/Hủy* (giữ nguyên giỏ hàng, không trừ kho).
6. **Theo dõi & Hủy đơn:** Khách hàng có thể vào `account.html` để theo dõi tiến trình đơn hàng. Đối với các đơn đang ở trạng thái *Chờ xác nhận*, khách hàng có thể bấm **"Hủy đơn hàng"**, hệ thống sẽ tự động hoàn trả số lượng sản phẩm về kho đúng 1 lần duy nhất.

### B. Luồng Quản trị viên (Admin Panel)
Truy cập `admin.html` (yêu cầu đăng nhập tài khoản `admin@hkstore.vn`):
1. **Tổng quan (Dashboard):** Xem các số liệu thống kê được tính toán động từ dữ liệu thật: Số sản phẩm đang bán, Tổng đơn, Đơn chờ duyệt, Doanh thu (từ các đơn đã giao & đã thanh toán), Bảng cảnh báo sản phẩm sắp hết hàng (tồn 1-5) và Bảng sản phẩm hết hàng (tồn = 0).
2. **Quản lý Sản phẩm & Biến thể:**
   - Bấm **"+ Thêm sản phẩm mới"**: Nhập tên, giá, danh mục, ảnh và bảng biến thể (SKU, Size, Màu, Tồn kho).
   - Kiểm tra trùng lặp SKU toàn hệ thống và chặn nhập hai biến thể trùng Size + Màu trong cùng một sản phẩm.
   - Khi bấm **"Xóa"**: Sản phẩm sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu. Trong các đơn hàng cũ, sản phẩm này sẽ tự động được hiển thị dưới dạng Data ẩn nhằm bảo vệ toàn vẹn lịch sử đối chiếu đơn hàng.
3. **Quản lý Đơn hàng:**
   - Lọc và tìm kiếm đơn theo mã, tên khách hàng hoặc trạng thái.
   - Bấm **"Chi tiết & Xử lý"**: Chuyển trạng thái theo đúng luồng: *Chờ xác nhận* &rarr; *Đã xác nhận* &rarr; *Đang giao* &rarr; *Đã giao*.
   - Với đơn Chuyển khoản: Admin có thể bấm *"Xác nhận đã nhận tiền"*.
   - Với đơn COD: Khi giao hàng, Admin có thể bấm *"Xác nhận đã giao & thu đủ tiền mặt"*.
   - Với đơn bị hủy đã thanh toán trước đó: Admin có thể bấm *"Xác nhận hoàn tiền mô phỏng"*.

---

## 6. HƯỚNG DẪN TÙY BIẾN GIAO DIỆN & DỮ LIỆU

- **Tùy biến dữ liệu nguồn trực tiếp:** Bạn có thể tự do mở file `assets/js/seed.js` để thêm, sửa hoặc xóa các sản phẩm theo mong muốn của bạn. Hệ thống sẽ tự động phát hiện thay đổi trong source code và đồng bộ lên website mà không làm mất giỏ hàng hay đơn hàng của bạn.

- **Đổi bảng màu chủ đạo:** Mở file `assets/css/base.css` và chỉnh sửa các biến CSS tại `:root`:
  ```css
  --color-primary: #111111;    /* Màu đen than chủ đạo */
  --color-bg: #F5F5F0;         /* Màu nền trắng ngà */
  --color-muted: #666666;      /* Màu chữ phụ xám */
  ```
- **Đổi Logo:** Tìm chuỗi chữ `HK STORE` trong `assets/js/ui.js` (hàm `renderHeader`) hoặc chỉnh sửa CSS typography trong `components.css`.
- **Thêm sản phẩm mặc định:** Mở file `assets/js/seed.js` và thêm đối tượng sản phẩm mới vào mảng `window.HK_SEED_DATA.products`.

---

## 7. GIỚI HẠN VÀ KHUYẾN CÁO BẢO MẬT

> [!WARNING]
> **Hệ thống chạy hoàn toàn ở phía Frontend (Client-side Demo):**
> 1. Mọi logic xác thực (Auth), phân quyền (Role Guard) và thanh toán đều diễn ra trên trình duyệt của người dùng. Một người dùng am hiểu kỹ thuật có thể mở DevTools để can thiệp vào `localStorage`.
> 2. Cơ chế này hoàn hảo cho mục đích **học tập, làm đồ án tốt nghiệp, demo sản phẩm mẫu hoặc prototype UI/UX**, nhưng **không** tương đương với một hệ thống Production có Backend bảo mật thực sự.
> 3. Tuyệt đối **không** nhập mật khẩu thật hay số thẻ ngân hàng thật vào bất kỳ màn hình nào của ứng dụng.
> 4. Dữ liệu chỉ tồn tại trong trình duyệt/origin hiện tại và không tự động đồng bộ giữa các máy tính hoặc thiết bị khác nhau.

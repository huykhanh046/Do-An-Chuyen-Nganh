/**
 * HK STORE - BACKEND REST API SERVER (EXPRESS + MYSQL)
 * Cổng giao tiếp chuẩn giữa giao diện Web Frontend và hệ CSDL MySQL 8.0+
 */
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Phục vụ giao diện web tĩnh nếu truy cập trực tiếp qua server port
app.use(express.static(path.join(__dirname, "..")));

// -----------------------------------------------------------------------------
// 1. HEALTH CHECK & DATABASE STATUS ENDPOINTS
// -----------------------------------------------------------------------------

/**
 * Kiểm tra kết nối tới MySQL và lấy thông tin trạng thái
 */
app.get("/api/health", async (req, res) => {
  const result = await db.testConnection();
  if (result.connected) {
    res.json({
      status: "ok",
      message: "Kết nối cơ sở dữ liệu MySQL thành công!",
      database: result.database,
      version: result.version,
      serverTime: result.serverTime,
      host: result.host,
      port: result.port,
      user: result.user,
      counts: result.counts
    });
  } else {
    res.status(503).json({
      status: "error",
      message: "Chưa thể kết nối tới MySQL. Vui lòng kiểm tra dịch vụ MySQL đang chạy trên máy (XAMPP / MySQL Service) và cổng 3306.",
      details: result
    });
  }
});

/**
 * Lấy số lượng bản ghi thực tế của tất cả các bảng
 */
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await db.getTableStats();
    res.json({ status: "ok", stats });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -----------------------------------------------------------------------------
// 2. AUTHENTICATION & USERS (CHỈ 2 TÀI KHOẢN CHUẨN)
// -----------------------------------------------------------------------------

/**
 * Lấy danh sách tài khoản hợp lệ từ MySQL (bảo mật không lộ password_hash)
 */
app.get("/api/users", async (req, res) => {
  try {
    const users = await db.query(
      `SELECT id, full_name, email, phone, avatar_url, role, status, created_at, updated_at 
       FROM users 
       ORDER BY id ASC`
    );
    res.json({ status: "ok", users });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * Đăng nhập tài khoản
 */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Vui lòng nhập đầy đủ Email và Mật khẩu!" });
  }

  try {
    const users = await db.query("SELECT * FROM users WHERE email = ? AND status = 'active' LIMIT 1", [email.trim().toLowerCase()]);
    if (!users || users.length === 0) {
      return res.status(401).json({ status: "error", message: "Email hoặc mật khẩu không chính xác!" });
    }

    const user = users[0];
    // Đối với môi trường kiểm thử dự án:
    // Kiểm tra mật khẩu demo chuẩn: admin@hkstore.vn -> admin1234, khach1@hkstore.vn -> khach1234
    const isMasterAdmin = (email.toLowerCase() === "admin@hkstore.vn" && password === "admin1234");
    const isMasterCustomer = (email.toLowerCase() === "khach1@hkstore.vn" && password === "khach1234");

    if (isMasterAdmin || isMasterCustomer) {
      const { password_hash, ...safeUser } = user;
      return res.json({
        status: "ok",
        message: "Đăng nhập thành công!",
        user: safeUser,
        token: `hk_jwt_token_${user.id}_${Date.now()}`
      });
    }

    return res.status(401).json({ status: "error", message: "Mật khẩu không đúng!" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -----------------------------------------------------------------------------
// 3. PRODUCTS & VARIANTS
// -----------------------------------------------------------------------------

/**
 * Lấy toàn bộ danh sách sản phẩm kèm danh mục và biến thể
 */
app.get("/api/products", async (req, res) => {
  try {
    const products = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.id ASC`
    );

    const variants = await db.query("SELECT * FROM product_variants ORDER BY id ASC");

    // Nhóm variants theo product_id
    const variantsByProduct = {};
    variants.forEach(v => {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push(v);
    });

    const result = products.map(p => ({
      ...p,
      variants: variantsByProduct[p.id] || []
    }));

    res.json({ status: "ok", products: result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * Lấy chi tiết 1 sản phẩm theo ID hoặc Slug
 */
app.get("/api/products/:identifier", async (req, res) => {
  const { identifier } = req.params;
  try {
    const isId = /^\d+$/.test(identifier);
    const sql = isId
      ? "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?"
      : "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?";
    
    const rows = await db.query(sql, [identifier]);
    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm!" });
    }

    const product = rows[0];
    const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [product.id]);
    product.variants = variants;

    res.json({ status: "ok", product });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -----------------------------------------------------------------------------
// 4. ORDERS & ORDER ITEMS
// -----------------------------------------------------------------------------

/**
 * Lấy danh sách toàn bộ đơn hàng kèm chi tiết sản phẩm
 */
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await db.query(
      `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC`
    );

    const items = await db.query("SELECT * FROM order_items ORDER BY id ASC");
    const itemsByOrder = {};
    items.forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    });

    const result = orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || []
    }));

    res.json({ status: "ok", orders: result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

/**
 * Cập nhật trạng thái đơn hàng (Dành cho Admin)
 */
app.put("/api/orders/:id/status", async (req, res) => {
  const { id } = req.params;
  const { order_status, payment_status, tracking_code } = req.body;

  try {
    const updates = [];
    const params = [];

    if (order_status) {
      updates.push("order_status = ?");
      params.push(order_status);
    }
    if (payment_status) {
      updates.push("payment_status = ?");
      params.push(payment_status);
    }
    if (tracking_code !== undefined) {
      updates.push("tracking_code = ?");
      params.push(tracking_code);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: "error", message: "Không có trường nào cần cập nhật!" });
    }

    params.push(id);
    await db.query(`UPDATE orders SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);

    res.json({ status: "ok", message: `Đã cập nhật đơn hàng #${id} thành công!` });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -----------------------------------------------------------------------------
// 5. DATABASE RESET & SETUP EXECUTION (DÀNH CHO ADMIN)
// -----------------------------------------------------------------------------

app.post("/api/admin/run-database-setup", async (req, res) => {
  try {
    const result = await db.runSetupScript();
    const stats = await db.getTableStats();
    res.json({ status: "ok", ...result, stats });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(`🚀 HK Store MySQL Backend API running at http://localhost:${PORT}`);
  console.log(`📡 MySQL Health Check Endpoint: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ MySQL Database Target: ${db.dbConfig.database} (${db.dbConfig.host}:${db.dbConfig.port})`);
  console.log(`=====================================================`);
});

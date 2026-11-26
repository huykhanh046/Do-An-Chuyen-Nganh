/**
 * HK STORE - BACKEND REST API SERVER (EXPRESS + MYSQL)
 * Cổng giao tiếp toàn diện giữa giao diện Web Frontend và hệ CSDL MySQL 8.0+ / MariaDB 10.11+
 */
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || "hk_store_secure_session_key_2026";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// 1. BẢO MẬT: SECURITY HEADERS, CORS ALLOWLIST & CHẶN FILE NHẠY CẢM
// -----------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://hethongquanlythoitrang-hkstore.vercel.app"
]);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || origin === "null" || ALLOWED_ORIGINS.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Chặn tuyệt đối truy cập các tệp cấu hình, backend source và file SQL nhạy cảm qua HTTP
app.use((req, res, next) => {
  const reqPath = (req.path || "").toLowerCase();
  const blockedPrefixes = ["/.env", "/.git", "/server", "/node_modules", "/security"];
  const blockedExact = [
    "/package.json",
    "/package-lock.json",
    "/database_setup.sql",
    "/database_setup_sqlserver.sql",
    "/agents.md"
  ];
  if (
    blockedPrefixes.some((p) => reqPath === p || reqPath.startsWith(p + "/") || reqPath.startsWith(p + ".")) ||
    blockedExact.includes(reqPath) ||
    reqPath.endsWith(".sql")
  ) {
    return res.status(403).json({ status: "error", message: "Truy cập bị từ chối." });
  }
  next();
});

// Phục vụ giao diện web tĩnh
app.use(express.static(path.join(__dirname, "..")));

// -----------------------------------------------------------------------------
// 2. TIỆN ÍCH BẢO MẬT: SCRYPT HASH, HMAC TOKEN & RATE LIMITING
// -----------------------------------------------------------------------------
function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordScrypt(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hexHash] = parts;
  try {
    const derived = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hexHash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch (e) {
    return false;
  }
}

function signToken(user) {
  const payload = {
    id: Number(user.id),
    email: user.email,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || !payload.id || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Rate limiter trong bộ nhớ (login & register)
const rateBuckets = new Map();
function checkRateLimit(key, maxAttempts = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const list = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (list.length >= maxAttempts) {
    rateBuckets.set(key, list);
    return false;
  }
  list.push(now);
  rateBuckets.set(key, list);
  return true;
}

function clearRateLimit(key) {
  rateBuckets.delete(key);
}

// Auth Middlewares
async function attachOptionalAuth(req, res, next) {
  req.user = null;
  req.tokenInvalid = false;
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return next();

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    req.tokenInvalid = true;
    return next();
  }

  try {
    const rows = await db.query("SELECT * FROM users WHERE id = ? AND status = 'active' LIMIT 1", [payload.id]);
    if (!rows || rows.length === 0) {
      req.tokenInvalid = true;
      return next();
    }
    req.user = rows[0];
  } catch (err) {
    console.error("[Auth] DB check error:", err.message);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: "error", message: "Vui lòng đăng nhập để thực hiện thao tác này." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ status: "error", message: "Bạn không có quyền quản trị (Admin)." });
  }
  next();
}

// -----------------------------------------------------------------------------
// 3. HELPER MAPPERS (MYSQL ROW <-> FRONTEND DTO)
// -----------------------------------------------------------------------------
const SHIPPING_CARRIERS = {
  spx: "SPX Express (Shopee)",
  ghn: "GHN - Giao Hàng Nhanh",
  ghtk: "GHTK - Giao Hàng Tiết Kiệm",
  viettelpost: "Viettel Post",
  jt: "J&T Express",
  vnpost: "VNPost - Bưu điện Việt Nam",
  ninjavan: "Ninja Van",
  other: "Đơn vị vận chuyển khác"
};

function normalizeDateToIso(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const str = String(val);
  if (str.includes("T")) return str;
  return str.replace(" ", "T") + "+07:00";
}

function mapUserRow(u) {
  if (!u) return null;
  return {
    id: String(u.id),
    fullName: u.full_name || "",
    email: u.email || "",
    phone: u.phone || "",
    address: u.address || "",
    avatarUrl: u.avatar_url || "",
    role: u.role || "customer",
    status: u.status || "active",
    isEmailVerified: Boolean(u.is_email_verified),
    emailVerifiedAt: normalizeDateToIso(u.email_verified_at),
    lastLoginAt: normalizeDateToIso(u.last_login_at),
    loginCount: Number(u.login_count) || 0,
    createdAt: normalizeDateToIso(u.created_at),
    updatedAt: normalizeDateToIso(u.updated_at)
  };
}

function mapVariantRow(v) {
  return {
    id: String(v.id),
    productId: String(v.product_id),
    sku: v.sku || "",
    size: v.size || "M",
    colorName: v.color || "",
    colorCode: v.color_code || "#111111",
    price: Number(v.price) || 0,
    stock: Number(v.stock_quantity) || 0,
    imageUrl: v.image_url || ""
  };
}

function parseImagesJson(rawJson, fallbackThumb) {
  let images = [];
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        images = parsed.filter((x) => typeof x === "string" && x.trim() !== "");
      }
    } catch (e) {}
  }
  if (images.length === 0 && fallbackThumb) {
    images = [fallbackThumb];
  }
  if (images.length === 0) {
    images = ["assets/images/placeholder.svg"];
  }
  return images;
}

function mapProductRow(p, variants = []) {
  return {
    id: String(p.id),
    name: p.name || "",
    slug: p.slug || "",
    category: p.category_slug || "ao-thun",
    categoryName: p.category_name || "Áo thun",
    badge: p.badge || null,
    price: Number(p.base_price) || 0,
    originalPrice: p.original_price !== null && p.original_price !== undefined ? Number(p.original_price) : null,
    material: p.material || "100% Cotton định lượng cao",
    fit: p.fit || "Boxy Oversize",
    description: p.description || "",
    images: parseImagesJson(p.images_json, p.thumbnail_url),
    variants: variants.map(mapVariantRow),
    status: p.is_active ? "active" : "archived",
    rating: Number(p.rating) || 5.0,
    reviewCount: Number(p.review_count) || 0,
    createdAt: normalizeDateToIso(p.created_at),
    updatedAt: normalizeDateToIso(p.updated_at)
  };
}

function normalizePaymentMethod(pm) {
  if (pm === "bank_transfer") return "banking";
  if (pm === "vnpay" || pm === "momo") return "gateway";
  return pm || "cod";
}

function normalizePaymentStatus(ps) {
  if (ps === "unpaid") return "pending";
  return ps || "pending";
}

function normalizeOrderStatus(os) {
  if (os === "completed") return "delivered";
  return os || "pending";
}

function mapOrderRow(o, items = []) {
  return {
    id: o.order_code,
    dbId: Number(o.id),
    userId: o.user_id !== null && o.user_id !== undefined ? String(o.user_id) : null,
    customerInfo: {
      fullName: o.customer_name || o.user_full_name || "",
      email: o.customer_email || o.user_email || "",
      phone: o.customer_phone || o.user_phone || "",
      address: o.customer_address || o.shipping_address_snapshot || "",
      note: o.note || ""
    },
    items: items.map((it) => ({
      productId: it.product_id ? String(it.product_id) : "",
      variantId: it.variant_id ? String(it.variant_id) : "",
      name: it.product_name_snapshot || "",
      image: it.image_snapshot || "assets/images/placeholder.svg",
      sku: it.sku_snapshot || "",
      size: it.size_snapshot || "",
      colorName: it.color_name_snapshot || "",
      price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 1,
      lineTotal: Number(it.line_total) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 1)
    })),
    subtotal: Number(o.subtotal) || 0,
    shippingFee: Number(o.shipping_fee) || 0,
    total: Number(o.total_amount) || 0,
    paymentMethod: normalizePaymentMethod(o.payment_method),
    paymentProvider: o.payment_provider || (o.payment_method === "vnpay" || o.payment_method === "momo" ? o.payment_method : null),
    paymentRef: o.payment_ref || null,
    paymentStatus: normalizePaymentStatus(o.payment_status),
    orderStatus: normalizeOrderStatus(o.order_status),
    shippingCarrier: o.shipping_carrier || "",
    shippingCarrierName:
      o.shipping_carrier_name || (o.shipping_carrier ? SHIPPING_CARRIERS[o.shipping_carrier] || o.shipping_carrier : ""),
    trackingCode: o.tracking_code || "",
    trackingUpdatedAt: normalizeDateToIso(o.tracking_updated_at),
    restocked: Boolean(o.restocked),
    cancelReason: o.cancel_reason || "",
    createdAt: normalizeDateToIso(o.created_at),
    updatedAt: normalizeDateToIso(o.updated_at)
  };
}

function mapReviewRow(r) {
  let dateLabel = "";
  try {
    const d = new Date(normalizeDateToIso(r.created_at));
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      dateLabel = `${dd}/${mm}/${yyyy}`;
    }
  } catch (e) {}
  return {
    id: String(r.id),
    productId: String(r.product_id),
    author: r.author_name || "Khách hàng",
    rating: Number(r.rating) || 5,
    fitSpec: r.fit_spec || "",
    fitFeel: r.fit_feel || "Chuẩn form Oversize",
    date: dateLabel,
    comment: r.comment || "",
    createdAt: normalizeDateToIso(r.created_at)
  };
}

function slugifyVietnamese(str) {
  return String(str || "san-pham")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "san-pham";
}

function isValidVietnamesePhone(phone) {
  const cleaned = String(phone || "").replace(/[\s.-]/g, "").trim();
  return !cleaned || /^(0|\+84)[0-9]{9,10}$/.test(cleaned);
}

async function fetchAllProductsWithVariants(connOrDb = db) {
  const products = await connOrDb.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ORDER BY p.created_at DESC, p.id DESC`
  );
  const variants = await connOrDb.query("SELECT * FROM product_variants ORDER BY id ASC");
  const byProd = {};
  variants.forEach((v) => {
    if (!byProd[v.product_id]) byProd[v.product_id] = [];
    byProd[v.product_id].push(v);
  });
  return products.map((p) => mapProductRow(p, byProd[p.id] || []));
}

async function fetchProductById(productId, connOrDb = db) {
  const rows = await connOrDb.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ? LIMIT 1`,
    [productId]
  );
  if (!rows || rows.length === 0) return null;
  const variants = await connOrDb.query("SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC", [productId]);
  return mapProductRow(rows[0], variants);
}

async function fetchOrdersForUser(user) {
  const isAdmin = user && user.role === "admin";
  const sql = isAdmin
    ? `SELECT o.*, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC, o.id DESC`
    : `SELECT o.*, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC, o.id DESC`;

  const orders = isAdmin ? await db.query(sql) : await db.query(sql, [user.id]);
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");
  const items = await db.query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds
  );
  const itemsByOrder = {};
  items.forEach((it) => {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push(it);
  });
  return orders.map((o) => mapOrderRow(o, itemsByOrder[o.id] || []));
}

async function fetchOrderByIdentifier(identifier, connOrDb = db) {
  const isNumeric = /^\d+$/.test(String(identifier));
  const sql = isNumeric
    ? `SELECT o.*, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ? OR o.order_code = ? LIMIT 1`
    : `SELECT o.*, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       WHERE o.order_code = ? LIMIT 1`;

  const params = isNumeric ? [Number(identifier), String(identifier)] : [String(identifier)];
  const rows = await connOrDb.query(sql, params);
  if (!rows || rows.length === 0) return null;
  const orderRow = rows[0];
  const items = await connOrDb.query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC", [orderRow.id]);
  return { row: orderRow, items, dto: mapOrderRow(orderRow, items) };
}

async function fetchUserCartRaw(userId, connOrDb = db) {
  const rows = await connOrDb.query(
    `SELECT ci.variant_id, ci.quantity, ci.added_at, pv.product_id
     FROM cart_items ci
     INNER JOIN product_variants pv ON ci.variant_id = pv.id
     WHERE ci.user_id = ?
     ORDER BY ci.added_at DESC, ci.id DESC`,
    [userId]
  );
  return rows.map((r) => ({
    productId: String(r.product_id),
    variantId: String(r.variant_id),
    quantity: Number(r.quantity) || 1,
    addedAt: normalizeDateToIso(r.added_at)
  }));
}

async function fetchUserWishlistIds(userId, connOrDb = db) {
  const rows = await connOrDb.query(
    "SELECT product_id FROM wishlists WHERE user_id = ? ORDER BY created_at DESC, id DESC",
    [userId]
  );
  return rows.map((r) => String(r.product_id));
}

function sendServerError(res, context, err) {
  console.error(`[API Error - ${context}]`, err);
  return res.status(500).json({ status: "error", message: "Hệ thống đang bận hoặc gặp sự cố kỹ thuật. Vui lòng thử lại sau." });
}

// -----------------------------------------------------------------------------
// 4. HEALTH CHECK, STATS & BOOTSTRAP HYDRATION ENDPOINTS
// -----------------------------------------------------------------------------
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

app.get("/api/stats", async (req, res) => {
  try {
    const stats = await db.getTableStats();
    res.json({ status: "ok", stats });
  } catch (err) {
    sendServerError(res, "GET /api/stats", err);
  }
});

app.get("/api/bootstrap", attachOptionalAuth, async (req, res) => {
  try {
    const categories = await db.query("SELECT id, name, slug, description FROM categories ORDER BY id ASC");
    const products = await fetchAllProductsWithVariants();

    const reviewRows = await db.query("SELECT * FROM product_reviews ORDER BY created_at DESC, id DESC");
    const reviewsMap = {};
    reviewRows.forEach((r) => {
      const pid = String(r.product_id);
      if (!reviewsMap[pid]) reviewsMap[pid] = [];
      reviewsMap[pid].push(mapReviewRow(r));
    });

    let currentUser = null;
    let cart = [];
    let wishlist = [];
    let orders = null;
    let users = null;

    if (req.user) {
      currentUser = mapUserRow(req.user);
      cart = await fetchUserCartRaw(req.user.id);
      wishlist = await fetchUserWishlistIds(req.user.id);
      orders = await fetchOrdersForUser(req.user);

      if (req.user.role === "admin") {
        const userRows = await db.query(
          `SELECT id, full_name, email, phone, address, avatar_url, role, status,
                  is_email_verified, email_verified_at, last_login_at, login_count, created_at, updated_at
           FROM users ORDER BY created_at DESC, id ASC`
        );
        users = userRows.map(mapUserRow);
      } else {
        users = [currentUser];
      }
    }

    res.json({
      status: "ok",
      tokenInvalid: req.tokenInvalid,
      categories: categories.map((c) => ({ id: String(c.id), name: c.name, slug: c.slug, description: c.description || "" })),
      products,
      reviews: reviewsMap,
      currentUser,
      cart,
      wishlist,
      orders,
      users
    });
  } catch (err) {
    sendServerError(res, "GET /api/bootstrap", err);
  }
});

// -----------------------------------------------------------------------------
// 5. AUTHENTICATION & USERS ENDPOINTS
// -----------------------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Vui lòng nhập đầy đủ Email và Mật khẩu!" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const rlKey = `login:${req.ip}:${normalizedEmail}`;
  if (!checkRateLimit(rlKey, 10, 15 * 60 * 1000)) {
    return res.status(429).json({
      status: "error",
      rateLimited: true,
      message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại."
    });
  }

  try {
    const users = await db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
    if (!users || users.length === 0) {
      return res.status(401).json({ status: "error", message: "Email hoặc mật khẩu không chính xác!" });
    }

    const user = users[0];
    if (user.status === "banned") {
      return res.status(403).json({ status: "error", message: "Tài khoản này đã bị tạm khóa." });
    }

    if (!verifyPasswordScrypt(password, user.password_hash)) {
      return res.status(401).json({ status: "error", message: "Email hoặc mật khẩu không chính xác!" });
    }

    clearRateLimit(rlKey);
    await db.query("UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = ?", [user.id]);
    const refreshed = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);

    const safeUser = mapUserRow(refreshed[0] || user);
    const token = signToken(refreshed[0] || user);

    return res.json({
      status: "ok",
      message: "Đăng nhập thành công!",
      user: safeUser,
      token
    });
  } catch (err) {
    sendServerError(res, "POST /api/auth/login", err);
  }
});

app.post("/api/auth/register", async (req, res) => {
  const rlKey = `register:${req.ip}`;
  if (!checkRateLimit(rlKey, 10, 15 * 60 * 1000)) {
    return res.status(429).json({
      status: "error",
      message: "Hệ thống ghi nhận quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau ít phút."
    });
  }

  const { fullName, email, password, phone, address, isEmailVerified } = req.body || {};
  const cleanName = String(fullName || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const cleanPhone = String(phone || "").replace(/[\s.-]/g, "").trim();
  const cleanAddress = String(address || "").trim();

  if (cleanName.length < 2) {
    return res.status(400).json({ status: "error", field: "name", message: "Vui lòng nhập họ và tên (tối thiểu 2 ký tự)." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ status: "error", field: "email", message: "Định dạng email chưa hợp lệ." });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ status: "error", field: "password", message: "Mật khẩu phải có tối thiểu 8 ký tự." });
  }
  if (cleanPhone && !isValidVietnamesePhone(cleanPhone)) {
    return res.status(400).json({ status: "error", field: "phone", message: "Số điện thoại chưa hợp lệ." });
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
    if (existing && existing.length > 0) {
      return res.status(409).json({
        status: "error",
        field: "email",
        message: "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác."
      });
    }

    const passwordHash = hashPasswordScrypt(password);
    const verifiedFlag = isEmailVerified ? 1 : 0;

    const createdUser = await db.withTransaction(async (conn) => {
      const [insertRes] = await conn.query(
        `INSERT INTO users (full_name, email, password_hash, phone, address, role, status, is_email_verified, email_verified_at, last_login_at, login_count)
         VALUES (?, ?, ?, ?, ?, 'customer', 'active', ?, ${verifiedFlag ? "NOW()" : "NULL"}, NOW(), 1)`,
        [cleanName, normalizedEmail, passwordHash, cleanPhone || null, cleanAddress, verifiedFlag]
      );
      const userId = insertRes.insertId;

      if (cleanAddress) {
        await conn.query(
          `INSERT INTO user_addresses (user_id, receiver_name, receiver_phone, street_address, ward, district, city, is_default)
           VALUES (?, ?, ?, ?, '', '', '', 1)`,
          [userId, cleanName, cleanPhone || "Chưa cập nhật", cleanAddress]
        );
      }

      const [rows] = await conn.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
      return rows[0];
    });

    const safeUser = mapUserRow(createdUser);
    const token = signToken(createdUser);

    res.status(201).json({
      status: "ok",
      message: "Đăng ký tài khoản thành công!",
      user: safeUser,
      token
    });
  } catch (err) {
    sendServerError(res, "POST /api/auth/register", err);
  }
});

app.get("/api/auth/me", attachOptionalAuth, requireAuth, (req, res) => {
  res.json({ status: "ok", user: mapUserRow(req.user) });
});

app.put("/api/auth/profile", attachOptionalAuth, requireAuth, async (req, res) => {
  const { fullName, phone, address } = req.body || {};
  const cleanName = fullName !== undefined ? String(fullName).trim() : req.user.full_name;
  const cleanPhone = phone !== undefined ? String(phone).replace(/[\s.-]/g, "").trim() : req.user.phone || "";
  const cleanAddress = address !== undefined ? String(address).trim() : req.user.address || "";

  if (cleanName.length < 2) {
    return res.status(400).json({ status: "error", field: "name", message: "Họ và tên phải có tối thiểu 2 ký tự." });
  }
  if (cleanPhone && !isValidVietnamesePhone(cleanPhone)) {
    return res.status(400).json({ status: "error", field: "phone", message: "Số điện thoại chưa hợp lệ." });
  }

  try {
    const updatedUser = await db.withTransaction(async (conn) => {
      await conn.query(
        "UPDATE users SET full_name = ?, phone = ?, address = ?, updated_at = NOW() WHERE id = ?",
        [cleanName, cleanPhone || null, cleanAddress, req.user.id]
      );

      if (cleanAddress) {
        const [addrRows] = await conn.query(
          "SELECT id FROM user_addresses WHERE user_id = ? AND is_default = 1 LIMIT 1",
          [req.user.id]
        );
        if (addrRows.length > 0) {
          await conn.query(
            "UPDATE user_addresses SET receiver_name = ?, receiver_phone = ?, street_address = ? WHERE id = ?",
            [cleanName, cleanPhone || "Chưa cập nhật", cleanAddress, addrRows[0].id]
          );
        } else {
          await conn.query(
            "INSERT INTO user_addresses (user_id, receiver_name, receiver_phone, street_address, ward, district, city, is_default) VALUES (?, ?, ?, ?, '', '', '', 1)",
            [req.user.id, cleanName, cleanPhone || "Chưa cập nhật", cleanAddress]
          );
        }
      }

      const [rows] = await conn.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);
      return rows[0];
    });

    res.json({ status: "ok", user: mapUserRow(updatedUser) });
  } catch (err) {
    sendServerError(res, "PUT /api/auth/profile", err);
  }
});

app.get("/api/users", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, full_name, email, phone, address, avatar_url, role, status,
              is_email_verified, email_verified_at, last_login_at, login_count, created_at, updated_at
       FROM users
       ORDER BY created_at DESC, id ASC`
    );
    res.json({ status: "ok", users: rows.map(mapUserRow) });
  } catch (err) {
    sendServerError(res, "GET /api/users", err);
  }
});

app.delete("/api/users/:id", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã người dùng không hợp lệ." });
  }
  if (targetId === Number(req.user.id)) {
    return res.status(400).json({ status: "error", message: "Không thể tự xóa tài khoản Quản trị viên đang đăng nhập." });
  }

  try {
    const rows = await db.query("SELECT id, role FROM users WHERE id = ? LIMIT 1", [targetId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy người dùng này." });
    }
    if (rows[0].role === "admin") {
      return res.status(400).json({ status: "error", message: "Không thể xóa tài khoản Quản trị viên (Admin)." });
    }

    await db.query("DELETE FROM users WHERE id = ?", [targetId]);
    res.json({ status: "ok", message: "Đã xóa dữ liệu người dùng thành công." });
  } catch (err) {
    sendServerError(res, "DELETE /api/users/:id", err);
  }
});

// -----------------------------------------------------------------------------
// 6. CATEGORIES & PRODUCTS & VARIANTS ENDPOINTS
// -----------------------------------------------------------------------------
app.get("/api/categories", async (req, res) => {
  try {
    const rows = await db.query("SELECT id, name, slug, description FROM categories ORDER BY id ASC");
    res.json({
      status: "ok",
      categories: rows.map((c) => ({ id: String(c.id), name: c.name, slug: c.slug, description: c.description || "" }))
    });
  } catch (err) {
    sendServerError(res, "GET /api/categories", err);
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const result = await fetchAllProductsWithVariants();
    res.json({ status: "ok", products: result });
  } catch (err) {
    sendServerError(res, "GET /api/products", err);
  }
});

app.get("/api/products/:identifier", async (req, res) => {
  const { identifier } = req.params;
  try {
    const isId = /^\d+$/.test(identifier);
    const sql = isId
      ? "SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?"
      : "SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?";

    const rows = await db.query(sql, [identifier]);
    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm!" });
    }

    const variants = await db.query("SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC", [rows[0].id]);
    res.json({ status: "ok", product: mapProductRow(rows[0], variants) });
  } catch (err) {
    sendServerError(res, "GET /api/products/:identifier", err);
  }
});

async function resolveCategoryId(conn, categorySlug, categoryName) {
  const slug = String(categorySlug || "ao-thun").trim().toLowerCase();
  const [rows] = await conn.query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [slug]);
  if (rows && rows.length > 0) return rows[0].id;
  const [inserted] = await conn.query(
    "INSERT INTO categories (name, slug) VALUES (?, ?)",
    [categoryName || slug, slug]
  );
  return inserted.insertId;
}

function validateProductPayload(body) {
  const name = String(body.name || "").trim();
  if (!name) return { error: "Tên sản phẩm không được để trống." };

  const price = Number(body.price);
  if (isNaN(price) || price < 0) return { error: "Giá bán phải là số nguyên không âm." };

  let originalPrice = null;
  if (body.originalPrice !== null && body.originalPrice !== "" && body.originalPrice !== undefined) {
    originalPrice = Number(body.originalPrice);
    if (isNaN(originalPrice) || originalPrice < price) {
      return { error: "Giá gốc (nếu có) không được thấp hơn giá bán." };
    }
  }

  const variants = Array.isArray(body.variants) ? body.variants : [];
  if (variants.length === 0) {
    return { error: "Sản phẩm phải có ít nhất một biến thể (size, màu, tồn kho)." };
  }

  const pairSet = new Set();
  for (const v of variants) {
    if (!v.size || !v.colorName) {
      return { error: "Biến thể phải có đầy đủ Size và Màu sắc." };
    }
    const key = `${String(v.size).trim().toLowerCase()}__${String(v.colorName).trim().toLowerCase()}`;
    if (pairSet.has(key)) {
      return { error: `Trùng lặp biến thể cùng Size (${v.size}) và Màu (${v.colorName})!` };
    }
    pairSet.add(key);

    const stock = Number(v.stock);
    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      return { error: "Tồn kho biến thể phải là số nguyên không âm." };
    }
  }

  return { name, price, originalPrice, variants };
}

async function generateUniqueProductSlug(conn, name, excludeId = null) {
  const baseSlug = slugifyVietnamese(name);
  let candidate = baseSlug;
  let suffix = 1;
  while (true) {
    const [rows] = excludeId
      ? await conn.query("SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1", [candidate, excludeId])
      : await conn.query("SELECT id FROM products WHERE slug = ? LIMIT 1", [candidate]);
    if (rows.length === 0) return candidate;
    suffix++;
    candidate = `${baseSlug}-${suffix}`;
  }
}

function buildAutoSku(productId, size, colorName, idx) {
  const sPart = slugifyVietnamese(size).toUpperCase().slice(0, 6) || "SIZE";
  const cPart = slugifyVietnamese(colorName).toUpperCase().slice(0, 6) || "CLR";
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `HK-${productId}-${sPart}-${cPart}-${idx + 1}-${rand}`;
}

app.post("/api/products", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const validated = validateProductPayload(req.body || {});
  if (validated.error) {
    return res.status(400).json({ status: "error", message: validated.error });
  }

  const body = req.body || {};
  const images = Array.isArray(body.images) && body.images.length > 0 ? body.images : ["assets/images/placeholder.svg"];
  const thumb = images[0];

  try {
    const product = await db.withTransaction(async (conn) => {
      const catId = await resolveCategoryId(conn, body.category, body.categoryName);
      const slug = await generateUniqueProductSlug(conn, validated.name);

      const [ins] = await conn.query(
        `INSERT INTO products (category_id, name, slug, badge, description, base_price, original_price, material, fit, thumbnail_url, images_json, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          catId,
          validated.name,
          slug,
          body.badge || null,
          String(body.description || ""),
          validated.price,
          validated.originalPrice,
          String(body.material || "100% Cotton định lượng cao"),
          String(body.fit || "Boxy Oversize"),
          thumb,
          JSON.stringify(images),
          body.status === "archived" ? 0 : 1
        ]
      );
      const newProductId = ins.insertId;

      for (let i = 0; i < validated.variants.length; i++) {
        const v = validated.variants[i];
        const rawSku = String(v.sku || "").trim().toUpperCase();
        const sku = rawSku || buildAutoSku(newProductId, v.size, v.colorName, i);

        const [dupSku] = await conn.query("SELECT id FROM product_variants WHERE sku = ? LIMIT 1", [sku]);
        if (dupSku.length > 0) {
          const err = new Error(`Mã SKU "${sku}" đã được sử dụng ở sản phẩm khác.`);
          err.statusCode = 409;
          throw err;
        }

        await conn.query(
          `INSERT INTO product_variants (product_id, sku, size, color, color_code, price, stock_quantity, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newProductId,
            sku,
            String(v.size).trim(),
            String(v.colorName).trim(),
            String(v.colorCode || "#111111").trim(),
            validated.price,
            Number(v.stock),
            thumb
          ]
        );
      }

      const [pRows] = await conn.query(
        "SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? LIMIT 1",
        [newProductId]
      );
      const [vRows] = await conn.query("SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC", [newProductId]);
      return mapProductRow(pRows[0], vRows);
    });

    res.status(201).json({ status: "ok", product, message: "Đã thêm sản phẩm mới vào MySQL!" });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ status: "error", message: err.message });
    }
    sendServerError(res, "POST /api/products", err);
  }
});

app.put("/api/products/:id", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã sản phẩm không hợp lệ." });
  }

  const validated = validateProductPayload(req.body || {});
  if (validated.error) {
    return res.status(400).json({ status: "error", message: validated.error });
  }

  const body = req.body || {};
  const images = Array.isArray(body.images) && body.images.length > 0 ? body.images : ["assets/images/placeholder.svg"];
  const thumb = images[0];

  try {
    const product = await db.withTransaction(async (conn) => {
      const [existRows] = await conn.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
      if (existRows.length === 0) {
        const err = new Error("Không tìm thấy sản phẩm cần cập nhật.");
        err.statusCode = 404;
        throw err;
      }

      const catId = await resolveCategoryId(conn, body.category, body.categoryName);
      const slug = await generateUniqueProductSlug(conn, validated.name, productId);

      await conn.query(
        `UPDATE products
         SET category_id = ?, name = ?, slug = ?, badge = ?, description = ?, base_price = ?, original_price = ?,
             material = ?, fit = ?, thumbnail_url = ?, images_json = ?, is_active = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          catId,
          validated.name,
          slug,
          body.badge || null,
          String(body.description || ""),
          validated.price,
          validated.originalPrice,
          String(body.material || "100% Cotton định lượng cao"),
          String(body.fit || "Boxy Oversize"),
          thumb,
          JSON.stringify(images),
          body.status === "archived" ? 0 : 1,
          productId
        ]
      );

      const [existingVariants] = await conn.query("SELECT id FROM product_variants WHERE product_id = ?", [productId]);
      const existingVarIds = new Set(existingVariants.map((v) => String(v.id)));
      const keptVarIds = new Set();

      for (let i = 0; i < validated.variants.length; i++) {
        const v = validated.variants[i];
        const rawVarId = v.id !== undefined && v.id !== null ? String(v.id) : "";
        const isExistingVar = /^\d+$/.test(rawVarId) && existingVarIds.has(rawVarId);
        const rawSku = String(v.sku || "").trim().toUpperCase();
        const sku = rawSku || buildAutoSku(productId, v.size, v.colorName, i);

        const [dupSku] = isExistingVar
          ? await conn.query("SELECT id FROM product_variants WHERE sku = ? AND id <> ? LIMIT 1", [sku, Number(rawVarId)])
          : await conn.query("SELECT id FROM product_variants WHERE sku = ? LIMIT 1", [sku]);

        if (dupSku.length > 0) {
          const err = new Error(`Mã SKU "${sku}" đã được sử dụng ở sản phẩm khác.`);
          err.statusCode = 409;
          throw err;
        }

        if (isExistingVar) {
          await conn.query(
            `UPDATE product_variants
             SET sku = ?, size = ?, color = ?, color_code = ?, price = ?, stock_quantity = ?, image_url = ?, updated_at = NOW()
             WHERE id = ? AND product_id = ?`,
            [
              sku,
              String(v.size).trim(),
              String(v.colorName).trim(),
              String(v.colorCode || "#111111").trim(),
              validated.price,
              Number(v.stock),
              thumb,
              Number(rawVarId),
              productId
            ]
          );
          keptVarIds.add(Number(rawVarId));
        } else {
          const [insVar] = await conn.query(
            `INSERT INTO product_variants (product_id, sku, size, color, color_code, price, stock_quantity, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              productId,
              sku,
              String(v.size).trim(),
              String(v.colorName).trim(),
              String(v.colorCode || "#111111").trim(),
              validated.price,
              Number(v.stock),
              thumb
            ]
          );
          keptVarIds.add(insVar.insertId);
        }
      }

      // Xóa các biến thể cũ không còn trong danh sách
      for (const oldVar of existingVariants) {
        if (!keptVarIds.has(Number(oldVar.id))) {
          await conn.query("DELETE FROM product_variants WHERE id = ? AND product_id = ?", [oldVar.id, productId]);
        }
      }

      const [pRows] = await conn.query(
        "SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? LIMIT 1",
        [productId]
      );
      const [vRows] = await conn.query("SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC", [productId]);
      return mapProductRow(pRows[0], vRows);
    });

    res.json({ status: "ok", product, message: "Đã cập nhật sản phẩm trong MySQL!" });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ status: "error", message: err.message });
    }
    sendServerError(res, "PUT /api/products/:id", err);
  }
});

app.delete("/api/products/:id", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã sản phẩm không hợp lệ." });
  }

  try {
    const rows = await db.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy sản phẩm." });
    }
    await db.query("DELETE FROM products WHERE id = ?", [productId]);
    res.json({ status: "ok", message: "Đã xóa sản phẩm khỏi cơ sở dữ liệu MySQL." });
  } catch (err) {
    sendServerError(res, "DELETE /api/products/:id", err);
  }
});

// -----------------------------------------------------------------------------
// 7. CART ENDPOINTS (ĐỒNG BỘ GIỎ HÀNG VỚI BẢNG cart_items)
// -----------------------------------------------------------------------------
app.get("/api/cart", attachOptionalAuth, requireAuth, async (req, res) => {
  try {
    const items = await fetchUserCartRaw(req.user.id);
    res.json({ status: "ok", items });
  } catch (err) {
    sendServerError(res, "GET /api/cart", err);
  }
});

app.post("/api/cart/items", attachOptionalAuth, requireAuth, async (req, res) => {
  const variantId = Number(req.body && req.body.variantId);
  const qty = parseInt(req.body && req.body.quantity, 10) || 1;
  if (!Number.isInteger(variantId) || variantId <= 0 || qty <= 0) {
    return res.status(400).json({ status: "error", message: "Dữ liệu biến thể hoặc số lượng không hợp lệ." });
  }

  try {
    const variants = await db.query(
      `SELECT pv.*, p.is_active FROM product_variants pv
       INNER JOIN products p ON pv.product_id = p.id
       WHERE pv.id = ? LIMIT 1`,
      [variantId]
    );
    if (!variants || variants.length === 0 || !variants[0].is_active) {
      return res.status(404).json({ status: "error", message: "Sản phẩm hoặc biến thể không tồn tại." });
    }

    const stock = Number(variants[0].stock_quantity) || 0;
    if (stock <= 0) {
      return res.status(400).json({ status: "error", message: "Biến thể này hiện đã hết hàng." });
    }

    const existing = await db.query(
      "SELECT id, quantity FROM cart_items WHERE user_id = ? AND variant_id = ? LIMIT 1",
      [req.user.id, variantId]
    );
    const currentQty = existing.length > 0 ? Number(existing[0].quantity) : 0;
    const nextQty = currentQty + qty;
    if (nextQty > stock) {
      return res.status(400).json({
        status: "error",
        message: `Số lượng tối đa có thể thêm là ${stock} (Hiện đã có ${currentQty} trong giỏ).`
      });
    }

    await db.query(
      `INSERT INTO cart_items (user_id, variant_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = ?, updated_at = NOW()`,
      [req.user.id, variantId, nextQty, nextQty]
    );

    const items = await fetchUserCartRaw(req.user.id);
    res.json({ status: "ok", items });
  } catch (err) {
    sendServerError(res, "POST /api/cart/items", err);
  }
});

app.put("/api/cart/items/:variantId", attachOptionalAuth, requireAuth, async (req, res) => {
  const variantId = Number(req.params.variantId);
  const qty = parseInt(req.body && req.body.quantity, 10);
  if (!Number.isInteger(variantId) || variantId <= 0 || isNaN(qty)) {
    return res.status(400).json({ status: "error", message: "Dữ liệu cập nhật giỏ hàng không hợp lệ." });
  }

  try {
    if (qty <= 0) {
      await db.query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [req.user.id, variantId]);
      const items = await fetchUserCartRaw(req.user.id);
      return res.json({ status: "ok", items });
    }

    const variants = await db.query("SELECT stock_quantity FROM product_variants WHERE id = ? LIMIT 1", [variantId]);
    if (!variants || variants.length === 0) {
      return res.status(404).json({ status: "error", message: "Biến thể không tồn tại." });
    }

    const stock = Number(variants[0].stock_quantity) || 0;
    const adjusted = qty > stock;
    const finalQty = Math.min(qty, stock);

    if (finalQty <= 0) {
      await db.query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [req.user.id, variantId]);
    } else {
      await db.query(
        `INSERT INTO cart_items (user_id, variant_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = ?, updated_at = NOW()`,
        [req.user.id, variantId, finalQty, finalQty]
      );
    }

    const items = await fetchUserCartRaw(req.user.id);
    res.json({
      status: "ok",
      adjusted,
      items,
      message: adjusted ? `Số lượng đã điều chỉnh về mức tồn kho tối đa (${stock}).` : "Đã cập nhật số lượng."
    });
  } catch (err) {
    sendServerError(res, "PUT /api/cart/items/:variantId", err);
  }
});

app.delete("/api/cart/items/:variantId", attachOptionalAuth, requireAuth, async (req, res) => {
  const variantId = Number(req.params.variantId);
  if (!Number.isInteger(variantId) || variantId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã biến thể không hợp lệ." });
  }
  try {
    await db.query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [req.user.id, variantId]);
    const items = await fetchUserCartRaw(req.user.id);
    res.json({ status: "ok", items });
  } catch (err) {
    sendServerError(res, "DELETE /api/cart/items/:variantId", err);
  }
});

app.delete("/api/cart", attachOptionalAuth, requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);
    res.json({ status: "ok", items: [] });
  } catch (err) {
    sendServerError(res, "DELETE /api/cart", err);
  }
});

app.post("/api/cart/merge", attachOptionalAuth, requireAuth, async (req, res) => {
  const guestItems = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  if (guestItems.length === 0) {
    const items = await fetchUserCartRaw(req.user.id);
    return res.json({ status: "ok", items, adjustedCount: 0 });
  }

  try {
    let adjustedCount = 0;
    await db.withTransaction(async (conn) => {
      for (const g of guestItems) {
        const vid = Number(g.variantId);
        const qty = parseInt(g.quantity, 10) || 0;
        if (!Number.isInteger(vid) || vid <= 0 || qty <= 0) continue;

        const [vRows] = await conn.query(
          `SELECT pv.stock_quantity, p.is_active FROM product_variants pv
           INNER JOIN products p ON pv.product_id = p.id
           WHERE pv.id = ? LIMIT 1`,
          [vid]
        );
        if (!vRows || vRows.length === 0 || !vRows[0].is_active) continue;

        const stock = Number(vRows[0].stock_quantity) || 0;
        if (stock <= 0) continue;

        const [cRows] = await conn.query(
          "SELECT quantity FROM cart_items WHERE user_id = ? AND variant_id = ? LIMIT 1",
          [req.user.id, vid]
        );
        const currentQty = cRows.length > 0 ? Number(cRows[0].quantity) : 0;
        let nextQty = currentQty + qty;
        if (nextQty > stock) {
          nextQty = stock;
          adjustedCount++;
        }

        await conn.query(
          `INSERT INTO cart_items (user_id, variant_id, quantity)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = ?, updated_at = NOW()`,
          [req.user.id, vid, nextQty, nextQty]
        );
      }
    });

    const items = await fetchUserCartRaw(req.user.id);
    res.json({ status: "ok", items, adjustedCount });
  } catch (err) {
    sendServerError(res, "POST /api/cart/merge", err);
  }
});

// -----------------------------------------------------------------------------
// 8. ORDERS & INVENTORY TRANSACTIONS ENDPOINTS
// -----------------------------------------------------------------------------
app.get("/api/orders", attachOptionalAuth, requireAuth, async (req, res) => {
  try {
    const orders = await fetchOrdersForUser(req.user);
    res.json({ status: "ok", orders });
  } catch (err) {
    sendServerError(res, "GET /api/orders", err);
  }
});

app.get("/api/orders/:id", attachOptionalAuth, requireAuth, async (req, res) => {
  try {
    const found = await fetchOrderByIdentifier(req.params.id);
    if (!found) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
    }
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && Number(found.row.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập vào đơn hàng này!" });
    }
    res.json({ status: "ok", order: found.dto });
  } catch (err) {
    sendServerError(res, "GET /api/orders/:id", err);
  }
});

app.post("/api/orders", attachOptionalAuth, requireAuth, async (req, res) => {
  const { customerInfo = {}, paymentMethod = "cod", paymentProvider = null, paymentRef = null, paymentStatus = "pending", items: bodyItems } = req.body || {};

  const fullName = String(customerInfo.fullName || "").trim();
  const email = String(customerInfo.email || req.user.email || "").trim();
  const phone = String(customerInfo.phone || "").replace(/[\s.-]/g, "").trim();
  const address = String(customerInfo.address || "").trim();
  const note = String(customerInfo.note || "").trim();

  if (fullName.length < 2 || !phone || address.length < 6) {
    return res.status(400).json({ status: "error", message: "Thông tin người nhận (họ tên, số điện thoại, địa chỉ) chưa hợp lệ." });
  }

  const allowedMethods = new Set(["cod", "banking", "bank_transfer", "gateway", "vnpay", "momo"]);
  const safeMethod = allowedMethods.has(paymentMethod) ? paymentMethod : "cod";
  const allowedPayStatus = new Set(["pending", "paid"]);
  const safePayStatus = allowedPayStatus.has(paymentStatus) ? paymentStatus : "pending";

  try {
    const createdOrder = await db.withTransaction(async (conn) => {
      // Lấy danh sách biến thể từ cart_items trong MySQL (hoặc fallback bodyItems nếu vừa đặt trước lúc đồng bộ)
      const [cartRows] = await conn.query("SELECT variant_id, quantity FROM cart_items WHERE user_id = ?", [req.user.id]);
      let requestedItems = cartRows.map((c) => ({ variantId: Number(c.variant_id), quantity: Number(c.quantity) }));
      if (requestedItems.length === 0 && Array.isArray(bodyItems) && bodyItems.length > 0) {
        requestedItems = bodyItems
          .map((it) => ({ variantId: Number(it.variantId), quantity: parseInt(it.quantity, 10) }))
          .filter((it) => Number.isInteger(it.variantId) && it.variantId > 0 && it.quantity > 0);
      }

      if (requestedItems.length === 0) {
        const err = new Error("Giỏ hàng của bạn đang trống.");
        err.statusCode = 400;
        throw err;
      }

      const preparedItems = [];
      for (const reqItem of requestedItems) {
        const [vRows] = await conn.query(
          `SELECT pv.*, p.id AS prod_id, p.name AS prod_name, p.base_price, p.thumbnail_url, p.images_json, p.is_active
           FROM product_variants pv
           INNER JOIN products p ON pv.product_id = p.id
           WHERE pv.id = ? FOR UPDATE`,
          [reqItem.variantId]
        );

        if (!vRows || vRows.length === 0 || !vRows[0].is_active) {
          const err = new Error("Một sản phẩm trong giỏ hàng không còn tồn tại hoặc đã ngừng kinh doanh.");
          err.statusCode = 400;
          throw err;
        }

        const v = vRows[0];
        const currentStock = Number(v.stock_quantity) || 0;
        if (currentStock < reqItem.quantity) {
          const err = new Error(
            `Biến thể "${v.prod_name}" (${v.size} - ${v.color}) chỉ còn ${currentStock} cái trong kho (Bạn đặt ${reqItem.quantity}).`
          );
          err.statusCode = 400;
          throw err;
        }

        // Trừ tồn kho
        await conn.query("UPDATE product_variants SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?", [
          reqItem.quantity,
          v.id
        ]);

        const unitPrice = Number(v.base_price) || Number(v.price) || 0;
        const lineTotal = unitPrice * reqItem.quantity;
        const imgs = parseImagesJson(v.images_json, v.thumbnail_url);

        preparedItems.push({
          productId: v.prod_id,
          variantId: v.id,
          name: v.prod_name,
          sku: v.sku || "",
          size: v.size,
          colorName: v.color,
          image: v.image_url || imgs[0],
          unitPrice,
          quantity: reqItem.quantity,
          lineTotal
        });
      }

      const subtotal = preparedItems.reduce((s, it) => s + it.lineTotal, 0);
      const shippingFee = subtotal >= 500000 || subtotal === 0 ? 0 : 30000;
      const totalAmount = subtotal + shippingFee;

      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randPart = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `ORD-${datePart}-${randPart}`;
      const snapshotAddress = `Người nhận: ${fullName} | SĐT: ${phone} | Địa chỉ: ${address}`;

      const [orderIns] = await conn.query(
        `INSERT INTO orders (
          order_code, user_id, customer_name, customer_email, customer_phone, customer_address,
          shipping_address_snapshot, subtotal, shipping_fee, total_amount,
          payment_method, payment_provider, payment_ref, payment_status, order_status, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          orderCode,
          req.user.id,
          fullName,
          email,
          phone,
          address,
          snapshotAddress,
          subtotal,
          shippingFee,
          totalAmount,
          safeMethod,
          paymentProvider || null,
          paymentRef || null,
          safePayStatus,
          note
        ]
      );
      const newOrderId = orderIns.insertId;

      for (const it of preparedItems) {
        const variantInfoSnapshot = `SKU: ${it.sku || "N/A"} | Size: ${it.size} | Màu: ${it.colorName}`;
        await conn.query(
          `INSERT INTO order_items (
            order_id, product_id, variant_id, product_name_snapshot, variant_info_snapshot,
            sku_snapshot, size_snapshot, color_name_snapshot, image_snapshot, quantity, unit_price, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newOrderId,
            it.productId,
            it.variantId,
            it.name,
            variantInfoSnapshot,
            it.sku,
            it.size,
            it.colorName,
            it.image,
            it.quantity,
            it.unitPrice,
            it.lineTotal
          ]
        );
      }

      // Xóa giỏ hàng của user sau khi tạo đơn thành công
      await conn.query("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);

      const [oRows] = await conn.query(
        `SELECT o.*, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone
         FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ? LIMIT 1`,
        [newOrderId]
      );
      const [iRows] = await conn.query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC", [newOrderId]);
      return mapOrderRow(oRows[0], iRows);
    });

    res.status(201).json({ status: "ok", order: createdOrder, message: "Đặt hàng thành công!" });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ status: "error", message: err.message });
    }
    sendServerError(res, "POST /api/orders", err);
  }
});

app.post("/api/orders/:id/cancel", attachOptionalAuth, requireAuth, async (req, res) => {
  const reason = String((req.body && req.body.reason) || "Khách hàng yêu cầu hủy").trim();
  const isAdmin = req.user.role === "admin";

  try {
    const updatedOrder = await db.withTransaction(async (conn) => {
      const isNumeric = /^\d+$/.test(String(req.params.id));
      const [oRows] = isNumeric
        ? await conn.query("SELECT * FROM orders WHERE id = ? OR order_code = ? FOR UPDATE", [Number(req.params.id), req.params.id])
        : await conn.query("SELECT * FROM orders WHERE order_code = ? FOR UPDATE", [req.params.id]);

      if (!oRows || oRows.length === 0) {
        const err = new Error("Không tìm thấy đơn hàng.");
        err.statusCode = 404;
        throw err;
      }

      const order = oRows[0];
      const curStatus = normalizeOrderStatus(order.order_status);

      if (!isAdmin) {
        if (Number(order.user_id) !== Number(req.user.id)) {
          const err = new Error("Bạn không có quyền thao tác trên đơn hàng này.");
          err.statusCode = 403;
          throw err;
        }
        if (curStatus !== "pending") {
          const err = new Error("Chỉ có thể hủy đơn hàng khi đơn đang ở trạng thái 'Chờ xác nhận'.");
          err.statusCode = 400;
          throw err;
        }
      } else {
        if (curStatus !== "pending" && curStatus !== "confirmed") {
          const err = new Error("Không thể hủy đơn hàng đang giao hoặc đã giao thành công.");
          err.statusCode = 400;
          throw err;
        }
      }

      const [items] = await conn.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

      // Hoàn kho đúng 1 lần duy nhất
      if (!order.restocked) {
        for (const it of items) {
          if (it.variant_id) {
            await conn.query("UPDATE product_variants SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?", [
              Number(it.quantity) || 0,
              it.variant_id
            ]);
          }
        }
      }

      const nextPayStatus = normalizePaymentStatus(order.payment_status) === "paid" ? "refund_pending" : order.payment_status;

      await conn.query(
        `UPDATE orders
         SET order_status = 'cancelled', payment_status = ?, restocked = 1, cancel_reason = ?, updated_at = NOW()
         WHERE id = ?`,
        [nextPayStatus, reason, order.id]
      );

      const [refreshed] = await conn.query(
        `SELECT o.*, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone
         FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ? LIMIT 1`,
        [order.id]
      );
      return mapOrderRow(refreshed[0], items);
    });

    res.json({ status: "ok", order: updatedOrder, message: "Đã hủy đơn hàng và hoàn lại tồn kho thành công." });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ status: "error", message: err.message });
    }
    sendServerError(res, "POST /api/orders/:id/cancel", err);
  }
});

app.put("/api/orders/:id/status", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const { orderStatus, order_status, paymentStatus, payment_status, shippingCarrier, trackingCode, tracking_code } = req.body || {};
  const nextStatus = orderStatus || order_status;
  const nextPay = paymentStatus || payment_status;
  const nextTracking = trackingCode !== undefined ? trackingCode : tracking_code;

  try {
    const found = await fetchOrderByIdentifier(req.params.id);
    if (!found) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
    }

    const order = found.row;
    const currentStatus = normalizeOrderStatus(order.order_status);

    if (nextStatus) {
      if (currentStatus === "cancelled") {
        return res.status(400).json({ status: "error", message: "Đơn hàng đã hủy, không thể thay đổi trạng thái." });
      }
      if (currentStatus === "delivered" && nextStatus !== "delivered") {
        return res.status(400).json({ status: "error", message: "Đơn hàng đã giao thành công, không thể đổi về trạng thái trước đó." });
      }
      const validTransitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["shipping", "cancelled"],
        shipping: ["delivered"],
        delivered: ["delivered"]
      };
      const allowed = validTransitions[currentStatus] || [];
      if (!allowed.includes(nextStatus)) {
        return res.status(400).json({ status: "error", message: `Không thể chuyển trạng thái từ "${currentStatus}" sang "${nextStatus}".` });
      }
    }

    const updates = [];
    const params = [];

    if (nextStatus) {
      updates.push("order_status = ?");
      params.push(nextStatus);
    }
    if (nextPay) {
      updates.push("payment_status = ?");
      params.push(nextPay);
    }
    if (shippingCarrier && String(shippingCarrier).trim()) {
      const cleanCarrier = String(shippingCarrier).trim();
      updates.push("shipping_carrier = ?", "shipping_carrier_name = ?");
      params.push(cleanCarrier, SHIPPING_CARRIERS[cleanCarrier] || cleanCarrier);
    }
    if (nextTracking !== undefined && String(nextTracking).trim()) {
      updates.push("tracking_code = ?", "tracking_updated_at = NOW()");
      params.push(String(nextTracking).trim().toUpperCase());
      if (!shippingCarrier && !order.shipping_carrier) {
        updates.push("shipping_carrier = ?", "shipping_carrier_name = ?");
        params.push("spx", SHIPPING_CARRIERS.spx);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: "error", message: "Không có trường nào cần cập nhật!" });
    }

    params.push(order.id);
    await db.query(`UPDATE orders SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);

    const updated = await fetchOrderByIdentifier(order.id);
    res.json({
      status: "ok",
      order: updated.dto,
      message:
        nextStatus === "shipping"
          ? "Đã chuyển sang Đang giao hàng!"
          : nextStatus === "delivered"
          ? "Đã xác nhận Giao thành công!"
          : "Đã cập nhật trạng thái đơn hàng."
    });
  } catch (err) {
    sendServerError(res, "PUT /api/orders/:id/status", err);
  }
});

app.put("/api/orders/:id/tracking", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const { shippingCarrier = "spx", trackingCode = "" } = req.body || {};
  const cleanCode = String(trackingCode || "").trim().toUpperCase();
  if (!cleanCode) {
    return res.status(400).json({ status: "error", message: "Vui lòng nhập mã vận đơn giao hàng hợp lệ." });
  }

  try {
    const found = await fetchOrderByIdentifier(req.params.id);
    if (!found) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
    }
    if (normalizeOrderStatus(found.row.order_status) === "cancelled") {
      return res.status(400).json({ status: "error", message: "Đơn hàng đã hủy, không thể cập nhật mã vận đơn." });
    }

    const cleanCarrier = String(shippingCarrier || "spx").trim();
    const carrierName = SHIPPING_CARRIERS[cleanCarrier] || cleanCarrier;

    await db.query(
      "UPDATE orders SET shipping_carrier = ?, shipping_carrier_name = ?, tracking_code = ?, tracking_updated_at = NOW(), updated_at = NOW() WHERE id = ?",
      [cleanCarrier, carrierName, cleanCode, found.row.id]
    );

    const updated = await fetchOrderByIdentifier(found.row.id);
    res.json({
      status: "ok",
      order: updated.dto,
      message: `Đã lưu mã vận đơn ${cleanCode} (${carrierName}) thành công!`
    });
  } catch (err) {
    sendServerError(res, "PUT /api/orders/:id/tracking", err);
  }
});

app.put("/api/orders/:id/payment", attachOptionalAuth, requireAuth, requireAdmin, async (req, res) => {
  const { paymentStatus } = req.body || {};
  const allowed = new Set(["pending", "unpaid", "paid", "refund_pending", "refunded"]);
  if (!allowed.has(paymentStatus)) {
    return res.status(400).json({ status: "error", message: "Trạng thái thanh toán không hợp lệ." });
  }

  try {
    const found = await fetchOrderByIdentifier(req.params.id);
    if (!found) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy đơn hàng." });
    }
    await db.query("UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?", [paymentStatus, found.row.id]);
    const updated = await fetchOrderByIdentifier(found.row.id);
    res.json({ status: "ok", order: updated.dto, message: "Đã cập nhật trạng thái thanh toán." });
  } catch (err) {
    sendServerError(res, "PUT /api/orders/:id/payment", err);
  }
});

// -----------------------------------------------------------------------------
// 9. PRODUCT REVIEWS & WISHLISTS ENDPOINTS
// -----------------------------------------------------------------------------
app.get("/api/products/:id/reviews", async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã sản phẩm không hợp lệ." });
  }
  try {
    const rows = await db.query(
      "SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC",
      [productId]
    );
    res.json({ status: "ok", reviews: rows.map(mapReviewRow) });
  } catch (err) {
    sendServerError(res, "GET /api/products/:id/reviews", err);
  }
});

app.post("/api/products/:id/reviews", attachOptionalAuth, async (req, res) => {
  const productId = Number(req.params.id);
  const { author, rating, fitSpec, fitFeel, comment } = req.body || {};
  const cleanAuthor = String(author || (req.user && req.user.full_name) || "").trim();
  const cleanComment = String(comment || "").trim();
  const safeRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã sản phẩm không hợp lệ." });
  }
  if (!cleanAuthor || cleanComment.length < 6) {
    return res.status(400).json({ status: "error", message: "Vui lòng nhập tên hiển thị và nội dung nhận xét (tối thiểu 6 ký tự)." });
  }

  try {
    const review = await db.withTransaction(async (conn) => {
      const [pRows] = await conn.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
      if (pRows.length === 0) {
        const err = new Error("Sản phẩm không tồn tại.");
        err.statusCode = 404;
        throw err;
      }

      const [ins] = await conn.query(
        `INSERT INTO product_reviews (product_id, user_id, author_name, rating, fit_spec, fit_feel, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          req.user ? req.user.id : null,
          cleanAuthor,
          safeRating,
          String(fitSpec || "").trim(),
          String(fitFeel || "Chuẩn form Oversize").trim(),
          cleanComment
        ]
      );

      const [agg] = await conn.query(
        "SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM product_reviews WHERE product_id = ?",
        [productId]
      );
      await conn.query("UPDATE products SET rating = ?, review_count = ? WHERE id = ?", [
        Number(agg[0].avg_rating || 5).toFixed(1),
        Number(agg[0].cnt || 0),
        productId
      ]);

      const [rRows] = await conn.query("SELECT * FROM product_reviews WHERE id = ? LIMIT 1", [ins.insertId]);
      return mapReviewRow(rRows[0]);
    });

    res.status(201).json({ status: "ok", review, message: "Cảm ơn bạn đã chia sẻ đánh giá!" });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ status: "error", message: err.message });
    }
    sendServerError(res, "POST /api/products/:id/reviews", err);
  }
});

app.get("/api/wishlist", attachOptionalAuth, requireAuth, async (req, res) => {
  try {
    const wishlist = await fetchUserWishlistIds(req.user.id);
    res.json({ status: "ok", wishlist });
  } catch (err) {
    sendServerError(res, "GET /api/wishlist", err);
  }
});

app.post("/api/wishlist/toggle", attachOptionalAuth, requireAuth, async (req, res) => {
  const productId = Number(req.body && req.body.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ status: "error", message: "Mã sản phẩm không hợp lệ." });
  }

  try {
    const existing = await db.query(
      "SELECT id FROM wishlists WHERE user_id = ? AND product_id = ? LIMIT 1",
      [req.user.id, productId]
    );

    let added = false;
    if (existing.length > 0) {
      await db.query("DELETE FROM wishlists WHERE id = ?", [existing[0].id]);
    } else {
      const pCheck = await db.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
      if (pCheck.length === 0) {
        return res.status(404).json({ status: "error", message: "Sản phẩm không tồn tại." });
      }
      await db.query("INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)", [req.user.id, productId]);
      added = true;
    }

    const wishlist = await fetchUserWishlistIds(req.user.id);
    res.json({ status: "ok", added, wishlist });
  } catch (err) {
    sendServerError(res, "POST /api/wishlist/toggle", err);
  }
});

// -----------------------------------------------------------------------------
// 10. DATABASE RESET & SETUP EXECUTION (DÀNH CHO ADMIN / KHỞI TẠO BAN ĐẦU)
// -----------------------------------------------------------------------------
app.post("/api/admin/run-database-setup", attachOptionalAuth, async (req, res) => {
  try {
    let allowSetup = Boolean(req.user && req.user.role === "admin");
    if (!allowSetup && process.env.NODE_ENV !== "production") {
      // Cho phép khởi tạo lần đầu nếu bảng users chưa tồn tại
      try {
        const uRows = await db.query("SELECT COUNT(*) AS cnt FROM users");
        if (!uRows || Number(uRows[0].cnt) === 0) allowSetup = true;
      } catch (e) {
        allowSetup = true;
      }
    }

    if (!allowSetup) {
      return res.status(403).json({ status: "error", message: "Chỉ Quản trị viên (Admin) mới được phép nạp lại CSDL." });
    }

    const result = await db.runSetupScript();
    const stats = await db.getTableStats();
    res.json({ status: "ok", ...result, stats });
  } catch (err) {
    sendServerError(res, "POST /api/admin/run-database-setup", err);
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

/**
 * HK STORE - MYSQL DATABASE CONNECTION & POOL MANAGER
 * Hệ quản trị: MySQL 8.0+ / MariaDB 10.11+
 * Thư viện: mysql2/promise
 */
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hk_store",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  dateStrings: true,
  multipleStatements: true
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

/**
 * Thực thi các thao tác trong một MySQL Transaction an toàn (tự động commit/rollback)
 */
async function withTransaction(callback) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rbErr) {
      console.error("[MySQL] Rollback error:", rbErr.message);
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Kiểm tra kết nối tới MySQL và kiểm tra trạng thái database
 */
async function testConnection() {
  try {
    const currentPool = getPool();
    const [rows] = await currentPool.query("SELECT 1 + 1 AS result, NOW() AS server_time, VERSION() AS version");
    const [dbRows] = await currentPool.query("SELECT DATABASE() AS current_db");

    // Thống kê nhanh số lượng bản ghi các bảng chính
    let counts = {};
    try {
      const [u] = await currentPool.query("SELECT COUNT(*) AS total FROM users");
      const [c] = await currentPool.query("SELECT COUNT(*) AS total FROM categories");
      const [p] = await currentPool.query("SELECT COUNT(*) AS total FROM products");
      const [v] = await currentPool.query("SELECT COUNT(*) AS total FROM product_variants");
      const [ci] = await currentPool.query("SELECT COUNT(*) AS total FROM cart_items");
      const [o] = await currentPool.query("SELECT COUNT(*) AS total FROM orders");
      counts = {
        users: u[0].total,
        categories: c[0].total,
        products: p[0].total,
        product_variants: v[0].total,
        cart_items: ci[0].total,
        orders: o[0].total
      };
    } catch (tblErr) {
      counts = { note: "Cần import file database_setup.sql để khởi tạo bảng" };
    }

    return {
      connected: true,
      database: dbRows[0].current_db,
      version: rows[0].version,
      serverTime: rows[0].server_time,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      counts
    };
  } catch (error) {
    let friendlyError = error.message || error.sqlMessage || "";
    if (error.code === "ECONNREFUSED") {
      friendlyError = `Không thể kết nối đến MySQL tại ${dbConfig.host}:${dbConfig.port} (Dịch vụ MySQL chưa được khởi động trên máy).`;
    } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
      friendlyError = `Sai thông tin đăng nhập MySQL (User: ${dbConfig.user}). Vui lòng kiểm tra lại DB_USER và DB_PASSWORD trong file .env.`;
    } else if (error.code === "ER_BAD_DB_ERROR") {
      friendlyError = `Cơ sở dữ liệu '${dbConfig.database}' chưa tồn tại. Vui lòng nạp file database_setup.sql để khởi tạo.`;
    }

    return {
      connected: false,
      error: friendlyError,
      code: error.code,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    };
  }
}

/**
 * Thực thi câu truy vấn SQL an toàn
 */
async function query(sql, params = []) {
  const currentPool = getPool();
  const [results] = await currentPool.query(sql, params);
  return results;
}

/**
 * Lấy số lượng chi tiết tất cả 10 bảng trong MySQL
 */
async function getTableStats() {
  const currentPool = getPool();
  const tables = [
    "users",
    "user_addresses",
    "categories",
    "products",
    "product_variants",
    "cart_items",
    "orders",
    "order_items",
    "product_reviews",
    "wishlists"
  ];

  const stats = {};
  for (const t of tables) {
    try {
      const [r] = await currentPool.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
      stats[t] = r[0].cnt;
    } catch (e) {
      stats[t] = null;
    }
  }
  return stats;
}

/**
 * Khởi tạo hoặc nạp lại seed script từ database_setup.sql
 */
async function runSetupScript() {
  const sqlPath = path.join(__dirname, "..", "database_setup.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error("Không tìm thấy file database_setup.sql tại thư mục dự án!");
  }
  const sqlContent = fs.readFileSync(sqlPath, "utf8");

  // Kết nối không chọn DB trước để tạo DB nếu chưa có
  const adminConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
    charset: "utf8mb4"
  });

  try {
    await adminConnection.query(sqlContent);
    return {
      success: true,
      message: "Đã nạp toàn bộ cấu trúc 10 bảng và dữ liệu chuẩn hóa từ database_setup.sql thành công!"
    };
  } finally {
    await adminConnection.end();
  }
}

module.exports = {
  dbConfig,
  getPool,
  withTransaction,
  query,
  testConnection,
  getTableStats,
  runSetupScript
};

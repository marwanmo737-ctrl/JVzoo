const Database = require("better-sqlite3");
const path = require("path");

// ⚠️ مهم جداً في الإنتاج: منصات مثل Render/Heroku/Fly.io تمسح أي ملفات
// على القرص المحلي مع كل إعادة نشر (redeploy) أو إعادة تشغيل الحاوية،
// لأن الـ filesystem غير دائم افتراضياً. لو DB_PATH لم يُحدَّد صراحةً
// إلى مسار على قرص دائم (Persistent Disk في Render، Volume في Fly.io،
// إلخ)، ستفقد كل بيانات المستخدمين والتراخيص عند أول إعادة نشر.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.sqlite");

if (process.env.NODE_ENV === "production" && !process.env.DB_PATH) {
  console.warn(
    "⚠️⚠️⚠️ تحذير إنتاج: DB_PATH غير محدد — قاعدة البيانات ستُخزَّن على مسار غير دائم " +
    "وستُمحى مع أي redeploy/restart. حدد DB_PATH ليشير إلى قرص دائم (راجع README)."
  );
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    plan TEXT NOT NULL DEFAULT 'none',
    usage_count INTEGER NOT NULL DEFAULT 0,
    period_start TEXT NOT NULL,
    must_set_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    plan_id TEXT NOT NULL,
    jvzoo_transaction_id TEXT UNIQUE,
    product_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    legal TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

/* ===================== USERS ===================== */

function createUser({ email, passwordHash, fullName, plan = "none", mustSetPassword = 0 }) {
  const stmt = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, plan, usage_count, period_start, must_set_password)
    VALUES (?, ?, ?, ?, 0, date('now'), ?)
  `);
  const info = stmt.run(email.toLowerCase().trim(), passwordHash, fullName || "", plan, mustSetPassword);
  return getUserById(info.lastInsertRowid);
}

function getUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase().trim());
}

function getUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

function updateUserPassword(userId, passwordHash) {
  db.prepare(`UPDATE users SET password_hash = ?, must_set_password = 0 WHERE id = ?`).run(passwordHash, userId);
}

function resetUsageIfNeeded(user) {
  const now = new Date();
  const periodStart = new Date(user.period_start);
  const isNewMonth = now.getFullYear() !== periodStart.getFullYear() || now.getMonth() !== periodStart.getMonth();
  if (isNewMonth) {
    db.prepare(`UPDATE users SET usage_count = 0, period_start = date('now') WHERE id = ?`).run(user.id);
    return getUserById(user.id);
  }
  return user;
}

function incrementUsage(userId) {
  db.prepare(`UPDATE users SET usage_count = usage_count + 1 WHERE id = ?`).run(userId);
}

function updatePlan(userId, plan) {
  db.prepare(`UPDATE users SET plan = ? WHERE id = ?`).run(plan, userId);
}

/* ===================== LICENSES ===================== */

function createLicense({ licenseKey, userId, planId, jvzooTransactionId, productId }) {
  const stmt = db.prepare(`
    INSERT INTO licenses (license_key, user_id, plan_id, jvzoo_transaction_id, product_id, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `);
  const info = stmt.run(licenseKey, userId, planId, jvzooTransactionId, productId);
  return db.prepare(`SELECT * FROM licenses WHERE id = ?`).get(info.lastInsertRowid);
}

function getLicenseByTransactionId(transactionId) {
  return db.prepare(`SELECT * FROM licenses WHERE jvzoo_transaction_id = ?`).get(transactionId);
}

function revokeLicenseByTransactionId(transactionId) {
  db.prepare(`UPDATE licenses SET status = 'revoked' WHERE jvzoo_transaction_id = ?`).run(transactionId);
}

function getActiveLicenseForUser(userId) {
  return db.prepare(`
    SELECT * FROM licenses WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1
  `).get(userId);
}

function getHighestActivePlanForUser(userId) {
  const rows = db.prepare(`
    SELECT plan_id FROM licenses WHERE user_id = ? AND status = 'active'
  `).all(userId);

  if (!rows.length) return null;

  const rank = { starter: 1, pro: 2, agency: 3 };
  return rows.reduce((highest, r) =>
    (rank[r.plan_id] > rank[highest] ? r.plan_id : highest), rows[0].plan_id
  );
}

/* ===================== PASSWORD RESET TOKENS ===================== */

function createResetToken(userId, token, expiresAt) {
  db.prepare(`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`).run(userId, token, expiresAt);
}

function getValidResetToken(token) {
  return db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token);
}

function markResetTokenUsed(token) {
  db.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE token = ?`).run(token);
}

/* ===================== PAGES ===================== */

function rowToPage(row) {
  if (!row) return null;
  return {
    ...row,
    content: JSON.parse(row.content),
    legal: row.legal ? JSON.parse(row.legal) : null
  };
}

function createPage({ userId, content, legal }) {
  const stmt = db.prepare(`
    INSERT INTO pages (user_id, content, legal, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(userId, JSON.stringify(content), legal ? JSON.stringify(legal) : null);
  return getPageById(info.lastInsertRowid);
}

function getPageById(id) {
  return rowToPage(db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id));
}

function updatePageContent(id, content) {
  db.prepare(`UPDATE pages SET content = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(content), id);
  return getPageById(id);
}

// Close the SQLite connection cleanly when the process exits so that
// WAL checkpointing completes and no journal files are left behind.
// Using 'exit' (synchronous) because better-sqlite3 is synchronous too.
process.on("exit", () => {
  try { db.close(); } catch { /* already closed or never opened */ }
});

module.exports = {
  createUser, getUserByEmail, getUserById, updateUserPassword,
  resetUsageIfNeeded, incrementUsage, updatePlan,
  createLicense, getLicenseByTransactionId, revokeLicenseByTransactionId,
  getActiveLicenseForUser, getHighestActivePlanForUser,
  createResetToken, getValidResetToken, markResetTokenUsed,
  createPage, getPageById, updatePageContent
};

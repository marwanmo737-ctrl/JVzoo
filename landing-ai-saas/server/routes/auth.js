const express = require("express");
const router = express.Router();
const { authLimiter } = require("../middleware/rateLimiter");
const { requireAuth } = require("../middleware/authMiddleware");
const db = require("../db/database");
const { hashPassword, comparePassword, generateToken, isValidEmail, isValidPassword } = require("../services/authService");
const { generateSecureToken } = require("../services/licenseService");
const { sendPasswordResetEmail } = require("../services/emailService");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "strict",
  maxAge: 30 * 24 * 60 * 60 * 1000
};

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    plan: user.plan,
    usageCount: user.usage_count
  };
}

/* ===== POST /api/auth/login ===== */
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const genericError = { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };

  if (!isValidEmail(email) || !password) return res.status(400).json(genericError);

  const user = db.getUserByEmail(email);
  if (!user) return res.status(401).json(genericError);

  if (user.must_set_password) {
    return res.status(403).json({ error: "يجب تعيين كلمة مرور أولاً عبر الرابط المُرسل إلى بريدك.", mustSetPassword: true });
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return res.status(401).json(genericError);

  const token = generateToken(user);
  res.cookie("token", token, cookieOptions);
  res.json({ success: true, user: publicUser(user) });
});

/* ===== POST /api/auth/set-password ===== */
router.post("/set-password", authLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !isValidPassword(password)) {
    return res.status(400).json({ error: "بيانات غير صالحة. كلمة المرور يجب أن تكون 8 أحرف على الأقل مع رقم وحرف." });
  }

  const resetRecord = db.getValidResetToken(token);
  if (!resetRecord) return res.status(400).json({ error: "الرابط غير صالح أو منتهي الصلاحية." });

  const passwordHash = await hashPassword(password);
  db.updateUserPassword(resetRecord.user_id, passwordHash);
  db.markResetTokenUsed(token);

  const user = db.getUserById(resetRecord.user_id);
  const authToken = generateToken(user);
  res.cookie("token", authToken, cookieOptions);

  res.json({ success: true, user: publicUser(user) });
});

/* ===== POST /api/auth/forgot-password ===== */
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  const successMsg = { success: true, message: "إذا كان البريد مسجلاً لدينا، ستصلك رسالة استعادة كلمة المرور." };

  const user = db.getUserByEmail(email || "");
  if (!user) return res.json(successMsg);

  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.createResetToken(user.id, token, expiresAt);

  const resetLink = `${process.env.APP_URL}/set-password.html?token=${token}`;
  await sendPasswordResetEmail({ to: user.email, resetLink });

  res.json(successMsg);
});

/* ===== POST /api/auth/logout ===== */
router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ success: true });
});

/* ===== GET /api/auth/me ===== */
router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

module.exports = router;

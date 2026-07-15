const { verifyToken } = require("../services/authService");
const { getUserById, resetUsageIfNeeded } = require("../db/database");

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "يجب تسجيل الدخول أولاً." });

  try {
    const decoded = verifyToken(token);
    let user = getUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: "الحساب غير موجود." });

    user = resetUsageIfNeeded(user);
    req.user = user;
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً." });
  }
}

module.exports = { requireAuth };

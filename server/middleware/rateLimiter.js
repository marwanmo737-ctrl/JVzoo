const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "طلبات كثيرة جداً، حاول لاحقاً." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "محاولات كثيرة جداً، حاول بعد 15 دقيقة." }
});

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "طلبات كثيرة جداً خلال ساعة، حاول لاحقاً." }
});

module.exports = { generalLimiter, authLimiter, generateLimiter };

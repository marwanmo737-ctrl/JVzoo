require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const webhookRoutes = require("./routes/webhooks");
const { generalLimiter } = require("./middleware/rateLimiter");

// ⚠️ فحص متغيرات البيئة الإلزامية عند الإقلاع — نفشل فوراً وبرسالة واضحة
// بدل ما نشتغل بمفاتيح ناقصة (JWT فاضي، Groq/JVzoo/Resend بدون مفتاح)
// ونكتشف المشكلة بعد ما عميل يحاول يدفع أو يسجّل دخول.
const REQUIRED_ENV_VARS = [
  "JWT_SECRET", "GROQ_API_KEY", "JVZOO_SECRET_KEY", "RESEND_API_KEY", "EMAIL_FROM", "APP_URL",
  // بدون هذه الثلاثة، getPlanByProductId() لن يطابق أي دفعة حقيقية بخطة —
  // العميل يدفع ويستلم بريد ترحيب لكن بدون ترخيص فعّال.
  "JVZOO_PRODUCT_ID_STARTER", "JVZOO_PRODUCT_ID_PRO", "JVZOO_PRODUCT_ID_AGENCY"
];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ متغيرات بيئة ناقصة: ${missingEnvVars.join(", ")}`);
  console.error("راجع server/.env.example وعبّئ كل القيم قبل التشغيل.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGIN) {
  console.error("❌ ALLOWED_ORIGIN غير محدد في الإنتاج. حدد دومين الموقع الفعلي (مثال: https://yourdomain.com).");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

// CORS: لا يوجد fallback إلى "*" مع credentials:true — هذا المزيج غير آمن
// أصلاً (والمتصفحات ترفضه مع طلبات فيها كوكيز). في الإنتاج ALLOWED_ORIGIN
// إلزامي (تم التحقق أعلاه)، وفي التطوير نستخدم localhost افتراضياً.
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin, credentials: true }));

// ⚠️ يجب تسجيل الويبهوك قبل express.json() لأن JVzoo يرسل urlencoded
app.use("/webhooks", webhookRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

app.use(express.static(path.join(__dirname, "../public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

app.listen(PORT, () => console.log(`✅ LandingAI running on http://localhost:${PORT}`));

const express = require("express");
const router = express.Router();
const { generateLimiter } = require("../middleware/rateLimiter");
const { requireAuth } = require("../middleware/authMiddleware");
const { checkQuota } = require("../middleware/quotaMiddleware");
const { getMonthlyQuota } = require("../config/plans");
const { incrementUsage, createPage, getPageById, updatePageContent } = require("../db/database");
const { scrapeProductUrl } = require("../services/scraperService");
const groq = require("../services/groqService");

function validateGenerateInput(body) {
  const { inputType, inputValue, price, purchaseLink } = body;
  if (!["link", "name", "desc", "image"].includes(inputType)) return "نوع الإدخال غير صالح";
  if (inputType !== "image" && (!inputValue || inputValue.trim().length < 2)) return "بيانات المنتج غير كافية";
  if (price && isNaN(Number(price))) return "السعر غير صالح";
  if (purchaseLink && purchaseLink.length > 500) return "رابط الشراء طويل جداً";
  return null;
}

/**
 * Persists the result of a regenerate/improve call so it's never lost.
 * If a pageId was supplied and actually belongs to the requesting user,
 * update that row in place. Otherwise (no pageId, unknown id, or someone
 * else's id) fall back to creating a fresh row instead of silently
 * discarding the content or overwriting another user's page.
 */
function persistPageUpdate(req, pageId, content) {
  const existing = pageId ? getPageById(pageId) : null;
  if (existing && existing.user_id === req.user.id) {
    return updatePageContent(pageId, content);
  }
  return createPage({ userId: req.user.id, content, legal: null });
}

/* ===== GET /api/config (public — no auth required) =====
 * Returns the JVZoo sales-page URLs so the frontend never has
 * them hardcoded. Falls back to "#" when env vars are unset so
 * the app still renders (buttons are just non-functional).
 */
router.get("/config", (req, res) => {
  res.json({
    plans: [
      { id: "starter", salesUrl: process.env.JVZOO_SALES_URL_STARTER || "#" },
      { id: "pro",     salesUrl: process.env.JVZOO_SALES_URL_PRO     || "#" },
      { id: "agency",  salesUrl: process.env.JVZOO_SALES_URL_AGENCY   || "#" }
    ]
  });
});

router.use(requireAuth);

/* ===== POST /api/generate ===== */
router.post("/generate", generateLimiter, checkQuota, async (req, res) => {
  try {
    const err = validateGenerateInput(req.body);
    if (err) return res.status(400).json({ error: err });

    const { inputType, inputValue, imageBase64, imageMimeType, extraNotes, price, currency, billingType, purchaseLink, lang } = req.body;
    let rawInput = inputValue || "";

    if (inputType === "link") {
      const scraped = await scrapeProductUrl(inputValue);
      rawInput = scraped.success
        ? `العنوان: ${scraped.title}\nالوصف: ${scraped.description}\nمحتوى الصفحة: ${scraped.bodyText}`
        : `رابط المنتج: ${inputValue} (تعذر الاستخراج التلقائي، استنتج من الرابط نفسه)`;
    }

    if (inputType === "image") {
      if (!imageBase64) return res.status(400).json({ error: "لم يتم إرفاق صورة" });
      rawInput = await groq.analyzeProductImage(imageBase64, imageMimeType || "image/jpeg");
    }

    const content = await groq.generateLandingContent({ inputType, rawInput, extraNotes, price, currency, billingType, lang });
    content.price = price || "0";
    content.currency = currency || "USD";
    content.billingType = billingType || "onetime";
    content.purchaseLink = purchaseLink || "#";
    content.lang = lang || "ar";

    const legal = await groq.generateLegalPages(content, lang);

    const page = createPage({ userId: req.user.id, content, legal });

    incrementUsage(req.user.id);

    res.json({
      success: true,
      pageId: page.id,
      content,
      legal,
      usage: { used: req.user.usage_count + 1, limit: getMonthlyQuota(req.user.plan) }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "فشل توليد الصفحة، حاول مرة أخرى." });
  }
});

/* ===== POST /api/regenerate ===== */
router.post("/regenerate", generateLimiter, checkQuota, async (req, res) => {
  try {
    const { content, instruction, lang, pageId } = req.body;
    if (!content || !instruction) return res.status(400).json({ error: "بيانات ناقصة" });
    const updated = await groq.regenerateContent(content, instruction, lang);
    const page = persistPageUpdate(req, pageId, updated);
    incrementUsage(req.user.id);
    res.json({ success: true, pageId: page.id, content: updated, usage: { used: req.user.usage_count + 1, limit: getMonthlyQuota(req.user.plan) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "فشل تنفيذ التعديل" });
  }
});

/* ===== POST /api/improve ===== */
router.post("/improve", generateLimiter, checkQuota, async (req, res) => {
  try {
    const { content, lang, pageId } = req.body;
    if (!content) return res.status(400).json({ error: "بيانات ناقصة" });
    const improved = await groq.improveContent(content, lang);
    const page = persistPageUpdate(req, pageId, improved);
    incrementUsage(req.user.id);
    res.json({ success: true, pageId: page.id, content: improved, usage: { used: req.user.usage_count + 1, limit: getMonthlyQuota(req.user.plan) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "فشل التحسين" });
  }
});

module.exports = router;

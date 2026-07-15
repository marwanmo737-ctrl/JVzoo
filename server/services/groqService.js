const fetch = require("node-fetch");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "llama-3.2-11b-vision-preview";

/* ============================================================
   Safe JSON parser — handles:
   1. Markdown code fences (```json ... ```) Groq sometimes wraps
   2. Leading/trailing whitespace or BOM characters
   3. Embedded JSON object/array when there is surrounding text
   ============================================================ */
function safeParseJSON(raw) {
  if (!raw) throw new Error("Groq returned an empty response");
  let text = raw.trim();

  // Strip markdown code fences
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // Last-resort: extract the first {...} or [...] block from the text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch { /* fall through */ }
    }
    throw new Error(`Groq returned invalid JSON. Preview: ${text.slice(0, 300)}`);
  }
}

/* ============================================================
   Core fetch — one attempt, no retry
   ============================================================ */
async function callGroq(messages, { jsonMode = true, model = TEXT_MODEL } = {}) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.75,
      max_tokens: 6000,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

/* ============================================================
   Retry wrapper — exponential back-off on transient errors
   (429 rate-limit, 500/503 server errors)
   ============================================================ */
async function callGroqWithRetry(messages, options = {}, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callGroq(messages, options);
    } catch (err) {
      lastErr = err;
      const isTransient =
        err.message.includes("429") ||
        err.message.includes("503") ||
        err.message.includes("500");
      if (!isTransient || attempt === maxRetries) break;
      // Exponential back-off: 1 s, 2 s
      await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }
  throw lastErr;
}

/* ============================================================
   Public helpers
   ============================================================ */

async function analyzeProductImage(base64Image, mimeType) {
  const content = await callGroqWithRetry(
    [
      {
        role: "user",
        content: [
          { type: "text", text: "حلّل هذه الصورة لمنتج، وصف نوع المنتج، فئته، مميزاته الظاهرة، والجمهور المحتمل. اكتب فقرة تحليلية واضحة بالعربية." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }
    ],
    { jsonMode: false, model: VISION_MODEL }
  );
  return content;
}

const CONTENT_SCHEMA = `
أرجع JSON فقط دون أي نص إضافي وفق الهيكل التالي بالضبط:
{
  "meta": {"productName":"", "category":"", "targetAudience":""},
  "hero": {"badge":"", "title":"", "subtitle":"", "ctaPrimary":"", "ctaSecondary":""},
  "painPoints": {"title":"", "items":[{"icon":"⚠️","text":""}]},
  "benefits": {"title":"", "subtitle":"", "items":[{"icon":"✨","title":"","desc":""}]},
  "features": {"title":"", "subtitle":"", "items":[{"icon":"⚡","title":"","desc":""}]},
  "whyUs": {"title":"", "items":[{"icon":"🏆","title":"","desc":""}]},
  "testimonials": {"title":"", "disclaimer":"أمثلة توضيحية لنتائج محتملة", "items":[{"name":"","role":"","text":"","rating":5}]},
  "faq": {"title":"", "items":[{"q":"","a":""}]},
  "guarantee": {"title":"", "days":"30", "text":""},
  "finalCta": {"title":"", "subtitle":"", "buttonText":""}
}
اجعل كل النصوص احترافية ومقنعة بأسلوب AIDA، بدون مبالغات كاذبة.
`;

async function generateLandingContent({ inputType, rawInput, extraNotes, price, currency, billingType, lang }) {
  const langInstruction = lang === "ar"
    ? "اكتب كل المحتوى بالعربية الفصحى التسويقية الاحترافية."
    : "Write all content in professional persuasive marketing English.";

  const prompt = `
بيانات المنتج المستخرجة (نوع الإدخال: ${inputType}):
${rawInput}

ملاحظات إضافية من صاحب المنتج: ${extraNotes || "لا يوجد"}
السعر: ${price} ${currency} — نوع الاشتراك: ${billingType}

${langInstruction}
${CONTENT_SCHEMA}
`;

  const raw = await callGroqWithRetry([
    { role: "system", content: "أنت خبير تسويق عالمي متخصص في صفحات الهبوط عالية التحويل. ترجع دائماً JSON صالح 100% بدون أي شرح إضافي." },
    { role: "user", content: prompt }
  ]);

  return safeParseJSON(raw);
}

async function generateLegalPages(content, lang) {
  const langInstruction = lang === "ar" ? "بالعربية" : "in English";
  const prompt = `
بناءً على منتج "${content.meta.productName}" في فئة "${content.meta.category}"،
اكتب 3 صفحات قانونية احترافية ${langInstruction}.
أرجع JSON فقط: {"privacy":"نص كامل", "terms":"نص كامل", "disclaimer":"نص كامل"}
`;
  const raw = await callGroqWithRetry([
    { role: "system", content: "أنت مستشار قانوني متخصص في صياغة سياسات مواقع البيع الإلكتروني. أرجع JSON صحيح فقط." },
    { role: "user", content: prompt }
  ]);
  return safeParseJSON(raw);
}

async function regenerateContent(currentContent, instruction, lang) {
  const prompt = `
المحتوى الحالي بصيغة JSON:
${JSON.stringify(currentContent)}

طلب التعديل: "${instruction}"

نفّذ التعديل المطلوب فقط وحافظ على بقية الحقول كما هي.
${CONTENT_SCHEMA}
`;
  const raw = await callGroqWithRetry([
    { role: "system", content: "أنت محرر محتوى تسويقي محترف. تعدّل فقط ما يُطلب. أرجع JSON صحيح كامل بنفس الهيكل." },
    { role: "user", content: prompt }
  ]);
  return safeParseJSON(raw);
}

async function improveContent(currentContent, lang) {
  return regenerateContent(
    currentContent,
    "حسّن جودة كل النصوص لتكون أكثر احترافية وإقناعاً وجاذبية دون تغيير المعنى أو الهيكل.",
    lang
  );
}

module.exports = {
  analyzeProductImage,
  generateLandingContent,
  generateLegalPages,
  regenerateContent,
  improveContent
};

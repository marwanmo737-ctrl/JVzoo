const fetch = require("node-fetch");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "llama-3.2-11b-vision-preview";

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

async function analyzeProductImage(base64Image, mimeType) {
  const content = await callGroq(
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

  const raw = await callGroq([
    { role: "system", content: "أنت خبير تسويق عالمي متخصص في صفحات الهبوط عالية التحويل. ترجع دائماً JSON صالح 100% بدون أي شرح إضافي." },
    { role: "user", content: prompt }
  ]);

  return JSON.parse(raw);
}

async function generateLegalPages(content, lang) {
  const langInstruction = lang === "ar" ? "بالعربية" : "in English";
  const prompt = `
بناءً على منتج "${content.meta.productName}" في فئة "${content.meta.category}"،
اكتب 3 صفحات قانونية احترافية ${langInstruction}.
أرجع JSON فقط: {"privacy":"نص كامل", "terms":"نص كامل", "disclaimer":"نص كامل"}
`;
  const raw = await callGroq([
    { role: "system", content: "أنت مستشار قانوني متخصص في صياغة سياسات مواقع البيع الإلكتروني. أرجع JSON صحيح فقط." },
    { role: "user", content: prompt }
  ]);
  return JSON.parse(raw);
}

async function regenerateContent(currentContent, instruction, lang) {
  const prompt = `
المحتوى الحالي بصيغة JSON:
${JSON.stringify(currentContent)}

طلب التعديل: "${instruction}"

نفّذ التعديل المطلوب فقط وحافظ على بقية الحقول كما هي.
${CONTENT_SCHEMA}
`;
  const raw = await callGroq([
    { role: "system", content: "أنت محرر محتوى تسويقي محترف. تعدّل فقط ما يُطلب. أرجع JSON صحيح كامل بنفس الهيكل." },
    { role: "user", content: prompt }
  ]);
  return JSON.parse(raw);
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

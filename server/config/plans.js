/**
 * مصدر واحد للحقيقة بخصوص الخطط — كل تعديل مستقبلي بالأسعار/الحدود يتم هنا فقط
 */

const PLANS = {
  starter: {
    id: "starter",
    label: "Starter",
    price: 47,
    monthlyQuota: 20,
    jvzooProductId: process.env.JVZOO_PRODUCT_ID_STARTER,
    features: ["20 صفحة هبوط شهرياً", "دعم عبر البريد الإلكتروني", "تصدير HTML كامل"]
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: 97,
    monthlyQuota: 60,
    jvzooProductId: process.env.JVZOO_PRODUCT_ID_PRO,
    features: ["60 صفحة هبوط شهرياً", "دعم أولوية", "تصدير HTML كامل", "بدون علامة مائية"]
  },
  agency: {
    id: "agency",
    label: "Agency",
    price: 197,
    monthlyQuota: 150,
    jvzooProductId: process.env.JVZOO_PRODUCT_ID_AGENCY,
    features: ["150 صفحة هبوط شهرياً", "دعم أولوية VIP", "تصدير HTML كامل", "ترخيص White-label"]
  }
};

function getPlanByProductId(productId) {
  return Object.values(PLANS).find(p => String(p.jvzooProductId) === String(productId)) || null;
}

function getPlan(planId) {
  return PLANS[planId] || null;
}

function getMonthlyQuota(planId) {
  return PLANS[planId]?.monthlyQuota || 0;
}

module.exports = { PLANS, getPlanByProductId, getPlan, getMonthlyQuota };

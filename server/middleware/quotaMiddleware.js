const { getMonthlyQuota } = require("../config/plans");

function checkQuota(req, res, next) {
  const user = req.user;

  if (!user.plan || user.plan === "none") {
    return res.status(403).json({
      error: "لا توجد خطة مفعّلة على حسابك. يرجى التواصل مع الدعم.",
      noPlan: true
    });
  }

  const limit = getMonthlyQuota(user.plan);

  if (user.usage_count >= limit) {
    return res.status(403).json({
      error: `لقد استنفدت رصيدك الشهري (${limit} صفحة). سيتجدد رصيدك تلقائياً في بداية الشهر القادم.`,
      quotaExceeded: true,
      plan: user.plan,
      limit
    });
  }
  next();
}

module.exports = { checkQuota };

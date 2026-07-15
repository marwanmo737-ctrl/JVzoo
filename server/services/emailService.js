const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail({ to, fullName, licenseKey, planLabel, setPasswordLink }) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2 style="color:#6366f1">مرحباً بك في LandingAI 🎉</h2>
    <p>شكراً لشرائك خطة <strong>${planLabel}</strong>! تم تفعيل حسابك تلقائياً.</p>
    <div style="background:#f8f9ff;border-radius:10px;padding:16px;margin:20px 0">
      <p><strong>البريد الإلكتروني:</strong> ${to}</p>
      <p><strong>الخطة:</strong> ${planLabel}</p>
      <p><strong>رقم الترخيص:</strong> ${licenseKey}</p>
    </div>
    <p>لتفعيل الدخول لأول مرة، قم بتعيين كلمة مرورك من الرابط التالي:</p>
    <a href="${setPasswordLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;margin:12px 0">تعيين كلمة المرور والدخول</a>
    <p style="color:#888;font-size:.85rem;margin-top:20px">هذا الرابط صالح لمدة 24 ساعة. لأي استفسار: ${process.env.SUPPORT_EMAIL}</p>
  </div>`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: `🎉 حسابك جاهز — خطة ${planLabel} مفعّلة`,
    html
  });
}

async function sendUpsellConfirmationEmail({ to, planLabel, newQuota }) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2 style="color:#10b981">🚀 تمت ترقية حسابك بنجاح!</h2>
    <p>تم تفعيل خطة <strong>${planLabel}</strong> على حسابك مباشرة.</p>
    <div style="background:#ecfdf5;border-radius:10px;padding:16px;margin:20px 0">
      <p><strong>الرصيد الشهري الجديد:</strong> ${newQuota} صفحة/شهر</p>
    </div>
    <a href="${process.env.APP_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;margin:12px 0">الذهاب إلى لوحة التحكم</a>
  </div>`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: `🚀 تمت ترقيتك إلى خطة ${planLabel}`,
    html
  });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2>إعادة تعيين كلمة المرور</h2>
    <p>اضغط الزر أدناه لتعيين كلمة مرور جديدة. الرابط صالح لمدة 30 دقيقة فقط.</p>
    <a href="${resetLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;margin:12px 0">إعادة تعيين كلمة المرور</a>
    <p style="color:#888;font-size:.85rem">إذا لم تطلب هذا، تجاهل الرسالة بأمان.</p>
  </div>`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: "إعادة تعيين كلمة المرور — LandingAI",
    html
  });
}

module.exports = { sendWelcomeEmail, sendUpsellConfirmationEmail, sendPasswordResetEmail };

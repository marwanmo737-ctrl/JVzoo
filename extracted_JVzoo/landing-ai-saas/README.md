# LandingAI — مولّد صفحات هبوط بالذكاء الاصطناعي (Groq)

## المتطلبات
- Node.js 18+
- حساب Groq API (console.groq.com)
- حساب Resend لإرسال الإيميلات (resend.com)
- حساب JVzoo مع 3 منتجات (Front-End + OTO1 + OTO2)

## التثبيت

```bash
cd server
npm install
cp .env.example .env
```

افتح `.env` وعبّئ:
- `GROQ_API_KEY`
- `JVZOO_SECRET_KEY` + 3 Product IDs
- `RESEND_API_KEY` + `EMAIL_FROM`
- `JWT_SECRET` (نص عشوائي طويل)

## التشغيل

```bash
npm start
```

افتح: `http://localhost:3000`

## إعداد JVzoo Webhook
في كل منتج (Starter/Pro/Agency) من لوحة تحكم JVzoo:
- Notification URL: `https://yourdomain.com/webhooks/jvzoo`
- فعّل IPN لأنواع: SALE, RFND, CGBK, BILL

## ملاحظة أمنية مهمة
لا تشغّل المشروع في الإنتاج بدون:
- HTTPS فعلي (`COOKIE_SECURE=true`)
- مراجعة دقيقة لصيغة `cverify` من توثيق JVzoo الرسمي حسب نوع منتجك

## ⚠️ قرص دائم لقاعدة البيانات (إلزامي في الإنتاج)
المشروع يستخدم SQLite كملف على القرص. منصات الاستضافة الشائعة تمسح القرص المحلي
مع كل إعادة نشر/تشغيل، لذا **يجب** تحديد `DB_PATH` ليشير إلى قرص دائم:

- **Render**: أضف Disk من تبويب الخدمة (مثلاً mount path `/var/data`)، ثم `DB_PATH=/var/data/data.sqlite`
- **Fly.io**: أنشئ Volume (`fly volumes create`) واربطه بمسار مثل `/data`، ثم `DB_PATH=/data/data.sqlite`
- **Heroku**: لا يدعم قرص دائم على الـ dynos العادية — استخدم Heroku Postgres بدلاً من SQLite، أو انتقل لمنصة تدعم Volumes
- **DigitalOcean App Platform**: مشابه لـ Heroku، لا يوجد قرص دائم على التطبيقات الأساسية — استخدم Managed Database أو Droplet مع volume

بدون هذا الإعداد، كل حسابات العملاء وتراخيصهم ستُفقد عند أول إعادة نشر.

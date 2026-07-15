const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const db = require("../db/database");
const { hashPassword } = require("../services/authService");
const { generateLicenseKey, generateTempPassword, generateSecureToken } = require("../services/licenseService");
const { sendWelcomeEmail, sendUpsellConfirmationEmail } = require("../services/emailService");
const { getPlanByProductId } = require("../config/plans");

function verifyJVzooSignature(body) {
  const secretKey = process.env.JVZOO_SECRET_KEY;
  const receivedVerify = body.cverify;
  if (!receivedVerify || !secretKey) return false;

  // JVZoo reference algorithm:
  //   1. Take all POST fields except `cverify`, sort alphabetically by key name.
  //   2. Concatenate each value followed by "|" (trailing pipe on every field).
  //   3. Append the secret key (no separator).
  //   4. SHA-1 hex → uppercase → first 8 characters.
  //
  // Only include scalar string/number fields. Express body-parser may add
  // prototype-inherited properties on edge-case inputs; guard with
  // hasOwnProperty so we only hash what JVZoo actually sent.
  const fieldsToVerify = Object.keys(body)
    .filter(k => Object.prototype.hasOwnProperty.call(body, k) && k !== "cverify")
    .sort()
    .map(k => `${body[k]}|`)
    .join("");

  const computedHash = crypto
    .createHash("sha1")
    .update(fieldsToVerify + secretKey)
    .digest("hex")
    .toUpperCase()
    .slice(0, 8);

  // Use timing-safe comparison to prevent timing-oracle attacks.
  // Both sides are padded/truncated to exactly 8 chars, so the buffer
  // lengths are always equal and timingSafeEqual won't throw.
  const computed  = computedHash.padEnd(8, " ").slice(0, 8);
  const received  = String(receivedVerify).toUpperCase().padEnd(8, " ").slice(0, 8);
  return crypto.timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(received, "utf8"));
}

router.post("/jvzoo", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const body = req.body;

    if (!verifyJVzooSignature(body)) {
      console.warn("⚠️ JVzoo webhook: توقيع غير صالح");
      return res.status(403).send("Invalid signature");
    }

    const transactionType = body.ctransaction;
    const transactionId   = body.ctransreceipt;
    const buyerEmail      = body.ccustemail;
    const buyerName       = body.ccustname || "";
    const productId       = body.cproditem;

    // Guard against malformed or incomplete payloads — all five fields are
    // required by JVZoo for every transaction notification.
    if (!transactionType || !transactionId || !buyerEmail || !productId) {
      console.warn("JVzoo webhook: missing required fields — payload rejected", {
        transactionType, transactionId, buyerEmail, productId
      });
      return res.status(400).send("Missing required fields");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      console.warn("JVzoo webhook: invalid buyer email —", buyerEmail);
      return res.status(400).send("Invalid email");
    }

    if (transactionType === "RFND" || transactionType === "CGBK") {
      db.revokeLicenseByTransactionId(transactionId);
      const license = db.getLicenseByTransactionId(transactionId);
      if (license) {
        const remainingPlan = db.getHighestActivePlanForUser(license.user_id);
        db.updatePlan(license.user_id, remainingPlan || "none");
      }
      console.log(`🔴 تم إلغاء ترخيص العملية ${transactionId}`);
      return res.status(200).send("OK");
    }

    if (transactionType === "SALE" || transactionType === "BILL") {
      const existing = db.getLicenseByTransactionId(transactionId);
      if (existing) return res.status(200).send("OK - Already processed");

      const plan = getPlanByProductId(productId);
      if (!plan) {
        console.error(`❌ Product ID غير معروف: ${productId}`);
        return res.status(400).send("Unknown product ID");
      }

      const licenseKey = generateLicenseKey();
      let user = db.getUserByEmail(buyerEmail);
      const isNewUser = !user;

      if (isNewUser) {
        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        user = db.createUser({ email: buyerEmail, passwordHash, fullName: buyerName, plan: plan.id, mustSetPassword: 1 });
      }

      db.createLicense({ licenseKey, userId: user.id, planId: plan.id, jvzooTransactionId: transactionId, productId });

      const highestPlan = db.getHighestActivePlanForUser(user.id);
      db.updatePlan(user.id, highestPlan);

      if (isNewUser) {
        const resetToken = generateSecureToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        db.createResetToken(user.id, resetToken, expiresAt);

        const setPasswordLink = `${process.env.APP_URL}/set-password.html?token=${resetToken}`;
        try {
          await sendWelcomeEmail({ to: buyerEmail, fullName: buyerName, licenseKey, planLabel: plan.label, setPasswordLink });
          console.log(`✅ حساب جديد: ${buyerEmail} — خطة: ${plan.label} — ترخيص: ${licenseKey}`);
        } catch (emailErr) {
          // The account/license are already committed above. If we let this
          // throw reach the outer catch, we'd return 500 and JVZoo would
          // retry — but the retry hits the "already processed" short-circuit
          // at the top of this handler and returns 200 without ever trying
          // to send the email again, so the customer would silently never
          // receive their activation link. Surface it loudly instead so a
          // human can resend it, but still tell JVZoo the sale was handled.
          console.error(`‼️ فشل إرسال إيميل التفعيل لـ ${buyerEmail} (ترخيص ${licenseKey}) — يتطلب إعادة إرسال يدوي:`, emailErr);
        }
      } else {
        try {
          await sendUpsellConfirmationEmail({ to: buyerEmail, planLabel: plan.label, newQuota: plan.monthlyQuota });
          console.log(`✅ ترقية خطة لمستخدم موجود: ${buyerEmail} → ${plan.label}`);
        } catch (emailErr) {
          console.error(`‼️ فشل إرسال إيميل ترقية الخطة لـ ${buyerEmail} — يتطلب إعادة إرسال يدوي:`, emailErr);
        }
      }

      return res.status(200).send("OK");
    }

    res.status(200).send("OK - Ignored");

  } catch (err) {
    console.error("❌ خطأ في معالجة JVzoo webhook:", err);
    res.status(500).send("Internal error");
  }
});

module.exports = router;

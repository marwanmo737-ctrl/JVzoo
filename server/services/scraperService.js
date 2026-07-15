const fetch = require("node-fetch");
const cheerio = require("cheerio");
const dns = require("dns").promises;
const net = require("net");

/* هذا endpoint يستقبل رابطاً من مستخدم مسجّل ويطلبه من السيرفر نفسه —
   بدون تحقق، يقدر أي مستخدم يمرر رابطاً لعنوان داخلي (شبكة السيرفر،
   169.254.169.254 وهو endpoint الخاص بـ cloud metadata على AWS/GCP/إلخ)
   ويخلي السيرفر يكشف بيانات حساسة أو يفحص الشبكة الداخلية (SSRF). */
function isPrivateOrReservedIP(ip) {
  const type = net.isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast/محجوز
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.split(":").pop();
      if (net.isIP(v4) === 4) return isPrivateOrReservedIP(v4);
    }
    return false;
  }
  return true; // نوع غير معروف -> نمنع افتراضياً
}

async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("رابط غير صالح");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("نوع رابط غير مسموح");
  if (parsed.hostname === "localhost") throw new Error("رابط غير مسموح");

  const { address } = await dns.lookup(parsed.hostname);
  if (isPrivateOrReservedIP(address)) throw new Error("رابط غير مسموح");
}

async function scrapeProductUrl(url) {
  try {
    await assertSafeUrl(url);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LandingAI-Bot/1.0)" },
      timeout: 8000,
      redirect: "manual" // منع تجاوز الفحص عبر إعادة توجيه (3xx) لعنوان داخلي
    });

    if (res.status >= 300 && res.status < 400) {
      return { success: false, error: "الرابط يقوم بإعادة توجيه، غير مدعوم حالياً", url };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
    const description = $('meta[property="og:description"]').attr("content")
      || $('meta[name="description"]').attr("content") || "";
    const image = $('meta[property="og:image"]').attr("content") || "";
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

    return { success: true, title, description, image, bodyText, url };
  } catch (err) {
    return { success: false, error: err.message, url };
  }
}

module.exports = { scrapeProductUrl };

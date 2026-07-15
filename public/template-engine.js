const DEFAULT_SECTION_ORDER = ["hero","painPoints","benefits","features","whyUs","testimonials","faq","guarantee","finalCta"];

/* Escapes text before it is ever interpolated into the generated HTML.
   content/legal fields ultimately trace back to AI output seeded with
   attacker-controllable input (product name/desc/notes, scraped page
   text, purchase link, etc.), so every dynamic value must be escaped
   at the point it's placed into markup — never trusted as-is. */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Only allow safe URL schemes for href attributes (purchase links, etc.)
   so a value like "javascript:alert(1)" can't execute on click. */
function safeUrl(value) {
  const s = String(value || "").trim();
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(s)) return esc(s);
  return "#";
}

function visualMockup(kind = "hero") {
  const shapes = {
    hero: `<div class="mockup mockup-hero">
      <div class="blob b1"></div><div class="blob b2"></div>
      <div class="glass-card"><div class="bar"></div><div class="line w80"></div><div class="line w60"></div><div class="grid-mini"><span></span><span></span><span></span></div></div>
    </div>`,
    feature: `<div class="mockup mockup-sm"><div class="icon-circle"></div><div class="line w70"></div><div class="line w50"></div></div>`
  };
  return shapes[kind] || shapes.feature;
}

function starRow(n){ return "★★★★★☆☆☆☆☆".slice(5-n,10-n); }

function buildLandingPageHTML(content, design) {
  const order = design.sectionOrder.filter(id => !design.hiddenSections.includes(id));

  const renderers = {
    hero: (c) => `
    <section class="section hero" data-section="hero">
      <div class="container hero-grid">
        <div>
          <span class="badge" data-editable="hero.badge">${esc(c.hero.badge)}</span>
          <h1 data-editable="hero.title">${esc(c.hero.title)}</h1>
          <p class="subtitle" data-editable="hero.subtitle">${esc(c.hero.subtitle)}</p>
          <div class="cta-row">
            <a href="${safeUrl(c.purchaseLink)}" class="btn btn-primary" data-editable="hero.ctaPrimary">${esc(c.hero.ctaPrimary)}</a>
            <a href="#features" class="btn btn-outline" data-editable="hero.ctaSecondary">${esc(c.hero.ctaSecondary)}</a>
          </div>
        </div>
        ${visualMockup("hero")}
      </div>
    </section>`,

    painPoints: (c) => `
    <section class="section alt" data-section="painPoints">
      <div class="container">
        <h2 data-editable="painPoints.title">${esc(c.painPoints.title)}</h2>
        <div class="grid-cards">
          ${c.painPoints.items.map((it,i)=>`
            <div class="pain-card">
              <span class="ic">${esc(it.icon)}</span>
              <p data-editable="painPoints.items.${i}.text">${esc(it.text)}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`,

    benefits: (c) => `
    <section class="section" data-section="benefits">
      <div class="container">
        <h2 data-editable="benefits.title">${esc(c.benefits.title)}</h2>
        <p class="section-sub" data-editable="benefits.subtitle">${esc(c.benefits.subtitle)}</p>
        <div class="grid-cards cols-3">
          ${c.benefits.items.map((it,i)=>`
            <div class="feature-card">
              <div class="ic-box">${esc(it.icon)}</div>
              <h3 data-editable="benefits.items.${i}.title">${esc(it.title)}</h3>
              <p data-editable="benefits.items.${i}.desc">${esc(it.desc)}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`,

    features: (c) => `
    <section class="section alt" id="features" data-section="features">
      <div class="container">
        <h2 data-editable="features.title">${esc(c.features.title)}</h2>
        <p class="section-sub" data-editable="features.subtitle">${esc(c.features.subtitle)}</p>
        <div class="grid-cards cols-2">
          ${c.features.items.map((it,i)=>`
            <div class="feature-row">
              ${visualMockup("feature")}
              <div>
                <h3 data-editable="features.items.${i}.title">${esc(it.title)}</h3>
                <p data-editable="features.items.${i}.desc">${esc(it.desc)}</p>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </section>`,

    whyUs: (c) => `
    <section class="section" data-section="whyUs">
      <div class="container">
        <h2 data-editable="whyUs.title">${esc(c.whyUs.title)}</h2>
        <div class="grid-cards cols-3">
          ${c.whyUs.items.map((it,i)=>`
            <div class="why-card">
              <span class="ic">${esc(it.icon)}</span>
              <h3 data-editable="whyUs.items.${i}.title">${esc(it.title)}</h3>
              <p data-editable="whyUs.items.${i}.desc">${esc(it.desc)}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`,

    testimonials: (c) => `
    <section class="section alt" data-section="testimonials">
      <div class="container">
        <h2 data-editable="testimonials.title">${esc(c.testimonials.title)}</h2>
        <p class="disclaimer">⚠️ ${esc(c.testimonials.disclaimer)}</p>
        <div class="grid-cards cols-3">
          ${c.testimonials.items.map((it,i)=>`
            <div class="testimonial-card">
              <div class="stars">${starRow(it.rating)}</div>
              <p data-editable="testimonials.items.${i}.text">"${esc(it.text)}"</p>
              <div class="t-author">
                <div class="avatar">${esc(String(it.name || "").charAt(0))}</div>
                <div><strong data-editable="testimonials.items.${i}.name">${esc(it.name)}</strong><br><span data-editable="testimonials.items.${i}.role">${esc(it.role)}</span></div>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </section>`,

    faq: (c) => `
    <section class="section" data-section="faq">
      <div class="container narrow">
        <h2 data-editable="faq.title">${esc(c.faq.title)}</h2>
        <div class="accordion">
          ${c.faq.items.map((it,i)=>`
            <details class="faq-item">
              <summary data-editable="faq.items.${i}.q">${esc(it.q)}</summary>
              <p data-editable="faq.items.${i}.a">${esc(it.a)}</p>
            </details>`).join("")}
        </div>
      </div>
    </section>`,

    guarantee: (c) => `
    <section class="section alt guarantee-section" data-section="guarantee">
      <div class="container narrow center">
        <div class="guarantee-badge">🛡️ ${esc(c.guarantee.days)} يوم</div>
        <h2 data-editable="guarantee.title">${esc(c.guarantee.title)}</h2>
        <p data-editable="guarantee.text">${esc(c.guarantee.text)}</p>
      </div>
    </section>`,

    finalCta: (c) => `
    <section class="section final-cta" data-section="finalCta">
      <div class="container center">
        <h2 data-editable="finalCta.title">${esc(c.finalCta.title)}</h2>
        <p data-editable="finalCta.subtitle">${esc(c.finalCta.subtitle)}</p>
        <div class="price-tag">${esc(c.price)} ${esc(c.currency)} <span>/ ${esc(billingLabel(c.billingType))}</span></div>
        <a href="${safeUrl(c.purchaseLink)}" class="btn btn-primary btn-lg" data-editable="finalCta.buttonText">${esc(c.finalCta.buttonText)}</a>
      </div>
    </section>`
  };

  const sectionsHtml = order.map(id => renderers[id] ? renderers[id](content) : "").join("");

  return `<!DOCTYPE html>
<html lang="${esc(content.lang || 'ar')}" dir="${content.lang === 'en' ? 'ltr':'rtl'}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(content.meta.productName)}</title>
<meta name="description" content="${esc(content.hero.subtitle)}">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Cairo:wght@400;600;800&display=swap" rel="stylesheet">
<style>${getLandingPageCSS(design)}</style>
</head>
<body>
<nav class="navbar">
  <div class="container nav-inner">
    <div class="logo" data-editable="meta.productName">${esc(content.meta.productName)}</div>
    <a href="${safeUrl(content.purchaseLink)}" class="btn btn-primary btn-sm">${esc(content.hero.ctaPrimary)}</a>
  </div>
</nav>
<main>${sectionsHtml}</main>
<footer class="footer">
  <div class="container center">
    <p>© ${new Date().getFullYear()} ${esc(content.meta.productName)}. جميع الحقوق محفوظة.</p>
    <div class="footer-links">
      <a href="#" data-legal-link="privacy">Privacy Policy</a> ·
      <a href="#" data-legal-link="terms">Terms of Service</a> ·
      <a href="#" data-legal-link="disclaimer">Disclaimer</a>
    </div>
  </div>
</footer>
</body>
</html>`;
}

function billingLabel(type){
  return {onetime:"مرة واحدة", monthly:"شهرياً", yearly:"سنوياً", lifetime:"مدى الحياة"}[type] || "";
}

function getLandingPageCSS(design) {
  return `
  :root{ --primary:${design.primaryColor}; --primary-dark:${shadeColor(design.primaryColor,-15)}; --font:${design.font}; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--font);color:#1a1a2e;line-height:1.7;background:#fff}
  .container{max-width:1140px;margin:0 auto;padding:0 24px}
  .container.narrow{max-width:760px}
  .center{text-align:center}
  h1,h2,h3{font-weight:800}
  h2{font-size:2rem;margin-bottom:12px}
  .section{padding:80px 0}
  .section.alt{background:#f8f9ff}
  .section-sub{color:#666;margin-bottom:40px;max-width:600px}

  .navbar{padding:16px 0;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;z-index:10}
  .nav-inner{display:flex;justify-content:space-between;align-items:center}
  .logo{font-weight:800;font-size:1.2rem}

  .btn{display:inline-block;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;transition:.2s}
  .btn-primary{background:var(--primary);color:#fff}
  .btn-primary:hover{background:var(--primary-dark);transform:translateY(-2px)}
  .btn-outline{border:2px solid var(--primary);color:var(--primary)}
  .btn-sm{padding:8px 18px;font-size:.85rem}
  .btn-lg{padding:18px 40px;font-size:1.15rem}

  .hero{padding:100px 0}
  .hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center}
  .badge{display:inline-block;background:color-mix(in srgb, var(--primary) 15%, white);color:var(--primary);padding:6px 16px;border-radius:100px;font-size:.85rem;font-weight:700;margin-bottom:16px}
  .hero h1{font-size:2.8rem;line-height:1.25;margin-bottom:16px}
  .subtitle{color:#555;font-size:1.1rem;margin-bottom:28px}
  .cta-row{display:flex;gap:14px;flex-wrap:wrap}

  .mockup-hero{position:relative;height:420px;border-radius:24px;background:linear-gradient(135deg, var(--primary), var(--primary-dark));overflow:hidden}
  .blob{position:absolute;border-radius:50%;filter:blur(40px);opacity:.5}
  .b1{width:200px;height:200px;background:#fff;top:-40px;right:-40px}
  .b2{width:150px;height:150px;background:#000;bottom:-30px;left:-30px}
  .glass-card{position:absolute;inset:40px;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,.3)}
  .bar{width:60px;height:8px;background:#fff;border-radius:10px;margin-bottom:16px}
  .line{height:12px;background:rgba(255,255,255,.6);border-radius:8px;margin-bottom:10px}
  .w80{width:80%} .w70{width:70%} .w60{width:60%} .w50{width:50%}
  .grid-mini{display:flex;gap:10px;margin-top:20px}
  .grid-mini span{width:60px;height:60px;background:rgba(255,255,255,.25);border-radius:10px}
  .mockup-sm{background:#f0f1ff;border-radius:16px;padding:24px;flex:1}
  .icon-circle{width:44px;height:44px;border-radius:50%;background:var(--primary);margin-bottom:16px}

  .grid-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:30px}
  .grid-cards.cols-3{grid-template-columns:repeat(3,1fr)}
  .grid-cards.cols-2{grid-template-columns:repeat(2,1fr)}
  .pain-card,.feature-card,.why-card,.testimonial-card{background:#fff;border:1px solid #eee;border-radius:16px;padding:26px;box-shadow:0 2px 10px rgba(0,0,0,.03)}
  .ic,.ic-box{font-size:1.8rem;display:inline-block;margin-bottom:12px}
  .ic-box{width:56px;height:56px;background:color-mix(in srgb, var(--primary) 12%, white);border-radius:14px;display:flex;align-items:center;justify-content:center}
  .feature-row{display:flex;gap:24px;align-items:center;background:#fff;border-radius:16px;padding:20px}

  .disclaimer{color:#999;font-size:.85rem;margin-bottom:20px}
  .stars{color:#fbbf24;margin-bottom:10px}
  .t-author{display:flex;align-items:center;gap:10px;margin-top:16px}
  .avatar{width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}

  .accordion .faq-item{border-bottom:1px solid #eee;padding:16px 0}
  .faq-item summary{font-weight:700;cursor:pointer;font-size:1.05rem}
  .faq-item p{margin-top:10px;color:#555}

  .guarantee-badge{display:inline-block;background:#ecfdf5;color:#059669;padding:10px 24px;border-radius:100px;font-weight:800;margin-bottom:16px}

  .final-cta{background:linear-gradient(135deg, var(--primary), var(--primary-dark));color:#fff;text-align:center}
  .final-cta h2{color:#fff}
  .price-tag{font-size:2.2rem;font-weight:800;margin:20px 0}
  .price-tag span{font-size:1rem;opacity:.8;font-weight:400}
  .final-cta .btn-primary{background:#fff;color:var(--primary)}

  .footer{padding:40px 0;background:#0f0f1a;color:#aaa;font-size:.85rem}
  .footer-links a{color:#aaa;text-decoration:none}

  [contenteditable="true"]{outline:2px dashed var(--primary);outline-offset:2px;cursor:text}

  @media(max-width:768px){
    .hero-grid,.grid-cards,.grid-cards.cols-3,.grid-cards.cols-2{grid-template-columns:1fr}
    .hero h1{font-size:2rem}
  }
  `;
}

function shadeColor(hex, percent) {
  const f = parseInt(hex.slice(1),16), t = percent<0?0:255, p = Math.abs(percent)/100;
  const R = f>>16, G = f>>8&0x00FF, B = f&0x0000FF;
  return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}

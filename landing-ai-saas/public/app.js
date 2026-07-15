/* ============================================================
   LandingAI — Frontend Application Logic
   ============================================================ */

let currentUser = null;

let state = {
  content: null,
  design: {
    primaryColor: "#6366f1",
    font: "'Inter', sans-serif",
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: []
  },
  legal: null,
  lang: "ar",
  editMode: false
};

const PLANS_INFO = [
  { id: "starter", label: "Starter", price: 47, quota: 20, salesUrl: "https://jvzoo.com/your-starter-link" },
  { id: "pro", label: "Pro", price: 97, quota: 60, salesUrl: "https://jvzoo.com/your-pro-oto1-link" },
  { id: "agency", label: "Agency", price: 197, quota: 150, salesUrl: "https://jvzoo.com/your-agency-oto2-link" }
];

/* ============================================================
   AUTH
   ============================================================ */

let authMode = "login";

function hideAuthError(){ document.getElementById("authError").style.display = "none"; }
function showAuthError(msg){
  const el = document.getElementById("authError");
  el.textContent = msg; el.style.display = "block";
}

document.getElementById("authSubmitBtn").onclick = async () => {
  hideAuthError();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  if(!email || !password) return showAuthError("يرجى تعبئة جميع الحقول");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error);
    currentUser = data.user;
    onAuthenticated();
  } catch(e){ showAuthError(e.message); }
};

document.getElementById("forgotPasswordLink").onclick = async (e) => {
  e.preventDefault();
  const email = prompt("أدخل بريدك الإلكتروني المسجّل:");
  if(!email) return;
  try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    alert(data.message);
  } catch(e){ alert("حدث خطأ، حاول لاحقاً."); }
};

document.getElementById("logoutBtn").onclick = async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  currentUser = null;
  document.getElementById("userArea").style.display = "none";
  switchScreen("screen-auth");
};

function onAuthenticated(){
  document.getElementById("userArea").style.display = "flex";
  updateUsageBadge();
  switchScreen("screen-dashboard");
}

function updateUsageBadge(){
  const plan = PLANS_INFO.find(p => p.id === currentUser.plan);
  const limit = plan ? plan.quota : 0;
  document.getElementById("planBadge").textContent = plan ? plan.label : "بدون خطة";
  document.getElementById("usageBadge").textContent = `${currentUser.usageCount}/${limit} هذا الشهر`;
}

async function checkSession(){
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if(!res.ok) throw new Error();
    const data = await res.json();
    currentUser = data.user;
    onAuthenticated();
  } catch {
    switchScreen("screen-auth");
  }
}

/* ============================================================
   UPGRADE MODAL
   ============================================================ */

function renderPlansGrid(){
  const grid = document.getElementById("plansGrid");
  grid.innerHTML = PLANS_INFO.map(p => {
    const isCurrent = currentUser.plan === p.id;
    return `
    <div class="plan-card ${isCurrent ? 'current' : ''}">
      <h4>${p.label}</h4>
      <div class="price">$${p.price} <span style="font-size:.8rem;color:var(--text-dim)">مرة واحدة</span></div>
      <ul><li>✅ ${p.quota} صفحة/شهر</li></ul>
      <a href="${p.salesUrl}" target="_blank">${isCurrent ? "خطتك الحالية" : "ترقية الآن"}</a>
    </div>`;
  }).join("");
}

document.getElementById("upgradeBtn").onclick = () => {
  renderPlansGrid();
  toggleModal("upgradeModal", true);
};
document.getElementById("closeUpgrade").onclick = () => toggleModal("upgradeModal", false);

function toggleModal(id, show){ document.getElementById(id).classList.toggle("active", show); }

/* ============================================================
   INPUT TABS
   ============================================================ */

document.querySelectorAll("#inputTabs .tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll("#inputTabs .tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
  };
});

let uploadedImageBase64 = null;
let uploadedImageMime = null;

document.getElementById("productImage").onchange = (e) => {
  const file = e.target.files[0];
  if(!file) return;
  uploadedImageMime = file.type;
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadedImageBase64 = ev.target.result.split(",")[1];
    document.getElementById("imagePreview").src = ev.target.result;
    document.getElementById("imagePreview").style.display = "block";
    document.getElementById("uploadLabel").style.display = "none";
  };
  reader.readAsDataURL(file);
};

/* ============================================================
   GENERATE FLOW
   ============================================================ */

document.getElementById("generateBtn").onclick = async () => {
  const activeTab = document.querySelector("#inputTabs .tab.active").dataset.tab;
  let inputValue = "";
  if(activeTab === "link") inputValue = document.getElementById("productLink").value;
  if(activeTab === "name") inputValue = document.getElementById("productName").value;
  if(activeTab === "desc") inputValue = document.getElementById("productDesc").value;

  if(activeTab !== "image" && !inputValue.trim()){
    alert("يرجى إدخال بيانات المنتج");
    return;
  }
  if(activeTab === "image" && !uploadedImageBase64){
    alert("يرجى رفع صورة المنتج");
    return;
  }

  const payload = {
    inputType: activeTab,
    inputValue,
    imageBase64: activeTab === "image" ? uploadedImageBase64 : undefined,
    imageMimeType: activeTab === "image" ? uploadedImageMime : undefined,
    extraNotes: document.getElementById("extraNotes").value,
    price: document.getElementById("price").value || "0",
    currency: document.getElementById("currency").value,
    billingType: document.getElementById("billingType").value,
    purchaseLink: document.getElementById("purchaseLink").value || "#",
    lang: document.getElementById("pageLang").value
  };
  state.lang = payload.lang;

  switchScreen("screen-progress");
  runProgressUI();

  try {
    await setStep(1, 500);
    await setStep(2, 500);
    setStepActive(3);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if(!res.ok){
      if(data.quotaExceeded || data.noPlan){
        switchScreen("screen-dashboard");
        renderPlansGrid();
        toggleModal("upgradeModal", true);
        return;
      }
      throw new Error(data.error || "فشل التوليد");
    }

    setStepDone(3);
    await setStep(4, 400);
    await setStep(5, 300);
    setStepDone(6);
    await setStep(7, 300);

    state.content = data.content;
    state.legal = data.legal;
    currentUser.usageCount = data.usage.used;
    updateUsageBadge();

    renderPreview();
    switchScreen("screen-editor");

  } catch (err) {
    alert("حدث خطأ: " + err.message);
    switchScreen("screen-dashboard");
  }
};

function switchScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ============================================================
   PROGRESS UI
   ============================================================ */

function runProgressUI(){
  document.querySelectorAll(".step-item").forEach(s => s.classList.remove("active","done"));
  document.getElementById("progressBarInner").style.width = "0%";
}
function setStepActive(n){
  document.querySelector(`.step-item[data-step="${n}"]`).classList.add("active");
  document.getElementById("progressBarInner").style.width = `${(n-1)/7*100}%`;
}
function setStepDone(n){
  const el = document.querySelector(`.step-item[data-step="${n}"]`);
  el.classList.remove("active"); el.classList.add("done");
  document.getElementById("progressBarInner").style.width = `${n/7*100}%`;
}
function setStep(n, delay){
  return new Promise(resolve => { setStepActive(n); setTimeout(() => { setStepDone(n); resolve(); }, delay); });
}

/* ============================================================
   PREVIEW RENDERING
   ============================================================ */

function renderPreview() {
  const html = buildLandingPageHTML(state.content, state.design);
  const frame = document.getElementById("previewFrame");
  frame.srcdoc = html;
  frame.onload = () => {
    attachLegalLinks();
    if (state.editMode) enableEditMode();
  };
  renderSectionList();
}

function getFrameDoc(){ return document.getElementById("previewFrame").contentDocument; }

/* ===== Sidebar: Color & Font ===== */
document.getElementById("primaryColorPicker").oninput = (e) => {
  state.design.primaryColor = e.target.value;
  updateLiveStyle();
};
document.getElementById("fontPicker").onchange = (e) => {
  state.design.font = e.target.value;
  updateLiveStyle();
};
function updateLiveStyle(){
  const doc = getFrameDoc();
  if(!doc) return;
  doc.documentElement.style.setProperty("--primary", state.design.primaryColor);
  doc.documentElement.style.setProperty("--primary-dark", shadeColor(state.design.primaryColor, -15));
  doc.documentElement.style.setProperty("--font", state.design.font);
}

/* ===== Section Order / Visibility ===== */
function renderSectionList(){
  const list = document.getElementById("sectionOrderList");
  list.innerHTML = "";
  const labels = {hero:"Hero",painPoints:"المشاكل",benefits:"الفوائد",features:"المميزات",whyUs:"لماذا نحن",testimonials:"آراء العملاء",faq:"الأسئلة الشائعة",guarantee:"الضمان",finalCta:"CTA النهائي"};
  state.design.sectionOrder.forEach((id, idx) => {
    const hidden = state.design.hiddenSections.includes(id);
    const li = document.createElement("li");
    li.className = hidden ? "hidden-section" : "";
    li.innerHTML = `
      <span>${labels[id] || id}</span>
      <div class="actions">
        <button data-act="up" title="أعلى">⬆️</button>
        <button data-act="down" title="أسفل">⬇️</button>
        <button data-act="toggle" title="إظهار/إخفاء">${hidden ? "👁️‍🗨️" : "👁️"}</button>
      </div>`;
    li.querySelector('[data-act="up"]').onclick = () => moveSection(idx, -1);
    li.querySelector('[data-act="down"]').onclick = () => moveSection(idx, 1);
    li.querySelector('[data-act="toggle"]').onclick = () => toggleSection(id);
    list.appendChild(li);
  });
}
function moveSection(idx, dir){
  const arr = state.design.sectionOrder;
  const newIdx = idx + dir;
  if(newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  renderPreview();
}
function toggleSection(id){
  const hs = state.design.hiddenSections;
  const i = hs.indexOf(id);
  if(i>-1) hs.splice(i,1); else hs.push(id);
  renderPreview();
}

/* ===== Edit Mode (contenteditable) ===== */
document.getElementById("toggleEditMode").onclick = (e) => {
  state.editMode = !state.editMode;
  e.target.textContent = state.editMode ? "✅ إيقاف وضع التعديل" : "✏️ تفعيل تعديل النصوص";
  if(state.editMode) enableEditMode(); else disableEditMode();
};
function enableEditMode(){
  const doc = getFrameDoc();
  doc.querySelectorAll("[data-editable]").forEach(el => {
    el.contentEditable = "true";
    el.onblur = () => saveEditableField(el.dataset.editable, el.innerText);
  });
}
function disableEditMode(){
  getFrameDoc().querySelectorAll("[data-editable]").forEach(el => el.contentEditable = "false");
}
function saveEditableField(path, value){
  const keys = path.split(".");
  let obj = state.content;
  for(let i=0;i<keys.length-1;i++) obj = obj[isNaN(keys[i]) ? keys[i] : Number(keys[i])];
  obj[keys[keys.length-1]] = value;
}

/* ===== Improve / Regenerate ===== */
document.getElementById("improveAiBtn").onclick = async () => {
  toggleLoading(true);
  try {
    const res = await fetch("/api/improve", {
      method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include",
      body: JSON.stringify({ content: state.content, lang: state.lang })
    });
    const data = await res.json();
    if(!res.ok){
      if(data.quotaExceeded || data.noPlan){ renderPlansGrid(); toggleModal("upgradeModal", true); return; }
      throw new Error(data.error);
    }
    state.content = data.content;
    currentUser.usageCount = data.usage.used;
    updateUsageBadge();
    renderPreview();
  } catch(e){ alert(e.message); }
  toggleLoading(false);
};

document.getElementById("regenerateBtn").onclick = async () => {
  const instruction = document.getElementById("customInstruction").value.trim();
  if(!instruction) return alert("يرجى وصف التعديل المطلوب");
  toggleLoading(true);
  try {
    const res = await fetch("/api/regenerate", {
      method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include",
      body: JSON.stringify({ content: state.content, instruction, lang: state.lang })
    });
    const data = await res.json();
    if(!res.ok){
      if(data.quotaExceeded || data.noPlan){ renderPlansGrid(); toggleModal("upgradeModal", true); return; }
      throw new Error(data.error);
    }
    state.content = data.content;
    currentUser.usageCount = data.usage.used;
    updateUsageBadge();
    renderPreview();
    document.getElementById("customInstruction").value = "";
  } catch(e){ alert(e.message); }
  toggleLoading(false);
};

function toggleLoading(show){ document.getElementById("loadingIndicator").style.display = show?"inline":"none"; }

/* ===== Legal Pages ===== */
let currentLegalTab = "privacy";
document.getElementById("viewLegalBtn").onclick = () => {
  document.getElementById("legalEditor").value = state.legal[currentLegalTab];
  toggleModal("legalModal", true);
};
document.getElementById("closeLegal").onclick = () => toggleModal("legalModal", false);
document.querySelectorAll(".legal-tabs .tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".legal-tabs .tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    currentLegalTab = tab.dataset.legal;
    document.getElementById("legalEditor").value = state.legal[currentLegalTab];
  };
});
document.getElementById("saveLegal").onclick = () => {
  state.legal[currentLegalTab] = document.getElementById("legalEditor").value;
  toggleModal("legalModal", false);
};
function attachLegalLinks(){
  getFrameDoc().querySelectorAll("[data-legal-link]").forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      currentLegalTab = link.dataset.legalLink;
      document.querySelectorAll(".legal-tabs .tab").forEach(t=>t.classList.toggle("active", t.dataset.legal===currentLegalTab));
      document.getElementById("legalEditor").value = state.legal[currentLegalTab];
      toggleModal("legalModal", true);
    };
  });
}

/* ===== Viewport Toggle ===== */
document.querySelectorAll(".vt-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".vt-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("frameWrap").className = "preview-frame-wrap " + btn.dataset.view;
  };
});

/* ===== Back & Export ===== */
document.getElementById("backBtn").onclick = () => switchScreen("screen-dashboard");

document.getElementById("exportBtn").onclick = () => {
  const doc = getFrameDoc();
  const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.content.meta.productName || "landing-page").replace(/\s+/g,"-")}.html`;
  a.click();
};

/* ============================================================
   INIT
   ============================================================ */
checkSession();

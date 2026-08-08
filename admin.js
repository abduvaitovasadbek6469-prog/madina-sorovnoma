// Firebase Console > Authentication > Users bo‘limidan o‘zingizning Admin UID qiymatingizni kiriting.
const ADMIN_UID = "fNGqq6CFyFfBhdnto7YeTy191l13";
const adminApp = document.querySelector("#admin-app");
let api;
let auth;
let db;
let unsubscribe;

const questionLabels = {
  q1: "Sayohat qilmoqchi bo‘lgan davlat", q2: "Sevimli shokolad", q3: "Sevimli serial yoki kino", q4: "Bo‘sh vaqtdagi mashg‘ulot",
  q5: "Suhbatlashishni yoqtiradigan insonlar", q6: "O‘zi haqidagi qiziq jihat", q7: "Ideal kun", q8: "Yoqimli e’tibor turi", q9: "Qiyin paytda tinchlantiradigan narsa",
  q10: "Birinchi taassurot"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function formatDate(timestamp) {
  return timestamp?.toDate ? timestamp.toDate().toLocaleString("uz-UZ") : "—";
}

function showError(message) {
  adminApp.innerHTML = `<p class="eyebrow">Admin</p><h1>Xatolik</h1><div class="notice error">${escapeHtml(message)}</div>`;
}

function renderLogin(message = "") {
  adminApp.innerHTML = `
    <p class="eyebrow">Himoyalangan sahifa</p><h1>Admin kirishi</h1>
    <p class="muted">Faqat ruxsat berilgan administrator natijalarni ko‘ra oladi.</p>
    <form id="login-form" class="login-form">
      <label>Elektron pochta<input id="email" type="email" autocomplete="username" required></label>
      <label>Parol<input id="password" type="password" autocomplete="current-password" required minlength="6"></label>
      ${message ? `<div class="notice error">${escapeHtml(message)}</div>` : ""}
      <button class="button" type="submit">Kirish</button>
    </form>`;
  document.querySelector("#login-form").addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await api.signInWithEmailAndPassword(auth, document.querySelector("#email").value, document.querySelector("#password").value);
  } catch (error) {
    console.error("Admin kirish xatosi:", error);
    renderLogin("Email yoki parol noto‘g‘ri. Qayta urinib ko‘ring.");
  }
}

function renderDashboard(user) {
  adminApp.innerHTML = `<div class="admin-top"><div><p class="eyebrow">Jonli natijalar</p><h1>So‘rovnoma javoblari</h1><p class="muted">Admin: ${escapeHtml(user.email || user.uid)}</p></div><button id="logout" class="button secondary">Chiqish</button></div><div id="responses" class="responses"><p class="muted">Natijalar yuklanmoqda…</p></div>`;
  document.querySelector("#logout").addEventListener("click", () => api.signOut(auth));
  subscribeToResponses();
}

// Barcha javoblarni admin uchun real vaqt rejimida kuzatadi.
function subscribeToResponses() {
  unsubscribe?.();
  unsubscribe = api.onSnapshot(api.collection(db, "surveyResponses"), snapshot => {
    const container = document.querySelector("#responses");
    if (!container) return;
    if (snapshot.empty) { container.innerHTML = '<div class="notice">Hozircha javoblar yo‘q.</div>'; return; }
    const docs = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    container.innerHTML = docs.map(renderResponse).join("");
  }, error => { console.error("Natijalar o‘qilmadi:", error); showError("Natijalarni o‘qib bo‘lmadi. Firestore qoidalari va Admin UID qiymatini tekshiring."); });
}

function renderResponse(data) {
  const answers = data.answers || {};
  const completed = data.status === "completed";
  return `<article class="response-card">
    <h2>${escapeHtml(data.inviteCode || "Noma’lum taklif")}</h2>
    <div class="meta-grid">
      <div class="meta"><small>Holati</small>${completed ? "Tugallangan" : "Jarayonda"}</div>
      <div class="meta"><small>Javoblar</small>${Object.keys(answers).length} / 10</div>
      <div class="meta"><small>Boshlandi</small>${formatDate(data.startedAt)}</div>
      <div class="meta"><small>Oxirgi faollik</small>${formatDate(data.updatedAt)}</div>
      <div class="meta"><small>Tugadi</small>${formatDate(data.completedAt)}</div>
      <div class="meta"><small>Taklif kodi</small>${escapeHtml(data.inviteCode || "—")}</div>
    </div>
    <ol class="answer-list">${Object.entries(questionLabels).map(([id, label]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(answers[id]?.optionText || "Javob berilmagan")}</li>`).join("")}</ol>
    ${data.invitationAnswer ? `<div class="invitation-response"><small>Uchrashuv taklifiga javob</small><p>${escapeHtml(data.invitationAnswer)}</p></div>` : ""}
  </article>`;
}

async function init() {
  try {
    const [{ firebaseConfig }, appSdk, authSdk, firestoreSdk] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);
    if (ADMIN_UID === "YOUR_ADMIN_UID" || !firebaseConfig?.apiKey || Object.values(firebaseConfig).some(v => String(v).includes("YOUR_"))) throw new Error("Firebase yoki ADMIN_UID hali sozlanmagan.");
    api = { ...appSdk, ...authSdk, ...firestoreSdk };
    const app = api.initializeApp(firebaseConfig);
    auth = api.getAuth(app);
    db = api.getFirestore(app);
    api.onAuthStateChanged(auth, user => {
      unsubscribe?.();
      if (!user) return renderLogin();
      if (user.uid !== ADMIN_UID) {
        adminApp.innerHTML = '<p class="eyebrow">Admin</p><h1>Ruxsat berilmadi</h1><div class="notice error">Bu sahifani ko‘rish uchun ruxsat yo‘q.</div><div class="actions"><button id="logout" class="button secondary">Chiqish</button></div>';
        document.querySelector("#logout").addEventListener("click", () => api.signOut(auth));
        return;
      }
      renderDashboard(user);
    });
  } catch (error) {
    console.error(error);
    showError("Firebase yoki Admin UID hali sozlanmagan. README ko‘rsatmalarini bajaring.");
  }
}

init();

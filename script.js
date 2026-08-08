const appElement = document.querySelector("#app");
const musicToggle = document.querySelector("#music-toggle");
const backgroundMusic = document.querySelector("#background-music");

// Har bir mavzu uchun fon video manzili — keyingi savol videosini oldindan yuklab qo'yish uchun ishlatiladi.
const videoSourceByTheme = {
  travel: "travel-background.mp4",
  chocolate: "chocolate-background.mp4",
  movies: "movies-background.mp4",
  leisure: "free-time-background.mp4",
  conversation: "conversation-background.mp4",
  secret: "secret-background.mp4",
  idealday: "ideal-day-background.mp4",
  attention: "attention-background.mp4",
  calm: "calm-background.mp4",
  impression: "impression-background.mp4"
};
const prefetchedVideos = new Set();

// Foydalanuvchi hozirgi savolga javob berayotganda, keyingi savol videosini fonda oldindan yuklab qo'yadi.
function prefetchVideo(src) {
  if (!src || prefetchedVideos.has(src)) return;
  prefetchedVideos.add(src);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "video";
  link.href = src;
  document.head.appendChild(link);
}

// Savollarni shu massiv orqali osongina o‘zgartirish yoki ko‘paytirish mumkin.
const questions = [
  { id: "q1", question: "Agar xohlagan davlatingizga sayohat qilish imkoniyati bo‘lganda, qaysi davlatga borgan bo‘lardingiz?", options: ["USA", "England", "Japan", "Switzerland"], allowCustom: true, theme: "travel" },
  { id: "q2", question: "Sizga qanday turdagi shokoladlar yoqadi?", options: ["Millenium", "Maxfan", "Alpen Gold", "KitKat"], allowCustom: true, theme: "chocolate" },
  { id: "q3", question: "Siz mazza qilib ko‘rgan serial yoki kino qaysi?", options: ["Stranger Things", "Harry Potter", "Spider-Man", "Home Alone"], theme: "movies" },
  { id: "q4", question: "Bo‘sh vaqtingizda eng ko‘p nima qilishni yoqtirasiz?", options: ["Kino yoki serial ko‘rish", "Musiqa tinglash", "Sayr qilish", "Oila bilan vaqt o‘tkazish"], theme: "leisure" },
  { id: "q5", question: "Qanday insonlar bilan suhbatlashish sizga yoqadi?", options: ["Samimiy va ochiqko‘ngil insonlar", "Aqlli va bilimli insonlar", "Chuqur mavzularda fikrlasha oladigan insonlar", "Ijodkor va noodatiy fikrlaydigan insonlar"], theme: "conversation" },
  { id: "q6", question: "O‘zingiz haqingizda odamlar bilmaydigan qiziq jihatingiz bormi?", options: ["Ha, ammo hozircha sir bo‘lib qolsin", "Menda alohida qiziq jihat yo‘q deb o‘ylayman", "Suhbat davomida aytib beraman", "Ha, lekin faqat yaqin insonlarimga aytaman"], theme: "secret" },
  { id: "q7", question: "Ideal kuningiz qanday o‘tishini xohlardingiz?", options: ["Tabiatda sayr qilib, xotirjam dam olardim", "Oila va yaqinlarim bilan vaqt o‘tkazardim", "Sevimli kafega borib, kitob o‘qirdim yoki suhbatlashardim", "Kitob o‘qib, yangi bilimlar olardim"], theme: "idealday" },
  { id: "q8", question: "Sizga e’tibor qanday ko‘rsatilsa, yoqimli bo‘ladi?", options: ["Samimiy suhbat va diqqat bilan tinglash", "Kichik, kutilmagan yoqimli syurprizlar", "Qiyin paytimda yonimda bo‘lish", "Hurmat va muloyim muomala"], theme: "attention" },
  { id: "q9", question: "Qiyin paytingizda sizni nima tinchlantiradi?", options: ["Ibodat qilish yoki duo qilish", "Yaqin do‘st bilan gaplashish", "Musiqa tinglash", "Yaxshilab dam olish yoki uxlash"], theme: "calm" },
  { id: "q10", question: "Men haqimda birinchi taassurotingiz qanday bo‘lgan?", hint: "Xohlasangiz, qisqacha yozing.", options: [], textOnly: true, theme: "impression" }
];

const inviteCode = new URLSearchParams(window.location.search).get("invite")?.trim();
const demoMode = window.location.protocol === "file:" || !inviteCode || new URLSearchParams(window.location.search).get("demo") === "1";
const DEMO_STORAGE_KEY = "madinaSurveyDemo";
let firebaseApi;
let db;
let user;
let responseRef;
let answers = {};
let currentQuestion = 0;
let retryAction = null;
let responseExists = false;
let musicEnabled = true;

function updateMusicButton() {
  if (!musicToggle) return;
  musicToggle.classList.toggle("is-off", !musicEnabled);
  musicToggle.textContent = musicEnabled ? "♪" : "×";
  musicToggle.title = musicEnabled ? "Musiqani o'chirish" : "Musiqani yoqish";
  musicToggle.setAttribute("aria-pressed", String(musicEnabled));
  musicToggle.setAttribute("aria-label", musicEnabled ? "Musiqani o'chirish" : "Musiqani yoqish");
}

async function startBackgroundMusic() {
  if (!musicEnabled || !backgroundMusic) return;
  backgroundMusic.volume = 0.55;
  await backgroundMusic.play().catch(() => {});
}

function stopBackgroundMusic() {
  if (!backgroundMusic) return;
  backgroundMusic.pause();
}

function setupMusic() {
  updateMusicButton();
  window.setTimeout(() => startBackgroundMusic(), 250);
  document.addEventListener("pointerdown", () => startBackgroundMusic(), { once: true });
  musicToggle?.addEventListener("click", async () => {
    musicEnabled = !musicEnabled;
    localStorage.setItem("madinaSurveyMusic", musicEnabled ? "on" : "off");
    updateMusicButton();
    if (musicEnabled) await startBackgroundMusic();
    else stopBackgroundMusic();
  });
}

function showMessage(title, message, retry = false) {
  appElement.classList.remove("welcome-mode");
  appElement.classList.remove("travel-mode");
  appElement.classList.remove("chocolate-mode");
  appElement.classList.remove("movies-mode");
  appElement.classList.remove("leisure-mode");
  appElement.classList.remove("conversation-mode");
  appElement.classList.remove("secret-mode");
  appElement.classList.remove("idealday-mode");
  appElement.classList.remove("attention-mode");
  appElement.classList.remove("calm-mode");
  appElement.classList.remove("impression-mode");
  appElement.innerHTML = `<p class="eyebrow">So‘rovnoma</p><h1>${title}</h1><p class="lead">${message}</p>${retry ? '<div class="actions"><button id="retry" class="button">Qayta urinish</button></div>' : ""}`;
  if (retry) document.querySelector("#retry").addEventListener("click", () => retryAction?.());
}

function isConfigReady(config) {
  return config?.apiKey && !Object.values(config).some(value => String(value).includes("YOUR_"));
}

// Firebase SDK va loyiha konfiguratsiyasini yuklaydi.
async function initializeFirebase(beginAfterConnect = false) {
  try {
    const [{ firebaseConfig }, appSdk, authSdk, firestoreSdk] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);
    if (!isConfigReady(firebaseConfig)) throw new Error("CONFIG_MISSING");
    firebaseApi = { ...appSdk, ...authSdk, ...firestoreSdk };
    const firebaseApp = firebaseApi.initializeApp(firebaseConfig);
    const auth = firebaseApi.getAuth(firebaseApp);
    db = firebaseApi.getFirestore(firebaseApp);
    const credential = await firebaseApi.signInAnonymously(auth);
    user = credential.user;
    responseRef = firebaseApi.doc(db, "surveyResponses", `${inviteCode}_${user.uid}`);
    await restoreProgress();
    if (beginAfterConnect) await startSurvey();
    else renderWelcome();
  } catch (error) {
    console.error("Firebase ishga tushmadi:", error);
    retryAction = initializeFirebase;
    const missing = error.message === "CONFIG_MISSING" || error.code === "ERR_MODULE_NOT_FOUND" || String(error).includes("firebase-config.js");
    showMessage("Sozlash talab qilinadi", missing ? "Firebase hali sozlanmagan. README ko‘rsatmasi bo‘yicha firebase-config.js faylini yarating." : "Firebase bilan bog‘lanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.", true);
  }
}

// Avvalgi javoblar va to‘xtalgan savolni Firestore'dan tiklaydi.
async function restoreProgress() {
  const snapshot = await firebaseApi.getDoc(responseRef);
  if (!snapshot.exists()) return;
  responseExists = true;
  const data = snapshot.data();
  answers = data.answers || {};
  currentQuestion = Math.min(Number(data.currentQuestion) || 0, questions.length - 1);
  if (data.status === "completed") currentQuestion = questions.length;
}

function renderWelcome() {
  appElement.classList.add("welcome-mode");
  appElement.classList.remove("travel-mode");
  appElement.classList.remove("chocolate-mode");
  appElement.classList.remove("movies-mode");
  appElement.classList.remove("leisure-mode");
  appElement.classList.remove("conversation-mode");
  appElement.classList.remove("secret-mode");
  appElement.classList.remove("idealday-mode");
  appElement.classList.remove("attention-mode");
  appElement.classList.remove("calm-mode");
  appElement.classList.remove("impression-mode");
  appElement.innerHTML = `
    <video class="welcome-video" autoplay muted loop playsinline preload="metadata" aria-hidden="true">
      <source src="welcome-background.mp4" type="video/mp4">
    </video>
    <div class="welcome-shade" aria-hidden="true"></div>
    <div class="welcome-copy">
      <h1>Salom, Madina</h1>
      <p class="lead">Sizning ayrim qiziqishlaringizni yaqindan bilish maqsadida kichik va qiziqarli so‘rovnoma tayyorladim.<br>Agar qarshi bo‘lmasangiz, bir necha daqiqaga suhbatlashsak nima deysiz</p>
      <div class="actions"><button id="start" class="button welcome-button">${Object.keys(answers).length ? "Davom ettiramiz" : "Yaxshi, boshladik"}<span aria-hidden="true">→</span></button></div>
    </div>`;
  document.querySelector("#start").addEventListener("click", startSurvey);
}

async function startSurvey() {
  await startBackgroundMusic();
  if (demoMode) {
    const savedDemo = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "{}");
    answers = savedDemo || answers || {};
    const answeredCount = Object.keys(answers).filter(id => questions.some(q => q.id === id)).length;
    currentQuestion = Math.min(answeredCount, questions.length);
    if (currentQuestion >= questions.length) return renderComplete();
    renderQuestion();
    return;
  }
  if (!inviteCode) {
    showMessage("Havola topilmadi", "Taklif havolasi noto‘g‘ri yoki mavjud emas.");
    return;
  }
  if (!firebaseApi) {
    appElement.classList.remove("welcome-mode");
    appElement.innerHTML = '<div class="loader" role="status" aria-label="Ulanmoqda"></div><p class="muted center">Kichik sarguzasht tayyorlanmoqda…</p>';
    await initializeFirebase(true);
    return;
  }
  try {
    if (currentQuestion >= questions.length) return renderComplete();
    await firebaseApi.setDoc(responseRef, {
      inviteCode, userId: user.uid, status: "in_progress",
      updatedAt: firebaseApi.serverTimestamp(), currentQuestion,
      ...(!responseExists ? { startedAt: firebaseApi.serverTimestamp() } : {})
    }, { merge: true });
    responseExists = true;
    renderQuestion();
  } catch (error) {
    console.error("So‘rovnoma boshlanmadi:", error);
    retryAction = startSurvey;
    showMessage("Ulanishda xatolik", "So‘rovnomani boshlashning iloji bo‘lmadi. Internetni tekshirib, qayta urining.", true);
  }
}

function renderQuestion() {
  appElement.classList.remove("welcome-mode");
  const item = questions[currentQuestion];
  const saved = answers[item.id];
  const isTravel = item.theme === "travel";
  const isChocolate = item.theme === "chocolate";
  const isMovies = item.theme === "movies";
  const isLeisure = item.theme === "leisure";
  const isConversation = item.theme === "conversation";
  const isSecret = item.theme === "secret";
  const isIdealDay = item.theme === "idealday";
  const isAttention = item.theme === "attention";
  const isCalm = item.theme === "calm";
  const isImpression = item.theme === "impression";
  appElement.classList.toggle("travel-mode", isTravel);
  appElement.classList.toggle("chocolate-mode", isChocolate);
  appElement.classList.toggle("movies-mode", isMovies);
  appElement.classList.toggle("leisure-mode", isLeisure);
  appElement.classList.toggle("conversation-mode", isConversation);
  appElement.classList.toggle("secret-mode", isSecret);
  appElement.classList.toggle("idealday-mode", isIdealDay);
  appElement.classList.toggle("attention-mode", isAttention);
  appElement.classList.toggle("calm-mode", isCalm);
  appElement.classList.toggle("impression-mode", isImpression);
  const themedQuestionClass = isTravel ? "themed-question travel-question" : isChocolate ? "themed-question chocolate-question" : isMovies ? "themed-question movies-question" : isLeisure ? "themed-question leisure-question" : isConversation ? "themed-question conversation-question" : isSecret ? "themed-question secret-question" : isIdealDay ? "themed-question idealday-question" : isAttention ? "themed-question attention-question" : isCalm ? "themed-question calm-question" : isImpression ? "themed-question impression-question" : "";
  const contextMarkup = isTravel
    ? '<div class="question-context"><span class="context-icon" aria-hidden="true">✈</span><span>Sayohat haqida</span></div>'
    : isChocolate
      ? '<div class="question-context"><span class="context-icon" aria-hidden="true">◆</span><span>Shirin tanlov</span></div>'
      : isMovies
        ? '<div class="question-context"><span class="context-icon" aria-hidden="true">▶</span><span>Kino va serial</span></div>'
        : isLeisure
          ? '<div class="question-context"><span class="context-icon" aria-hidden="true">☀</span><span>Bo‘sh vaqt</span></div>'
          : isConversation
            ? '<div class="question-context"><span class="context-icon" aria-hidden="true">✦</span><span>Yoqimli suhbat</span></div>'
            : isSecret
              ? '<div class="question-context"><span class="context-icon" aria-hidden="true">?</span><span>Kichik sir</span></div>'
              : isIdealDay
                ? '<div class="question-context"><span class="context-icon" aria-hidden="true">☼</span><span>Ideal kun</span></div>'
                : isAttention
                  ? '<div class="question-context"><span class="context-icon" aria-hidden="true">♡</span><span>E’tibor va g‘amxo‘rlik</span></div>'
                  : isCalm
                    ? '<div class="question-context"><span class="context-icon" aria-hidden="true">☾</span><span>Xotirjamlik</span></div>'
                    : isImpression
                      ? '<div class="question-context"><span class="context-icon" aria-hidden="true">✧</span><span>Birinchi taassurot</span></div>'
                      : '<p class="eyebrow">O‘zingizga mosini tanlang</p>';
  const backgroundVideo = isTravel
    ? { source: "travel-background.mp4", poster: "travel-airplane.png" }
    : isChocolate
      ? { source: "chocolate-background.mp4", poster: "chocolate-background.png" }
      : isMovies
        ? { source: "movies-background.mp4", poster: "movies-background.png" }
        : isLeisure
          ? { source: "free-time-background.mp4", poster: "" }
          : isConversation
            ? { source: "conversation-background.mp4", poster: "" }
            : isSecret
              ? { source: "secret-background.mp4", poster: "" }
              : isIdealDay
                ? { source: "ideal-day-background.mp4", poster: "" }
                : isAttention
                  ? { source: "attention-background.mp4", poster: "" }
                  : isCalm
                    ? { source: "calm-background.mp4", poster: "" }
                    : isImpression
                      ? { source: "impression-background.mp4", poster: "" }
                      : null;
  appElement.innerHTML = `
    ${backgroundVideo ? `<video class="question-video" autoplay muted loop playsinline preload="metadata"${backgroundVideo.poster ? ` poster="${backgroundVideo.poster}"` : ""} aria-hidden="true">
      <source src="${backgroundVideo.source}" type="video/mp4">
    </video><div class="video-shade" aria-hidden="true"></div>` : ""}
    <div class="progress-row"><span>Savol</span><span>${currentQuestion + 1} / ${questions.length}</span></div>
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${questions.length}" aria-valuenow="${currentQuestion + 1}"><span style="width:${((currentQuestion + 1) / questions.length) * 100}%"></span></div>
    <div class="question-copy ${themedQuestionClass}">
      ${contextMarkup}
      <h2>${item.question}</h2>
      ${item.hint ? `<p class="question-hint">${item.hint}</p>` : ""}
    </div>
    ${item.textOnly ? "" : `<div class="options">${item.options.map((option, index) => `<button class="option ${saved?.optionIndex === index ? "selected" : ""}" data-index="${index}" aria-label="${index + 1}-variant: ${option}"><span class="option-index">${String.fromCharCode(65 + index)}</span><span>${option}</span></button>`).join("")}</div>`}
    <form id="custom-answer-form" class="custom-answer">
      <label for="custom-answer">${item.textOnly ? "Javobingiz" : "Boshqa variantingiz"}</label>
      <div class="custom-answer-row ${item.textOnly ? "text-only-row" : ""}">
        ${item.textOnly
          ? '<textarea id="custom-answer" maxlength="500" rows="3" placeholder="Qisqacha yozing…" aria-label="Birinchi taassurotingizni qisqacha yozing"></textarea>'
          : '<input id="custom-answer" type="text" maxlength="100" placeholder="O‘zingiz xohlagan javobni yozing…" autocomplete="off" aria-label="O‘zingiz xohlagan javobni yozing">'}
        <button class="custom-submit" type="submit" aria-label="Yozilgan javobni tanlash">→</button>
      </div>
    </form>
    ${item.textOnly ? '<button id="skip-question" class="skip-question" type="button">Hozircha o‘tkazib yuborish</button>' : ""}
    ${currentQuestion > 0 ? '<button id="back" class="back" aria-label="Oldingi savolga qaytish">← Oldingi savol</button>' : ""}
    <div id="status" aria-live="assertive"></div>`;
  document.querySelectorAll(".option").forEach(button => button.addEventListener("click", () => saveAnswer(Number(button.dataset.index))));
  document.querySelector("#custom-answer-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const customText = document.querySelector("#custom-answer").value.trim();
    if (!customText) {
      document.querySelector("#custom-answer").focus();
      return;
    }
    saveAnswer(-1, customText);
  });
  document.querySelector("#skip-question")?.addEventListener("click", () => saveAnswer(-1, "Javob berilmagan"));
  document.querySelector("#back")?.addEventListener("click", () => { currentQuestion -= 1; renderQuestion(); });
  const nextItem = questions[currentQuestion + 1];
  if (nextItem) prefetchVideo(videoSourceByTheme[nextItem.theme]);
}

// Tanlovni darhol yozadi; muvaffaqiyatdan keyingina keyingi savolga o‘tadi.
async function saveAnswer(optionIndex, customText = "") {
  const item = questions[currentQuestion];
  const buttons = [...document.querySelectorAll(".option")];
  buttons.forEach((button, index) => { button.disabled = true; button.classList.toggle("selected", index === optionIndex); });
  document.querySelector("#custom-answer")?.setAttribute("disabled", "");
  document.querySelector(".custom-submit")?.setAttribute("disabled", "");
  document.querySelector("#skip-question")?.setAttribute("disabled", "");
  const optionText = optionIndex === -1 ? customText : item.options[optionIndex];
  const answer = { optionIndex, optionText, answeredAt: firebaseApi ? firebaseApi.serverTimestamp() : new Date().toISOString() };
  try {
    const isLast = currentQuestion === questions.length - 1;
    if (demoMode) {
      answers[item.id] = answer;
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(answers));
      currentQuestion += 1;
      window.setTimeout(() => currentQuestion >= questions.length ? renderComplete() : renderQuestion(), 260);
      return;
    }
    await firebaseApi.setDoc(responseRef, {
      answers: { [item.id]: answer },
      currentQuestion: isLast ? questions.length : currentQuestion + 1,
      status: isLast ? "completed" : "in_progress",
      updatedAt: firebaseApi.serverTimestamp(),
      ...(isLast ? { completedAt: firebaseApi.serverTimestamp() } : {})
    }, { merge: true });
    answers[item.id] = { ...answer, answeredAt: new Date() };
    currentQuestion += 1;
    window.setTimeout(() => currentQuestion >= questions.length ? renderComplete() : renderQuestion(), 260);
  } catch (error) {
    console.error("Javob saqlanmadi:", error);
    buttons.forEach(button => { button.disabled = false; });
    document.querySelector("#custom-answer")?.removeAttribute("disabled");
    document.querySelector(".custom-submit")?.removeAttribute("disabled");
    document.querySelector("#skip-question")?.removeAttribute("disabled");
    document.querySelector("#status").innerHTML = '<div class="notice error">Javob saqlanmadi. Internetni tekshiring. <button id="answer-retry" class="back">Qayta urinish</button></div>';
    document.querySelector("#answer-retry").addEventListener("click", () => saveAnswer(optionIndex));
  }
}

function renderComplete() {
  clearSurveyTheme();
  appElement.classList.add("final-mode", "final-summary-mode");
  appElement.innerHTML = `
    <div class="final-mark" aria-hidden="true">✓</div>
    <p class="eyebrow center">So‘rovnoma yakuni</p>
    <h1 class="center">So‘rovnoma yakunlandi ✨</h1>
    <p class="lead center">Barcha javoblaringiz saqlandi.</p>
    <p class="final-copy center">Javob berganingiz uchun rahmat.<br>Lekin bu so‘rovnomaning kichik bir siri bor edi...</p>
    <div class="actions"><button id="continue-secret" class="button">Davom etish <span aria-hidden="true">→</span></button></div>`;
  document.querySelector("#continue-secret").addEventListener("click", renderSecretReveal);
}

function clearSurveyTheme() {
  appElement.classList.remove("welcome-mode");
  appElement.classList.remove("travel-mode");
  appElement.classList.remove("chocolate-mode");
  appElement.classList.remove("movies-mode");
  appElement.classList.remove("leisure-mode");
  appElement.classList.remove("conversation-mode");
  appElement.classList.remove("secret-mode");
  appElement.classList.remove("idealday-mode");
  appElement.classList.remove("attention-mode");
  appElement.classList.remove("calm-mode");
  appElement.classList.remove("impression-mode");
  appElement.classList.remove("final-mode", "final-summary-mode", "secret-reveal-mode", "comic-cover-mode", "invitation-mode");
}

function renderSecretReveal() {
  clearSurveyTheme();
  appElement.classList.add("final-mode", "secret-reveal-mode");
  appElement.innerHTML = `
    <p class="eyebrow center">Kichik sir</p>
    <h1 class="center">Aslida, bu savollarni shunchaki bermadim.</h1>
    <p class="lead center">Siz uchun ancha vaqt davomida alohida bir narsa tayyorladim.</p>
    <p class="final-copy center">Uni ko‘rishga tayyormisiz?</p>
    <div class="actions"><button id="show-comic" class="button">Ha, ko‘rsatish <span aria-hidden="true">→</span></button></div>`;
  document.querySelector("#show-comic").addEventListener("click", renderComicCover);
}

function renderComicCover() {
  clearSurveyTheme();
  appElement.classList.add("final-mode", "comic-cover-mode");
  appElement.innerHTML = `
    <div class="cover-frame"><img src="comic-cover.png" alt="Madina uchun tayyorlangan maxsus komiks muqovasi"></div>
    <p class="eyebrow center">Maxsus muqova</p>
    <h1 class="center">Bu — siz uchun tayyorlangan maxsus komiks.</h1>
    <p class="final-copy center">Undagi voqealar, qahramonlar va sahifalar alohida tayyorlangan.<br>Hozir siz uning faqat muqovasini ko‘ryapsiz.</p>
    <div class="actions"><button id="continue-invite" class="button">Davom etish <span aria-hidden="true">→</span></button></div>`;
  document.querySelector("#continue-invite").addEventListener("click", renderInvitation);
}

function renderInvitation() {
  clearSurveyTheme();
  appElement.classList.add("final-mode", "invitation-mode");
  appElement.innerHTML = `
    <p class="eyebrow center">Kichik taklif</p>
    <h1 class="center">Komiksning to‘liq nusxasi tayyor.</h1>
    <p class="lead center">Uni internet orqali yuborishdan ko‘ra, sizga shaxsan sovg‘a qilishni istardim.</p>
    <p class="final-copy center">Agar siz ham rozi bo‘lsangiz, qisqa uchrashsak nima deysiz? Shu bahona biroz suhbatlashardik. To‘g‘risini aytsam, siz bilan yolg‘iz suhbat qurish men uchun qiziq bo‘lardi — shu vaqtgacha deyarli har safar yonimizda Zulfiya opa yoki kursdoshlar bo‘lgan.<br><br>Agar uchrashishga rozi bo‘lsangiz, quyida o‘zingizga qulay kunni tanlang. Qolgan tafsilotlarni keyinroq chat orqali kelishib olamiz.</p>
    <div class="actions"><button id="answer-invitation" class="button">Javob berish</button></div>
    <div id="invitation-answer" aria-live="polite"></div>`;
  document.querySelector("#answer-invitation").addEventListener("click", renderInvitationAnswerForm);
}

function renderInvitationAnswerForm() {
  const answerArea = document.querySelector("#invitation-answer");
  const answerButton = document.querySelector("#answer-invitation");
  answerButton?.remove();
  answerArea.innerHTML = `
    <form id="invitation-answer-form" class="invitation-answer-form">
      <label for="invitation-text">Javobingiz</label>
      <textarea id="invitation-text" rows="3" maxlength="700" placeholder="Javobingizni shu yerga yozing…" aria-label="Uchrashuv taklifiga javobingiz"></textarea>
      <button class="button" type="submit">Yuborish <span aria-hidden="true">→</span></button>
    </form>`;
  const textArea = document.querySelector("#invitation-text");
  textArea.focus();
  document.querySelector("#invitation-answer-form").addEventListener("submit", async event => {
    event.preventDefault();
    const response = textArea.value.trim();
    if (!response) return textArea.focus();
    const submitButton = document.querySelector("#invitation-answer-form button");
    submitButton.disabled = true;
    try {
      if (demoMode) {
        localStorage.setItem("madinaSurveyInvitationAnswer", response);
      } else {
        await firebaseApi.setDoc(responseRef, {
          invitationAnswer: response,
          invitationAnsweredAt: firebaseApi.serverTimestamp(),
          updatedAt: firebaseApi.serverTimestamp()
        }, { merge: true });
      }
      answerArea.innerHTML = '<div class="notice success center">Rahmat, javobingiz saqlandi. 😊</div>';
    } catch (error) {
      console.error("Taklif javobi saqlanmadi:", error);
      submitButton.disabled = false;
      answerArea.insertAdjacentHTML("beforeend", '<div class="notice error center">Javob saqlanmadi. Internetni tekshirib, qayta urinib ko‘ring.</div>');
    }
  });
}

// Birinchi taklif sahifasi Firebase sozlanishidan qat’i nazar darhol ko‘rinadi.
setupMusic();
renderWelcome();

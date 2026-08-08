# Romantik interaktiv so‘rovnoma

Frameworksiz, mobil qurilmalarga mos HTML/CSS/JavaScript so‘rovnoma. Har bir tanlov Firebase Cloud Firestore'ga darhol yoziladi; foydalanuvchi Firebase Anonymous Authentication orqali aniqlanadi. Sayt lokatsiya, kamera, mikrofon, kontakt, fayl yoki fingerprint ma’lumotlarini yig‘maydi.

## Loyiha tuzilishi

```text
romantik-sorovnoma/
├── index.html                 # Asosiy so‘rovnoma
├── style.css                 # Mobil va desktop dizayn
├── script.js                 # Savollar, anonim kirish va javoblarni saqlash
├── firebase-config.example.js# Firebase sozlamasi namunasi
├── admin.html                 # Himoyalangan admin sahifasi
├── admin.js                  # Admin kirishi va jonli natijalar
└── README.md                 # O‘rnatish va xavfsizlik yo‘riqnomasi
```

## 1. Firebase loyihasini yaratish

1. [Firebase Console](https://console.firebase.google.com/) sahifasiga kiring.
2. **Add project** tugmasini bosing, loyiha nomini yozing va jarayonni yakunlang.

## 2. Web App qo‘shish

Project Overview yonidagi tishli belgi → **Project settings** → **Your apps** → `</>` ni tanlang. Ilovani ro‘yxatdan o‘tkazing va ko‘rsatilgan `firebaseConfig` qiymatlarini saqlab qo‘ying.

## 3. Anonymous Authentication'ni yoqish

**Build → Authentication → Sign-in method → Anonymous → Enable → Save**.

## 4. Admin uchun Email/Password'ni yoqish

**Authentication → Sign-in method → Email/Password → Enable → Save**.

## 5. Cloud Firestore yaratish

**Build → Firestore Database → Create database**. Production mode'ni va sizga yaqin hududni tanlang. Hudud keyinchalik o‘zgarmaydi.

## 6. Firebase konfiguratsiyasini joylashtirish

`firebase-config.example.js` faylidan nusxa olib, nusxani `firebase-config.js` deb nomlang. Ichidagi barcha `YOUR_...` qiymatlarni Firebase Console bergan Web App konfiguratsiyasi bilan almashtiring. Firebase Web konfiguratsiyasi server siri emas; haqiqiy himoya quyidagi Security Rules orqali bajariladi. Service Account/private key kabi maxfiy kalitlarni frontendga hech qachon yozmang.

## 7. Admin foydalanuvchisini yaratish

**Authentication → Users → Add user** orqali admin emaili va kuchli parol yarating. Bu hisobni oddiy foydalanuvchiga bermang.

## 8. Admin UID'ni topish

Authentication foydalanuvchilar jadvalidan adminning **User UID** qiymatini nusxalang. `admin.js` boshidagi qiymatni almashtiring:

```javascript
const ADMIN_UID = "FIREBASE_DAGI_HAQIQIY_ADMIN_UID";
```

## 9. Firestore Security Rules

Quyidagi qoidada `YOUR_ADMIN_UID` o‘rniga xuddi shu haqiqiy admin UID'ni kiriting va **Firestore Database → Rules → Publish** orqali joylang.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.uid == "YOUR_ADMIN_UID";
    }

    function isOwnerDocument(documentId) {
      return signedIn()
        && documentId.matches('^.+_' + request.auth.uid + '$')
        && request.resource.data.userId == request.auth.uid;
    }

    match /surveyResponses/{documentId} {
      allow list: if isAdmin();
      allow get: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid);

      allow create: if isOwnerDocument(documentId)
        && request.resource.data.keys().hasOnly([
          'inviteCode', 'userId', 'status', 'startedAt', 'updatedAt',
          'completedAt', 'currentQuestion', 'answers'
        ])
        && request.resource.data.inviteCode is string
        && request.resource.data.inviteCode.size() >= 4
        && request.resource.data.inviteCode.size() <= 100
        && request.resource.data.status == 'in_progress'
        && request.resource.data.currentQuestion is int
        && request.resource.data.currentQuestion >= 0
        && request.resource.data.currentQuestion <= 10;

      allow update: if isOwnerDocument(documentId)
        && resource.data.userId == request.auth.uid
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.inviteCode == resource.data.inviteCode
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'status', 'updatedAt', 'completedAt', 'currentQuestion', 'answers'
        ])
        && request.resource.data.status in ['in_progress', 'completed']
        && request.resource.data.currentQuestion is int
        && request.resource.data.currentQuestion >= 0
        && request.resource.data.currentQuestion <= 10;

      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Bu qoidalar anonim foydalanuvchiga faqat o‘z UID'i bilan tugaydigan va ichida shu UID yozilgan hujjatni yaratish/yangilash imkonini beradi. U boshqa javoblarni o‘qiy yoki ro‘yxatlay olmaydi. Faqat belgilangan admin barcha natijalarni ro‘yxatlay oladi. Delete butunlay yopiq.

> Eslatma: frontenddagi `ADMIN_UID` faqat interfeys tekshiruvi. Asosiy himoya — Firestore Rules ichidagi admin UID.

## 10. Lokal serverda ishga tushirish

ES modullar va Firebase SDK sababli `index.html` faylini `file://` orqali ikki marta bosib ochmang. Papka ichida lokal HTTP server ishga tushiring:

```bash
python -m http.server 8000
```

So‘ng brauzerda quyidagini oching:

```text
http://localhost:8000/?invite=madina-2026-x7k29
```

Admin sahifasi:

```text
http://localhost:8000/admin.html
```

## 11. Firebase Hosting'ga joylashtirish

Node.js o‘rnatilgan bo‘lsa:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

`firebase init hosting` savollarida public directory sifatida joriy papkani (`.`) kiriting, single-page app savoliga **No**, GitHub deploy savoliga istagingizga qarab javob bering. `firebase.json`, `.firebaserc` va `firebase-config.js` fayllarini xavfsiz saqlang. Service Account kalitini loyihaga qo‘shmang.

## 12. Maxsus invite havolasi

Har bir taklif uchun taxmin qilish qiyin, noyob kod tanlang:

```text
https://YOUR_PROJECT.web.app/?invite=madina-2026-x7k29
```

Kod bo‘lmasa sayt so‘rovnomani boshlamaydi. Bitta qurilma/brauzerdagi anonim hisob bir xil havolani qayta ochsa, avvalgi joyidan davom etadi. Brauzer ma’lumotlari o‘chirilsa yoki boshqa qurilma ishlatilsa, Firebase yangi anonim UID beradi va yangi javob hujjati yaratiladi.

## Tekshirish checklisti

- [ ] `firebase-config.js` yaratildi va haqiqiy qiymatlar kiritildi.
- [ ] Anonymous va Email/Password Authentication yoqildi.
- [ ] Admin hisob yaratildi; UID `admin.js` va Firestore Rules ichiga bir xil yozildi.
- [ ] Firestore Rules e’lon qilindi.
- [ ] `?invite=...` siz sahifa xato ko‘rsatadi.
- [ ] Invite bilan har bir javobdan so‘ng keyingi savol ochiladi.
- [ ] Sahifa yangilanganda oldingi javoblar va joy tiklanadi.
- [ ] Oldingi savoldagi tanlov o‘zgartirilsa Firestore yangilanadi.
- [ ] Admin bo‘lmagan hisob natijalarni ko‘ra olmaydi.
- [ ] Admin sahifasida yangi javoblar real vaqtda ko‘rinadi.
- [ ] Mobil ekran va klaviatura bilan boshqarish tekshirildi.

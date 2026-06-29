/**
 * Firebase Configuration
 * إعدادات Firebase — استبدل القيم بإعدادات مشروعك
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// حساب فرق الوقت مع السيرفر لمزامنة المؤقت
let serverTimeOffset = 0;
db.ref('.info/serverTimeOffset').on('value', (snap) => {
  serverTimeOffset = snap.val() || 0;
});

/**
 * الحصول على وقت السيرفر الحالي
 */
function getServerTime() {
  return Date.now() + serverTimeOffset;
}

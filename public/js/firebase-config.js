/**
 * Firebase Configuration
 * إعدادات Firebase الخاصة بمشروع top10-7aa3d
 */
const firebaseConfig = {
  apiKey: "AIzaSyDizMH71WHp7ySaxBusbHHEIFN1lQ_qKns",
  authDomain: "top10-7aa3d.firebaseapp.com",
  databaseURL: "https://top10-7aa3d-default-rtdb.firebaseio.com",
  projectId: "top10-7aa3d",
  storageBucket: "top10-7aa3d.firebasestorage.app",
  messagingSenderId: "595821499501",
  appId: "1:595821499501:web:cae68ead8c3cbafbd01b64",
  measurementId: "G-CQT4LEGLYL"
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

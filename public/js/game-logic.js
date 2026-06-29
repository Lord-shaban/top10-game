/**
 * Game Logic — منطق اللعبة (client-side)
 * يحل محل Room.js و GameManager.js من الجانب الخلفي
 */

/**
 * تطبيع النص العربي - إزالة التشكيل وتوحيد الأحرف المتشابهة
 */
function normalizeArabic(text) {
  return text
    .toLowerCase()
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
    .replace(/[أإآءؤئ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * توليد معرف فريد للاعب
 */
function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

/**
 * توليد كود غرفة فريد (6 أحرف/أرقام)
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * التحقق من إجابة اللاعب ضد سؤال معين
 * @param {string} answer - الإجابة المُقدمة
 * @param {Object} question - كائن السؤال
 * @param {Set} discoveredIndices - فهارس الإجابات المكتشفة
 * @returns {Object|null} نتيجة الإجابة أو null إذا خاطئة
 */
function checkAnswerAgainstQuestion(answer, question, discoveredIndices) {
  const normalizedAnswer = normalizeArabic(answer);

  for (let i = 0; i < question.answers.length; i++) {
    if (discoveredIndices.has(i)) continue;

    const correctAnswer = question.answers[i];
    const allNames = [correctAnswer.name, ...correctAnswer.aliases].map(n => normalizeArabic(n));

    if (allNames.includes(normalizedAnswer)) {
      return {
        answerIndex: i,
        answerName: correctAnswer.name,
        answerValue: correctAnswer.value,
        points: i + 1
      };
    }
  }
  return null;
}

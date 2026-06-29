/**
 * App — المنطق الرئيسي للتطبيق
 * يستخدم RealtimeClient (Firebase) بدلاً من SocketClient (Socket.IO)
 */
(function() {
  'use strict';

  // تهيئة Firebase Realtime Client
  RealtimeClient.init();

  // تهيئة Autocomplete
  window.autocomplete = new Autocomplete(
    UI.elements.answerInput,
    UI.elements.suggestionsList,
    (selectedName) => {
      RealtimeClient.submitAnswer(selectedName);
    }
  );

  // ═══════════════════════════════════
  // أحداث الشاشة الرئيسية
  // ═══════════════════════════════════

  // التحقق من صحة الاسم
  function validatePlayerName() {
    const name = UI.elements.playerName.value.trim();
    if (!name) {
      UI.showToast('يرجى إدخال اسمك أولاً');
      UI.elements.playerName.focus();
      return null;
    }
    if (name.length < 2) {
      UI.showToast('الاسم يجب أن يكون حرفين على الأقل');
      UI.elements.playerName.focus();
      return null;
    }
    return name;
  }

  // إنشاء غرفة
  UI.elements.btnCreateRoom.addEventListener('click', () => {
    const name = validatePlayerName();
    if (name) {
      RealtimeClient.createRoom(name);
    }
  });

  // الانضمام لغرفة
  UI.elements.btnJoinRoom.addEventListener('click', () => {
    const name = validatePlayerName();
    if (!name) return;

    const code = UI.elements.roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      UI.showToast('يرجى إدخال كود الغرفة');
      UI.elements.roomCodeInput.focus();
      return;
    }
    if (code.length !== 6) {
      UI.showToast('كود الغرفة يجب أن يكون 6 أحرف');
      UI.elements.roomCodeInput.focus();
      return;
    }

    RealtimeClient.joinRoom(code, name);
  });

  // Enter في حقل الكود → انضمام
  UI.elements.roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      UI.elements.btnJoinRoom.click();
    }
  });

  // Enter في حقل الاسم → إنشاء غرفة
  UI.elements.playerName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      UI.elements.btnCreateRoom.click();
    }
  });

  // ═══════════════════════════════════
  // أحداث غرفة الانتظار
  // ═══════════════════════════════════

  // نسخ كود الغرفة
  UI.elements.btnCopyCode.addEventListener('click', () => {
    const code = UI.elements.lobbyRoomCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      UI.showToast('تم نسخ الكود! 📋', 1500);
    }).catch(() => {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      UI.showToast('تم نسخ الكود! 📋', 1500);
    });
  });

  // بدء اللعبة
  UI.elements.btnStartGame.addEventListener('click', () => {
    RealtimeClient.startGame();
  });

  // ═══════════════════════════════════
  // أحداث شاشة اللعب
  // ═══════════════════════════════════

  // إرسال الإجابة بالضغط على Enter (بدون autocomplete مفتوح)
  UI.elements.answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !window.autocomplete.isOpen) {
      const answer = UI.elements.answerInput.value.trim();
      if (answer) {
        RealtimeClient.submitAnswer(answer);
        UI.elements.answerInput.value = '';
      }
    }
  });

  // ═══════════════════════════════════
  // أحداث نتائج الجولة
  // ═══════════════════════════════════

  // الجولة التالية
  UI.elements.btnNextRound.addEventListener('click', () => {
    RealtimeClient.nextRound();
  });

  // ═══════════════════════════════════
  // أحداث النتائج النهائية
  // ═══════════════════════════════════

  // لعب مرة أخرى
  UI.elements.btnPlayAgain.addEventListener('click', () => {
    RealtimeClient.playAgain();
  });

  // ═══════════════════════════════════
  // تأثيرات إضافية
  // ═══════════════════════════════════

  // فلتر حقل كود الغرفة (أحرف وأرقام فقط)
  UI.elements.roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  });

  // التركيز التلقائي على حقل الاسم
  setTimeout(() => {
    UI.elements.playerName.focus();
  }, 500);

  console.log('🎮 Top 10 — اللعبة جاهزة! (Firebase Mode)');
})();

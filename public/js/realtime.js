/**
 * RealtimeClient — اتصال Firebase Realtime Database
 * بديل كامل لـ Socket.IO — يدير المزامنة الفورية بين اللاعبين
 */
const RealtimeClient = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  roomRef: null,
  listeners: [],
  currentQuestion: null,
  questionIds: [],
  currentRound: -1,
  totalTime: 90,
  timerInterval: null,
  discoveredIndices: new Set(),
  localPlayers: {},
  _lastRound: -2,
  _lastState: null,

  /**
   * تهيئة الاتصال
   */
  init() {
    this.playerId = generatePlayerId();

    // مراقبة حالة الاتصال بـ Firebase
    db.ref('.info/connected').on('value', (snap) => {
      if (snap.val() === false) {
        console.log('🔴 انقطع الاتصال بـ Firebase');
      } else {
        console.log('🟢 متصل بـ Firebase');
      }
    });
  },

  // ═══════════════════════════════════
  // الأحداث الرئيسية
  // ═══════════════════════════════════

  /**
   * إنشاء غرفة جديدة
   */
  async createRoom(playerName) {
    try {
      this.playerName = playerName;
      this.isHost = true;
      this.roomCode = generateRoomCode();
      this.roomRef = db.ref('rooms/' + this.roomCode);

      // التأكد من عدم وجود غرفة بنفس الكود
      const snapshot = await this.roomRef.once('value');
      if (snapshot.exists()) {
        this.roomCode = generateRoomCode();
        this.roomRef = db.ref('rooms/' + this.roomCode);
      }

      const roomData = {
        hostId: this.playerId,
        state: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        players: {
          [this.playerId]: {
            name: playerName,
            score: 0,
            roundScore: 0,
            isHost: true
          }
        }
      };

      await this.roomRef.set(roomData);

      // حذف اللاعب تلقائياً عند قطع الاتصال
      this.roomRef.child('players').child(this.playerId).onDisconnect().remove();

      // إعداد المستمعين
      this._setupListeners();

      // تحديث واجهة المستخدم
      const players = this._formatPlayersList({
        [this.playerId]: roomData.players[this.playerId]
      });
      UI.updateLobby(this.roomCode, players, true);
      UI.showScreen('lobby');

      console.log(`🏠 غرفة جديدة: ${this.roomCode}`);
    } catch (error) {
      console.error('خطأ في إنشاء الغرفة:', error);
      UI.showToast('حدث خطأ في إنشاء الغرفة');
    }
  },

  /**
   * الانضمام لغرفة موجودة
   */
  async joinRoom(roomCode, playerName) {
    try {
      this.playerName = playerName;
      this.isHost = false;
      this.roomCode = roomCode.toUpperCase();
      this.roomRef = db.ref('rooms/' + this.roomCode);

      // التحقق من وجود الغرفة
      const snapshot = await this.roomRef.once('value');
      if (!snapshot.exists()) {
        UI.showToast('الغرفة غير موجودة');
        return;
      }

      const roomData = snapshot.val();

      if (roomData.state !== 'waiting') {
        UI.showToast('اللعبة بدأت بالفعل');
        return;
      }

      const players = roomData.players || {};
      const playerCount = Object.keys(players).length;

      if (playerCount >= 10) {
        UI.showToast('الغرفة ممتلئة (الحد الأقصى 10 لاعبين)');
        return;
      }

      // التحقق من عدم تكرار الاسم
      const nameExists = Object.values(players).some(p => p.name === playerName);
      if (nameExists) {
        UI.showToast('هذا الاسم مُستخدم بالفعل في هذه الغرفة');
        return;
      }

      // إضافة اللاعب
      await this.roomRef.child('players').child(this.playerId).set({
        name: playerName,
        score: 0,
        roundScore: 0,
        isHost: false
      });

      // حذف اللاعب عند قطع الاتصال
      this.roomRef.child('players').child(this.playerId).onDisconnect().remove();

      // إعداد المستمعين
      this._setupListeners();

      // تحديث واجهة المستخدم
      players[this.playerId] = {
        name: playerName, score: 0, roundScore: 0, isHost: false
      };
      const playersList = this._formatPlayersList(players);
      UI.updateLobby(this.roomCode, playersList, false);
      UI.showScreen('lobby');

      console.log(`👤 ${playerName} انضم للغرفة ${this.roomCode}`);
    } catch (error) {
      console.error('خطأ في الانضمام:', error);
      UI.showToast('حدث خطأ في الانضمام للغرفة');
    }
  },

  /**
   * بدء اللعبة (المضيف فقط)
   */
  async startGame() {
    if (!this.isHost) return;

    try {
      // اختيار 5 أسئلة عشوائية
      const selectedQuestions = getRandomQuestions(5);
      this.questionIds = selectedQuestions.map(q => q.id);

      // إعادة تعيين نقاط اللاعبين
      const playersSnapshot = await this.roomRef.child('players').once('value');
      const updates = {};
      playersSnapshot.forEach(child => {
        updates['players/' + child.key + '/score'] = 0;
        updates['players/' + child.key + '/roundScore'] = 0;
      });

      updates['state'] = 'starting';
      updates['questionIds'] = this.questionIds;
      updates['currentRound'] = -1;
      updates['totalRounds'] = this.questionIds.length;

      await this.roomRef.update(updates);

      console.log(`🎮 اللعبة بدأت في الغرفة ${this.roomCode}`);

      // بدء الجولة الأولى بعد تأخير
      setTimeout(() => {
        this._startNextRound();
      }, 1500);
    } catch (error) {
      console.error('خطأ في بدء اللعبة:', error);
      UI.showToast('حدث خطأ في بدء اللعبة');
    }
  },

  /**
   * إرسال إجابة
   */
  async submitAnswer(answer) {
    if (!this.currentQuestion) return;

    const result = checkAnswerAgainstQuestion(
      answer,
      this.currentQuestion,
      this.discoveredIndices
    );

    if (result) {
      try {
        // محاولة حجز الإجابة بـ transaction (لمنع التكرار)
        const answerRef = this.roomRef
          .child('discoveredAnswers')
          .child(String(result.answerIndex));

        const transResult = await answerRef.transaction((currentData) => {
          if (currentData === null) {
            // لم يكتشفها أحد بعد — نحجزها
            return {
              playerName: this.playerName,
              playerId: this.playerId,
              answerName: result.answerName,
              answerValue: result.answerValue,
              points: result.points
            };
          }
          // مكتشفة بالفعل — إلغاء
          return undefined;
        });

        if (transResult.committed) {
          // تحديث النقاط
          const playerRef = this.roomRef.child('players').child(this.playerId);
          await playerRef.child('score').transaction(s => (s || 0) + result.points);
          await playerRef.child('roundScore').transaction(s => (s || 0) + result.points);
        }
      } catch (error) {
        console.error('خطأ في إرسال الإجابة:', error);
      }
    } else {
      // إجابة خاطئة
      UI.shakeInput();
    }
  },

  /**
   * الجولة التالية (المضيف فقط)
   */
  nextRound() {
    if (!this.isHost) return;
    this._startNextRound();
  },

  /**
   * إعادة اللعب (المضيف فقط)
   */
  async playAgain() {
    if (!this.isHost) return;

    try {
      const updates = {
        state: 'waiting',
        currentRound: null,
        questionIds: null,
        totalRounds: null,
        roundStartTime: null,
        discoveredAnswers: null
      };

      // إعادة تعيين النقاط
      const playersSnapshot = await this.roomRef.child('players').once('value');
      playersSnapshot.forEach(child => {
        updates['players/' + child.key + '/score'] = 0;
        updates['players/' + child.key + '/roundScore'] = 0;
      });

      this._lastRound = -2;
      this._lastState = null;
      await this.roomRef.update(updates);
    } catch (error) {
      console.error('خطأ في إعادة اللعب:', error);
    }
  },

  // ═══════════════════════════════════
  // المنطق الداخلي
  // ═══════════════════════════════════

  /**
   * بدء الجولة التالية (يُنفذ بواسطة المضيف فقط)
   */
  async _startNextRound() {
    if (!this.isHost) return;

    try {
      const snapshot = await this.roomRef.once('value');
      const roomData = snapshot.val();
      const nextRound = (roomData.currentRound === null || roomData.currentRound === undefined)
        ? 0
        : roomData.currentRound + 1;

      if (nextRound >= roomData.questionIds.length) {
        // انتهت جميع الجولات
        await this.roomRef.update({ state: 'finished' });
        return;
      }

      // إعادة تعيين نقاط الجولة
      const updates = {};
      const players = roomData.players || {};
      Object.keys(players).forEach(pid => {
        updates['players/' + pid + '/roundScore'] = 0;
      });

      updates['currentRound'] = nextRound;
      updates['roundStartTime'] = firebase.database.ServerValue.TIMESTAMP;
      updates['state'] = 'playing';
      updates['discoveredAnswers'] = null;

      await this.roomRef.update(updates);
    } catch (error) {
      console.error('خطأ في بدء الجولة:', error);
    }
  },

  /**
   * إنهاء الجولة
   */
  async _endRound() {
    try {
      const stateSnap = await this.roomRef.child('state').once('value');
      if (stateSnap.val() !== 'playing') return;

      await this.roomRef.child('state').set('round_results');
    } catch (error) {
      console.error('خطأ في إنهاء الجولة:', error);
    }
  },

  // ═══════════════════════════════════
  // المستمعون (Listeners)
  // ═══════════════════════════════════

  /**
   * إعداد جميع المستمعين على الغرفة
   */
  _setupListeners() {
    this._cleanupListeners();

    // ─── مستمع اللاعبين ───
    const playersRef = this.roomRef.child('players');
    const playersCallback = playersRef.on('value', (snapshot) => {
      const players = snapshot.val() || {};
      const oldPlayers = this.localPlayers;
      this.localPlayers = players;

      // التحقق من وجود المضيف
      const hostExists = Object.values(players).some(p => p.isHost);
      if (!hostExists && Object.keys(players).length > 0) {
        // تعيين مضيف جديد (أول لاعب أبجدياً)
        const sortedIds = Object.keys(players).sort();
        const newHostId = sortedIds[0];
        if (newHostId === this.playerId) {
          this.isHost = true;
          this.roomRef.child('players').child(this.playerId).child('isHost').set(true);
          this.roomRef.child('hostId').set(this.playerId);
        }
      }

      // تحقق هل أنا المضيف
      if (players[this.playerId]) {
        this.isHost = players[this.playerId].isHost || false;
      }

      // اكتشاف اللاعبين الجدد والمغادرين
      const oldIds = Object.keys(oldPlayers || {});
      const newIds = Object.keys(players);

      // لاعب جديد انضم
      newIds.forEach(id => {
        if (!oldIds.includes(id) && id !== this.playerId && oldIds.length > 0) {
          UI.showToast(`${players[id].name} انضم للغرفة! 👋`, 2000);
        }
      });

      // لاعب غادر
      oldIds.forEach(id => {
        if (!newIds.includes(id)) {
          const leftName = oldPlayers[id]?.name || 'لاعب';
          UI.showToast(`${leftName} غادر الغرفة`, 2000);
        }
      });

      // تحديث الواجهة حسب الحالة
      const playersList = this._formatPlayersList(players);
      if (this._lastState === 'waiting') {
        UI.updateLobby(this.roomCode, playersList, this.isHost);
      } else if (this._lastState === 'playing') {
        UI.updateMiniScores(playersList);
      }
    });
    this.listeners.push({ ref: playersRef, event: 'value', cb: playersCallback });

    // ─── مستمع حالة الغرفة ───
    const stateRef = this.roomRef.child('state');
    const stateCallback = stateRef.on('value', (snapshot) => {
      const state = snapshot.val();
      if (state === this._lastState) return;

      const oldState = this._lastState;
      this._lastState = state;

      if (state === 'waiting') {
        this._stopTimer();
        this._lastRound = -2;
        const playersList = this._formatPlayersList(this.localPlayers);
        UI.updateLobby(this.roomCode, playersList, this.isHost);
        UI.showScreen('lobby');
      } else if (state === 'round_results') {
        this._stopTimer();
        this._showRoundResults();
      } else if (state === 'finished') {
        this._stopTimer();
        this._showFinalResults();
      }
    });
    this.listeners.push({ ref: stateRef, event: 'value', cb: stateCallback });

    // ─── مستمع تغيير الجولة ───
    const roundRef = this.roomRef.child('currentRound');
    const roundCallback = roundRef.on('value', async (snapshot) => {
      const round = snapshot.val();
      if (round === null || round === undefined || round < 0) return;
      if (round === this._lastRound) return;
      this._lastRound = round;

      try {
        // جلب بيانات الغرفة كاملة
        const roomSnap = await this.roomRef.once('value');
        const roomData = roomSnap.val();
        if (!roomData || !roomData.questionIds) return;

        this.currentRound = round;
        this.questionIds = roomData.questionIds;

        // البحث عن السؤال محلياً
        const questionId = roomData.questionIds[round];
        this.currentQuestion = questions.find(q => q.id === questionId);
        if (!this.currentQuestion) return;

        this.discoveredIndices = new Set();

        // توليد الاقتراحات
        const allSuggestions = getSuggestionList(this.currentQuestion);

        const roundData = {
          questionIndex: round + 1,
          totalQuestions: roomData.questionIds.length,
          question: this.currentQuestion.question,
          category: this.currentQuestion.category,
          suggestions: allSuggestions.map(s => ({ name: s.name, aliases: s.aliases })),
          timeLeft: this.totalTime
        };

        UI.initGameScreen(roundData);
        UI.updateMiniScores(this._formatPlayersList(this.localPlayers));

        if (window.autocomplete) {
          window.autocomplete.setSuggestions(roundData.suggestions);
          window.autocomplete.clear();
        }

        UI.showScreen('game');
        UI.elements.answerInput.focus();

        // بدء المؤقت بناءً على roundStartTime
        this._startSyncedTimer(roomData.roundStartTime);
      } catch (error) {
        console.error('خطأ في بدء الجولة:', error);
      }
    });
    this.listeners.push({ ref: roundRef, event: 'value', cb: roundCallback });

    // ─── مستمع الإجابات المكتشفة ───
    const discoveredRef = this.roomRef.child('discoveredAnswers');
    const discoveredCallback = discoveredRef.on('value', (snapshot) => {
      const discovered = snapshot.val() || {};

      // اكتشاف الإجابات الجديدة
      Object.entries(discovered).forEach(([indexStr, data]) => {
        const index = parseInt(indexStr);
        if (!this.discoveredIndices.has(index)) {
          this.discoveredIndices.add(index);

          // عرض الإجابة في الواجهة
          UI.revealAnswer({
            answerIndex: index,
            answerName: data.answerName,
            answerValue: data.answerValue,
            playerName: data.playerName,
            points: data.points
          });
        }
      });

      // تحديث النقاط المصغرة
      const playersList = this._formatPlayersList(this.localPlayers);
      UI.updateMiniScores(playersList);

      // تحديث الاقتراحات (إزالة المكتشفة)
      if (window.autocomplete && this.currentQuestion) {
        const allSuggestions = getSuggestionList(this.currentQuestion);
        const filtered = allSuggestions
          .filter(s => !this.discoveredIndices.has(s.index))
          .map(s => ({ name: s.name, aliases: s.aliases }));
        window.autocomplete.setSuggestions(filtered);
      }

      // التحقق من اكتشاف جميع الإجابات
      if (Object.keys(discovered).length >= 10 && this.isHost) {
        this._stopTimer();
        setTimeout(() => {
          this._endRound();
        }, 1500);
      }
    });
    this.listeners.push({ ref: discoveredRef, event: 'value', cb: discoveredCallback });
  },

  // ═══════════════════════════════════
  // المؤقت
  // ═══════════════════════════════════

  /**
   * بدء مؤقت متزامن مع السيرفر
   */
  _startSyncedTimer(roundStartTime) {
    this._stopTimer();

    if (!roundStartTime) return;

    const tick = () => {
      const serverNow = getServerTime();
      const elapsed = Math.floor((serverNow - roundStartTime) / 1000);
      const remaining = Math.max(0, this.totalTime - elapsed);

      UI.updateTimer(remaining, this.totalTime);

      if (remaining <= 0) {
        this._stopTimer();
        UI.elements.answerInput.disabled = true;
        if (window.autocomplete) window.autocomplete.clear();

        // المضيف ينهي الجولة
        if (this.isHost) {
          this._endRound();
        }
      }
    };

    tick();
    this.timerInterval = setInterval(tick, 1000);
  },

  /**
   * إيقاف المؤقت
   */
  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  // ═══════════════════════════════════
  // عرض النتائج
  // ═══════════════════════════════════

  /**
   * عرض نتائج الجولة
   */
  async _showRoundResults() {
    if (!this.currentQuestion) return;

    try {
      const roomSnap = await this.roomRef.once('value');
      const roomData = roomSnap.val();
      const players = roomData.players || {};
      const discovered = roomData.discoveredAnswers || {};

      const fullAnswers = this.currentQuestion.answers.map((answer, index) => ({
        rank: index + 1,
        name: answer.name,
        value: answer.value,
        discovered: !!discovered[index],
        discoveredBy: discovered[index]?.playerName || null
      }));

      const playerScores = Object.values(players)
        .map(p => ({
          name: p.name,
          roundScore: p.roundScore || 0,
          totalScore: p.score || 0
        }))
        .sort((a, b) => b.totalScore - a.totalScore);

      const isLastRound = (roomData.currentRound >= roomData.questionIds.length - 1);

      UI.showRoundResults({
        question: this.currentQuestion.question,
        answers: fullAnswers,
        scores: playerScores,
        isLastRound: isLastRound
      }, this.isHost);

      UI.showScreen('roundResults');
    } catch (error) {
      console.error('خطأ في عرض النتائج:', error);
    }
  },

  /**
   * عرض النتائج النهائية
   */
  async _showFinalResults() {
    try {
      const roomSnap = await this.roomRef.once('value');
      const roomData = roomSnap.val();
      const players = roomData.players || {};

      const rankings = Object.values(players)
        .map(p => ({
          name: p.name,
          totalScore: p.score || 0
        }))
        .sort((a, b) => b.totalScore - a.totalScore);

      UI.showFinalResults({
        rankings: rankings,
        winner: rankings[0]
      }, this.isHost);

      UI.showScreen('final');
    } catch (error) {
      console.error('خطأ في عرض النتائج النهائية:', error);
    }
  },

  // ═══════════════════════════════════
  // أدوات مساعدة
  // ═══════════════════════════════════

  /**
   * تنسيق قائمة اللاعبين
   */
  _formatPlayersList(playersObj) {
    return Object.entries(playersObj || {}).map(([id, p]) => ({
      id: id,
      name: p.name,
      score: p.score || 0,
      isHost: p.isHost || false
    }));
  },

  /**
   * تنظيف جميع المستمعين
   */
  _cleanupListeners() {
    this.listeners.forEach(({ ref, event, cb }) => {
      ref.off(event, cb);
    });
    this.listeners = [];
    this._stopTimer();
  }
};

const { getRandomQuestions, getSuggestionList } = require('./questions');

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
 * كائن الغرفة - يدير لعبة واحدة
 */
class Room {
  /**
   * @param {string} code - كود الغرفة
   * @param {string} hostId - معرف Socket لصاحب الغرفة
   * @param {string} hostName - اسم صاحب الغرفة
   */
  constructor(code, hostId, hostName) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map();
    this.state = 'waiting'; // waiting | playing | round_results | final_results
    this.questions = [];
    this.currentQuestionIndex = -1;
    this.currentQuestion = null;
    this.discoveredAnswers = new Map(); // index -> { playerName, playerId }
    this.roundTimer = null;
    this.roundTimeLeft = 90;
    this.timerInterval = null;
    this.roundsCount = 5;
    this.roundTime = 90; // seconds
    this.createdAt = Date.now();

    // إضافة صاحب الغرفة
    this.addPlayer(hostId, hostName);
  }

  /**
   * إضافة لاعب جديد
   */
  addPlayer(socketId, name) {
    this.players.set(socketId, {
      id: socketId,
      name: name,
      score: 0,
      roundScore: 0,
      isHost: socketId === this.hostId
    });
  }

  /**
   * إزالة لاعب
   */
  removePlayer(socketId) {
    this.players.delete(socketId);
    
    // إذا غادر صاحب الغرفة، تعيين مضيف جديد
    if (socketId === this.hostId && this.players.size > 0) {
      const firstPlayer = this.players.values().next().value;
      this.hostId = firstPlayer.id;
      firstPlayer.isHost = true;
    }
  }

  /**
   * الحصول على قائمة اللاعبين
   */
  getPlayersList() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isHost: p.isHost
    }));
  }

  /**
   * بدء اللعبة
   */
  startGame() {
    if (this.state !== 'waiting') return false;
    if (this.players.size < 1) return false;

    this.state = 'playing';
    this.questions = getRandomQuestions(this.roundsCount);
    this.currentQuestionIndex = -1;
    
    // إعادة تعيين النقاط
    for (const player of this.players.values()) {
      player.score = 0;
    }

    return true;
  }

  /**
   * بدء جولة جديدة
   */
  startNextRound() {
    this.currentQuestionIndex++;
    
    if (this.currentQuestionIndex >= this.questions.length) {
      this.state = 'final_results';
      return null;
    }

    this.currentQuestion = this.questions[this.currentQuestionIndex];
    this.discoveredAnswers = new Map();
    this.roundTimeLeft = this.roundTime;
    
    // إعادة تعيين نقاط الجولة
    for (const player of this.players.values()) {
      player.roundScore = 0;
    }

    this.state = 'playing';

    return {
      questionIndex: this.currentQuestionIndex + 1,
      totalQuestions: this.questions.length,
      question: this.currentQuestion.question,
      category: this.currentQuestion.category,
      suggestions: this.getSuggestions(),
      timeLeft: this.roundTimeLeft
    };
  }

  /**
   * الحصول على قائمة الاقتراحات (بدون الإجابات المكتشفة)
   */
  getSuggestions() {
    const suggestions = getSuggestionList(this.currentQuestion);
    return suggestions.filter(s => !this.discoveredAnswers.has(s.index)).map(s => ({
      name: s.name,
      aliases: s.aliases
    }));
  }

  /**
   * التحقق من إجابة اللاعب
   * @param {string} playerId - معرف اللاعب
   * @param {string} answer - الإجابة المُقدمة
   * @returns {Object|null} نتيجة الإجابة أو null إذا كانت خاطئة
   */
  checkAnswer(playerId, answer) {
    if (!this.currentQuestion || this.state !== 'playing') return null;

    const player = this.players.get(playerId);
    if (!player) return null;

    const normalizedAnswer = normalizeArabic(answer);

    for (let i = 0; i < this.currentQuestion.answers.length; i++) {
      // تخطي الإجابات المكتشفة مسبقاً
      if (this.discoveredAnswers.has(i)) continue;

      const correctAnswer = this.currentQuestion.answers[i];
      const allNames = [correctAnswer.name, ...correctAnswer.aliases].map(n => normalizeArabic(n));

      if (allNames.includes(normalizedAnswer)) {
        // إجابة صحيحة!
        const points = i + 1; // المركز = النقاط
        player.score += points;
        player.roundScore += points;
        
        this.discoveredAnswers.set(i, {
          playerName: player.name,
          playerId: player.id
        });

        return {
          answerIndex: i,
          answerName: correctAnswer.name,
          answerValue: correctAnswer.value,
          playerName: player.name,
          playerId: player.id,
          points: points,
          allDiscovered: this.discoveredAnswers.size === 10
        };
      }
    }

    return null;
  }

  /**
   * الحصول على نتائج الجولة
   */
  getRoundResults() {
    const fullAnswers = this.currentQuestion.answers.map((answer, index) => ({
      rank: index + 1,
      name: answer.name,
      value: answer.value,
      discovered: this.discoveredAnswers.has(index),
      discoveredBy: this.discoveredAnswers.get(index)?.playerName || null
    }));

    const playerScores = Array.from(this.players.values())
      .map(p => ({
        name: p.name,
        roundScore: p.roundScore,
        totalScore: p.score
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    return {
      question: this.currentQuestion.question,
      answers: fullAnswers,
      scores: playerScores,
      isLastRound: this.currentQuestionIndex >= this.questions.length - 1
    };
  }

  /**
   * الحصول على النتائج النهائية
   */
  getFinalResults() {
    const playerScores = Array.from(this.players.values())
      .map(p => ({
        name: p.name,
        totalScore: p.score
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    return {
      rankings: playerScores,
      winner: playerScores[0]
    };
  }

  /**
   * بدء مؤقت الجولة
   * @param {Function} onTick - دالة تُنفذ كل ثانية
   * @param {Function} onEnd - دالة تُنفذ عند انتهاء الوقت
   */
  startTimer(onTick, onEnd) {
    this.stopTimer();
    this.roundTimeLeft = this.roundTime;

    this.timerInterval = setInterval(() => {
      this.roundTimeLeft--;
      onTick(this.roundTimeLeft);

      if (this.roundTimeLeft <= 0) {
        this.stopTimer();
        this.state = 'round_results';
        onEnd();
      }
    }, 1000);
  }

  /**
   * إيقاف المؤقت
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * هل الغرفة فارغة؟
   */
  isEmpty() {
    return this.players.size === 0;
  }

  /**
   * تنظيف الموارد
   */
  destroy() {
    this.stopTimer();
  }
}

module.exports = Room;

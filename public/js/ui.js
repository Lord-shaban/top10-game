/**
 * UI — إدارة واجهة المستخدم (Retro Theme)
 */
const UI = {
  // ─── مراجع العناصر ───
  screens: {
    home: document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    roundResults: document.getElementById('screen-round-results'),
    final: document.getElementById('screen-final'),
  },

  elements: {
    // الشاشة الرئيسية
    playerName: document.getElementById('player-name'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    roomCodeInput: document.getElementById('room-code-input'),
    btnJoinRoom: document.getElementById('btn-join-room'),

    // غرفة الانتظار
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    playersList: document.getElementById('players-list'),
    playersCount: document.getElementById('players-count'),
    btnStartGame: document.getElementById('btn-start-game'),
    waitingMsg: document.getElementById('waiting-msg'),

    // شاشة اللعب
    roundIndicator: document.getElementById('round-indicator'),
    categoryBadge: document.getElementById('category-badge'),
    timerCircle: document.getElementById('timer-circle'),
    timerText: document.getElementById('timer-text'),
    questionText: document.getElementById('question-text'),
    answersGrid: document.getElementById('answers-grid'),
    answerInput: document.getElementById('answer-input'),
    suggestionsList: document.getElementById('suggestions-list'),
    miniScores: document.getElementById('mini-scores'),

    // نتائج الجولة
    resultsQuestionText: document.getElementById('results-question-text'),
    resultsAnswersList: document.getElementById('results-answers-list'),
    resultsScoresList: document.getElementById('results-scores-list'),
    btnNextRound: document.getElementById('btn-next-round'),
    waitingNextRound: document.getElementById('waiting-next-round'),

    // النتائج النهائية
    podium: document.getElementById('podium'),
    finalRankingsList: document.getElementById('final-rankings-list'),
    btnPlayAgain: document.getElementById('btn-play-again'),

    // Toast
    toast: document.getElementById('toast'),

    // Notification
    answerNotification: document.getElementById('answer-notification'),
    notifPlayer: document.getElementById('notif-player'),
    notifAnswer: document.getElementById('notif-answer'),
    notifPoints: document.getElementById('notif-points'),
  },

  // ─── التنقل بين الشاشات ───
  showScreen(screenName) {
    Object.values(this.screens).forEach(screen => {
      screen.classList.remove('active');
    });
    this.screens[screenName].classList.add('active');
    // إعادة تهيئة أيقونات Lucide
    if (typeof lucide !== 'undefined') {
      setTimeout(() => lucide.createIcons(), 50);
    }
  },

  // ─── Toast ───
  showToast(message, duration = 3000) {
    const toast = this.elements.toast;
    const textEl = toast.querySelector('.toast-text');
    if (textEl) {
      textEl.textContent = message;
    } else {
      toast.textContent = message;
    }
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  },

  // ─── إشعار الإجابة الصحيحة ───
  showAnswerNotification(playerName, answerName, points) {
    const notif = this.elements.answerNotification;
    this.elements.notifPlayer.textContent = playerName;
    this.elements.notifAnswer.textContent = answerName;
    this.elements.notifPoints.textContent = `+${points}`;
    
    notif.classList.add('show');
    setTimeout(() => {
      notif.classList.remove('show');
    }, 2500);
  },

  // ─── غرفة الانتظار ───
  updateLobby(roomCode, players, isHost) {
    this.elements.lobbyRoomCode.textContent = roomCode;
    this.elements.playersCount.textContent = `${players.length}/10`;
    
    this.elements.playersList.innerHTML = '';
    players.forEach((player, index) => {
      const li = document.createElement('li');
      li.className = 'player-item';
      li.innerHTML = `
        <div class="player-avatar avatar-color-${index % 10}">
          ${player.name.charAt(0)}
        </div>
        <span class="player-name">${player.name}</span>
        ${player.isHost ? '<span class="host-badge">HOST</span>' : ''}
      `;
      this.elements.playersList.appendChild(li);
    });

    // إظهار/إخفاء زر بدء اللعبة
    if (isHost) {
      this.elements.btnStartGame.style.display = 'flex';
      this.elements.waitingMsg.style.display = 'none';
    } else {
      this.elements.btnStartGame.style.display = 'none';
      this.elements.waitingMsg.style.display = 'flex';
    }
  },

  // ─── شاشة اللعب ───
  initGameScreen(data) {
    this.elements.roundIndicator.innerHTML = `
      <i data-lucide="repeat" class="icon-xs"></i>
      الجولة ${data.questionIndex}/${data.totalQuestions}
    `;
    this.elements.categoryBadge.innerHTML = `
      <i data-lucide="tag" class="icon-xs"></i>
      ${data.category}
    `;
    this.elements.questionText.textContent = data.question;
    this.elements.answerInput.value = '';
    this.elements.answerInput.disabled = false;

    // إعداد خانات الإجابات
    this.elements.answersGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const slot = document.createElement('div');
      slot.className = 'answer-slot';
      slot.id = `answer-slot-${i}`;
      slot.innerHTML = `
        <div class="answer-rank">${i + 1}</div>
        <span class="answer-name">???</span>
        <span class="answer-value"></span>
        <span class="answer-discoverer"></span>
        <span class="answer-points">${i + 1} pt</span>
      `;
      this.elements.answersGrid.appendChild(slot);
    }

    // تحديث المؤقت
    this.updateTimer(data.timeLeft, data.timeLeft);
    
    // إعادة تهيئة Lucide
    if (typeof lucide !== 'undefined') {
      setTimeout(() => lucide.createIcons(), 50);
    }
  },

  // ─── تحديث المؤقت ───
  updateTimer(timeLeft, totalTime) {
    const timerText = this.elements.timerText;
    const timerCircle = this.elements.timerCircle;
    
    timerText.textContent = timeLeft;

    // حساب stroke-dashoffset
    const circumference = 2 * Math.PI * 45; // r = 45
    const progress = timeLeft / totalTime;
    timerCircle.style.strokeDashoffset = circumference * (1 - progress);

    // تغيير اللون حسب الوقت المتبقي
    timerText.className = 'timer-text';
    timerCircle.className = 'timer-ring-fg';

    if (timeLeft <= 10) {
      timerText.classList.add('danger');
      timerCircle.classList.add('danger');
    } else if (timeLeft <= 30) {
      timerText.classList.add('warning');
      timerCircle.classList.add('warning');
    }
  },

  // ─── عرض إجابة صحيحة ───
  revealAnswer(data) {
    const slot = document.getElementById(`answer-slot-${data.answerIndex}`);
    if (!slot) return;

    slot.classList.add('discovered');
    slot.querySelector('.answer-name').textContent = data.answerName;
    slot.querySelector('.answer-value').textContent = data.answerValue;
    slot.querySelector('.answer-discoverer').textContent = data.playerName;

    // إشعار
    this.showAnswerNotification(data.playerName, data.answerName, data.points);
  },

  // ─── تحديث لوحة النقاط المصغرة ───
  updateMiniScores(players) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    this.elements.miniScores.innerHTML = '';
    
    sorted.forEach(player => {
      const li = document.createElement('li');
      li.className = 'mini-score-item';
      li.innerHTML = `
        <span class="mini-score-name">${player.name}</span>
        <span class="mini-score-value">${player.score}</span>
      `;
      this.elements.miniScores.appendChild(li);
    });
  },

  // ─── نتائج الجولة ───
  showRoundResults(data, isHost) {
    this.elements.resultsQuestionText.textContent = data.question;

    // قائمة الإجابات
    this.elements.resultsAnswersList.innerHTML = '';
    data.answers.forEach((answer, index) => {
      const li = document.createElement('li');
      li.className = `results-answer-item ${answer.discovered ? 'was-discovered' : 'was-missed'}`;
      li.style.animationDelay = `${index * 0.08}s`;
      li.innerHTML = `
        <div class="results-rank">${answer.rank}</div>
        <span class="results-answer-name">${answer.name}</span>
        <span class="results-answer-value">${answer.value}</span>
        ${answer.discovered ? `<span class="results-answer-discoverer">${answer.discoveredBy}</span>` : ''}
      `;
      this.elements.resultsAnswersList.appendChild(li);
    });

    // ترتيب اللاعبين
    this.elements.resultsScoresList.innerHTML = '';
    const medals = ['1st', '2nd', '3rd'];
    data.scores.forEach((player, index) => {
      const pos = index < 3 ? medals[index] : `${index + 1}th`;
      const li = document.createElement('li');
      li.className = 'results-score-item';
      li.style.animationDelay = `${index * 0.1}s`;
      li.innerHTML = `
        <span class="results-score-position">${pos}</span>
        <span class="results-score-name">${player.name}</span>
        <span class="results-score-round">+${player.roundScore}</span>
        <span class="results-score-total">${player.totalScore}</span>
      `;
      this.elements.resultsScoresList.appendChild(li);
    });

    // أزرار
    if (isHost) {
      if (data.isLastRound) {
        this.elements.btnNextRound.innerHTML = '<i data-lucide="trophy" class="btn-ic"></i> عرض النتائج النهائية';
      } else {
        this.elements.btnNextRound.innerHTML = '<i data-lucide="arrow-left" class="btn-ic"></i> الجولة التالية';
      }
      this.elements.btnNextRound.style.display = 'flex';
      this.elements.waitingNextRound.style.display = 'none';
    } else {
      this.elements.btnNextRound.style.display = 'none';
      this.elements.waitingNextRound.style.display = 'flex';
    }

    if (typeof lucide !== 'undefined') {
      setTimeout(() => lucide.createIcons(), 50);
    }
  },

  // ─── النتائج النهائية ───
  showFinalResults(data, isHost) {
    const rankings = data.rankings;

    // المنصة
    this.elements.podium.innerHTML = '';
    
    const podiumOrder = [1, 0, 2]; // فضي، ذهبي، برونزي
    const barClasses = ['second', 'first', 'third'];
    const medalLabels = ['2nd', '1st', '3rd'];

    podiumOrder.forEach((rankIndex, displayIndex) => {
      if (rankIndex >= rankings.length) return;
      
      const player = rankings[rankIndex];
      const div = document.createElement('div');
      div.className = 'podium-place';
      div.style.animationDelay = `${displayIndex * 0.2}s`;
      div.innerHTML = `
        <div class="podium-avatar avatar-color-${rankIndex % 10}">
          ${player.name.charAt(0)}
        </div>
        <div class="podium-name">${player.name}</div>
        <div class="podium-score">${player.totalScore} PTS</div>
        <div class="podium-bar ${barClasses[displayIndex]}">${medalLabels[displayIndex]}</div>
      `;
      this.elements.podium.appendChild(div);
    });

    // الترتيب الكامل
    this.elements.finalRankingsList.innerHTML = '';
    const rankMedals = ['1st', '2nd', '3rd'];
    rankings.forEach((player, index) => {
      const pos = index < 3 ? rankMedals[index] : `${index + 1}th`;
      const li = document.createElement('li');
      li.className = 'final-rank-item';
      li.innerHTML = `
        <span class="final-rank-position">${pos}</span>
        <span class="final-rank-name">${player.name}</span>
        <span class="final-rank-score">${player.totalScore} PTS</span>
      `;
      this.elements.finalRankingsList.appendChild(li);
    });

    // زر إعادة اللعب
    if (isHost) {
      this.elements.btnPlayAgain.style.display = 'flex';
    } else {
      this.elements.btnPlayAgain.style.display = 'none';
    }

    if (typeof lucide !== 'undefined') {
      setTimeout(() => lucide.createIcons(), 50);
    }

    // تأثير الاحتفال
    this.launchConfetti();
  },

  // ─── تأثير الاحتفال ───
  launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#39ff14', '#ffe600', '#00e5ff', '#ff2d6b', '#b44dff', '#ff6f00'];
    
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDuration = `${2 + Math.random() * 3}s`;
      confetti.style.animationDelay = `${Math.random() * 2}s`;
      const size = 6 + Math.random() * 8;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      confetti.style.borderRadius = '0'; // مربعات بيكسل ريترو
      container.appendChild(confetti);
    }

    setTimeout(() => {
      container.remove();
    }, 6000);
  },

  // ─── تأثير الاهتزاز ───
  shakeInput() {
    this.elements.answerInput.classList.add('shake');
    setTimeout(() => {
      this.elements.answerInput.classList.remove('shake');
    }, 400);
  },

  // ─── إنذار الخروج ───
  showWarningToast(warningCount, remaining) {
    // إنشاء عنصر الإنذار
    const overlay = document.createElement('div');
    overlay.className = 'warning-toast-overlay';
    overlay.innerHTML = `
      <div class="warning-toast-box retro-border">
        <div class="warning-icon-big">⚠️</div>
        <div class="warning-title">إنذار!</div>
        <div class="warning-message">
          لقد خرجت من اللعبة أثناء الجولة!
        </div>
        <div class="warning-count">
          <span class="warning-dots">
            ${'🔴'.repeat(warningCount)}${'⚪'.repeat(remaining)}
          </span>
          <span>إنذار ${warningCount} من 3</span>
        </div>
        ${remaining > 0 
          ? `<div class="warning-remaining">⚠️ متبقي لك ${remaining} ${remaining === 1 ? 'إنذار' : 'إنذارات'} قبل الحظر</div>`
          : ''
        }
        <button class="btn btn-primary warning-dismiss-btn" onclick="this.closest('.warning-toast-overlay').remove()">
          فهمت
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // إزالة تلقائية بعد 5 ثواني
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 5000);
  },

  // ─── شاشة الحظر ───
  showBlockOverlay() {
    // إزالة أي overlay سابق
    this.hideBlockOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'block-overlay';
    overlay.className = 'block-overlay';
    overlay.innerHTML = `
      <div class="block-box retro-border">
        <div class="block-icon">⛔</div>
        <div class="block-title">تم حظرك!</div>
        <div class="block-message">
          حصلت على 3 إنذارات بسبب الخروج من اللعبة.<br>
          لا يمكنك الإجابة حتى تنتهي هذه الجولة.
        </div>
        <div class="block-dots">🔴🔴🔴</div>
        <div class="block-wait">انتظر الجولة القادمة...</div>
      </div>
    `;
    
    // إضافة الـ overlay فوق حقل الإدخال
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) {
      gameScreen.appendChild(overlay);
    }
  },

  hideBlockOverlay() {
    const existing = document.getElementById('block-overlay');
    if (existing) existing.remove();
  }
};

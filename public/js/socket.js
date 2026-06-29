/**
 * Socket — اتصال Socket.IO بالخادم
 */
const SocketClient = {
  socket: null,
  isHost: false,
  roomCode: null,
  playerName: null,
  totalTime: 90,

  /**
   * تهيئة الاتصال
   */
  init() {
    this.socket = io();

    this._bindEvents();
  },

  /**
   * ربط أحداث Socket.IO
   */
  _bindEvents() {
    // ─── أحداث الاتصال ───
    this.socket.on('connect', () => {
      console.log('🟢 متصل بالخادم');
    });

    this.socket.on('disconnect', () => {
      console.log('🔴 انقطع الاتصال');
      UI.showToast('انقطع الاتصال بالخادم! يرجى تحديث الصفحة.');
    });

    // ─── رسائل الخطأ ───
    this.socket.on('error-msg', ({ message }) => {
      UI.showToast(message);
    });

    // ─── الغرفة ───
    this.socket.on('room-created', ({ roomCode, players }) => {
      this.roomCode = roomCode;
      this.isHost = true;
      UI.updateLobby(roomCode, players, true);
      UI.showScreen('lobby');
    });

    this.socket.on('room-joined', ({ roomCode, players }) => {
      this.roomCode = roomCode;
      this.isHost = false;
      UI.updateLobby(roomCode, players, false);
      UI.showScreen('lobby');
    });

    this.socket.on('player-joined', ({ players, newPlayer }) => {
      UI.updateLobby(this.roomCode, players, this.isHost);
      UI.showToast(`${newPlayer} انضم للغرفة! 👋`, 2000);
    });

    this.socket.on('player-left', ({ playerName, players, newHostId }) => {
      // التحقق إذا أصبحت أنت المضيف
      if (newHostId === this.socket.id) {
        this.isHost = true;
      }
      UI.updateLobby(this.roomCode, players, this.isHost);
      UI.showToast(`${playerName} غادر الغرفة`, 2000);
    });

    // ─── اللعبة ───
    this.socket.on('game-started', ({ totalRounds }) => {
      // تظهر رسالة بدء
    });

    this.socket.on('new-round', (data) => {
      this.totalTime = data.timeLeft;
      UI.initGameScreen(data);
      UI.updateMiniScores([]); // سيتم تحديثه مع أول إجابة
      
      // تحديث الاقتراحات في Autocomplete
      if (window.autocomplete) {
        window.autocomplete.setSuggestions(data.suggestions);
        window.autocomplete.clear();
      }
      
      UI.showScreen('game');
      UI.elements.answerInput.focus();
    });

    this.socket.on('correct-answer', (data) => {
      UI.revealAnswer(data);
      UI.updateMiniScores(data.players);
      
      // تحديث الاقتراحات
      if (window.autocomplete && data.updatedSuggestions) {
        window.autocomplete.setSuggestions(data.updatedSuggestions);
      }
    });

    this.socket.on('wrong-answer', () => {
      UI.shakeInput();
    });

    this.socket.on('timer-update', ({ timeLeft }) => {
      UI.updateTimer(timeLeft, this.totalTime);
    });

    this.socket.on('round-end', (data) => {
      UI.elements.answerInput.disabled = true;
      if (window.autocomplete) {
        window.autocomplete.clear();
      }
      
      UI.showRoundResults(data, this.isHost);
      UI.showScreen('roundResults');
    });

    this.socket.on('game-end', (data) => {
      UI.showFinalResults(data, this.isHost);
      UI.showScreen('final');
    });

    this.socket.on('back-to-lobby', ({ players }) => {
      UI.updateLobby(this.roomCode, players, this.isHost);
      UI.showScreen('lobby');
    });
  },

  // ─── إرسال الأحداث ───
  
  createRoom(playerName) {
    this.playerName = playerName;
    this.socket.emit('create-room', { playerName });
  },

  joinRoom(roomCode, playerName) {
    this.playerName = playerName;
    this.socket.emit('join-room', { roomCode, playerName });
  },

  startGame() {
    this.socket.emit('start-game');
  },

  submitAnswer(answer) {
    this.socket.emit('submit-answer', { answer });
  },

  nextRound() {
    this.socket.emit('next-round');
  },

  playAgain() {
    this.socket.emit('play-again');
  }
};

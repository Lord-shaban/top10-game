const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const gameManager = new GameManager();

// تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// تنظيف الغرف القديمة كل 30 دقيقة
setInterval(() => {
  gameManager.cleanupStaleRooms();
}, 30 * 60 * 1000);

// ==============================
// Socket.IO Events
// ==============================

io.on('connection', (socket) => {
  console.log(`✅ لاعب اتصل: ${socket.id}`);

  // ─── إنشاء غرفة ───
  socket.on('create-room', ({ playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error-msg', { message: 'يرجى إدخال اسم اللاعب' });
      return;
    }

    const room = gameManager.createRoom(socket.id, playerName.trim());
    socket.join(room.code);
    
    socket.emit('room-created', {
      roomCode: room.code,
      players: room.getPlayersList()
    });

    console.log(`🏠 غرفة جديدة: ${room.code} بواسطة ${playerName}`);
  });

  // ─── الانضمام لغرفة ───
  socket.on('join-room', ({ roomCode, playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error-msg', { message: 'يرجى إدخال اسم اللاعب' });
      return;
    }
    if (!roomCode || roomCode.trim().length === 0) {
      socket.emit('error-msg', { message: 'يرجى إدخال كود الغرفة' });
      return;
    }

    const result = gameManager.joinRoom(roomCode.trim(), socket.id, playerName.trim());
    
    if (!result.success) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    socket.join(result.room.code);
    
    socket.emit('room-joined', {
      roomCode: result.room.code,
      players: result.room.getPlayersList()
    });

    // إعلام باقي اللاعبين
    socket.to(result.room.code).emit('player-joined', {
      players: result.room.getPlayersList(),
      newPlayer: playerName.trim()
    });

    console.log(`👤 ${playerName} انضم للغرفة ${roomCode}`);
  });

  // ─── بدء اللعبة ───
  socket.on('start-game', () => {
    const room = gameManager.getPlayerRoom(socket.id);
    if (!room) return;
    
    if (room.hostId !== socket.id) {
      socket.emit('error-msg', { message: 'فقط صاحب الغرفة يمكنه بدء اللعبة' });
      return;
    }

    if (room.players.size < 1) {
      socket.emit('error-msg', { message: 'يجب أن يكون هناك لاعب واحد على الأقل' });
      return;
    }

    if (!room.startGame()) {
      socket.emit('error-msg', { message: 'لا يمكن بدء اللعبة' });
      return;
    }

    io.to(room.code).emit('game-started', {
      totalRounds: room.questions.length
    });

    // بدء الجولة الأولى بعد تأخير قصير
    setTimeout(() => {
      startNewRound(room);
    }, 1500);

    console.log(`🎮 اللعبة بدأت في الغرفة ${room.code}`);
  });

  // ─── إرسال إجابة ───
  socket.on('submit-answer', ({ answer }) => {
    const room = gameManager.getPlayerRoom(socket.id);
    if (!room || room.state !== 'playing') return;

    const result = room.checkAnswer(socket.id, answer);
    
    if (result) {
      // إجابة صحيحة - إرسال لجميع اللاعبين
      io.to(room.code).emit('correct-answer', {
        answerIndex: result.answerIndex,
        answerName: result.answerName,
        answerValue: result.answerValue,
        playerName: result.playerName,
        points: result.points,
        players: room.getPlayersList(),
        updatedSuggestions: room.getSuggestions()
      });

      // التحقق من اكتشاف جميع الإجابات
      if (result.allDiscovered) {
        room.stopTimer();
        room.state = 'round_results';
        
        setTimeout(() => {
          io.to(room.code).emit('round-end', room.getRoundResults());
        }, 1500);
      }
    } else {
      // إجابة خاطئة
      socket.emit('wrong-answer', { answer });
    }
  });

  // ─── الجولة التالية ───
  socket.on('next-round', () => {
    const room = gameManager.getPlayerRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return;

    startNewRound(room);
  });

  // ─── إعادة اللعب ───
  socket.on('play-again', () => {
    const room = gameManager.getPlayerRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return;

    room.state = 'waiting';
    room.currentQuestionIndex = -1;
    room.questions = [];
    
    for (const player of room.players.values()) {
      player.score = 0;
      player.roundScore = 0;
    }

    io.to(room.code).emit('back-to-lobby', {
      players: room.getPlayersList()
    });
  });

  // ─── انفصال اللاعب ───
  socket.on('disconnect', () => {
    const result = gameManager.removePlayer(socket.id);
    
    if (result && !result.roomDestroyed) {
      const room = gameManager.getRoom(result.roomCode);
      if (room) {
        io.to(result.roomCode).emit('player-left', {
          playerName: result.playerName,
          players: room.getPlayersList(),
          newHostId: result.newHostId
        });
      }
    }

    console.log(`❌ لاعب غادر: ${socket.id}`);
  });
});

/**
 * بدء جولة جديدة في غرفة
 */
function startNewRound(room) {
  const roundData = room.startNextRound();
  
  if (!roundData) {
    // انتهت جميع الجولات
    io.to(room.code).emit('game-end', room.getFinalResults());
    return;
  }

  io.to(room.code).emit('new-round', roundData);

  // بدء المؤقت
  room.startTimer(
    (timeLeft) => {
      io.to(room.code).emit('timer-update', { timeLeft });
    },
    () => {
      io.to(room.code).emit('round-end', room.getRoundResults());
    }
  );
}

// ─── بدء الخادم ───
server.listen(PORT, () => {
  console.log(`\n🚀 ══════════════════════════════════════`);
  console.log(`   خادم Top 10 يعمل على المنفذ ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`══════════════════════════════════════\n`);
});

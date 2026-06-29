const Room = require('./Room');

/**
 * مدير الألعاب - يدير جميع الغرف النشطة
 */
class GameManager {
  constructor() {
    this.rooms = new Map(); // code -> Room
    this.playerRooms = new Map(); // socketId -> roomCode
  }

  /**
   * توليد كود فريد للغرفة (6 أحرف/أرقام)
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون حروف متشابهة
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * إنشاء غرفة جديدة
   * @param {string} hostId - معرف Socket لصاحب الغرفة
   * @param {string} hostName - اسم صاحب الغرفة
   * @returns {Room} الغرفة المُنشأة
   */
  createRoom(hostId, hostName) {
    const code = this.generateRoomCode();
    const room = new Room(code, hostId, hostName);
    this.rooms.set(code, room);
    this.playerRooms.set(hostId, code);
    return room;
  }

  /**
   * الانضمام لغرفة
   * @param {string} code - كود الغرفة
   * @param {string} playerId - معرف Socket للاعب
   * @param {string} playerName - اسم اللاعب
   * @returns {Object} نتيجة الانضمام
   */
  joinRoom(code, playerId, playerName) {
    const room = this.rooms.get(code.toUpperCase());
    
    if (!room) {
      return { success: false, error: 'الغرفة غير موجودة' };
    }
    
    if (room.state !== 'waiting') {
      return { success: false, error: 'اللعبة بدأت بالفعل' };
    }
    
    if (room.players.size >= 10) {
      return { success: false, error: 'الغرفة ممتلئة (الحد الأقصى 10 لاعبين)' };
    }

    // التحقق من عدم تكرار الاسم
    const nameExists = Array.from(room.players.values()).some(
      p => p.name === playerName
    );
    if (nameExists) {
      return { success: false, error: 'هذا الاسم مُستخدم بالفعل في هذه الغرفة' };
    }

    room.addPlayer(playerId, playerName);
    this.playerRooms.set(playerId, code.toUpperCase());
    
    return { success: true, room };
  }

  /**
   * الحصول على غرفة بالكود
   */
  getRoom(code) {
    return this.rooms.get(code.toUpperCase());
  }

  /**
   * الحصول على غرفة اللاعب
   */
  getPlayerRoom(playerId) {
    const code = this.playerRooms.get(playerId);
    if (!code) return null;
    return this.rooms.get(code);
  }

  /**
   * إزالة لاعب من غرفته
   * @param {string} playerId - معرف Socket للاعب
   * @returns {Object|null} معلومات الغرفة المتأثرة
   */
  removePlayer(playerId) {
    const code = this.playerRooms.get(playerId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    const playerName = room.players.get(playerId)?.name;
    room.removePlayer(playerId);
    this.playerRooms.delete(playerId);

    // تنظيف الغرفة إذا كانت فارغة
    if (room.isEmpty()) {
      room.destroy();
      this.rooms.delete(code);
      return { roomCode: code, playerName, roomDestroyed: true };
    }

    return { 
      roomCode: code, 
      playerName, 
      roomDestroyed: false, 
      newHostId: room.hostId 
    };
  }

  /**
   * تنظيف الغرف القديمة (أكثر من ساعتين)
   */
  cleanupStaleRooms() {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    for (const [code, room] of this.rooms) {
      if (room.createdAt < twoHoursAgo) {
        room.destroy();
        for (const playerId of room.players.keys()) {
          this.playerRooms.delete(playerId);
        }
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = GameManager;

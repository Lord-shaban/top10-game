/**
 * Dashboard Logic — إدارة لوحة التحكم والإحصائيات
 */
(function() {
  'use strict';

  // ═══════════════════════════════════
  // تهيئة المتغيرات والتحقق من الدخول
  // ═══════════════════════════════════
  const DEFAULT_PASSCODE = 'lord';
  let activeRoomCode = null;
  let activeRoomsData = {};
  let statsData = {};

  const elements = {
    loginGate: document.getElementById('login-gate'),
    dashboardContent: document.getElementById('dashboard-content'),
    adminPasscode: document.getElementById('admin-passcode'),
    btnLoginAdmin: document.getElementById('btn-login-admin'),
    btnLogout: document.getElementById('btn-logout'),
    btnCleanDb: document.getElementById('btn-clean-db'),

    // الإحصائيات العامة
    statTotalRooms: document.getElementById('stat-total-rooms'),
    statTotalPlayers: document.getElementById('stat-total-players'),
    statTotalFinished: document.getElementById('stat-total-finished'),
    statTotalAnswers: document.getElementById('stat-total-answers'),

    // الإحصائيات اللحظية والتحليلات المضافة
    liveActiveRooms: document.getElementById('live-active-rooms'),
    liveOnlinePlayers: document.getElementById('live-online-players'),
    statAvgPlayers: document.getElementById('stat-avg-players'),
    statHottestRoom: document.getElementById('stat-hottest-room'),
    statPlayingRatio: document.getElementById('stat-playing-ratio'),
    popularCategoriesList: document.getElementById('popular-categories-list'),

    // الغرف والأسئلة الشائعة
    activeRoomsTbody: document.getElementById('active-rooms-tbody'),
    popularQuestionsList: document.getElementById('popular-questions-list'),

    // مودال تفاصيل الغرفة
    roomDetailModal: document.getElementById('room-detail-modal'),
    modalRoomCode: document.getElementById('modal-room-code'),
    modalRoomState: document.getElementById('modal-room-state'),
    modalRoomRound: document.getElementById('modal-room-round'),
    modalQuestionBlock: document.getElementById('modal-question-block'),
    modalQuestionCategory: document.getElementById('modal-question-category'),
    modalQuestionText: document.getElementById('modal-question-text'),
    modalPlayersTbody: document.getElementById('modal-players-tbody'),
    modalAnswersGrid: document.getElementById('modal-answers-grid'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalForceEnd: document.getElementById('btn-modal-force-end'),
    btnModalDeleteRoom: document.getElementById('btn-modal-delete-room'),

    // نافذة التأكيد المخصصة
    customConfirmModal: document.getElementById('custom-confirm-modal'),
    confirmMessageText: document.getElementById('confirm-message-text'),
    btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
    btnConfirmOk: document.getElementById('btn-confirm-ok'),

    // التنبيهات
    toast: document.getElementById('toast')
  };

  // التحقق من حالة تسجيل الدخول السابقة
  if (localStorage.getItem('admin_logged_in') === 'true') {
    showDashboard();
  }

  // الضغط على زر الدخول
  elements.btnLoginAdmin.addEventListener('click', () => {
    const code = elements.adminPasscode.value.trim();
    if (code === DEFAULT_PASSCODE) {
      localStorage.setItem('admin_logged_in', 'true');
      showDashboard();
      elements.adminPasscode.value = '';
    } else {
      showToast('رمز المرور خاطئ! يرجى المحاولة مرة أخرى.');
      elements.adminPasscode.classList.add('shake');
      setTimeout(() => elements.adminPasscode.classList.remove('shake'), 400);
      elements.adminPasscode.focus();
    }
  });

  // Enter في حقل الباسورد
  elements.adminPasscode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      elements.btnLoginAdmin.click();
    }
  });

  // قفل لوحة التحكم
  elements.btnLogout.addEventListener('click', () => {
    localStorage.removeItem('admin_logged_in');
    location.reload();
  });

  // ═══════════════════════════════════
  // تفعيل وعرض لوحة التحكم والاشتراكات
  // ═══════════════════════════════════
  function showDashboard() {
    elements.loginGate.classList.remove('active');
    elements.dashboardContent.classList.add('active');
    
    // بدء مستمعي Firebase
    initFirebaseListeners();

    // تشغيل التنظيف التلقائي الصامت
    runSilentAutoCleanup();
  }

  function initFirebaseListeners() {
    // 1. مستمع الإحصائيات العامة
    db.ref('stats').on('value', (snapshot) => {
      statsData = snapshot.val() || {};
      renderGlobalStats();
    });

    // 2. مستمع الغرف النشطة
    db.ref('rooms').on('value', (snapshot) => {
      activeRoomsData = snapshot.val() || {};
      renderActiveRooms();
      renderRealtimeIndicatorStats();
      if (activeRoomCode) {
        updateModalData();
      }
    });
  }

  // ═══════════════════════════════════
  // عرض البيانات والإحصائيات
  // ═══════════════════════════════════

  // عرض الإحصائيات التراكمية
  function renderGlobalStats() {
    elements.statTotalRooms.textContent = statsData.totalRoomsCreated || 0;
    elements.statTotalPlayers.textContent = statsData.totalPlayersJoined || 0;
    elements.statTotalFinished.textContent = statsData.totalGamesFinished || 0;
    elements.statTotalAnswers.textContent = statsData.totalAnswersDiscovered || 0;

    // معالجة الأسئلة الأكثر شعبية والـ categories
    const popularQs = statsData.popularQuestions || {};
    
    // تجميع الإحصائيات حسب الفئة
    const categoryCounts = {};
    Object.entries(popularQs).forEach(([id, count]) => {
      const qObj = questions.find(q => q.id === id);
      if (qObj && qObj.category) {
        categoryCounts[qObj.category] = (categoryCounts[qObj.category] || 0) + count;
      }
    });

    const sortedCategories = Object.entries(categoryCounts)
      .map(([catName, count]) => ({ name: catName, count: count }))
      .sort((a, b) => b.count - a.count);

    elements.popularCategoriesList.innerHTML = '';
    if (sortedCategories.length === 0) {
      elements.popularCategoriesList.innerHTML = '<div class="list-empty">لا توجد تصنيفات لعب مسجلة بعد.</div>';
    } else {
      const maxCatCount = sortedCategories[0].count || 1;
      sortedCategories.forEach(item => {
        const percentage = Math.round((item.count / maxCatCount) * 100);
        const div = document.createElement('div');
        div.className = 'popular-item';
        div.innerHTML = `
          <div class="popular-item-info">
            <span class="popular-item-name">${item.name}</span>
            <span class="popular-item-count">${item.count} مرة</span>
          </div>
          <div class="popular-item-bar-bg">
            <div class="popular-item-bar-fg" style="width: ${percentage}%; background: linear-gradient(to left, var(--neon-pink), var(--neon-purple));"></div>
          </div>
        `;
        elements.popularCategoriesList.appendChild(div);
      });
    }

    const sortedQs = Object.entries(popularQs)
      .map(([id, count]) => {
        // البحث عن السؤال محلياً بالـ id
        const qObj = questions.find(q => q.id === id);
        return {
          id: id,
          text: qObj ? qObj.question : `سؤال غير معروف (${id})`,
          count: count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // عرض أفضل 5 أسئلة فقط

    elements.popularQuestionsList.innerHTML = '';
    
    if (sortedQs.length === 0) {
      elements.popularQuestionsList.innerHTML = '<div class="list-empty">لا توجد إحصائيات لعب مسجلة بعد.</div>';
      return;
    }

    const maxCount = sortedQs[0].count || 1;

    sortedQs.forEach(item => {
      const percentage = Math.round((item.count / maxCount) * 100);
      const div = document.createElement('div');
      div.className = 'popular-item';
      div.innerHTML = `
        <div class="popular-item-info">
          <span class="popular-item-name" title="${item.text}">${item.text}</span>
          <span class="popular-item-count">${item.count} مرة</span>
        </div>
        <div class="popular-item-bar-bg">
          <div class="popular-item-bar-fg" style="width: ${percentage}%"></div>
        </div>
      `;
      elements.popularQuestionsList.appendChild(div);
    });
  }

  // حساب الأرقام اللحظية (غرف نشطة ولاعبين متصلين)
  function renderRealtimeIndicatorStats() {
    const entries = Object.entries(activeRoomsData);
    let onlineCount = 0;
    let activeRoomsCount = 0;
    
    let totalRooms = entries.length;
    let totalPlayers = 0;
    let playingRoomsCount = 0;
    let maxPlayers = 0;
    let hottestRoomCode = 'لا توجد';

    entries.forEach(([code, room]) => {
      if (room.state !== 'finished') {
        activeRoomsCount++;
      }
      if (room.state === 'playing') {
        playingRoomsCount++;
      }
      
      const players = room.players || {};
      const pCount = Object.keys(players).length;
      totalPlayers += pCount;

      if (pCount > maxPlayers) {
        maxPlayers = pCount;
        hottestRoomCode = `${code} (${pCount} لاعب)`;
      }

      Object.values(players).forEach(p => {
        if (p.online !== false) {
          onlineCount++;
        }
      });
    });

    elements.liveActiveRooms.textContent = activeRoomsCount;
    elements.liveOnlinePlayers.textContent = onlineCount;

    // حساب متوسط اللاعبين في الغرف
    const avgPlayers = totalRooms > 0 ? (totalPlayers / totalRooms).toFixed(1) : 0;
    elements.statAvgPlayers.textContent = avgPlayers;

    // الغرفة الأكثر نشاطا
    elements.statHottestRoom.textContent = hottestRoomCode;

    // نسبة الغرف التي تلعب حالياً
    elements.statPlayingRatio.textContent = `${playingRoomsCount} / ${totalRooms}`;
  }

  // عرض جدول الغرف النشطة
  function renderActiveRooms() {
    elements.activeRoomsTbody.innerHTML = '';
    const roomEntries = Object.entries(activeRoomsData);

    if (roomEntries.length === 0) {
      elements.activeRoomsTbody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty">لا توجد غرف نشطة حالياً في قاعدة البيانات.</td>
        </tr>
      `;
      return;
    }

    // ترتيب الغرف تنازلياً حسب تاريخ الإنشاء
    roomEntries.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    roomEntries.forEach(([code, room]) => {
      const tr = document.createElement('tr');
      
      // اسم المضيف
      let hostName = 'غير معروف';
      const players = room.players || {};
      const host = Object.values(players).find(p => p.isHost === true);
      if (host) {
        hostName = host.name;
      } else if (room.hostId && players[room.hostId]) {
        hostName = players[room.hostId].name;
      }

      // حساب عدد اللاعبين
      const pCount = Object.keys(players).length;

      // الوقت المنقضي
      const createdTime = room.createdAt ? formatTimeAgo(room.createdAt) : 'غير متوفر';

      // ترجمة حالة الغرفة
      const stateLabels = {
        'waiting': 'انتظار المضيف',
        'starting': 'بدء اللعب',
        'playing': 'جولة نشطة',
        'round_results': 'نتائج الجولة',
        'finished': 'انتهت اللعبة'
      };
      const stateLabel = stateLabels[room.state] || room.state || 'انتظار';

      // الجولة الحالية
      let roundText = 'Lobby';
      if (room.state !== 'waiting' && room.currentRound !== undefined && room.currentRound !== null) {
        const roundNum = room.currentRound + 1;
        const totalNum = room.totalRounds || (room.questionIds ? room.questionIds.length : 5);
        roundText = `الجولة ${roundNum}/${totalNum}`;
      }

      tr.innerHTML = `
        <td><strong class="neon-text">${code}</strong></td>
        <td>${hostName}</td>
        <td><span class="badge ${room.state || 'waiting'}">${stateLabel}</span></td>
        <td>${roundText}</td>
        <td>${pCount}/10</td>
        <td>${createdTime}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-manage" data-code="${code}">إدارة التفاصيل</button>
          <button class="btn btn-danger btn-sm btn-delete-room" data-code="${code}">حذف</button>
        </td>
      `;

      elements.activeRoomsTbody.appendChild(tr);
    });

    // ربط الأحداث للأزرار الجديدة
    document.querySelectorAll('.btn-manage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        openRoomModal(code);
      });
    });

    document.querySelectorAll('.btn-delete-room').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        showConfirm(`هل أنت متأكد من حذف الغرفة ${code} بالكامل؟ سيتم طرد جميع اللاعبين فيها.`, () => {
          deleteRoom(code);
        });
      });
    });
  }

  // ═══════════════════════════════════
  // إدارة المودال وتفاصيل الغرفة المحددة
  // ═══════════════════════════════════
  function openRoomModal(code) {
    activeRoomCode = code;
    elements.modalRoomCode.textContent = code;
    elements.roomDetailModal.classList.add('active');
    updateModalData();
  }

  function updateModalData() {
    const room = activeRoomsData[activeRoomCode];
    if (!room) {
      // الغرفة حذفت أثناء عرض المودال
      closeModal();
      showToast('تم إغلاق الغرفة المحددة بواسطة نظام آخر');
      return;
    }

    // 1. تحديث الحالة والجولة
    const stateLabels = {
      'waiting': 'انتظار المضيف',
      'starting': 'بدء اللعب',
      'playing': 'جولة نشطة',
      'round_results': 'نتائج الجولة',
      'finished': 'انتهت اللعبة'
    };
    elements.modalRoomState.textContent = stateLabels[room.state] || room.state || 'انتظار';
    elements.modalRoomState.className = `badge ${room.state || 'waiting'}`;

    let roundText = 'Lobby';
    if (room.state !== 'waiting' && room.currentRound !== undefined && room.currentRound !== null) {
      const roundNum = room.currentRound + 1;
      const totalNum = room.totalRounds || (room.questionIds ? room.questionIds.length : 5);
      roundText = `الجولة ${roundNum}/${totalNum}`;
    }
    elements.modalRoomRound.textContent = roundText;

    // 2. تحديث السؤال الحالي
    let currentQuestionObj = null;
    if (room.state !== 'waiting' && room.questionIds && room.currentRound !== undefined && room.currentRound !== null && room.currentRound >= 0) {
      const questionId = room.questionIds[room.currentRound];
      currentQuestionObj = questions.find(q => q.id === questionId);
    }

    if (currentQuestionObj) {
      elements.modalQuestionBlock.style.display = 'block';
      elements.modalQuestionCategory.textContent = currentQuestionObj.category;
      elements.modalQuestionText.textContent = currentQuestionObj.question;
    } else {
      elements.modalQuestionBlock.style.display = 'none';
    }

    // 3. تحديث جدول اللاعبين
    elements.modalPlayersTbody.innerHTML = '';
    const players = room.players || {};
    const playerEntries = Object.entries(players);

    if (playerEntries.length === 0) {
      elements.modalPlayersTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد لاعبين في الغرفة.</td></tr>';
    } else {
      // ترتيب تنازلي حسب مجموع النقاط
      playerEntries.sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

      playerEntries.forEach(([pid, p]) => {
        const tr = document.createElement('tr');
        
        const isOnline = p.online !== false;
        const onlineText = isOnline ? 'متصل' : 'أوفلاين';
        const onlineClass = isOnline ? 'online' : '';

        const isHostLabel = p.isHost ? ' <span style="font-size:0.65rem; color:var(--neon-yellow); font-weight:bold;">(HOST)</span>' : '';
        const isBlockedText = p.blocked ? '<span class="warn-text-critical">محظور 🚫</span>' : 'سليم';

        tr.innerHTML = `
          <td>
            <span class="status-indicator">
              <span class="status-dot ${onlineClass}"></span>
              <strong>${p.name}</strong>${isHostLabel}
            </span>
          </td>
          <td>${onlineText}</td>
          <td>${p.score || 0}</td>
          <td>${p.warnings || 0}/3 (${isBlockedText})</td>
          <td>
            <button class="btn btn-danger btn-xs btn-kick" data-pid="${pid}" data-name="${p.name}">طرد</button>
          </td>
        `;
        elements.modalPlayersTbody.appendChild(tr);
      });

      // ربط أزرار الطرد
      document.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const pid = e.currentTarget.getAttribute('data-pid');
          const name = e.currentTarget.getAttribute('data-name');
          showConfirm(`هل أنت متأكد من طرد اللاعب ${name}؟`, () => {
            kickPlayer(activeRoomCode, pid);
          });
        });
      });
    }

    // 4. تحديث شبكة الإجابات المكتشفة
    elements.modalAnswersGrid.innerHTML = '';
    
    if (currentQuestionObj) {
      const discoveredAnswers = room.discoveredAnswers || {};
      
      currentQuestionObj.answers.forEach((ans, index) => {
        const isDiscovered = !!discoveredAnswers[index];
        const slotDiv = document.createElement('div');
        slotDiv.className = `modal-answer-slot ${isDiscovered ? 'discovered' : ''}`;
        
        if (isDiscovered) {
          const data = discoveredAnswers[index];
          slotDiv.innerHTML = `
            <div class="m-ans-rank">${index + 1}. ${ans.value}</div>
            <div class="m-ans-name">${ans.name}</div>
            <div class="m-ans-discoverer">بواسطة: ${data.playerName} (+${data.points})</div>
          `;
        } else {
          slotDiv.innerHTML = `
            <div class="m-ans-rank">${index + 1}. ${ans.value}</div>
            <div class="m-ans-name">${ans.name}</div>
            <div class="m-ans-discoverer" style="color:var(--text-muted)">قيمة الإجابة: ${index + 1} نقاط (لم تكتشف)</div>
          `;
        }
        elements.modalAnswersGrid.appendChild(slotDiv);
      });
    } else {
      elements.modalAnswersGrid.innerHTML = '<div class="list-empty" style="grid-column: span 2;">اللعبة لم تبدأ بعد، بانتظار اختيار الأسئلة.</div>';
    }
  }

  function closeModal() {
    activeRoomCode = null;
    elements.roomDetailModal.classList.remove('active');
  }

  elements.btnCloseModal.addEventListener('click', closeModal);
  elements.roomDetailModal.addEventListener('click', (e) => {
    if (e.target === elements.roomDetailModal) {
      closeModal();
    }
  });

  // ═══════════════════════════════════
  // أوامر الإدارة البرمجية (Admin Actions)
  // ═══════════════════════════════════

  // إنهاء الجولة قسرياً
  elements.btnModalForceEnd.addEventListener('click', async () => {
    if (!activeRoomCode) return;
    try {
      const room = activeRoomsData[activeRoomCode];
      if (!room || room.state !== 'playing') {
        showToast('هذه الغرفة ليست في حالة جولة لعب نشطة حالياً');
        return;
      }

      showConfirm('هل أنت متأكد من إنهاء الجولة الحالية قسرياً؟ سيتم تحويل الغرفة فوراً لشاشة عرض نتائج الجولة.', async () => {
        try {
          await db.ref('rooms/' + activeRoomCode + '/state').set('round_results');
          showToast('تم إنهاء الجولة قسرياً بنجاح! ⏱️');
        } catch (e) {
          showToast('فشل في إنهاء الجولة');
        }
      });
    } catch (e) {
      console.error(e);
      showToast('فشل في إنهاء الجولة قسرياً');
    }
  });

  // حذف الغرفة من المودال
  elements.btnModalDeleteRoom.addEventListener('click', () => {
    if (!activeRoomCode) return;
    showConfirm(`هل أنت متأكد من حذف الغرفة ${activeRoomCode} بالكامل؟ سيتم طرد جميع اللاعبين فيها.`, () => {
      const code = activeRoomCode;
      closeModal();
      deleteRoom(code);
    });
  });

  // دالة حذف الغرفة
  async function deleteRoom(code) {
    try {
      await db.ref('rooms/' + code).remove();
      showToast(`تم حذف الغرفة ${code} بنجاح!`);
    } catch (e) {
      console.error(e);
      showToast(`فشل في حذف الغرفة ${code}`);
    }
  }

  // دالة طرد اللاعب
  async function kickPlayer(roomCode, playerId) {
    try {
      await db.ref('rooms/' + roomCode + '/players/' + playerId).remove();
      showToast('تم طرد اللاعب بنجاح!');
    } catch (e) {
      console.error(e);
      showToast('فشل في طرد اللاعب');
    }
  }

  // تنظيف الغرفة الخاملة (أقدم من 3 ساعات)
  elements.btnCleanDb.addEventListener('click', () => {
    showConfirm('هل أنت متأكد من رغبتك في حذف وتطهير قاعدة البيانات من جميع الغرف الخاملة (التي مضى عليها أكثر من 3 ساعات)؟', async () => {
      try {
        const now = Date.now();
        const threeHoursMs = 3 * 60 * 60 * 1000;
        let deleteCount = 0;

        const snapshot = await db.ref('rooms').once('value');
        const rooms = snapshot.val() || {};

        const promises = Object.entries(rooms).map(([code, room]) => {
          const roomAge = now - (room.createdAt || 0);
          if (roomAge > threeHoursMs) {
            deleteCount++;
            return db.ref('rooms/' + code).remove();
          }
          return Promise.resolve();
        });

        await Promise.all(promises);
        
        if (deleteCount > 0) {
          showToast(`تم تنظيف قاعدة البيانات! تم حذف ${deleteCount} غرف خاملة.`);
        } else {
          showToast('قاعدة البيانات نظيفة! لا توجد غرف خاملة أقدم من 3 ساعات.');
        }
      } catch (e) {
        console.error(e);
        showToast('حدث خطأ أثناء تنظيف الغرف الخاملة');
      }
    });
  });

  // ═══════════════════════════════════
  // دوال مساعدة وتنبيهات
  // ═══════════════════════════════════

  // تنسيق الوقت النسبي (مثلاً: قبل 5 دقائق)
  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'الآن';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      if (minutes === 1) return 'قبل دقيقة';
      if (minutes === 2) return 'قبل دقيقتين';
      if (minutes <= 10) return `قبل ${minutes} دقائق`;
      return `قبل ${minutes} دقيقة`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      if (hours === 1) return 'قبل ساعة';
      if (hours === 2) return 'قبل ساعتين';
      if (hours <= 10) return `قبل ${hours} ساعات`;
      return `قبل ${hours} ساعة`;
    }

    return new Date(timestamp).toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // عرض توست تنبيهي
  function showToast(message, duration = 3000) {
    elements.toast.querySelector('.toast-text').textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, duration);
  }

  // النافذة التأكيدية المخصصة (Custom Confirm Box)
  function showConfirm(message, callback) {
    elements.confirmMessageText.textContent = message;
    elements.customConfirmModal.classList.add('active');
    
    const onOk = () => {
      cleanup();
      callback();
    };
    
    const onCancel = () => {
      cleanup();
    };
    
    const cleanup = () => {
      elements.btnConfirmOk.removeEventListener('click', onOk);
      elements.btnConfirmCancel.removeEventListener('click', onCancel);
      elements.customConfirmModal.classList.remove('active');
    };
    
    elements.btnConfirmOk.addEventListener('click', onOk);
    elements.btnConfirmCancel.addEventListener('click', onCancel);
  }

  // تنظيف تلقائي صامت للغرف الفارغة والخاملة (أقدم من 4 ساعات)
  async function runSilentAutoCleanup() {
    try {
      const now = Date.now();
      const fourHoursMs = 4 * 60 * 60 * 1000;
      let cleanCount = 0;

      const snapshot = await db.ref('rooms').once('value');
      const rooms = snapshot.val() || {};

      const promises = Object.entries(rooms).map(([code, room]) => {
        const pCount = Object.keys(room.players || {}).length;
        const age = now - (room.createdAt || 0);
        
        // حذف الغرفة إذا كانت فارغة أو مضى عليها 4 ساعات
        if (pCount === 0 || age > fourHoursMs) {
          cleanCount++;
          return db.ref('rooms/' + code).remove();
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      if (cleanCount > 0) {
        console.log(`[Auto Cleanup] Cleaned up ${cleanCount} empty or stale rooms.`);
      }
    } catch (e) {
      console.error('[Auto Cleanup Error]', e);
    }
  }

})();

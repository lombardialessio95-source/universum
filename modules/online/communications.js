/** UNIVERSUM / modules/online/communications.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { LEADERBOARD_CACHE_TTL_MS, _leaderboardCache, _playersCache, _syncLastByUni } = window.__UniversumMPVariables;
  // Bridge lazy per le funzioni definite negli altri moduli.
  const _cacheGet = (...args) => G._cacheGet(...args);
  const _invalidateUniCaches = (...args) => G._invalidateUniCaches(...args);
  const getAuth = (...args) => G.getAuth(...args);
  const getDB = (...args) => G.getDB(...args);
  const releaseServerSlot = (...args) => G.releaseServerSlot(...args);
  const sanitizeNickname = (...args) => G.sanitizeNickname(...args);



  async function getReports(uniId) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) return [];
    const snap = await db.collection('online_universes').doc(uniId).collection('messages')
      .where('recipientUid', '==', user.uid)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get()
      .catch(() => ({ docs: [] }));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }


  async function deleteReport(uniId, reportId) {
    const guard=G.ordinaryMutationGuard({id:uniId});
    try {
    guard.check();
    const db = getDB();
    await db.collection('online_universes').doc(uniId).collection('messages').doc(reportId).delete();
    } finally { guard.release(); }
  }


  async function deleteAllReports(uniId) {
    const guard=G.ordinaryMutationGuard({id:uniId});
    try {
    guard.check();
    const reports = await getReports(uniId);
    guard.check();
    const db = getDB();
    const batch = db.batch();
    reports.forEach((r) => batch.delete(db.collection('online_universes').doc(uniId).collection('messages').doc(r.id)));
    await batch.commit();
    return reports.length;
    } finally { guard.release(); }
  }


  async function getLeaderboard(uniId) {
    const cached = _cacheGet(_leaderboardCache, uniId, LEADERBOARD_CACHE_TTL_MS);
    if (cached) return [...cached];
    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('players')
      .orderBy('points', 'desc')
      .limit(50)
      .get();

    const data = snap.docs.map((d) => d.data());
    _leaderboardCache.set(uniId, { at: Date.now(), data });
    return [...data];
  }


  async function sendChatMessage(uniId, text) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere per inviare messaggi.');

    const cleanText = String(text || '').trim().slice(0, 240);
    if (!cleanText) return;

    const nickname = user.displayName || user.email.split('@')[0];
    await db.collection('online_universes').doc(uniId).collection('chat').add({
      uid: user.uid,
      nickname,
      text: cleanText,
      timestamp: Date.now()
    });
  }


  function listenChat(uniId, callback) {
    const db = getDB();
    return db.collection('online_universes').doc(uniId).collection('chat')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot((snap) => {
        const messages = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .reverse();
        callback(messages);
      }, (err) => {
        console.warn('[MP Chat] Errore listener chat galattica:', err);
      });
  }


  function _getPrivateChatId(uid1, uid2) {
    return [String(uid1), String(uid2)].sort().join('_');
  }


  async function getUniversePlayers(uniId) {
    const auth = getAuth();
    const myUid = auth.currentUser?.uid;
    if (!myUid) return [];

    const cached = _cacheGet(_playersCache, uniId, LEADERBOARD_CACHE_TTL_MS);
    if (cached) return cached.filter((p) => p.uid !== myUid).map((p) => ({ ...p }));

    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('players')
      .orderBy('nickname', 'asc')
      .get();

    const data = snap.docs
      .map((d) => d.data())
      .filter((p) => p.uid)
      .map((p) => ({
        uid: p.uid,
        nickname: p.nickname || 'Comandante'
      }));
    _playersCache.set(uniId, { at: Date.now(), data });
    return data.filter((p) => p.uid !== myUid).map((p) => ({ ...p }));
  }


  async function sendPrivateMessage(uniId, targetUid, targetName, text) {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user) throw new Error('Devi accedere per inviare messaggi privati.');

    const cleanText = String(text || '').trim().slice(0, 300);
    if (!cleanText) throw new Error('Il messaggio non può essere vuoto.');
    if (!targetUid || targetUid === user.uid) throw new Error('Destinatario non valido.');

    const myUid = user.uid;
    const myName = user.displayName || user.email.split('@')[0];
    const safeTargetName = sanitizeNickname(targetName) || 'Comandante';
    const chatId = this._getPrivateChatId(myUid, targetUid);
    const now = Date.now();

    const chatDocRef = db.collection('online_universes').doc(uniId)
      .collection('private_chats').doc(chatId);
    const messagesColRef = chatDocRef.collection('messages');

    await messagesColRef.add({
      senderUid: myUid,
      senderName: myName,
      text: cleanText,
      timestamp: now
    });

    await chatDocRef.set({
      participants: [myUid, targetUid],
      participantNames: {
        [myUid]: myName,
        [targetUid]: safeTargetName
      },
      lastMessage: cleanText,
      lastTimestamp: now,
      unreadFor: targetUid
    }, { merge: true });
  }


  function listenPrivateConversations(uniId, callback) {
    const auth = getAuth();
    const db = getDB();
    const myUid = auth.currentUser?.uid;
    if (!myUid) return () => {};

    return db.collection('online_universes').doc(uniId).collection('private_chats')
      .where('participants', 'array-contains', myUid)
      .orderBy('lastTimestamp', 'desc')
      .onSnapshot((snap) => {
        let unreadCount = 0;
        const conversations = snap.docs.map((doc) => {
          const data = doc.data();
          if (data.unreadFor === myUid) unreadCount++;
          const otherUid = (data.participants || []).find((id) => id !== myUid) || '';
          const otherName = (data.participantNames && data.participantNames[otherUid]) || 'Comandante';
          return {
            chatId: doc.id,
            otherUid,
            otherName,
            lastMessage: data.lastMessage || '',
            lastTimestamp: data.lastTimestamp || 0,
            isUnread: data.unreadFor === myUid
          };
        });
        callback(conversations, unreadCount);
      }, (err) => {
        console.warn('[MP Private] Errore listener conversazioni private:', err);
      });
  }


  function listenPrivateMessages(uniId, otherUid, callback) {
    const auth = getAuth();
    const db = getDB();
    const myUid = auth.currentUser?.uid;
    if (!myUid || !otherUid) return () => {};

    const chatId = this._getPrivateChatId(myUid, otherUid);
    const chatDocRef = db.collection('online_universes').doc(uniId)
      .collection('private_chats').doc(chatId);

    return chatDocRef.collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(15)
      .onSnapshot(async (snap) => {
        chatDocRef.get().then((roomSnap) => {
          if (roomSnap.exists && roomSnap.data().unreadFor === myUid) {
            chatDocRef.update({ unreadFor: null }).catch(() => {});
          }
        }).catch(() => {});

        const messages = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .reverse();
        callback(messages);
      }, (err) => {
        console.warn('[MP Private] Errore listener messaggi privati:', err);
      });
  }


  async function _deleteCollectionDocs(colRef) {
    let snap = await colRef.limit(400).get();
    while (!snap.empty) {
      const batch = getDB().batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      snap = await colRef.limit(400).get();
    }
  }


  async function leaveOnlineUniverse(uniId) {
    const guard=G.ordinaryMutationGuard({id:uniId});
    try {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const playerRef = uniRef.collection('players').doc(user.uid);
    const playerSnap = await playerRef.get({source:'server'});
    guard.check();
    if (playerSnap.metadata?.fromCache!==false || playerSnap.metadata.hasPendingWrites!==false) throw Error('Profilo non verificato dal server.');
    if (playerSnap.data()?.ordinaryDispatchReceipt && playerSnap.data().ordinaryDispatchReceipt.acknowledged!==true)
      throw Error('Ricevuta partenza non riconciliata: abbandono sospeso.');
    if (!playerSnap.exists) {
      await releaseServerSlot(db, user.uid, uniId);
      return;
    }

    const planetsSnap = await uniRef.collection('planets').where('ownerUid', '==', user.uid).get();
    const fleetsSnap = await uniRef.collection('fleets').where('attackerUid', '==', user.uid).get().catch(() => ({ docs: [] }));

    guard.check();
    const batch = db.batch();
    planetsSnap.docs.forEach((d) => batch.delete(d.ref));
    fleetsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(playerRef);
    await batch.commit();

    await uniRef.update({ playerCount: firebase.firestore.FieldValue.increment(-1) }).catch(() => {});
    G.invalidateOnlineUniverseList?.();
    await releaseServerSlot(db, user.uid, uniId);
    } finally { guard.release(); }
  }


  async function deleteOnlineUniverse(uniId) {
    const guard=G.ordinaryMutationGuard({id:uniId});
    try {
    const auth = getAuth();
    const db = getDB();
    const user = auth.currentUser;
    if (!user || !uniId) throw new Error('Utente non autenticato.');

    const uniRef = db.collection('online_universes').doc(uniId);
    const uniSnap = await uniRef.get();
    if (!uniSnap.exists) throw new Error('Server non trovato.');
    const uniData = uniSnap.data() || {};
    const founderUid = uniData.founderUid || uniData.ownerUid;
    if (founderUid !== user.uid) {
      throw new Error("Solo l'utente che ha creato il server puo' eliminarlo.");
    }

    const playersSnap = await uniRef.collection('players').get({source:'server'});
    guard.check();
    if (playersSnap.metadata?.fromCache!==false || playersSnap.metadata.hasPendingWrites!==false ||
        playersSnap.docs.some(d=>d.metadata?.fromCache!==false || d.metadata.hasPendingWrites!==false))
      throw Error('Profili non verificati dal server.');
    if (playersSnap.docs.some(d=>d.data()?.ordinaryDispatchReceipt && d.data().ordinaryDispatchReceipt.acknowledged!==true))
      throw Error('Ricevuta partenza non riconciliata: eliminazione sospesa.');
    const playerUids = playersSnap.docs.map((d) => d.data()?.uid || d.id);

    for (const uid of playerUids) {
      await uniRef.collection('messages').add({
        recipientUid: uid,
        title: 'Eliminazione Server',
        body: 'Il server sta per essere eliminato dal creatore.',
        timestamp: Date.now()
      }).catch(() => {});
    }

    for (const uid of playerUids) {
      if (uid) await releaseServerSlot(db, uid, uniId);
    }
    await releaseServerSlot(db, user.uid, uniId);

    const privateChatsSnap = await uniRef.collection('private_chats').get().catch(() => ({ docs: [] }));
    for (const chatDoc of privateChatsSnap.docs) {
      await _deleteCollectionDocs(chatDoc.ref.collection('messages'));
    }
    await _deleteCollectionDocs(uniRef.collection('private_chats'));
    await _deleteCollectionDocs(uniRef.collection('players'));
    await _deleteCollectionDocs(uniRef.collection('planets'));
    await _deleteCollectionDocs(uniRef.collection('fleets'));
    await _deleteCollectionDocs(uniRef.collection('messages'));
    await _deleteCollectionDocs(uniRef.collection('chat'));
    await uniRef.delete();

    _invalidateUniCaches(uniId);
    _syncLastByUni.delete(uniId);
    } finally { guard.release(); }
  }


  function listenUniverseDeleted(uniId, callback) {
    const db = getDB();
    return db.collection('online_universes').doc(uniId)
      .onSnapshot((snap) => {
        if (!snap.exists) callback();
      }, () => {});
  }

  Object.assign(G, { getReports, deleteReport, deleteAllReports, getLeaderboard, sendChatMessage, listenChat, _getPrivateChatId, getUniversePlayers, sendPrivateMessage, listenPrivateConversations, listenPrivateMessages, _deleteCollectionDocs, leaveOnlineUniverse, deleteOnlineUniverse, listenUniverseDeleted });

})();

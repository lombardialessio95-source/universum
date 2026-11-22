/** UNIVERSUM / modules/online/foundation.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  const G = window.__UniversumMPModules;
  const { FLEET_SCHEMA_VERSION, _migratedFleetUnis } = window.__UniversumMPVariables;



  function getAuth() {
    if (!window.fbAuth) throw new Error('Firebase Auth non inizializzato.');
    return window.fbAuth;
  }


  function getDB() {
    if (!window.fbDB) throw new Error('Firebase Firestore non inizializzato.');
    return window.fbDB;
  }


  function coordsToKey(coords) {
    return `${coords.g}_${coords.s}_${coords.p}`;
  }


  function _tsToMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return Number(v) || 0;
  }


  function _parseKeyCoords(key) {
    const parts = String(key || '').split('_').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { g: parts[0], s: parts[1], p: parts[2] };
  }


  function _cleanShips(raw) {
    const out = {};
    for (const [id, qty] of Object.entries(raw || {})) {
      const n = Math.max(0, Math.floor(Number(qty) || 0));
      if (n > 0) out[id] = n;
    }
    return out;
  }


  function normalizeOnlineFleet(raw, id) {
    const f = raw || {};
    const missionAlias = { blockade: 'embargo', explore: 'expedition' };
    const mission = missionAlias[f.mission] || f.mission || 'attack';
    const targetCoords = f.targetCoords || f.target || _parseKeyCoords(f.targetKey) || null;
    const originCoords = f.originCoords || f.origin || _parseKeyCoords(f.originKey) || null;
    const targetKey = f.targetKey || (targetCoords ? coordsToKey(targetCoords) : null);
    const now = Date.now();
    const departureTime = Number(f.departureTime || _tsToMs(f.departureAt) || now);
    let status = f.status || 'outbound';
    if (!['outbound', 'returning', 'embargo', 'occupy', 'completed'].includes(status)) status = 'outbound';
    const resolved = f.resolved === true || status === 'completed';
    return {
      ...f,
      id: id || f.id,
      schemaVersion: FLEET_SCHEMA_VERSION,
      mission,
      status: resolved ? 'completed' : status,
      phase: resolved ? 'COMPLETATA' : (status === 'outbound' ? 'IN VIAGGIO' : status === 'returning' ? 'IN RITORNO' : status === 'embargo' ? 'IN EMBARGO' : status === 'occupy' ? 'IN OCCUPAZIONE' : status.toUpperCase()),
      ships: _cleanShips(f.ships || f.fleet),
      fleet: _cleanShips(f.ships || f.fleet),
      cargo: {
        metal: Math.max(0, Math.floor(Number(f.cargo?.metal) || 0)),
        crystal: Math.max(0, Math.floor(Number(f.cargo?.crystal) || 0)),
        deuterium: Math.max(0, Math.floor(Number(f.cargo?.deuterium) || 0))
      },
      attackerUid: f.attackerUid || null,
      attackerName: f.attackerName || 'Comandante',
      attackerTech: {
        weaponsTech: Number(f.attackerTech?.weaponsTech || 0),
        shieldingTech: Number(f.attackerTech?.shieldingTech || 0),
        armourTech: Number(f.attackerTech?.armourTech || 0),
        expeditionTech: Number(f.attackerTech?.expeditionTech || 0),
        espionageTech: Number(f.attackerTech?.espionageTech || 0)
      },
      defenderUid: f.defenderUid || null,
      originCoords,
      targetCoords,
      targetKey,
      departureTime,
      arrivalTime: Number(f.arrivalTime || _tsToMs(f.arrivalAt) || f.returnTime || now),
      returnTime: Number(f.returnTime || f.arrivalTime || _tsToMs(f.arrivalAt) || now),
      resolved,
      ransom: f.ransom || f.ransomDemand || { metal: 50000, crystal: 25000, deuterium: 10000 },
      siegeDeuterium: Math.max(0, Number(f.siegeDeuterium ?? f.cargo?.deuterium ?? 0)),
      lastSiegeTickAt: Number(f.lastSiegeTickAt || f.siegeStartedAt || now)
    };
  }


  function _fleetDueTime(f) {
    return f.status === 'returning' ? Number(f.returnTime || f.arrivalTime || 0) : Number(f.arrivalTime || 0);
  }


  async function migrateOnlineFleets(uniId, { force = false } = {}) {
    if (!force && _migratedFleetUnis.has(uniId)) return 0;
    _migratedFleetUnis.add(uniId);
    const db = getDB();
    const snap = await db.collection('online_universes').doc(uniId).collection('fleets').limit(100).get().catch(() => ({ docs: [] }));
    let migrated = 0;
    for (const d of snap.docs) {
      const raw = d.data() || {};
      const uid = getAuth().currentUser?.uid;
      if (!uid || (raw.attackerUid !== uid && raw.defenderUid !== uid)) continue;
      const norm = normalizeOnlineFleet(raw, d.id);
      const needs = raw.schemaVersion !== FLEET_SCHEMA_VERSION || raw.resolved === undefined || !raw.targetKey || !raw.ships;
      if (needs) {
        const { id: _omit, ...toWrite } = norm;
        await d.ref.set(toWrite, { merge: true }).catch(() => {});
        migrated++;
      }
    }
    return migrated;
  }

  Object.assign(G, { getAuth, getDB, coordsToKey, _tsToMs, _parseKeyCoords, _cleanShips, normalizeOnlineFleet, _fleetDueTime, migrateOnlineFleets });

})();

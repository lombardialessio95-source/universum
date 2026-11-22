/** UNIVERSUM / modules/online / context — modulo estratto conservando la logica originale. */
(function () {
  'use strict';
  window.__UniversumMPModules = window.__UniversumMPModules || {};


  // =========================================================
  // FIX 0 / 0-B: CICLO DI VITA FLOTTE ONLINE, SCHEMA E ORFANE
  // =========================================================
  const FLEET_SCHEMA_VERSION = 2;

  const _migratedFleetUnis = new Set();


  const SERVER_LIMIT = 3;

  const SERVER_LIMIT_MESSAGE = 'Hai già raggiunto il limite di 3 server. Abbandona un server per entrarne in un altro.';

  const SYNC_MIN_INTERVAL_MS = 60 * 1000;

  const SYSTEM_CACHE_TTL_MS = 30 * 1000;

  const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;


  const _syncLastByUni = new Map();

  const _systemCache = new Map();

  const _systemPending = new Set();

  const _leaderboardCache = new Map();

  const _playersCache = new Map();

  const _privateCleanupDone = new Set();


  const _INBOX_RES_KEYS = ['metal', 'crystal', 'deuterium'];


  const _mpErrorToastAt = new Map();


  const _ONLINE_SUPPORTED_MISSIONS = new Set([
    'attack', 'destroyMoon', 'spy', 'transport', 'deploy', 'colonize', 'recycle',
    'expedition', 'explore', 'embargo', 'blockade', 'occupy', 'recall'
  ]);


  const _occupationSweepAt = new Map();

  const OCCUPATION_SWEEP_MIN_MS = 10 * 60 * 1000;
Object.assign(window.__UniversumMPVariables || (window.__UniversumMPVariables = {}), { FLEET_SCHEMA_VERSION, LEADERBOARD_CACHE_TTL_MS, OCCUPATION_SWEEP_MIN_MS, SERVER_LIMIT, SERVER_LIMIT_MESSAGE, SYNC_MIN_INTERVAL_MS, SYSTEM_CACHE_TTL_MS, _INBOX_RES_KEYS, _ONLINE_SUPPORTED_MISSIONS, _leaderboardCache, _migratedFleetUnis, _mpErrorToastAt, _occupationSweepAt, _playersCache, _privateCleanupDone, _syncLastByUni, _systemCache, _systemPending });
})();

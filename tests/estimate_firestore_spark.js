/**
 * Modello prudenziale di quota, NON misura del traffico reale del progetto.
 * Eseguire con: node tests/estimate_firestore_spark.js
 * Firestore Standard (Spark): 50000 read e 20000 write /giorno.
 */
const READS_PER_DAY = 50000;
const WRITES_PER_DAY = 20000;
const RESERVED_SHARE = 0.25; // lascia il 25% delle quote per picchi e nuovi utenti
const scenarios = [
  {name:'Leggero (1 ora)', minutes:60, planets:2, otherActions:6, fleets:1, systems:4, avgOccupied:2, reports:5, otherReads:15, otherWrites:5, baseReads:20},
  {name:'Medio (2 ore)', minutes:120, planets:3, otherActions:12, fleets:3, systems:6, avgOccupied:4, reports:12, otherReads:25, otherWrites:10, baseReads:30},
  {name:'Intenso (2 ore)', minutes:120, planets:5, otherActions:25, fleets:10, systems:15, avgOccupied:6, reports:25, otherReads:70, otherWrites:30, baseReads:45}
];
function estimate(s) {
  const heartbeats = Math.ceil(s.minutes / 10);
  const forced = s.otherActions + s.fleets;
  // I salvataggi forzati spostano in avanti l'heartbeat; contarli entrambi
  // e' volutamente prudente. Per sync vengono letti i pianeti e tutti scritti.
  const saves = heartbeats + forced;
  const writes = saves * (s.planets + 1) + s.fleets * 5 + s.otherWrites;
  // Una lettura per pianeta nella transazione + la notifica listener; esclusi
  // i read da listener complessi, aggiunti nei margini otherReads/baseReads.
  // Il checkpoint confronta anche la revisione del giocatore.
  const reads = saves * (s.planets * 2 + 1) + s.fleets * 8 +
    s.systems * Math.max(1, s.avgOccupied) + s.reports + s.otherReads +
    s.baseReads + Math.ceil(saves * 0.25);
  const theoretical = Math.floor(Math.min(READS_PER_DAY / reads, WRITES_PER_DAY / writes));
  const withReserve = Math.floor(Math.min(READS_PER_DAY * (1-RESERVED_SHARE) / reads,
                                        WRITES_PER_DAY * (1-RESERVED_SHARE) / writes));
  return {...s, heartbeats, forced, reads, writes, theoretical, withReserve, bottleneck: READS_PER_DAY/reads < WRITES_PER_DAY/writes ? 'letture' : 'scritture'};
}
if (require.main === module) {
  console.log('Ipotesi: Firestore Standard 50.000 letture/20.000 scritture, riserva quota 25%.');
  for (const e of scenarios.map(estimate)) {
    console.log(`${e.name}: ${e.reads} reads/player/day, ${e.writes} writes/player/day, `+
      `teorico=${e.theoretical}, prudente=${e.withReserve} DAU, vincolo=${e.bottleneck}`);
  }
  console.log('Le cifre NON includono traffico anomalo, documenti grandi o query di altri client oltre ai margini ipotizzati.');
}
module.exports = {estimate, scenarios};

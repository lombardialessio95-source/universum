/** UNIVERSUM / modules/data/buildings.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';


  const BUILDINGS = {
    metalMine: {
      id: 'metalMine',
      name: 'Miniera di Metallo',
      icon: '⛏️',
      category: 'resource',
      description: 'Estrae minerale metallico grezzo dalla crosta planetaria. Fondamentale per ogni struttura e scafo.',
      baseCost: { metal: 60, crystal: 15, deuterium: 0 },
      factor: 1.5,
      requirements: {}
    },
    crystalMine: {
      id: 'crystalMine',
      name: 'Miniera di Cristallo',
      icon: '💎',
      category: 'resource',
      description: 'Estrae silicati e cristalli ad alta purezza indispensabili per circuiti, sensori e ricerche.',
      baseCost: { metal: 48, crystal: 24, deuterium: 0 },
      factor: 1.6,
      requirements: {}
    },
    deuteriumSynth: {
      id: 'deuteriumSynth',
      name: 'Sintetizzatore di Deuterio',
      icon: '🧪',
      category: 'resource',
      description: 'Separa isotopi pesanti di idrogeno dagli oceani. La resa aumenta su pianeti freddi.',
      baseCost: { metal: 225, crystal: 75, deuterium: 0 },
      factor: 1.5,
      requirements: {}
    },
    solarPlant: {
      id: 'solarPlant',
      name: 'Centrale Solare',
      icon: '☀️',
      category: 'resource',
      description: 'Cattura la radiazione stellare per alimentare le miniere. Più efficiente vicino alla stella.',
      baseCost: { metal: 75, crystal: 30, deuterium: 0 },
      factor: 1.5,
      requirements: {}
    },
    fusionReactor: {
      id: 'fusionReactor',
      name: 'Reattore a Fusione',
      icon: '⚛️',
      category: 'resource',
      description: 'Fonde atomi di deuterio generando ingenti quantità di energia indipendenti dalla temperatura.',
      baseCost: { metal: 900, crystal: 360, deuterium: 180 },
      factor: 1.8,
      requirements: { buildings: { deuteriumSynth: 5 }, researches: { energyTech: 3 } }
    },
    roboticsFactory: {
      id: 'roboticsFactory',
      name: 'Fabbrica dei Robot',
      icon: '🦾',
      category: 'facility',
      description: 'Droni automatizzati che accelerano la costruzione di tutte le strutture planetarie.',
      baseCost: { metal: 400, crystal: 120, deuterium: 200 },
      factor: 2.0,
      requirements: {}
    },
    shipyard: {
      id: 'shipyard',
      name: 'Cantiere Navale',
      icon: '🚀',
      category: 'facility',
      description: 'Bacini orbitali per l’assemblaggio di navi spaziali e sistemi di difesa planetaria.',
      baseCost: { metal: 400, crystal: 200, deuterium: 100 },
      factor: 2.0,
      requirements: { buildings: { roboticsFactory: 2 } }
    },
    researchLab: {
      id: 'researchLab',
      name: 'Laboratorio di Ricerca',
      icon: '🔬',
      category: 'facility',
      description: 'Centro scientifico avanzato per lo sviluppo di tecnologie propulsive, belliche ed energetiche.',
      baseCost: { metal: 200, crystal: 400, deuterium: 200 },
      factor: 2.0,
      requirements: {}
    },
    naniteFactory: {
      id: 'naniteFactory',
      name: 'Fabbrica di Naniti',
      icon: '🧬',
      category: 'facility',
      description: 'Assemblatori molecolari che dimezzano i tempi di costruzione di edifici, navi e difese per livello.',
      baseCost: { metal: 1000000, crystal: 500000, deuterium: 100000 },
      factor: 2.0,
      requirements: { buildings: { roboticsFactory: 10 }, researches: { computerTech: 10 } }
    },
    metalStorage: {
      id: 'metalStorage',
      name: 'Deposito di Metallo',
      icon: '📦',
      category: 'storage',
      description: 'Aumenta la capacità massima di stoccaggio del metallo sul pianeta.',
      baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
      factor: 2.0,
      requirements: {}
    },
    crystalStorage: {
      id: 'crystalStorage',
      name: 'Deposito di Cristallo',
      icon: '🔷',
      category: 'storage',
      description: 'Celle pressurizzate che espandono la capacità massima di stoccaggio del cristallo.',
      baseCost: { metal: 1000, crystal: 500, deuterium: 0 },
      factor: 2.0,
      requirements: {}
    },
    deuteriumTank: {
      id: 'deuteriumTank',
      name: 'Cisterna di Deuterio',
      icon: '🛢️',
      category: 'storage',
      description: 'Serbatoi criogenici ad alta pressione per conservare grandi riserve di deuterio.',
      baseCost: { metal: 1000, crystal: 1000, deuterium: 0 },
      factor: 2.0,
      requirements: {}
    },
    terraformer: {
      id: 'terraformer',
      name: 'Terraformer',
      icon: '🌍',
      category: 'facility',
      description: 'Rimodella la superficie planetaria aggiungendo +5 campi utilizzabili per ogni livello.',
      baseCost: { metal: 0, crystal: 50000, deuterium: 100000 },
      factor: 2.0,
      requirements: { buildings: { naniteFactory: 1 }, researches: { energyTech: 12 } }
    },
    hiddenBunker: {
      id: 'hiddenBunker',
      name: 'Bunker Sotterraneo',
      icon: '🔐',
      category: 'facility',
      description: 'Camere blindate profonde che proteggono il 10% delle risorse per livello (fino al 90%) dai saccheggi.',
      baseCost: { metal: 2500, crystal: 2500, deuterium: 1000 },
      factor: 1.8,
      maxLevel: 9,
      requirements: { buildings: { roboticsFactory: 3 }, researches: { shieldingTech: 2 } }
    }
  };


  const MOON_BUILDINGS = {
    lunarBase: {
      id: 'lunarBase',
      name: 'Base Lunare',
      icon: '🌑',
      category: 'moon',
      description: 'Cupole pressurizzate fondamentali per colonizzare la Luna. Fornisce +3 campi lunari per livello.',
      baseCost: { metal: 20000, crystal: 40000, deuterium: 20000 },
      factor: 2.0,
      requirements: {}
    },
    lunarStorage: {
      id: 'lunarStorage',
      name: 'Deposito Orbitale Lunare',
      icon: '🛰️',
      category: 'moon',
      description: 'Silos a bassa gravità per immagazzinare risorse sulla superficie lunare.',
      baseCost: { metal: 10000, crystal: 10000, deuterium: 5000 },
      factor: 2.0,
      requirements: { moonBuildings: { lunarBase: 1 } }
    },
    lunarShield: {
      id: 'lunarShield',
      name: 'Scudo Gravitazionale Lunare',
      icon: '💠',
      category: 'moon',
      description: 'Generatore di campo che riduce del 10% per livello la probabilità di distruzione della Luna.',
      baseCost: { metal: 50000, crystal: 50000, deuterium: 25000 },
      factor: 2.0,
      maxLevel: 8,
      requirements: { moonBuildings: { lunarBase: 2 }, researches: { shieldingTech: 8 } }
    },
    secretShipyard: {
      id: 'secretShipyard',
      name: 'Cantiere Segreto Lunare',
      icon: '🕶️',
      category: 'moon',
      description: 'Bacino occulto: -20% tempo di costruzione navi ma +20% costo risorse per massima discrezione.',
      baseCost: { metal: 40000, crystal: 30000, deuterium: 20000 },
      factor: 2.0,
      requirements: { moonBuildings: { lunarBase: 2 }, researches: { hyperspaceTech: 4 } }
    },
    sensorPhalanx: {
      id: 'sensorPhalanx',
      name: 'Falange di Sensori',
      icon: '📡',
      category: 'moon',
      description: 'Intercetta movimenti di flotte ostili nei sistemi vicini. Portata: livello × 2 sistemi.',
      baseCost: { metal: 20000, crystal: 40000, deuterium: 20000 },
      factor: 2.0,
      requirements: { moonBuildings: { lunarBase: 1 }, researches: { espionageTech: 4 } }
    },
    jumpGate: {
      id: 'jumpGate',
      name: 'Portale Iperspaziale',
      icon: '🌀',
      category: 'moon',
      description: 'Teletrasporta flotte tra due Lune (10.000 Deuterio a salto, cooldown 30 min a 1x, 0s a 100x+).',
      baseCost: { metal: 2000000, crystal: 4000000, deuterium: 2000000 },
      factor: 2.0,
      maxLevel: 1,
      requirements: { moonBuildings: { lunarBase: 1 }, researches: { jumpGateTech: 1, hyperspaceTech: 7 } }
    }
  };
  Object.assign(window.__UniversumCatalog || (window.__UniversumCatalog = {}), {BUILDINGS, MOON_BUILDINGS});
})();

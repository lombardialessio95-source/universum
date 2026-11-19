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

  // Bacino Spaziale: occupa lo slot orbitale al posto della Luna (mai insieme).
  // Tempi in giorni reali (non scalati dalla velocita' dell'universo).
  const BACINO_SPAZIALE = {
    id: 'bacino_spaziale',
    name: 'Bacino Spaziale',
    icon: '🛠️',
    description: 'Grande cantiere orbitale costruito al posto della Luna: 20 giorni reali, pagato a rate giornaliere.',
    totalDays: 20,
    dayMs: 86400000,
    totalCost: { metal: 5000000, crystal: 3000000, deuterium: 1000000 },
    dailyCost: { metal: 250000, crystal: 150000, deuterium: 50000 }
  };

  // Invictus: nave legata a un Bacino Spaziale (max 4 tra attive e in costruzione).
  const INVICTUS = {
    id: 'invictus',
    name: 'Invictus',
    maxPerBacino: 4,
    totalDays: 20,
    dayMs: 86400000,
    totalCost: { metal: 4000000, crystal: 2400000, deuterium: 1600000 },
    dailyCost: { metal: 200000, crystal: 120000, deuterium: 80000 },
    jumpDeuteriumPerShip: 5000,
    jumpSystemsStep: 3,
    moonChancePerLost: 0.15
  };

  // Crepuscolo degli Dei: nave unica d'impero, solo in un Bacino mai usato (vuoto).
  const CREPUSCOLO = {
    id: 'crepuscolo',
    name: 'Crepuscolo degli Dei',
    maxPerEmpire: 1,
    buildDays: 100,
    wreckRepairDays: 30,
    battleRepairDays: 10,
    dayMs: 86400000,
    totalCost: { metal: 50000000, crystal: 30000000, deuterium: 20000000 },
    dailyCost: { metal: 500000, crystal: 300000, deuterium: 200000 },
    wreckChance: 0.005,
    wreckMinDeathStars: 4,
    wreckExploreHours: 24
  };

  // Galattica: nave-pianeta errante che nasce nel Bacino e ne prende il posto (max 3 per impero).
  const GALATTICA = {
    id: 'galattica',
    name: 'Galattica',
    maxPerEmpire: 3,
    buildDays: 100,
    dayMs: 86400000,
    totalCost: { metal: 45000000, crystal: 27000000, deuterium: 18000000 },
    dailyCost: { metal: 450000, crystal: 270000, deuterium: 180000 },
    jumpDeuteriumPerSystemStep: 25000,
    jumpSystemsStep: 3,
    jumpGalaxyExtraDeuterium: 100000,
    defenseCostMultiplier: 2,
    requirements: {
      researches: { quantumPhysics: 10, jumpPropulsion: 8, mobilePlanetaryStructure: 5, stellarReactor: 7, spatialTerraforming: 5 }
    }
  };

  const GALATTICA_STRUCTURES = {
    cantiereSpaziale: { id: 'cantiereSpaziale', name: 'Cantiere Spaziale', icon: '🚀', baseCost: { metal: 2000, crystal: 1000, deuterium: 500 }, factor: 2.0 },
    generatoreMetallo: { id: 'generatoreMetallo', name: 'Generatore di Metallo', icon: '⛏️', baseCost: { metal: 300, crystal: 75, deuterium: 0 }, factor: 1.5 },
    generatoreCristallo: { id: 'generatoreCristallo', name: 'Generatore di Cristallo', icon: '💎', baseCost: { metal: 240, crystal: 120, deuterium: 0 }, factor: 1.6 },
    sintetizzatoreDeuterio: { id: 'sintetizzatoreDeuterio', name: 'Sintetizzatore di Deuterio', icon: '🧪', baseCost: { metal: 1125, crystal: 375, deuterium: 0 }, factor: 1.5 },
    reattoreFusione: { id: 'reattoreFusione', name: 'Reattore a Fusione', icon: '⚛️', baseCost: { metal: 4500, crystal: 1800, deuterium: 900 }, factor: 1.8 }
  };

  const RESEARCHES = {
    energyTech: {
      id: 'energyTech',
      name: 'Tecnologia Energetica',
      icon: '⚡',
      description: 'Ottimizza la distribuzione energetica e aumenta la resa del Reattore a Fusione.',
      baseCost: { metal: 0, crystal: 800, deuterium: 400 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 1 } }
    },
    laserTech: {
      id: 'laserTech',
      name: 'Tecnologia dei Laser',
      icon: '🔦',
      description: 'Focalizzazione di fasci coerenti ad alta energia per armi leggere e medie.',
      baseCost: { metal: 200, crystal: 100, deuterium: 0 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 1 }, researches: { energyTech: 2 } }
    },
    ionTech: {
      id: 'ionTech',
      name: 'Tecnologia Ionica',
      icon: '💠',
      description: 'Accelerazione di fasci ionici capaci di sovraccaricare gli scudi nemici.',
      baseCost: { metal: 1000, crystal: 300, deuterium: 100 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 4 }, researches: { laserTech: 5, energyTech: 4 } }
    },
    hyperspaceTech: {
      id: 'hyperspaceTech',
      name: 'Tecnologia Iperspaziale',
      icon: '🌌',
      description: 'Manipolazione delle dimensioni superiori per propulsione avanzata e stive compresse.',
      baseCost: { metal: 0, crystal: 4000, deuterium: 2000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 7 }, researches: { energyTech: 5, shieldingTech: 5 } }
    },
    plasmaTech: {
      id: 'plasmaTech',
      name: 'Tecnologia del Plasma',
      icon: '🔥',
      description: 'Super-riscaldamento ionico: +1% produzione Metallo, +0.66% Cristallo e +0.33% Deuterio per livello.',
      baseCost: { metal: 2000, crystal: 4000, deuterium: 1000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 4 }, researches: { energyTech: 8, laserTech: 10, ionTech: 5 } }
    },
    combustionDrive: {
      id: 'combustionDrive',
      name: 'Propulsore a Combustione',
      icon: '🔥',
      description: 'Aumenta del +10% per livello la velocità delle navi leggere e dei cargo.',
      baseCost: { metal: 400, crystal: 0, deuterium: 600 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 1 }, researches: { energyTech: 1 } }
    },
    impulseDrive: {
      id: 'impulseDrive',
      name: 'Propulsore a Impulso',
      icon: '💫',
      description: 'Aumenta del +20% per livello la velocità delle navi medie e delle colonizzatrici.',
      baseCost: { metal: 2000, crystal: 4000, deuterium: 600 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 2 }, researches: { energyTech: 1 } }
    },
    hyperspaceDrive: {
      id: 'hyperspaceDrive',
      name: 'Propulsore Iperspaziale',
      icon: '🌠',
      description: 'Aumenta del +30% per livello la velocità delle navi pesanti da battaglia.',
      baseCost: { metal: 10000, crystal: 20000, deuterium: 6000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 7 }, researches: { hyperspaceTech: 3 } }
    },
    espionageTech: {
      id: 'espionageTech',
      name: 'Tecnologia dello Spionaggio',
      icon: '👁️',
      description: 'Migliora i sensori delle sonde spia e riduce il rischio di controspionaggio nemico.',
      baseCost: { metal: 200, crystal: 1000, deuterium: 200 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 3 } }
    },
    computerTech: {
      id: 'computerTech',
      name: 'Tecnologia Informatica',
      icon: '💻',
      description: 'Potenzia il calcolo tattico: sblocca +1 slot flotta simultaneo per livello.',
      baseCost: { metal: 0, crystal: 400, deuterium: 600 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 1 } }
    },
    astrophysics: {
      id: 'astrophysics',
      name: 'Astrofisica',
      icon: '🔭',
      description: 'Permette spedizioni profonde, nuove colonie e sblocca la Nave Madre al livello 8.',
      baseCost: { metal: 4000, crystal: 8000, deuterium: 4000 },
      factor: 1.75,
      requirements: { buildings: { researchLab: 3 }, researches: { espionageTech: 4, impulseDrive: 3 } }
    },
    intergalacticNetwork: {
      id: 'intergalacticNetwork',
      name: 'Rete Intergalattica di Ricerca',
      icon: '🌐',
      description: 'Collega i laboratori dei tuoi pianeti sommando la loro velocità di ricerca.',
      baseCost: { metal: 240000, crystal: 400000, deuterium: 160000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 10 }, researches: { computerTech: 8, hyperspaceTech: 8 } }
    },
    weaponsTech: {
      id: 'weaponsTech',
      name: 'Tecnologia delle Armi',
      icon: '⚔️',
      description: 'Potenzia tutte le armi di navi e difese del +10% per livello.',
      baseCost: { metal: 800, crystal: 200, deuterium: 0 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 4 } }
    },
    shieldingTech: {
      id: 'shieldingTech',
      name: 'Tecnologia degli Scudi',
      icon: '🛡️',
      description: 'Rinforza i campi deflettori di navi e difese del +10% per livello.',
      baseCost: { metal: 200, crystal: 600, deuterium: 0 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 6 }, researches: { energyTech: 3 } }
    },
    armourTech: {
      id: 'armourTech',
      name: 'Tecnologia delle Corazze',
      icon: '🔩',
      description: 'Leghe ultra-dense che aumentano l’integrità strutturale dello scafo del +10% per livello.',
      baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 2 } }
    },
    lunarTech: {
      id: 'lunarTech',
      name: 'Ingegneria Lunare',
      icon: '🌒',
      description: 'Stabilizzazione gravitazionale dei detriti orbitali: sblocca la creazione della Luna al livello 1.',
      baseCost: { metal: 25000, crystal: 50000, deuterium: 25000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 6 }, researches: { astrophysics: 4, hyperspaceTech: 3 } }
    },
    jumpGateTech: {
      id: 'jumpGateTech',
      name: 'Teoria dei Ponti Iperspaziali',
      icon: '🌀',
      description: 'Consente la costruzione del Portale Iperspaziale sulle Lune per salti istantanei.',
      baseCost: { metal: 100000, crystal: 200000, deuterium: 100000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 9 }, researches: { hyperspaceTech: 7, lunarTech: 1 } }
    },
    deathStarTech: {
      id: 'deathStarTech',
      name: 'Tecnologia Gravitonica Suprema',
      icon: '☠️',
      description: 'Singolarità artificiale controllata richiesta per alimentare la Morte Nera.',
      baseCost: { metal: 500000, crystal: 500000, deuterium: 250000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 12 }, researches: { plasmaTech: 15, hyperspaceTech: 10 } }
    },
    quantumPhysics: {
      id: 'quantumPhysics',
      name: 'Fisica Quantica',
      icon: '⚛️',
      description: 'Fondamenti teorici del salto quantico: primo requisito della Galattica (serve Lv.10).',
      baseCost: { metal: 0, crystal: 400000, deuterium: 200000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 10 }, researches: { energyTech: 10, hyperspaceTech: 7 } }
    },
    jumpPropulsion: {
      id: 'jumpPropulsion',
      name: 'Propulsione a Salto',
      icon: '🌀',
      description: 'Motori a salto per scafi planetari: requisito Galattica Lv.8.',
      baseCost: { metal: 300000, crystal: 300000, deuterium: 150000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 9 }, researches: { quantumPhysics: 5, hyperspaceDrive: 6 } }
    },
    mobilePlanetaryStructure: {
      id: 'mobilePlanetaryStructure',
      name: 'Struttura Planetaria Mobile',
      icon: '🏗️',
      description: 'Scafo planetario in grado di muoversi: requisito Galattica Lv.5.',
      baseCost: { metal: 500000, crystal: 250000, deuterium: 0 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 8 }, researches: { jumpPropulsion: 4, armourTech: 8 } }
    },
    stellarReactor: {
      id: 'stellarReactor',
      name: 'Reattore Stellare',
      icon: '☀️',
      description: 'Reattore in grado di alimentare una nave-pianeta: requisito Galattica Lv.7.',
      baseCost: { metal: 0, crystal: 350000, deuterium: 350000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 10 }, researches: { quantumPhysics: 7, plasmaTech: 8 } }
    },
    spatialTerraforming: {
      id: 'spatialTerraforming',
      name: 'Terraforming Spaziale',
      icon: '🌍',
      description: 'Ecosistemi chiusi per navi-pianeta: requisito Galattica Lv.5.',
      baseCost: { metal: 450000, crystal: 450000, deuterium: 200000 },
      factor: 2.0,
      requirements: { buildings: { researchLab: 9 }, researches: { mobilePlanetaryStructure: 3 } }
    }
  };

  const SHIPS = {
    smallCargo: {
      id: 'smallCargo',
      name: 'Cargo Leggero',
      icon: '🚐',
      description: 'Nave mercantile agile per trasporti rapidi e incursioni su pianeti poco difesi.',
      cost: { metal: 2000, crystal: 2000, deuterium: 0 },
      hull: 4000,
      shield: 10,
      attack: 5,
      speed: 5000,
      driveType: 'combustionDrive',
      cargo: 5000,
      fuelConsumption: 10,
      complexity: 2,
      requirements: { buildings: { shipyard: 2 }, researches: { combustionDrive: 2 } },
      rapidFire: { espionageProbe: 5, solarSatellite: 5 }
    },
    largeCargo: {
      id: 'largeCargo',
      name: 'Cargo Pesante',
      icon: '🚛',
      description: 'Trasporto ad altissima capacità progettato per spostare grandi quantità di risorse.',
      cost: { metal: 6000, crystal: 6000, deuterium: 0 },
      hull: 12000,
      shield: 25,
      attack: 5,
      speed: 7500,
      driveType: 'combustionDrive',
      cargo: 25000,
      fuelConsumption: 50,
      complexity: 5,
      requirements: { buildings: { shipyard: 4 }, researches: { combustionDrive: 6 } },
      rapidFire: { espionageProbe: 5, solarSatellite: 5 }
    },
    lightFighter: {
      id: 'lightFighter',
      name: 'Caccia Leggero',
      icon: '✈️',
      description: 'Intercettore economico e veloce, efficace in grandi sciami come schermo tattico.',
      cost: { metal: 3000, crystal: 1000, deuterium: 0 },
      hull: 4000,
      shield: 10,
      attack: 50,
      speed: 12500,
      driveType: 'combustionDrive',
      cargo: 50,
      fuelConsumption: 20,
      complexity: 3,
      requirements: { buildings: { shipyard: 1 }, researches: { combustionDrive: 1 } },
      rapidFire: { espionageProbe: 5, solarSatellite: 5 }
    },
    heavyFighter: {
      id: 'heavyFighter',
      name: 'Caccia Pesante',
      icon: '🛩️',
      description: 'Caccia corazzato con armamento potenziato e propulsione a impulso.',
      cost: { metal: 6000, crystal: 4000, deuterium: 0 },
      hull: 10000,
      shield: 25,
      attack: 150,
      speed: 10000,
      driveType: 'impulseDrive',
      cargo: 100,
      fuelConsumption: 75,
      complexity: 6,
      requirements: { buildings: { shipyard: 3 }, researches: { armourTech: 2, impulseDrive: 2 } },
      rapidFire: { smallCargo: 3, espionageProbe: 5, solarSatellite: 5 }
    },
    cruiser: {
      id: 'cruiser',
      name: 'Incrociatore',
      icon: '🚀',
      description: 'Nave d’assalto veloce, devastante contro sciami di caccia leggeri e lanciamissili.',
      cost: { metal: 20000, crystal: 7000, deuterium: 2000 },
      hull: 27000,
      shield: 50,
      attack: 400,
      speed: 15000,
      driveType: 'impulseDrive',
      cargo: 800,
      fuelConsumption: 300,
      complexity: 12,
      requirements: { buildings: { shipyard: 5 }, researches: { impulseDrive: 4, ionTech: 2 } },
      rapidFire: { lightFighter: 6, rocketLauncher: 10, espionageProbe: 5, solarSatellite: 5 }
    },
    battleship: {
      id: 'battleship',
      name: 'Nave da Battaglia',
      icon: '🛸',
      description: 'Spina dorsale della flotta d’attacco con cannoni pesanti e corazzatura spessa.',
      cost: { metal: 45000, crystal: 15000, deuterium: 0 },
      hull: 60000,
      shield: 200,
      attack: 1000,
      speed: 10000,
      driveType: 'hyperspaceDrive',
      cargo: 1500,
      fuelConsumption: 500,
      complexity: 22,
      requirements: { buildings: { shipyard: 7 }, researches: { hyperspaceDrive: 4 } },
      rapidFire: { espionageProbe: 5, solarSatellite: 5 }
    },
    bomber: {
      id: 'bomber',
      name: 'Bombardiere',
      icon: '💣',
      description: 'Progettato specificamente per annientare le difese planetarie fisse.',
      cost: { metal: 50000, crystal: 25000, deuterium: 15000 },
      hull: 75000,
      shield: 500,
      attack: 1000,
      speed: 5000,
      driveType: 'hyperspaceDrive',
      cargo: 500,
      fuelConsumption: 1000,
      complexity: 30,
      requirements: { buildings: { shipyard: 8 }, researches: { impulseDrive: 6, plasmaTech: 5 } },
      rapidFire: { rocketLauncher: 20, lightLaser: 20, heavyLaser: 10, ionCannon: 10, espionageProbe: 5 }
    },
    battlecruiser: {
      id: 'battlecruiser',
      name: 'Incrociatore da Battaglia',
      icon: '⚔️',
      description: 'Cacciatore d’élite specializzato nell’intercettazione e distruzione di flotte nemiche.',
      cost: { metal: 30000, crystal: 40000, deuterium: 15000 },
      hull: 70000,
      shield: 400,
      attack: 700,
      speed: 10000,
      driveType: 'hyperspaceDrive',
      cargo: 750,
      fuelConsumption: 250,
      complexity: 28,
      requirements: { buildings: { shipyard: 8 }, researches: { hyperspaceTech: 5, hyperspaceDrive: 5, laserTech: 12 } },
      rapidFire: { smallCargo: 3, largeCargo: 3, heavyFighter: 4, cruiser: 4, battleship: 7, espionageProbe: 5 }
    },
    colonyShip: {
      id: 'colonyShip',
      name: 'Colonizzatrice',
      icon: '🌍',
      description: 'Trasporta coloni e moduli prefabbricati per fondare un nuovo pianeta su uno slot vuoto.',
      cost: { metal: 10000, crystal: 20000, deuterium: 10000 },
      hull: 30000,
      shield: 100,
      attack: 50,
      speed: 2500,
      driveType: 'impulseDrive',
      cargo: 7500,
      fuelConsumption: 1000,
      complexity: 15,
      requirements: { buildings: { shipyard: 4 }, researches: { impulseDrive: 3, astrophysics: 1 } },
      rapidFire: { espionageProbe: 5, solarSatellite: 5 }
    },
    recycler: {
      id: 'recycler',
      name: 'Riciclatrice',
      icon: '♻️',
      description: 'Raccoglie metallo e cristallo dai campi detriti generati dopo le battaglie orbitali.',
      cost: { metal: 10000, crystal: 6000, deuterium: 2000 },
      hull: 16000,
      shield: 10,
      attack: 1,
      speed: 2000,
      driveType: 'combustionDrive',
      cargo: 20000,
      fuelConsumption: 300,
      complexity: 10,
      requirements: { buildings: { shipyard: 4 }, researches: { combustionDrive: 6, shieldingTech: 2 } },
      rapidFire: { espionageProbe: 5, solarSatellite: 5 }
    },
    espionageProbe: {
      id: 'espionageProbe',
      name: 'Sonda Spia',
      icon: '🛰️',
      description: 'Micro-drone ad altissima velocità per scansionare risorse, difese e flotte nemiche.',
      cost: { metal: 0, crystal: 1000, deuterium: 0 },
      hull: 1000,
      shield: 0,
      attack: 0,
      speed: 100000000,
      driveType: 'combustionDrive',
      cargo: 5,
      fuelConsumption: 1,
      complexity: 1,
      requirements: { buildings: { shipyard: 3 }, researches: { combustionDrive: 3, espionageTech: 2 } },
      rapidFire: {}
    },
    solarSatellite: {
      id: 'solarSatellite',
      name: 'Satellite Solare',
      icon: '🔆',
      description: 'Piattaforma orbitale immobile che fornisce energia extra in base alla temperatura del pianeta.',
      cost: { metal: 0, crystal: 2000, deuterium: 500 },
      hull: 2000,
      shield: 1,
      attack: 1,
      speed: 0,
      driveType: 'none',
      cargo: 0,
      fuelConsumption: 0,
      complexity: 2,
      requirements: { buildings: { shipyard: 1 } },
      rapidFire: {}
    },
    mothership: {
      id: 'mothership',
      name: 'Nave Madre',
      icon: '🛸',
      description: 'Vettore strategico pesante capace di trasportare 50 navi leggere nel proprio hangar interno.',
      cost: { metal: 250000, crystal: 150000, deuterium: 50000 },
      hull: 400000,
      shield: 2500,
      attack: 5000,
      speed: 6000,
      driveType: 'hyperspaceDrive',
      cargo: 50000,
      hangarCapacity: 50,
      fuelConsumption: 2500,
      complexity: 60,
      requirements: { buildings: { shipyard: 10 }, researches: { astrophysics: 8, hyperspaceDrive: 6 } },
      rapidFire: { lightFighter: 15, heavyFighter: 10, cruiser: 5, espionageProbe: 10 }
    },
    deathStar: {
      id: 'deathStar',
      name: 'Morte Nera',
      icon: '🌑',
      description: 'Fortezza planetoide armata di superlaser gravitazionale in grado di distruggere intere lune.',
      cost: { metal: 1000000, crystal: 500000, deuterium: 100000 },
      hull: 9000000,
      shield: 50000,
      attack: 200000,
      speed: 100,
      driveType: 'hyperspaceDrive',
      cargo: 1000000,
      fuelConsumption: 1,
      complexity: 100,
      requirements: { buildings: { shipyard: 12 }, researches: { deathStarTech: 1, hyperspaceDrive: 7 } },
      rapidFire: {
        smallCargo: 250,
        largeCargo: 250,
        lightFighter: 200,
        heavyFighter: 100,
        cruiser: 33,
        battleship: 30,
        bomber: 25,
        battlecruiser: 15,
        colonyShip: 250,
        recycler: 250,
        espionageProbe: 1250,
        solarSatellite: 1250,
        rocketLauncher: 200,
        lightLaser: 200,
        heavyLaser: 100,
        gaussCannon: 50,
        ionCannon: 100
      }
    },
    invictus: {
      id: 'invictus',
      name: 'Invictus',
      icon: '⚔️',
      description: 'Ammiraglia legata a un Bacino Spaziale: potenza 4x Morte Nera, non orbita e rientra sempre al suo Bacino.',
      cost: { metal: 4000000, crystal: 2400000, deuterium: 1600000 },
      hull: 9000000,
      shield: 50000,
      attack: 800000,
      speed: 150,
      driveType: 'hyperspaceDrive',
      cargo: 1000000,
      fuelConsumption: 0,
      complexity: 100,
      specialConstruction: 'bacino',
      requirements: {},
      rapidFire: {
        smallCargo: 250, largeCargo: 250, lightFighter: 200, heavyFighter: 100,
        cruiser: 33, battleship: 30, bomber: 25, battlecruiser: 15,
        colonyShip: 250, recycler: 250, espionageProbe: 1250, solarSatellite: 1250,
        rocketLauncher: 200, lightLaser: 200, heavyLaser: 100, gaussCannon: 50, ionCannon: 100
      }
    },
    crepuscolo: {
      id: 'crepuscolo',
      name: 'Crepuscolo degli Dei',
      icon: '🌌',
      description: 'Nave piu potente dell\'impero: unica, legata a un Bacino Spaziale mai usato, salta anche tra galassie.',
      cost: { metal: 50000000, crystal: 30000000, deuterium: 20000000 },
      hull: 9000000,
      shield: 50000,
      attack: 2000000,
      speed: 300,
      driveType: 'hyperspaceDrive',
      cargo: 10000000,
      fuelConsumption: 1,
      complexity: 100,
      specialConstruction: 'bacino',
      requirements: {},
      rapidFire: {
        smallCargo: 250, largeCargo: 250, lightFighter: 200, heavyFighter: 100,
        cruiser: 33, battleship: 30, bomber: 25, battlecruiser: 15,
        colonyShip: 250, recycler: 250, espionageProbe: 1250, solarSatellite: 1250,
        rocketLauncher: 200, lightLaser: 200, heavyLaser: 100, gaussCannon: 50, ionCannon: 100
      }
    }
  };

  const DEFENSES = {
    rocketLauncher: {
      id: 'rocketLauncher',
      name: 'Lanciamissili',
      icon: '🚀',
      description: 'Torretta missilistica semplice ed economica per assorbire il fuoco nemico.',
      cost: { metal: 2000, crystal: 0, deuterium: 0 },
      hull: 2000,
      shield: 20,
      attack: 80,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 1,
      requirements: { buildings: { shipyard: 1 } },
      rapidFire: {}
    },
    lightLaser: {
      id: 'lightLaser',
      name: 'Laser Leggero',
      icon: '🔫',
      description: 'Batteria laser a tiro rapido efficace contro caccia leggeri e sonde.',
      cost: { metal: 1500, crystal: 500, deuterium: 0 },
      hull: 2000,
      shield: 25,
      attack: 100,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 2,
      requirements: { buildings: { shipyard: 2 }, researches: { laserTech: 3 } },
      rapidFire: {}
    },
    heavyLaser: {
      id: 'heavyLaser',
      name: 'Laser Pesante',
      icon: '⚡',
      description: 'Emettitore concentrato ad alta potenza capace di perforare scafi medi.',
      cost: { metal: 6000, crystal: 2000, deuterium: 0 },
      hull: 8000,
      shield: 100,
      attack: 250,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 4,
      requirements: { buildings: { shipyard: 4 }, researches: { energyTech: 3, laserTech: 6 } },
      rapidFire: {}
    },
    gaussCannon: {
      id: 'gaussCannon',
      name: 'Cannone di Gauss',
      icon: '🧲',
      description: 'Acceleratore elettromagnetico che scaglia proiettili ipersonici ad altissima penetrazione.',
      cost: { metal: 20000, crystal: 15000, deuterium: 2000 },
      hull: 35000,
      shield: 200,
      attack: 1100,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 12,
      requirements: { buildings: { shipyard: 6 }, researches: { energyTech: 6, weaponsTech: 3, shieldingTech: 1 } },
      rapidFire: {}
    },
    ionCannon: {
      id: 'ionCannon',
      name: 'Cannone Ionico',
      icon: '💠',
      description: 'Dispositivo ad alte prestazioni difensive che neutralizza gli scudi delle navi attaccanti.',
      cost: { metal: 5000, crystal: 3000, deuterium: 0 },
      hull: 8000,
      shield: 500,
      attack: 150,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 6,
      requirements: { buildings: { shipyard: 4 }, researches: { ionTech: 4 } },
      rapidFire: {}
    },
    plasmaTurret: {
      id: 'plasmaTurret',
      name: 'Torretta al Plasma',
      icon: '🔥',
      description: 'Artiglieria planetaria suprema che lancia sfere di plasma incandescente contro corazzate.',
      cost: { metal: 50000, crystal: 50000, deuterium: 30000 },
      hull: 100000,
      shield: 300,
      attack: 3000,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 35,
      requirements: { buildings: { shipyard: 8 }, researches: { plasmaTech: 7 } },
      rapidFire: {}
    },
    smallShieldDome: {
      id: 'smallShieldDome',
      name: 'Cupola Scudo Leggera',
      icon: '🛡️',
      description: 'Avvolge l’intero pianeta in una barriera energetica protettiva (Massimo 1 per pianeta).',
      cost: { metal: 10000, crystal: 10000, deuterium: 0 },
      hull: 20000,
      shield: 2000,
      attack: 1,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 10,
      maxCount: 1,
      requirements: { buildings: { shipyard: 1 }, researches: { shieldingTech: 2 } },
      rapidFire: {}
    },
    largeShieldDome: {
      id: 'largeShieldDome',
      name: 'Cupola Scudo Pesante',
      icon: '🔰',
      description: 'Barriera planetaria rinforzata capace di assorbire bombardamenti prolungati (Massimo 1).',
      cost: { metal: 50000, crystal: 50000, deuterium: 0 },
      hull: 100000,
      shield: 10000,
      attack: 1,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 25,
      maxCount: 1,
      requirements: { buildings: { shipyard: 6 }, researches: { shieldingTech: 6 } },
      rapidFire: {}
    },
    antiBallisticMissile: {
      id: 'antiBallisticMissile',
      name: 'Missile Anti-Balistico',
      icon: '🎯',
      description: 'Intercetta e distrugge in volo i missili interplanetari nemici prima dell’impatto.',
      cost: { metal: 8000, crystal: 0, deuterium: 2000 },
      hull: 8000,
      shield: 1,
      attack: 1,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 4,
      requirements: { buildings: { shipyard: 2 } },
      rapidFire: {}
    },
    spaceTrap: {
      id: 'spaceTrap',
      name: 'Trappola Spaziale (Mina)',
      icon: '💥',
      description: 'Mina orbitale occultata che detona prima della battaglia danneggiando la flotta nemica.',
      cost: { metal: 12000, crystal: 8000, deuterium: 4000 },
      hull: 5000,
      shield: 0,
      attack: 2500,
      speed: 0,
      cargo: 0,
      fuelConsumption: 0,
      complexity: 8,
      requirements: { buildings: { shipyard: 5 }, researches: { espionageTech: 5, weaponsTech: 4 } },
      rapidFire: {}
    }
  };

  // =========================================================
  // FUNZIONI DI CALCOLO COSTI, PRODUZIONI E REQUISITI
  // =========================================================
  function getBuildingCost(buildingId, targetLevel, isMoon = false) {
    const def = isMoon ? MOON_BUILDINGS[buildingId] : BUILDINGS[buildingId];
    if (!def) return { metal: 0, crystal: 0, deuterium: 0 };
    const lv = Math.max(1, Number(targetLevel) || 1);
    const mult = Math.pow(def.factor, lv - 1);
    return {
      metal: Math.floor(def.baseCost.metal * mult),
      crystal: Math.floor(def.baseCost.crystal * mult),
      deuterium: Math.floor(def.baseCost.deuterium * mult)
    };
  }

  function getResearchCost(researchId, targetLevel) {
    const def = RESEARCHES[researchId];
    if (!def) return { metal: 0, crystal: 0, deuterium: 0 };
    const lv = Math.max(1, Number(targetLevel) || 1);
    const mult = Math.pow(def.factor, lv - 1);
    return {
      metal: Math.floor(def.baseCost.metal * mult),
      crystal: Math.floor(def.baseCost.crystal * mult),
      deuterium: Math.floor(def.baseCost.deuterium * mult)
    };
  }

  function getBuildingEnergyDelta(buildingId, level, maxTemp = 30) {
    const lv = Math.max(0, Number(level) || 0);
    if (lv === 0) return 0;
    switch (buildingId) {
      case 'metalMine':
        return -Math.ceil(10 * lv * Math.pow(1.1, lv));
      case 'crystalMine':
        return -Math.ceil(10 * lv * Math.pow(1.1, lv));
      case 'deuteriumSynth':
        return -Math.ceil(20 * lv * Math.pow(1.1, lv));
      case 'solarPlant':
        // Bonus lieve su pianeti caldi
        return Math.floor(20 * lv * Math.pow(1.1, lv) * (1 + maxTemp / 400));
      case 'fusionReactor':
        return Math.floor(30 * lv * Math.pow(1.05, lv));
      default:
        return 0;
    }
  }

  function getBaseHourlyProduction(buildingId, level, maxTemp = 30) {
    const lv = Math.max(0, Number(level) || 0);
    if (lv === 0) return 0;
    switch (buildingId) {
      case 'metalMine':
        return Math.floor(30 * lv * Math.pow(1.1, lv));
      case 'crystalMine':
        return Math.floor(20 * lv * Math.pow(1.1, lv));
      case 'deuteriumSynth': {
        // Pianeti freddi producono significativamente più deuterio
        const tempFactor = Math.max(0.2, 1.36 - 0.004 * maxTemp);
        return Math.floor(10 * lv * Math.pow(1.1, lv) * tempFactor);
      }
      default:
        return 0;
    }
  }

  function getStorageCapacity(level) {
    const lv = Math.max(0, Number(level) || 0);
    return Math.floor(5000 * Math.pow(2.5, Math.floor(lv / 2)) * Math.pow(1.5, lv % 2) + (lv === 0 ? 5000 : 10000 * lv));
  }

  function getMaxFields(planet) {
    const base = Number(planet.fieldsMax) || 200;
    const tf = Number(planet.buildings?.terraformer) || 0;
    return base + tf * 5;
  }

  function getUsedFields(planet) {
    if (!planet || !planet.buildings) return 0;
    let total = 0;
    for (const key of Object.keys(BUILDINGS)) {
      if (key === 'deuteriumSynth') {
        total += Number(planet.buildings.deuteriumSynth ?? planet.buildings.deuteriumSynthesizer ?? 0);
      } else {
        total += Number(planet.buildings[key] || 0);
      }
    }
    return total;
  }

  function getMoonMaxFields(moon) {
    if (!moon) return 0;
    const base = Number(moon.fieldsMax) || 1;
    const lunarBaseLv = Number(moon.buildings?.lunarBase) || 0;
    return base + lunarBaseLv * 3;
  }

  function getMoonUsedFields(moon) {
    if (!moon || !moon.buildings) return 0;
    let total = 0;
    for (const key of Object.keys(MOON_BUILDINGS)) {
      total += Number(moon.buildings[key] || 0);
    }
    return total;
  }

  function checkRequirements(requirements, planet, universe, isMoon = false) {
    if (!requirements) return { met: true, missing: [] };
    const missing = [];

    if (requirements.buildings) {
      for (const [bId, reqLv] of Object.entries(requirements.buildings)) {
        const cur = bId === 'deuteriumSynth'
          ? Number(planet.buildings?.deuteriumSynth ?? planet.buildings?.deuteriumSynthesizer ?? 0)
          : Number(planet.buildings?.[bId] || 0);
        if (cur < reqLv) {
          const name = BUILDINGS[bId]?.name || bId;
          missing.push(`${name} Lv.${reqLv}`);
        }
      }
    }

    if (requirements.moonBuildings && isMoon && planet.moon) {
      for (const [mbId, reqLv] of Object.entries(requirements.moonBuildings)) {
        const cur = Number(planet.moon.buildings?.[mbId] || 0);
        if (cur < reqLv) {
          const name = MOON_BUILDINGS[mbId]?.name || mbId;
          missing.push(`${name} Lv.${reqLv}`);
        }
      }
    }

    if (requirements.researches) {
      for (const [rId, reqLv] of Object.entries(requirements.researches)) {
        const cur = Number(universe.researches?.[rId] || 0);
        if (cur < reqLv) {
          const name = RESEARCHES[rId]?.name || rId;
          missing.push(`${name} Lv.${reqLv}`);
        }
      }
    }

    return { met: missing.length === 0, missing };
  }

  window.UniversumData = {
    BUILDINGS,
    MOON_BUILDINGS,
    BACINO_SPAZIALE,
    INVICTUS,
    CREPUSCOLO,
    GALATTICA,
    GALATTICA_STRUCTURES,
    RESEARCHES,
    SHIPS,
    DEFENSES,
    getBuildingCost,
    getResearchCost,
    getBuildingEnergyDelta,
    getBaseHourlyProduction,
    getStorageCapacity,
    getMaxFields,
    getUsedFields,
    getMoonMaxFields,
    getMoonUsedFields,
    checkRequirements
  };
})();

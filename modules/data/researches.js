/** UNIVERSUM / modules/data/researches.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';


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
  Object.assign(window.__UniversumCatalog || (window.__UniversumCatalog = {}), {RESEARCHES});
})();

/**
 * UNIVERSUM — Pagina Guida / Aiuto
 * Genera dinamicamente le sezioni a partire da window.UniversumData.
 * Accessibile da sidebar (desktop) e drawer (mobile) via data-view="guide".
 */
(function () {
  'use strict';

  const UI = window.UniversumUI;
  if (!UI) return;

  // Stato locale della guida (non persistito)
  const guideState = {
    openSections: new Set(['intro']),
    searchQuery: ''
  };

  // =========================================================
  // HELPERS DI RENDER
  // =========================================================
  function _esc(str) { return UI.escapeHTML(String(str ?? '')); }
  function _num(n) { return UI.formatNum(Number(n) || 0); }

  function _linkTo(view, label) {
    if (!view) return '';
    return `<button type="button" class="btn btn-blue btn-sm guide-go" data-view="${_esc(view)}" style="margin-top:6px;">→ ${_esc(label || 'VAI ALLA SEZIONE')}</button>`;
  }

  function _sectionHeader(title, subtitle) {
    return `<div style="margin-bottom:10px;">
      <h3 style="font-size:1rem; color:var(--res-crystal); margin-bottom:4px;">${_esc(title)}</h3>
      ${subtitle ? `<p class="text-muted" style="font-size:0.9rem;">${_esc(subtitle)}</p>` : ''}
    </div>`;
  }

  function _dataCard(item, kind, opts = {}) {
    const art = opts.artId ? UI.artTag(opts.artId, 'unit-art-sm', item.name) : '';
    const cost = item.cost || item.baseCost || {};
    const hasCost = (cost.metal > 0 || cost.crystal > 0 || cost.deuterium > 0);
    const req = item.requirements || {};
    const reqParts = [];
    if (req.buildings) for (const [k, v] of Object.entries(req.buildings)) reqParts.push(`${(window.UniversumData.BUILDINGS[k]?.name || k)} Lv.${v}`);
    if (req.researches) for (const [k, v] of Object.entries(req.researches)) reqParts.push(`${(window.UniversumData.RESEARCHES[k]?.name || k)} Lv.${v}`);

    const stats = [];
    if (typeof item.attack === 'number') stats.push(`${UI.svgIcon('sword')} ${_num(item.attack)}`);
    if (typeof item.shield === 'number') stats.push(`${UI.svgIcon('shield')} ${_num(item.shield)}`);
    if (typeof item.hull === 'number') stats.push(`${UI.svgIcon('hull')} ${_num(item.hull)}`);
    if (typeof item.cargo === 'number' && item.cargo > 0) stats.push(`${UI.svgIcon('cargo')} ${_num(item.cargo)}`);
    if (typeof item.speed === 'number' && item.speed > 0) stats.push(`${UI.svgIcon('bolt')} ${_num(item.speed)}`);

    return `<div class="glass-panel" style="padding:12px; margin-bottom:8px; display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; gap:10px; align-items:flex-start;">
        ${art}
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
            <strong style="font-size:0.98rem;">${_esc(item.name || item.id)}</strong>
            ${opts.badge ? `<span class="badge badge-blue">${_esc(opts.badge)}</span>` : ''}
          </div>
          <p class="text-muted" style="font-size:0.86rem; margin-top:2px;">${_esc(item.description || '')}</p>
        </div>
      </div>
      ${stats.length ? `<div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; color:var(--res-crystal);">${stats.map((s) => `<span>${s}</span>`).join('')}</div>` : ''}
      ${hasCost ? `<div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; font-weight:700;">
        ${cost.metal > 0 ? `<span class="cost-item text-metal">M ${_num(cost.metal)}</span>` : ''}
        ${cost.crystal > 0 ? `<span class="cost-item text-crystal">C ${_num(cost.crystal)}</span>` : ''}
        ${cost.deuterium > 0 ? `<span class="cost-item text-deuterium">D ${_num(cost.deuterium)}</span>` : ''}
      </div>` : ''}
            ${reqParts.length ? `<p class="text-muted" style="font-size:0.82rem;">${UI.svgIcon('lock')} Richiede: ${_esc(reqParts.join(', '))}</p>` : ''}
        ${opts.hint ? `<p class="text-muted" style="font-size:0.82rem; font-style:italic;">Suggerimento: ${_esc(opts.hint)}</p>` : ''}
    </div>`;
  }

  function _missionCard(missionId, label, what, when, risk) {
    return `<div class="glass-panel" style="padding:12px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
        <strong style="font-size:0.98rem;">${_esc(label)}</strong>
        <span class="badge badge-neutral">${_esc(missionId)}</span>
      </div>
      <p style="font-size:0.9rem; margin-bottom:4px;"><strong>Cosa fa:</strong> ${_esc(what)}</p>
      <p class="text-muted" style="font-size:0.86rem; margin-bottom:4px;"><strong>Quando usarla:</strong> ${_esc(when)}</p>
      <p class="text-muted" style="font-size:0.86rem;"><strong>Rischi / note:</strong> ${_esc(risk)}</p>
    </div>`;
  }

  function _imageHeader(artId, title, subtitle) {
    return `<div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
      ${UI.artTag(artId, 'unit-art', title)}
      <div>
        <h3 style="font-size:1.05rem; color:var(--res-crystal); margin-bottom:4px;">${_esc(title)}</h3>
        ${subtitle ? `<p class="text-muted" style="font-size:0.88rem;">${_esc(subtitle)}</p>` : ''}
      </div>
    </div>`;
  }

  // =========================================================
  // SEZIONI DELLA GUIDA
  // =========================================================
  function renderIntro() {
    return `<div class="glass-panel" style="padding:14px; margin-bottom:10px;">
      <p style="font-size:0.92rem; margin-bottom:8px;">UNIVERSUM è un gestionale spaziale a turni reali. Il tuo obiettivo è espandere l'Impero costruendo miniere, ricerche, flotte e colonie su più pianeti.</p>
      <ol style="padding-left:18px; font-size:0.9rem; line-height:1.7;">
        <li><strong>Produci risorse</strong> — costruisci Miniera di Metallo, Miniera di Cristallo e Sintetizzatore di Deuterio.</li>
        <li><strong>Energia</strong> — le miniere consumano energia: bilancia Centrale Solare e Reattore a Fusione.</li>
        <li><strong>Ricerca</strong> — sblocca navi migliori, propulsori, armi e nuove meccaniche (Luna, Galattica).</li>
        <li><strong>Cantiere</strong> — produci Cargo, Caccia, Incrociatori, Morte Nera, Colonizzatrici e Riciclatrici.</li>
        <li><strong>Flotte</strong> — lancia missioni: attacco, spionaggio, trasporto, riciclaggio, esplorazione, colonizzazione.</li>
        <li><strong>Galassia</strong> — esplora i sistemi, trova pianeti BOT da attaccare o slot liberi da colonizzare.</li>
        <li><strong>Espandi</strong> — Luna, Bacino Spaziale, Invictus, Crepuscolo e infine la Galattica (nave-pianeta).</li>
      </ol>
      <p class="text-muted" style="font-size:0.86rem; margin-top:8px;">Suggerimento: parti dalle miniere, poi Cantiere Navale, poi Ricerca. Non lasciare mai l'energia in negativo.</p>
    </div>
    ${_linkTo('buildings', 'VAI A EDIFICI')}`;
  }

  function renderResources() {
    return `${_sectionHeader('Risorse & Energia', 'Le tre risorse principali e l\'energia che le muove.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:8px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong class="text-metal">Metallo</strong> — si estrae con la Miniera di Metallo. Serve per quasi tutto: edifici, scafi, difese.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong class="text-crystal">Cristallo</strong> — si estrae con la Miniera di Cristallo. Fondamentale per ricerca, elettronica e navi.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong class="text-deuterium">Deuterio</strong> — si produce col Sintetizzatore di Deuterio. Carburante per flotte, ricerche avanzate, salti.</p>
      <p style="font-size:0.9rem;"><strong class="text-energy">Energia</strong> — prodotta da Centrale Solare e Reattore a Fusione. Se va in negativo, le miniere si fermano.</p>
    </div>
    ${_linkTo('buildings', 'GESTISCI EDIFICI')}`;
  }

  function renderBuildings() {
    const Data = window.UniversumData;
    return `${_sectionHeader('Edifici Planetari', 'Tutti gli edifici costruibili su un pianeta.')}
    ${Object.values(Data.BUILDINGS).map((b) => _dataCard(b, 'building', { artId: b.id, hint: b.id === 'hiddenBunker' ? 'Riduce le risorse saccheggiabili in caso di attacco.' : b.id === 'terraformer' ? 'Aggiunge +5 campi per livello.' : '' })).join('')}
    ${_linkTo('buildings', 'VAI A EDIFICI')}`;
  }

  function renderResearch() {
    const Data = window.UniversumData;
    const groups = {
      'Economia & Produzione': ['energyTech', 'plasmaTech', 'intergalacticNetwork'],
      'Propulsione & Velocità': ['combustionDrive', 'impulseDrive', 'hyperspaceDrive', 'hyperspaceTech'],
      'Militare & Difesa': ['weaponsTech', 'shieldingTech', 'armourTech'],
      'Spionaggio & Comando': ['espionageTech', 'computerTech', 'astrophysics'],
      'Lune & Portali': ['lunarTech', 'jumpGateTech'],
      'Armi Speciali': ['laserTech', 'ionTech', 'deathStarTech'],
      'Galattica (Requisiti)': ['quantumPhysics', 'jumpPropulsion', 'mobilePlanetaryStructure', 'stellarReactor', 'spatialTerraforming']
    };
    return `${_sectionHeader('Ricerche', 'Ogni ricerca si applica a tutto l\'Impero, non solo al pianeta dove la avvii.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem;">Le ricerche si avviano dal Laboratorio di Ricerca. Puoi fare <strong>una sola ricerca alla volta</strong> per tutto l'Impero. Ogni livello costa sempre di più (fattore 2x o 1.75x) e richiede tempo crescente.</p>
      <p class="text-muted" style="font-size:0.86rem; margin-top:6px;">Le ricerche galattica sono requisiti obbligatori per costruire la Galattica: quantumPhysics 10, jumpPropulsion 8, mobilePlanetaryStructure 5, stellarReactor 7, spatialTerraforming 5.</p>
    </div>
    ${Object.entries(groups).map(([group, ids]) => `
      <h4 style="font-size:0.9rem; color:var(--res-crystal); margin:10px 0 8px;">${_esc(group)}</h4>
      ${ids.map((id) => Data.RESEARCHES[id] ? _dataCard(Data.RESEARCHES[id], 'research', { artId: id }) : '').join('')}
    `).join('')}
    ${_linkTo('research', 'VAI A RICERCHE')}`;
  }

  function renderShips() {
    const Data = window.UniversumData;
    const order = ['smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'bomber', 'battlecruiser', 'colonyShip', 'recycler', 'espionageProbe', 'solarSatellite', 'mothership', 'deathStar', 'invictus', 'crepuscolo'];
    return `${_sectionHeader('Navi', 'Le 16 navi del gioco: cosa fanno e come si ottengono.')}
    ${order.map((id) => {
      const s = Data.SHIPS[id];
      if (!s) return '';
      const hints = {
        invictus: 'Costruibile solo nel Bacino Spaziale (max 4 per Bacino).',
        crepuscolo: 'Costruibile solo in un Bacino mai usato, max 1 per Impero.',
        deathStar: 'Richiede Tecnologia Gravitonica Suprema. Può distruggere Lune/Bacini.',
        colonyShip: 'Necessaria per fondare nuove colonie (missione Colonizzazione).',
        recycler: 'Necessaria per raccogliere detriti dopo una battaglia (missione Riciclaggio).',
        espionageProbe: 'Necessaria per le missioni Spionaggio (almeno 1 nella flotta).',
        mothership: 'Trasporta fino a 50 navi leggere nell\'hangar.',
        solarSatellite: 'Non si può usare in missione, resta in orbita al pianeta.'
      };
      return _dataCard(s, 'ship', { artId: id, hint: hints[id] || '' });
    }).join('')}
    ${_linkTo('shipyard', 'VAI A CANTIERE')}`;
  }

  function renderDefenses() {
    const Data = window.UniversumData;
    return `${_sectionHeader('Difese Planetarie', 'Le 10 difese installabili su un pianeta o Bacino.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem;">Le difese <strong>non si spostano</strong> e non si possono inviare in missione. Dopo una battaglia, il <strong>70%</strong> delle difese distrutte viene riparato automaticamente. Restano sempre sul pianeta dove le costruisci.</p>
    </div>
    ${Object.values(Data.DEFENSES).map((d) => _dataCard(d, 'defense', { artId: d.id, badge: d.maxCount ? `Max ${d.maxCount}` : '' })).join('')}
    ${_linkTo('defense', 'VAI A DIFESA')}`;
  }

  function renderMoon() {
    const Data = window.UniversumData;
    return `${_imageHeader('lunarBase', 'Luna', 'Slot orbitale che si crea dai detriti di una battaglia o manualmente (richiede Ingegneria Lunare Lv.1).')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem; margin-bottom:6px;">Una Luna occupa lo slot orbitale del pianeta. Fornisce campi extra e permette di costruire:</p>
      <ul style="padding-left:18px; font-size:0.9rem; line-height:1.6;">
        <li>Cantiere Segreto (navi a -20% tempo, +20% costo)</li>
        <li>Falange di Sensori (vede flotte nemiche in arrivo nei sistemi vicini)</li>
        <li>Portale Iperspaziale (teletrasporta flotte tra Lune)</li>
      </ul>
      <p class="text-muted" style="font-size:0.86rem; margin-top:6px;">Luna e Bacino Spaziale sono <strong>mutuamente esclusivi</strong>: su un pianeta hai l'uno o l'altro, mai entrambi.</p>
    </div>
    <h4 style="font-size:0.9rem; color:var(--res-crystal); margin:10px 0 8px;">Edifici Lunari</h4>
    ${Object.values(Data.MOON_BUILDINGS).map((mb) => _dataCard(mb, 'moonBuilding', { artId: mb.id })).join('')}
    ${_linkTo('moon', 'VAI A LUNA')}`;
  }

  function renderBacino() {
    const Data = window.UniversumData;
    const B = Data.BACINO_SPAZIALE;
    return `${_imageHeader('bacinoSpaziale', 'Bacino Spaziale', 'Alternativa alla Luna: cantiere orbitale in 20 giorni reali, pagato a rate giornaliere.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Costo totale:</strong> ${_num(B.totalCost.metal)} M · ${_num(B.totalCost.crystal)} C · ${_num(B.totalCost.deuterium)} D</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Rata giornaliera:</strong> ${_num(B.dailyCost.metal)} M · ${_num(B.dailyCost.crystal)} C · ${_num(B.dailyCost.deuterium)} D</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Durata:</strong> ${B.totalDays} giorni reali (non scalati dalla velocità dell'universo).</p>
      <p class="text-muted" style="font-size:0.86rem;">Se non paghi una rata, il cantiere si ferma e riprende quando torni a pagarla. Al termine occupa lo slot orbitale al posto della Luna.</p>
    </div>
    <div class="glass-panel" style="padding:12px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Cosa sblocca:</strong></p>
      <ul style="padding-left:18px; font-size:0.9rem; line-height:1.6;">
        <li><strong>Invictus</strong> — ammiraglia da battaglia (max 4 per Bacino).</li>
        <li><strong>Crepuscolo degli Dei</strong> — nave unica d'Impero, solo in un Bacino mai usato.</li>
        <li><strong>Galattica</strong> — nave-pianeta che prende il posto del Bacino stesso.</li>
      </ul>
      <p class="text-muted" style="font-size:0.86rem; margin-top:6px;">Distruggibile con Morte Nera (missione Distruzione Luna/Bacino). Se distrutto, si forma una Luna dai detriti.</p>
    </div>
    ${_linkTo('moon', 'VAI A BACINO (vista Luna)')}`;
  }

  function renderInvictus() {
    const Data = window.UniversumData;
    const I = Data.INVICTUS;
    const ship = Data.SHIPS.invictus;
    return `${_imageHeader('invictus', 'Invictus', 'Ammiraglia legata a un Bacino Spaziale.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Costo per unità:</strong> ${_num(ship.cost.metal)} M · ${_num(ship.cost.crystal)} C · ${_num(ship.cost.deuterium)} D</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Rate:</strong> ${_num(I.dailyCost.metal)} M · ${_num(I.dailyCost.crystal)} C · ${_num(I.dailyCost.deuterium)} D al giorno per ${I.totalDays} giorni.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Limite:</strong> max ${I.maxPerBacino} per Bacino (attive + in costruzione).</p>
      <p style="font-size:0.9rem;"><strong>Salto:</strong> ${_num(I.jumpDeuteriumPerShip)} D per nave ogni ${I.jumpSystemsStep} sistemi (non salta tra galassie).</p>
    </div>
    <div class="glass-panel" style="padding:12px;">
      <p style="font-size:0.9rem;">L'Invictus è 4x più potente di una Morte Nera, ma <strong>rientra sempre al suo Bacino</strong>: se il Bacino viene distrutto durante la missione, l'Invictus diventa detriti al rientro. Se perde (o vince) e torna danneggiata, resta al Bacino per ripararsi.</p>
    </div>
    ${_linkTo('moon', 'VAI AL BACINO')}`;
  }

  function renderCrepuscolo() {
    const Data = window.UniversumData;
    const C = Data.CREPUSCOLO;
    const ship = Data.SHIPS.crepuscolo;
    return `${_imageHeader('crepuscolo', 'Crepuscolo degli Dei', 'La nave più potente dell\'Impero. Unica.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Come si ottiene:</strong></p>
      <ol style="padding-left:18px; font-size:0.9rem; line-height:1.6;">
        <li><strong>Costruzione diretta</strong> — in un Bacino <em>mai usato da nessuna nave</em> (Bacino Vuoto). Costo: ${_num(ship.cost.metal)} M · ${_num(ship.cost.crystal)} C · ${_num(ship.cost.deuterium)} D. Rate: ${_num(C.dailyCost.metal)} M · ${_num(C.dailyCost.crystal)} C · ${_num(C.dailyCost.deuterium)} D al giorno per ${C.buildDays} giorni reali.</li>
        <li><strong>Relitto da esplorazione</strong> — missione Esplorazione di almeno ${C.wreckExploreHours}h con almeno ${C.wreckMinDeathStars} Morti Nere nella flotta. Probabilità: ${(C.wreckChance * 100).toFixed(1)}%. Riparazione: ${C.wreckRepairDays} giorni reali.</li>
      </ol>
      <p style="font-size:0.9rem; margin-top:6px;"><strong>Limite:</strong> max ${C.maxPerEmpire} per Impero.</p>
    </div>
    <div class="glass-panel" style="padding:12px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Stati della Crepuscolo:</strong></p>
      <ul style="padding-left:18px; font-size:0.9rem; line-height:1.6;">
        <li><strong>active</strong> — operativa, può essere inviata in missione.</li>
        <li><strong>inMission</strong> — in volo con una flotta.</li>
        <li><strong>repairing</strong> — in riparazione al Bacino (${C.battleRepairDays} giorni dopo una battaglia).</li>
        <li><strong>limbo</strong> — il Bacino è stato distrutto: la Crepuscolo vaga all'1% della velocità verso il pianeta madre e resta in attesa.</li>
      </ul>
      <p class="text-muted" style="font-size:0.86rem; margin-top:6px;">Se il Bacino viene distrutto durante il volo e non c'è un altro Bacino disponibile, la Crepuscolo diventa relitto perduto.</p>
    </div>
    ${_linkTo('moon', 'VAI AL BACINO')}`;
  }

  function renderGalattica() {
    const Data = window.UniversumData;
    const G = Data.GALATTICA;
    const reqParts = Object.entries(G.requirements.researches).map(([k, v]) => `${Data.RESEARCHES[k]?.name || k} Lv.${v}`);
    return `${_imageHeader('galattica', 'Galattica', 'Nave-pianeta. Massima espansione dell\'Impero.')}
    <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Requisiti:</strong> ${_esc(reqParts.join(', '))}</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Costo:</strong> ${_num(G.totalCost.metal)} M · ${_num(G.totalCost.crystal)} C · ${_num(G.totalCost.deuterium)} D (rate ${_num(G.dailyCost.metal)} M · ${_num(G.dailyCost.crystal)} C · ${_num(G.dailyCost.deuterium)} D al giorno per ${G.buildDays} giorni reali).</p>
      <p style="font-size:0.9rem;"><strong>Limite:</strong> max ${G.maxPerEmpire} per Impero. Prende il posto del Bacino che la costruisce.</p>
    </div>
    <div class="glass-panel" style="padding:12px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Cosa può fare:</strong></p>
      <ul style="padding-left:18px; font-size:0.9rem; line-height:1.6;">
        <li>Produrre risorse (come un pianeta) con strutture interne potenziabili.</li>
        <li>Costruire difese (a prezzo <strong>doppio</strong>) e navi (cantiere interno).</li>
        <li>Lanciare missioni flotta verso altri pianeti (tutte tranne Colonizzazione e Schieramento).</li>
        <li>Saltare tra sistemi e galassie con il Salto Quantico (${_num(G.jumpDeuteriumPerSystemStep)} D ogni ${G.jumpSystemsStep} sistemi + ${_num(G.jumpGalaxyExtraDeuterium)} D per galassia).</li>
        <li>Al salto, il 50% delle navi in orbita viene distrutto. Le navi in missione non vengono toccate e rientrano alla nuova posizione.</li>
      </ul>
      <p class="text-muted" style="font-size:0.86rem; margin-top:6px;">Distruggibile con Morte Nera. Se distrutta, al suo posto può formarsi una Luna (75% di probabilità).</p>
    </div>
    ${_linkTo('moon', 'GESTISCI GALATTICA')}`;
  }

  function renderMissions() {
    return `${_sectionHeader('Missioni Flotta', 'Tutte le missioni disponibili in Flotta & Missioni.')}
    ${_missionCard('attack', 'Attacco', 'Attacchi un pianeta BOT o un giocatore. Risoluzione a 6 round. Se vinci saccheggi risorse, se hai una Colonizzatrice e distruggi tutte le difese, puoi conquistare il pianeta.', 'Bersagli redditizi dopo uno spionaggio.', 'Perdi navi, possibili detriti per il difensore.')}
    ${_missionCard('spy', 'Spionaggio', 'Invii almeno una Sonda Spia. Ottieni un report su risorse, flotte e difese del bersaglio.', 'Prima di un attacco, per capire cosa c\'è.', 'Le sonde possono essere distrutte dal controspionaggio.')}
    ${_missionCard('transport', 'Trasporto', 'Invii risorse a un pianeta tuo o a un pianeta BOT. La flotta torna indietro.', 'Rifornire una colonia.', 'Il cargo è esposto a intercettazioni nemiche.')}
    ${_missionCard('deploy', 'Schieramento', 'Sposti navi e risorse in modo permanente su un altro tuo pianeta. La flotta NON torna.', 'Spostare la flotta su un pianeta più vicino al fronte.', 'Attenzione: è definitivo.')}
    ${_missionCard('colonize', 'Colonizzazione', 'Invii almeno una Colonizzatrice su uno slot vuoto per fondare una nuova colonia.', 'Espandere l\'Impero.', 'La colonia parte con poche risorse.')}
    ${_missionCard('recycle', 'Riciclaggio', 'Invii almeno una Riciclatrice per raccogliere Metallo e Cristallo dai detriti lasciati da una battaglia.', 'Dopo un attacco (tuo o subito).', 'I detriti possono essere rubati da altri giocatori.')}
    ${_missionCard('explore', 'Esplorazione', 'Invii una flotta in posizione 16 (Spazio Profondo). Eventi casuali: risorse, navi, relitti, pirati.', 'Cercare risorse rare o relitti rari.', 'Possibili perdite di navi. Durata scelta (1h base + 1h per livello expeditionTech).')}
    ${_missionCard('destroyMoon', 'Distruzione Luna/Bacino', 'Invii una Morte Nera per tentare di distruggere una Luna o un Bacino nemico. Probabilità 10% per ogni Morte Nera.', 'Rimuovere la base operativa nemica.', 'La Morte Nera può essere distrutta. Se distruggi il Bacino, si forma una Luna.')}
    ${_missionCard('embargo', 'Embargo Planetario', 'Impedisci partenze e arrivi su un pianeta nemico. Consuma deuterio dalla stiva della flotta nel tempo.', 'Bloccare un pianeta senza distruggerlo.', 'La flotta resta in orbita (occupa 1 slot). Può essere attaccata.')}
    ${_missionCard('occupy', 'Occupazione Planetaria', 'Prelevi il 5% delle risorse del pianeta nemico ogni giorno. Consuma deuterio del pianeta occupato.', 'Spremere un pianeta senza distruggerlo.', 'La flotta resta in orbita (occupa 1 slot). Il nemico può pagare un riscatto o attaccarti.')}
    ${_missionCard('galattica-return', 'Rientro Galattica', 'Missione speciale generata automaticamente quando una flotta lanciata da una Galattica torna mentre la Galattica si è spostata. Viaggia al 5% della velocità.', '(Automatico, non scegli tu).', 'Non richiamabile. Attendi il rientro naturale.')}
    ${_linkTo('fleet', 'VAI A FLOTTA')}`;
  }

  function renderSlots() {
    return `${_sectionHeader('Slot Flotta', 'Quante missioni puoi avere in volo contemporaneamente.')}
    <div class="glass-panel" style="padding:14px;">
      <p style="font-size:0.92rem; margin-bottom:8px;"><strong>Formula:</strong> <code>5 + Livello Tecnologia Informatica + Numero di Galattiche possedute</code>.</p>
      <p style="font-size:0.9rem; margin-bottom:8px;">Esempio: Tecnologia Informatica Lv.3 e 1 Galattica → 5 + 3 + 1 = <strong>9 slot</strong>.</p>
      <p class="text-muted" style="font-size:0.88rem;">Ogni missione in volo consuma 1 slot. Ogni Galattica consuma 1 slot fisso (anche se non sta facendo nulla). Embargo e Occupazione occupano 1 slot finché restano attivi.</p>
      <p style="font-size:0.88rem; margin-top:8px;"><strong>Come aumentare:</strong> ricerca Tecnologia Informatica (ogni livello +1 slot) e costruisci Galattiche.</p>
    </div>
    ${_linkTo('movements', 'VEDI I TUOI SLOT')}`;
  }

  function renderSpy() {
    return `${_sectionHeader('Spionaggio & Simulatore', 'Come leggere i report e prevedere una battaglia.')}
    <div class="glass-panel" style="padding:14px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Report di spionaggio:</strong> più sonde invii e più alta è la tua Tecnologia Spionaggio, più dettagli vedi (risorse, flotte, difese, edifici, tecnologie).</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Incertezza:</strong> i numeri delle flotte nemiche hanno sempre un margine di errore. Più report fai, più il margine si riduce.</p>
      <p style="font-size:0.9rem;"><strong>Simulatore:</strong> nella scheda Spionaggio puoi lanciare una simulazione Monte Carlo (30 iterazioni) per vedere probabilità di vittoria, perdite attese e detriti stimati.</p>
    </div>
    ${_linkTo('espionage', 'VAI A SPIONAGGIO')}`;
  }

  function renderTrade() {
    return `${_sectionHeader('Commercio & Mercato Nero', 'Scambiare risorse con BOT.')}
    <div class="glass-panel" style="padding:14px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Commercio BOT:</strong> scambi risorse con un pianeta BOT. Il tasso è fisso (Metallo:Cristallo:Deuterio = 3:2:1) ma ogni BOT può avere tassi diversi.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Mercante di Lune (universi Normali offline e online):</strong> costo 1.000.000 Deuterio, flotta di stanza sul pianeta distrutta, difese intatte. I detriti teorici valgono il 30% di Metallo e Cristallo delle navi perse; ogni 100.000 unità di detriti concede 1% di possibilità di Luna, massimo 20%. Per ingaggiarlo servono almeno 100.000 detriti teorici; i detriti sono sempre ritirati dal mercante, anche in caso di fallimento. In Creativa rimane il pulsante Crea Luna nella sezione Luna.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Mercato Nero:</strong> scambio con tasso più sfavorevole (-15%) ma senza BOT.</p>
      <p style="font-size:0.9rem;"><strong>Contratti BOT:</strong> paghi 10.000 Metallo/giorno per avere un BOT che ti difende (bonus difensivo passivo).</p>
    </div>
    ${_linkTo('diplomacy', 'VAI A COMMERCIO')}`;
  }

  function renderSieges() {
    return `${_sectionHeader('Embargo & Occupazione', 'Bloccare o spremere un pianeta senza distruggerlo.')}
    <div class="glass-panel" style="padding:14px;">
      <p style="font-size:0.9rem; margin-bottom:8px;"><strong>Embargo Planetario</strong> — blocca tutte le partenze e gli arrivi sul pianeta bersaglio (tranne gli attacchi). Durata = quanto deuterio hai in stiva (si consuma nel tempo).</p>
      <p style="font-size:0.9rem; margin-bottom:8px;"><strong>Occupazione Planetaria</strong> — prelevi il 5% delle risorse del pianeta ogni giorno. Consuma deuterio del pianeta occupato.</p>
      <p style="font-size:0.9rem;"><strong>Riscatto:</strong> il difensore può pagare un riscatto per liberarsi. Il prezzo lo decide chi attacca al momento della missione.</p>
      <p style="font-size:0.9rem;"><strong>Attaccare la flotta orbitale:</strong> il difensore può inviare una flotta per distruggere chi lo sta assediando.</p>
    </div>
    ${_linkTo('movements', 'VAI A MOVIMENTI')}`;
  }

  function renderCreative() {
    return `${_sectionHeader('Modalità Creativa', 'Come funziona l\'offline creativo (solo partite offline).')}
    <div class="glass-panel" style="padding:14px;">
      <p style="font-size:0.9rem; margin-bottom:6px;">In modalità creativa:</p>
      <ul style="padding-left:18px; font-size:0.9rem; line-height:1.6;">
        <li>Risorse infinite (∞ nella barra in alto).</li>
        <li>Costruzioni, ricerche e produzione navi istantanee (0s).</li>
        <li>Bacino, Invictus, Crepuscolo, Galattica si completano istantaneamente.</li>
        <li>Barra rapida in alto con cheat (+10M risorse, completa code, sblocca tecnologie, +10 Morti Nere).</li>
        <li>Nessun BOT ostile, nessun attacco in arrivo.</li>
      </ul>
      <p class="text-muted" style="font-size:0.86rem; margin-top:8px;">La modalità creativa NON è disponibile nei server online PvP.</p>
    </div>`;
  }

  function renderTips() {
    return `${_sectionHeader('Consigli & Errori Comuni', 'Le domande più frequenti.')}
    <div class="glass-panel" style="padding:14px; margin-bottom:8px;">
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>«Perché non posso costruire il Bacino?»</strong><br>Serve uno slot orbitale libero: niente Luna, niente Bacino già esistente, niente Galattica sopra il pianeta.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>«Perché le miniere producono poco?»</strong><br>Probabilmente hai energia in negativo. Controlla il saldo energia nella Panoramica: se è sotto zero, le miniere si fermano o producono meno.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>«Perché non posso costruire la Crepuscolo?»</strong><br>Serve un Bacino <em>mai usato da nessuna nave</em> (deve essere "vuoto"). Se hai già Invictus o un'altra Crepuscolo nel Bacino, non puoi.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>«Perché non posso costruire la Galattica?»</strong><br>Servono 5 ricerche specifiche ai livelli indicati (quantumPhysics 10, jumpPropulsion 8, mobilePlanetaryStructure 5, stellarReactor 7, spatialTerraforming 5) e un Bacino attivo senza navi legate.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>«Ho perso la flotta in Esplorazione, perché?»</strong><br>L'Esplorazione ha eventi casuali: pirati, buchi neri, relitti. Puoi perdere navi. Non è un bug, è il rischio dell'esplorazione.</p>
      <p style="font-size:0.9rem; margin-bottom:6px;"><strong>«Come faccio a conquistare un pianeta BOT?»</strong><br>Distruggi tutte le difese e le flotte con una missione Attacco, e includi almeno una Colonizzatrice o Nave Madre nella flotta. Se vinci e resti senza difese nemiche, il pianeta diventa tuo.</p>
      <p style="font-size:0.9rem;"><strong>«Perché la Galattica ha mangiato il mio Bacino?»</strong><br>La Galattica nasce <em>dentro</em> il Bacino e ne prende il posto. Non è un bug: è la meccanica prevista. Se vuoi un Bacino, devi costruirne un altro su un pianeta diverso.</p>
    </div>`;
  }

  // =========================================================
  // LISTA SEZIONI
  // =========================================================
  const GUIDE_SECTIONS = [
    { id: 'intro', title: 'Come si gioca', icon: '🎮', render: renderIntro },
    { id: 'resources', title: 'Risorse & Energia', icon: '💎', render: renderResources },
    { id: 'buildings', title: 'Edifici Planetari', icon: '🏗️', render: renderBuildings },
    { id: 'research', title: 'Ricerche', icon: '🔬', render: renderResearch },
    { id: 'ships', title: 'Navi', icon: '🚀', render: renderShips },
    { id: 'defenses', title: 'Difese', icon: '🛡️', render: renderDefenses },
    { id: 'moon', title: 'Luna', icon: '🌒', render: renderMoon },
    { id: 'bacino', title: 'Bacino Spaziale', icon: '🛠️', render: renderBacino },
    { id: 'invictus', title: 'Invictus', icon: '⚔️', render: renderInvictus },
    { id: 'crepuscolo', title: 'Crepuscolo degli Dei', icon: '🌌', render: renderCrepuscolo },
    { id: 'galattica', title: 'Galattica', icon: '🪐', render: renderGalattica },
    { id: 'missions', title: 'Missioni Flotta', icon: '🎯', render: renderMissions },
    { id: 'slots', title: 'Slot Flotta', icon: '📊', render: renderSlots },
    { id: 'spy', title: 'Spionaggio & Simulatore', icon: '👁️', render: renderSpy },
    { id: 'trade', title: 'Commercio & Mercato Nero', icon: '💱', render: renderTrade },
    { id: 'sieges', title: 'Embargo & Occupazione', icon: '🚫', render: renderSieges },
    { id: 'creative', title: 'Modalità Creativa', icon: '✨', render: renderCreative },
    { id: 'tips', title: 'Consigli & Errori Comuni', icon: '💡', render: renderTips }
  ];

  // =========================================================
  // VISTA
  // =========================================================
  UI.renderGuide = function (viewport) {
    if (!viewport) return;
    const q = (guideState.searchQuery || '').toLowerCase().trim();

    const filtered = q
      ? GUIDE_SECTIONS.filter((s) => {
          if (s.title.toLowerCase().includes(q)) return true;
          const body = s.render();
          return body.toLowerCase().includes(q);
        })
      : GUIDE_SECTIONS;

    viewport.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="glass-panel" style="padding:14px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:space-between;">
                       <h2 style="font-size:1.1rem; color:var(--res-crystal);">${UI.svgIcon('radar')} GUIDA GALATTICA</h2>
            <span class="badge badge-blue">${GUIDE_SECTIONS.length} sezioni</span>
          </div>
          <p class="text-muted" style="font-size:0.9rem; margin-top:4px;">Tutto quello che serve sapere: edifici, ricerche, navi, difese, missioni e meccaniche speciali.</p>
          <div style="margin-top:10px;">
                        <input type="text" id="guide-search" class="form-control" placeholder="Cerca nella guida (es. Galattica, Invictus, Morte Nera)..." value="${_esc(guideState.searchQuery)}">
          </div>
        </div>

        <div id="guide-accordion" style="display:flex; flex-direction:column; gap:8px;">
          ${filtered.length === 0 ? `<div class="glass-panel" style="padding:20px; text-align:center;"><p class="text-muted">Nessun risultato per "${_esc(guideState.searchQuery)}".</p></div>` : ''}
          ${filtered.map((s) => {
            const isOpen = q ? true : guideState.openSections.has(s.id);
            return `
              <div class="glass-panel" style="padding:0; overflow:hidden;">
                <button type="button" class="guide-toggle" data-section="${_esc(s.id)}" style="width:100%; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:8px; background:none; border:none; color:inherit; cursor:pointer; text-align:left;">
                                  <span style="display:inline-flex; align-items:center; gap:8px;">
                    <strong style="font-size:0.98rem;">${_esc(s.title)}</strong>
                  </span>
                  <span style="color:var(--res-crystal); font-size:0.9rem;">${isOpen ? '▼' : '▶'}</span>
                </button>
                ${isOpen ? `<div style="padding:0 16px 16px;">${s.render()}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Toggle accordion
    viewport.querySelectorAll('.guide-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.section;
        if (guideState.openSections.has(id)) guideState.openSections.delete(id);
        else guideState.openSections.add(id);
        UI.renderGuide(viewport);
        UI.playSound('click');
      });
    });

    // Ricerca
    document.getElementById('guide-search')?.addEventListener('input', (e) => {
      guideState.searchQuery = e.target.value || '';
      const pos = e.target.selectionStart;
      UI.renderGuide(viewport);
      const newInp = document.getElementById('guide-search');
      if (newInp) { newInp.focus(); try { newInp.setSelectionRange(pos, pos); } catch (_) {} }
    });

    // Link "vai alla sezione"
    viewport.querySelectorAll('.guide-go').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view && typeof UI.switchView === 'function') UI.switchView(view);
      });
    });
  };

  UI.renderGuideView = function (viewport) {
    UI.renderGuide(viewport);
  };
})();
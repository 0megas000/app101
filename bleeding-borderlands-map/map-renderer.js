// Enhanced Map Renderer - Renders all geographic layers with ocean, elevation, terrain
// Complete rebuild for 2400x2400px canvas with proper geography

class MapRenderer {
  constructor(config, ocean, coastline, locations, features, routes, factions, corruptionZones) {
    this.config = config;
    this.ocean = ocean;
    this.coastline = coastline;
    this.locations = locations;
    this.features = features;
    this.routes = routes;
    this.factions = factions;
    this.corruptionZones = corruptionZones;

    this.svg = null;
    this.layers = {};

    // Visibility state
    this.visibility = {
      ocean: true,
      terrain: true,
      corruption: true,
      routes: true,
      factions: false,
      distanceRings: false,
      secrets: false
    };
  }

  // Initialize and render map
  initialize(containerId) {
    const container = document.getElementById(containerId);

    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${this.config.canvasWidth} ${this.config.canvasHeight}`);
    this.svg.setAttribute('id', 'main-map-svg');
    this.svg.style.cursor = 'grab';

    // Create defs for patterns, gradients, filters
    this.createDefs();

    // Create layer groups in correct order
    const layerOrder = [
      'background',
      'ocean',
      'coastline',
      'terrain',
      'rivers',
      'corruption',
      'routes',
      'factions',
      'locations',
      'labels',
      'ui'
    ];

    layerOrder.forEach(name => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', `layer-${name}`);
      group.setAttribute('class', `layer`);
      this.layers[name] = group;
      this.svg.appendChild(group);
    });

    container.appendChild(this.svg);

    // Render all layers
    this.render();
  }

  // Create SVG defs (gradients, patterns, filters)
  createDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Ocean depth gradient
    const oceanGradient = this.createElement('radialGradient', {
      id: 'ocean-depth-gradient',
      cx: '-50%',
      cy: '50%',
      r: '100%'
    });
    oceanGradient.innerHTML = `
      <stop offset="0%" stop-color="${this.ocean.ceruleanSea.colorDeep}" />
      <stop offset="50%" stop-color="${this.ocean.ceruleanSea.color}" />
      <stop offset="100%" stop-color="#2E8BC0" />
    `;
    defs.appendChild(oceanGradient);

    // Maelstrom gradient
    const maelstromGradient = this.createElement('radialGradient', { id: 'maelstrom-gradient' });
    maelstromGradient.innerHTML = `
      <stop offset="0%" stop-color="#1a0a1f" />
      <stop offset="40%" stop-color="#4A0E4E" />
      <stop offset="70%" stop-color="#8B4789" />
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0.8" />
    `;
    defs.appendChild(maelstromGradient);

    // Maelstrom glow filter
    const glowFilter = this.createElement('filter', { id: 'maelstrom-glow' });
    glowFilter.innerHTML = `
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    `;
    defs.appendChild(glowFilter);

    // Shadow filter for markers
    const shadowFilter = this.createElement('filter', { id: 'marker-shadow' });
    shadowFilter.innerHTML = `
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="2" dy="2" result="offsetblur"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    `;
    defs.appendChild(shadowFilter);

    // Wave pattern for ocean
    const wavePattern = this.createElement('pattern', {
      id: 'wave-pattern',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      patternUnits: 'userSpaceOnUse'
    });
    wavePattern.innerHTML = `
      <path d="M0 20 Q 10 15, 20 20 T 40 20" stroke="#4A9ED8" stroke-width="0.5" fill="none" opacity="0.3"/>
      <path d="M0 30 Q 10 25, 20 30 T 40 30" stroke="#4A9ED8" stroke-width="0.5" fill="none" opacity="0.2"/>
    `;
    defs.appendChild(wavePattern);

    this.svg.appendChild(defs);
  }

  // Main render function
  render() {
    this.renderBackground();
    this.renderOcean();
    this.renderTerrain();
    this.renderRivers();
    this.renderCorruption();
    this.renderRoutes();
    this.renderFactionTerritories();
    this.renderLocations();
    this.renderLabels();
  }

  // Render parchment background
  renderBackground() {
    const rect = this.createElement('rect', {
      x: 0,
      y: 0,
      width: this.config.canvasWidth,
      height: this.config.canvasHeight,
      fill: '#F4E8D8',
      class: 'map-background'
    });
    this.layers.background.appendChild(rect);
  }

  // === LAYER 1: OCEAN ===
  renderOcean() {
    const ocean = this.ocean.ceruleanSea;
    const bounds = ocean.bounds;

    // Convert bounds to SVG coordinates
    const nw = coordHelpers.realToSVG(bounds.west, bounds.north);
    const se = coordHelpers.realToSVG(bounds.east, bounds.south);

    // Ocean rectangle
    const oceanRect = this.createElement('rect', {
      x: nw.x,
      y: nw.y,
      width: se.x - nw.x,
      height: se.y - nw.y,
      fill: 'url(#ocean-depth-gradient)',
      class: 'ocean-layer'
    });
    this.layers.ocean.appendChild(oceanRect);

    // Wave pattern overlay
    const waveOverlay = this.createElement('rect', {
      x: nw.x,
      y: nw.y,
      width: se.x - nw.x,
      height: se.y - nw.y,
      fill: 'url(#wave-pattern)',
      opacity: 0.4,
      class: 'ocean-waves'
    });
    this.layers.ocean.appendChild(waveOverlay);

    // Render coastline
    this.renderCoastline();

    // Render offshore islands
    this.renderOffshoreIslands();

    // Render delta
    this.renderDelta();
  }

  // Render coastline
  renderCoastline() {
    const coast = this.coastline.mainCoast;
    const points = coast.points.map(p => coordHelpers.realToSVG(p.x, p.y));

    // Create coastline path
    let pathData = `M ${points[0].x} ${points[0].y}`;

    // Smooth curve through points
    for (let i = 1; i < points.length; i++) {
      const curr = points[i];
      const prev = points[i - 1];

      // Control points for smooth curve
      const cpx = (prev.x + curr.x) / 2;
      const cpy = (prev.y + curr.y) / 2;

      pathData += ` Q ${cpx} ${cpy}, ${curr.x} ${curr.y}`;
    }

    const coastPath = this.createElement('path', {
      d: pathData,
      stroke: '#8B7355',
      'stroke-width': 2,
      fill: 'none',
      class: 'coastline'
    });
    this.layers.coastline.appendChild(coastPath);

    // Add beach markers
    coast.features.beaches?.forEach(beach => {
      const pos = coordHelpers.realToSVG(beach.center.x, beach.center.y);
      const beachMarker = this.createElement('circle', {
        cx: pos.x,
        cy: pos.y,
        r: beach.length * this.config.pixelsPerMile / 2,
        fill: '#F4E4B7',
        opacity: 0.6,
        class: 'beach'
      });
      this.layers.coastline.appendChild(beachMarker);
    });
  }

  // Render offshore islands
  renderOffshoreIslands() {
    const islands = this.coastline.mainCoast.features.islands || [];

    islands.forEach(island => {
      const pos = coordHelpers.realToSVG(island.x, island.y);
      const radius = island.size * this.config.pixelsPerMile;

      const islandCircle = this.createElement('circle', {
        cx: pos.x,
        cy: pos.y,
        r: radius,
        fill: '#9B8B7E',
        stroke: '#6B5D52',
        'stroke-width': 1,
        class: 'island'
      });
      this.layers.coastline.appendChild(islandCircle);

      // Island label
      const label = this.createElement('text', {
        x: pos.x,
        y: pos.y + radius + 12,
        'text-anchor': 'middle',
        'font-size': '10px',
        fill: '#3D2817',
        class: 'island-label'
      });
      label.textContent = island.name;
      this.layers.labels.appendChild(label);
    });
  }

  // Render Silverflow Delta
  renderDelta() {
    const delta = this.coastline.silverflowDelta;
    const center = coordHelpers.realToSVG(delta.center.x, delta.center.y);

    // Marshland area (rough triangle spreading from river to ocean)
    const marshPoints = [
      coordHelpers.realToSVG(delta.center.x + 6, delta.center.y - 4),
      coordHelpers.realToSVG(delta.center.x + 8, delta.center.y),
      coordHelpers.realToSVG(delta.center.x + 6, delta.center.y + 4),
      coordHelpers.realToSVG(delta.center.x - 2, delta.center.y + 3),
      coordHelpers.realToSVG(delta.center.x - 2, delta.center.y - 3)
    ];

    const marshPath = this.createPolygonPath(marshPoints);
    const marsh = this.createElement('path', {
      d: marshPath,
      fill: delta.marshland.color,
      opacity: 0.5,
      class: 'delta-marsh'
    });
    this.layers.coastline.appendChild(marsh);

    // Delta channels (simplified representation)
    const channelPaths = [
      [{ x: -50, y: 0 }, { x: -55, y: 0 }],     // Main
      [{ x: -50, y: 0 }, { x: -54, y: 2 }],     // North arm
      [{ x: -50, y: 0 }, { x: -54, y: -2 }],    // South arm
    ];

    channelPaths.forEach(path => {
      const svgPoints = path.map(p => coordHelpers.realToSVG(p.x, p.y));
      const line = this.createElement('path', {
        d: `M ${svgPoints[0].x} ${svgPoints[0].y} L ${svgPoints[1].x} ${svgPoints[1].y}`,
        stroke: '#2196F3',
        'stroke-width': 3,
        class: 'delta-channel'
      });
      this.layers.rivers.appendChild(line);
    });

    // Sandbars
    delta.sandbars?.forEach(bar => {
      const pos = coordHelpers.realToSVG(bar.x, bar.y);
      this.layers.coastline.appendChild(this.createElement('circle', {
        cx: pos.x,
        cy: pos.y,
        r: 8,
        fill: '#D4B896',
        opacity: 0.7,
        class: 'sandbar'
      }));
    });
  }

  // === LAYER 4: TERRAIN (Elevation-based) ===
  renderTerrain() {
    // Render terrain regions with elevation colors

    // Coastal Plain (0-200 ft)
    this.renderTerrainRegion(this.features.coastalPlain, '#E8F5E3');

    // Golden Plains (200-800 ft)
    this.renderTerrainRegion(this.features.goldmeadowPlains, '#E8DC9F');

    // Shimmerwood Forest
    this.renderForest();

    // Ironspine Mountains
    this.renderMountains();
  }

  // Render terrain region
  renderTerrainRegion(region, color) {
    if (!region || !region.bounds) return;

    const points = region.bounds.map(p => coordHelpers.realToSVG(p.x, p.y));
    const path = this.createPolygonPath(points);

    const polygon = this.createElement('path', {
      d: path,
      fill: color,
      opacity: 0.6,
      class: `terrain-${region.type}`
    });
    this.layers.terrain.appendChild(polygon);
  }

  // Render Shimmerwood Forest
  renderForest() {
    const forest = this.features.shimmerwoodForest;
    const points = forest.bounds.map(p => coordHelpers.realToSVG(p.x, p.y));
    const path = this.createPolygonPath(points);

    const forestPolygon = this.createElement('path', {
      d: path,
      fill: forest.color,
      opacity: 0.7,
      class: 'forest shimmerwood'
    });
    this.layers.terrain.appendChild(forestPolygon);

    // Add tree symbols for density
    const center = coordHelpers.realToSVG(forest.center.x, forest.center.y);
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 50 + Math.random() * 100;
      const tx = center.x + Math.cos(angle) * dist;
      const ty = center.y + Math.sin(angle) * dist;

      const tree = this.createElement('circle', {
        cx: tx,
        cy: ty,
        r: 3,
        fill: '#1a3a0f',
        opacity: 0.4,
        class: 'tree-symbol'
      });
      this.layers.terrain.appendChild(tree);
    }

    // Hidden lake (if secrets shown)
    if (this.visibility.secrets && forest.hiddenLake) {
      const lakePos = coordHelpers.realToSVG(forest.hiddenLake.x, forest.hiddenLake.y);
      const lakeRadius = forest.hiddenLake.radius * this.config.pixelsPerMile;

      const lake = this.createElement('ellipse', {
        cx: lakePos.x,
        cy: lakePos.y,
        rx: lakeRadius * 1.5,
        ry: lakeRadius,
        fill: '#4A9ED8',
        opacity: 0.8,
        class: 'hidden-lake'
      });
      this.layers.terrain.appendChild(lake);
    }
  }

  // Render Ironspine Mountains
  renderMountains() {
    const mountains = this.features.ironspineMountains;

    // Mountain range background
    const points = mountains.bounds.map(p => coordHelpers.realToSVG(p.x, p.y));
    const path = this.createPolygonPath(points);

    const mountainBg = this.createElement('path', {
      d: path,
      fill: mountains.color,
      opacity: 0.5,
      class: 'mountains-background'
    });
    this.layers.terrain.appendChild(mountainBg);

    // Individual peaks
    mountains.peaks.forEach(peak => {
      const pos = coordHelpers.realToSVG(peak.x, peak.y);
      const size = (peak.elevation / 1000) * 3; // Scale by elevation

      // Peak triangle
      const peakPath = `M ${pos.x} ${pos.y - size} L ${pos.x - size} ${pos.y + size/2} L ${pos.x + size} ${pos.y + size/2} Z`;

      const peakElement = this.createElement('path', {
        d: peakPath,
        fill: peak.elevation >= mountains.snowlineElevation ? '#E5E5E5' : '#736B5E',
        stroke: '#3D2817',
        'stroke-width': 1,
        class: 'mountain-peak'
      });
      this.layers.terrain.appendChild(peakElement);

      // Peak label
      const label = this.createElement('text', {
        x: pos.x,
        y: pos.y + size + 15,
        'text-anchor': 'middle',
        'font-size': '10px',
        fill: '#3D2817',
        class: 'peak-label'
      });
      label.textContent = `${peak.name} (${peak.elevation}')`;
      this.layers.labels.appendChild(label);
    });
  }

  // === LAYER 5: RIVERS ===
  renderRivers() {
    // Silverflow River (main)
    const river = this.features.silverflowRiver;

    river.course.forEach((point, i) => {
      if (i === 0) return; // Skip first point

      const prev = river.course[i - 1];
      const curr = point;

      const p1 = coordHelpers.realToSVG(prev.x, prev.y);
      const p2 = coordHelpers.realToSVG(curr.x, curr.y);

      const width = curr.width * this.config.pixelsPerMile * 100; // Convert fraction to pixels

      const riverSegment = this.createElement('line', {
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        stroke: curr.corrupted ? river.corruptionColor : river.color,
        'stroke-width': width,
        'stroke-linecap': 'round',
        opacity: 0.7,
        class: curr.corrupted ? 'river corrupted-river' : 'river'
      });
      this.layers.rivers.appendChild(riverSegment);
    });

    // Tributaries
    [this.features.brightwaterStream, this.features.ironCreek].forEach(stream => {
      if (!stream || !stream.course) return;

      stream.course.forEach((point, i) => {
        if (i === 0) return;

        const prev = stream.course[i - 1];
        const curr = point;

        const p1 = coordHelpers.realToSVG(prev.x, prev.y);
        const p2 = coordHelpers.realToSVG(curr.x, curr.y);

        const width = curr.width * this.config.pixelsPerMile * 100;

        const streamSegment = this.createElement('line', {
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          stroke: stream.color,
          'stroke-width': width,
          'stroke-linecap': 'round',
          opacity: 0.6,
          class: 'stream'
        });
        this.layers.rivers.appendChild(streamSegment);
      });
    });
  }

  // === LAYER 6: CORRUPTION ZONES ===
  renderCorruption() {
    if (!this.visibility.corruption) return;

    // Render zones from outermost to innermost
    for (let i = this.corruptionZones.length - 1; i >= 0; i--) {
      const zone = this.corruptionZones[i];
      const radius = zone.maxDistance * this.config.pixelsPerMile;
      const center = coordHelpers.realToSVG(0, 0);

      const circle = this.createElement('circle', {
        cx: center.x,
        cy: center.y,
        r: radius,
        fill: zone.color,
        class: `corruption-zone level-${zone.level}`
      });
      this.layers.corruption.appendChild(circle);
    }

    // Maelstrom core
    const maelstromCenter = coordHelpers.realToSVG(0, 0);
    const maelstromRadius = this.config.maelstromRadius * this.config.pixelsPerMile;

    const maelstrom = this.createElement('circle', {
      cx: maelstromCenter.x,
      cy: maelstromCenter.y,
      r: maelstromRadius,
      fill: 'url(#maelstrom-gradient)',
      filter: 'url(#maelstrom-glow)',
      class: 'maelstrom-core'
    });
    this.layers.corruption.appendChild(maelstrom);

    // Expansion ring
    const expansionRadius = (this.config.maelstromRadius + 1) * this.config.pixelsPerMile;
    const expansionRing = this.createElement('circle', {
      cx: maelstromCenter.x,
      cy: maelstromCenter.y,
      r: expansionRadius,
      fill: 'none',
      stroke: '#8B4789',
      'stroke-width': 2,
      'stroke-dasharray': '5,5',
      opacity: 0.6,
      class: 'expansion-ring'
    });
    this.layers.corruption.appendChild(expansionRing);
  }

  // === LAYER 7: TRADE ROUTES ===
  renderRoutes() {
    if (!this.visibility.routes) return;

    Object.values(this.routes).forEach(route => {
      if (route.type === 'water') return;

      const locationPoints = route.points.map(id => {
        const loc = this.locations[id];
        return loc ? coordHelpers.realToSVG(loc.position.x, loc.position.y) : null;
      }).filter(Boolean);

      for (let i = 0; i < locationPoints.length - 1; i++) {
        const p1 = locationPoints[i];
        const p2 = locationPoints[i + 1];

        const line = this.createElement('line', {
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          stroke: route.color,
          'stroke-width': route.width || 2,
          'stroke-dasharray': '8,4',
          opacity: 0.5,
          class: `trade-route ${route.type}`
        });
        this.layers.routes.appendChild(line);
      }
    });
  }

  // === LAYER 8: FACTION TERRITORIES ===
  renderFactionTerritories() {
    if (!this.visibility.factions) return;

    Object.entries(this.factions).forEach(([key, faction]) => {
      if (faction.secret && !this.visibility.secrets) return;

      faction.territories.forEach(locId => {
        const loc = this.locations[locId];
        if (!loc) return;

        const pos = coordHelpers.realToSVG(loc.position.x, loc.position.y);
        const radius = 50 + (faction.influence * 50);

        const territory = this.createElement('circle', {
          cx: pos.x,
          cy: pos.y,
          r: radius,
          fill: faction.color,
          opacity: 0.2,
          stroke: faction.color,
          'stroke-width': 2,
          'stroke-opacity': 0.4,
          class: `faction-territory faction-${key}`
        });
        this.layers.factions.appendChild(territory);
      });
    });
  }

  // === LAYER 9: LOCATIONS ===
  renderLocations() {
    Object.entries(this.locations).forEach(([id, location]) => {
      if (location.type === 'corruption-core') return;
      if (location.secret && !this.visibility.secrets) return;

      const pos = coordHelpers.realToSVG(location.position.x, location.position.y);

      const group = this.createElement('g', {
        class: 'location',
        'data-location-id': id,
        transform: `translate(${pos.x}, ${pos.y})`
      });

      // Marker circle
      const isCity = location.type.startsWith('city-');
      const radius = isCity ? 12 : 8;

      const marker = this.createElement('circle', {
        cx: 0,
        cy: 0,
        r: radius,
        fill: location.color || '#8B6F47',
        stroke: '#3D2817',
        'stroke-width': 2,
        filter: 'url(#marker-shadow)',
        class: 'location-marker'
      });
      group.appendChild(marker);

      // Emoji/icon
      const icon = this.createElement('text', {
        x: 0,
        y: 5,
        'text-anchor': 'middle',
        'font-size': isCity ? '16px' : '12px',
        class: 'location-icon'
      });
      icon.textContent = location.emoji || '📍';
      group.appendChild(icon);

      this.layers.locations.appendChild(group);
    });
  }

  // === LAYER 10: LABELS ===
  renderLabels() {
    // Location labels
    Object.entries(this.locations).forEach(([id, location]) => {
      if (location.type === 'corruption-core') return;
      if (location.secret && !this.visibility.secrets) return;

      const pos = coordHelpers.realToSVG(location.position.x, location.position.y);

      const label = this.createElement('text', {
        x: pos.x,
        y: pos.y - 18,
        'text-anchor': 'middle',
        'font-size': location.type.startsWith('city-') ? '14px' : '11px',
        'font-weight': location.type.startsWith('city-') ? 'bold' : 'normal',
        fill: '#3D2817',
        stroke: '#F4E8D8',
        'stroke-width': 3,
        'paint-order': 'stroke',
        class: 'location-label'
      });
      label.textContent = location.name;
      this.layers.labels.appendChild(label);
    });

    // Geographic feature labels
    this.addLabel('Cerulean Sea', -85, 0, '24px', '#0D3B4A');
    this.addLabel('Silverflow River', -25, -5, '12px', '#2196F3');
    this.addLabel('Ironspine Mountains', 55, -15, '16px', '#6B5D52');
    this.addLabel('Shimmerwood', -40, 20, '14px', '#2D5016');
    this.addLabel('The Maelstrom', 0, 0, '18px', '#a855f7');
  }

  addLabel(text, x, y, fontSize, color) {
    const pos = coordHelpers.realToSVG(x, y);
    const label = this.createElement('text', {
      x: pos.x,
      y: pos.y,
      'text-anchor': 'middle',
      'font-size': fontSize,
      'font-style': 'italic',
      fill: color,
      opacity: 0.7,
      class: 'feature-label'
    });
    label.textContent = text;
    this.layers.labels.appendChild(label);
  }

  // === UTILITIES ===

  createElement(type, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  }

  createPolygonPath(points) {
    if (!points || points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ' Z';
    return path;
  }

  // === PUBLIC API ===

  toggleLayer(layerName, visible) {
    this.visibility[layerName] = visible;

    switch(layerName) {
      case 'corruption':
        this.layers.corruption.style.display = visible ? 'block' : 'none';
        break;
      case 'routes':
        this.layers.routes.style.display = visible ? 'block' : 'none';
        break;
      case 'factions':
        this.layers.factions.style.display = visible ? 'block' : 'none';
        this.renderFactionTerritories();
        break;
      case 'secrets':
        this.render(); // Re-render to show/hide secrets
        break;
    }
  }

  // Add location (from editor)
  addLocation(location) {
    this.locations[location.id] = location;
    this.renderLocations();
    this.renderLabels();
  }

  // Update location (from editor)
  updateLocation(id, updates) {
    if (this.locations[id]) {
      this.locations[id] = { ...this.locations[id], ...updates };
      this.renderLocations();
      this.renderLabels();
    }
  }

  // Remove location (from editor)
  removeLocation(id) {
    delete this.locations[id];
    this.renderLocations();
    this.renderLabels();
  }

  // Move location visually (during drag)
  moveLocation(id, svgX, svgY) {
    const group = this.svg.querySelector(`[data-location-id="${id}"]`);
    if (group) {
      group.setAttribute('transform', `translate(${svgX}, ${svgY})`);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapRenderer;
}

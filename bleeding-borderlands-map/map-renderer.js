// Map Renderer - Handles SVG generation and rendering
class MapRenderer {
  constructor(config, locations, features, routes, factions, corruptionZones) {
    this.config = config;
    this.locations = locations;
    this.features = features;
    this.routes = routes;
    this.factions = factions;
    this.corruptionZones = corruptionZones;
    this.svg = null;
    this.layers = {
      background: null,
      corruption: null,
      terrain: null,
      routes: null,
      factions: null,
      locations: null,
      ui: null
    };
    this.visibilityState = {
      corruption: true,
      factions: false,
      routes: true,
      secondaryLocations: true,
      distanceRings: false
    };
  }

  // Convert polar coordinates to Cartesian
  polarToCartesian(angle, distance) {
    const angleRad = (angle - 90) * (Math.PI / 180); // Adjust so 0° is North
    const x = this.config.centerX + (distance * this.config.pixelsPerMile * Math.cos(angleRad));
    const y = this.config.centerY + (distance * this.config.pixelsPerMile * Math.sin(angleRad));
    return { x, y };
  }

  // Calculate distance between two points
  calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy) / this.config.pixelsPerMile;
  }

  // Initialize SVG element
  initialize(containerId) {
    const container = document.getElementById(containerId);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.config.canvasWidth);
    this.svg.setAttribute('height', this.config.canvasHeight);
    this.svg.setAttribute('viewBox', `0 0 ${this.config.canvasWidth} ${this.config.canvasHeight}`);
    this.svg.setAttribute('id', 'main-map');

    // Create layer groups
    const layerOrder = ['background', 'corruption', 'terrain', 'routes', 'factions', 'locations', 'ui'];
    layerOrder.forEach(layerName => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', `layer-${layerName}`);
      group.setAttribute('class', `layer layer-${layerName}`);
      this.layers[layerName] = group;
      this.svg.appendChild(group);
    });

    container.appendChild(this.svg);
    this.render();
  }

  // Main render function
  render() {
    this.renderBackground();
    this.renderCorruptionZones();
    this.renderTerrain();
    this.renderRoutes();
    this.renderFactionTerritories();
    this.renderLocations();
    this.renderDistanceRings();
  }

  // Render parchment background
  renderBackground() {
    const rect = this.createSVGElement('rect', {
      x: 0,
      y: 0,
      width: this.config.canvasWidth,
      height: this.config.canvasHeight,
      fill: '#F4E8D8',
      class: 'map-background'
    });
    this.layers.background.appendChild(rect);

    // Add subtle texture with noise
    const defs = this.createSVGElement('defs');
    const filter = this.createSVGElement('filter', { id: 'paper-texture' });
    const turbulence = this.createSVGElement('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: '0.04',
      numOctaves: '5',
      result: 'noise'
    });
    const diffuse = this.createSVGElement('feDiffuseLighting', {
      in: 'noise',
      'lighting-color': '#E8DCC8',
      surfaceScale: '1'
    });
    const light = this.createSVGElement('feDistantLight', {
      azimuth: '45',
      elevation: '60'
    });

    diffuse.appendChild(light);
    filter.appendChild(turbulence);
    filter.appendChild(diffuse);
    defs.appendChild(filter);
    this.svg.insertBefore(defs, this.svg.firstChild);
  }

  // Render corruption zones
  renderCorruptionZones() {
    const group = this.createSVGElement('g', { id: 'corruption-zones' });

    // Render zones from outermost to innermost
    for (let i = this.corruptionZones.length - 1; i >= 0; i--) {
      const zone = this.corruptionZones[i];
      const maxRadius = zone.maxDistance * this.config.pixelsPerMile;

      const circle = this.createSVGElement('circle', {
        cx: this.config.centerX,
        cy: this.config.centerY,
        r: maxRadius,
        fill: zone.color,
        class: `corruption-zone corruption-level-${zone.level}`,
        'data-level': zone.level,
        'data-name': zone.name
      });

      group.appendChild(circle);
    }

    // Add Maelstrom core with special effects
    const maelstrom = this.createSVGElement('circle', {
      cx: this.config.centerX,
      cy: this.config.centerY,
      r: this.config.maelstromRadius * this.config.pixelsPerMile,
      fill: 'url(#maelstrom-gradient)',
      class: 'maelstrom-core',
      filter: 'url(#maelstrom-glow)'
    });

    // Create maelstrom gradient
    const defs = this.svg.querySelector('defs') || this.createSVGElement('defs');
    const gradient = this.createSVGElement('radialGradient', { id: 'maelstrom-gradient' });
    const stops = [
      { offset: '0%', color: '#1a0a1f', opacity: 1 },
      { offset: '40%', color: '#4A0E4E', opacity: 0.95 },
      { offset: '70%', color: '#8B4789', opacity: 0.9 },
      { offset: '100%', color: '#a855f7', opacity: 0.8 }
    ];

    stops.forEach(stop => {
      const stopEl = this.createSVGElement('stop', {
        offset: stop.offset,
        'stop-color': stop.color,
        'stop-opacity': stop.opacity
      });
      gradient.appendChild(stopEl);
    });

    // Maelstrom glow filter
    const glowFilter = this.createSVGElement('filter', { id: 'maelstrom-glow' });
    const blur = this.createSVGElement('feGaussianBlur', {
      stdDeviation: '4',
      result: 'coloredBlur'
    });
    const merge = this.createSVGElement('feMerge');
    const mergeNode1 = this.createSVGElement('feMergeNode', { in: 'coloredBlur' });
    const mergeNode2 = this.createSVGElement('feMergeNode', { in: 'SourceGraphic' });
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);
    glowFilter.appendChild(blur);
    glowFilter.appendChild(merge);

    defs.appendChild(gradient);
    defs.appendChild(glowFilter);
    if (!this.svg.querySelector('defs')) {
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    // Expansion ring (dotted circle showing future growth)
    const futureRadius = (this.config.maelstromRadius + 0.5) * this.config.pixelsPerMile;
    const expansionRing = this.createSVGElement('circle', {
      cx: this.config.centerX,
      cy: this.config.centerY,
      r: futureRadius,
      fill: 'none',
      stroke: '#8B4789',
      'stroke-width': 2,
      'stroke-dasharray': '5,5',
      class: 'expansion-ring',
      opacity: 0.6
    });

    group.appendChild(maelstrom);
    group.appendChild(expansionRing);
    this.layers.corruption.appendChild(group);
  }

  // Render terrain features
  renderTerrain() {
    const group = this.createSVGElement('g', { id: 'terrain-features' });

    // Render Silverflow River
    const river = this.features.silverflowRiver;
    const riverPoints = river.points.map(p => this.polarToCartesian(p.angle, p.distance));
    const pathData = this.createSmoothPath(riverPoints);

    const riverPath = this.createSVGElement('path', {
      d: pathData,
      fill: 'none',
      stroke: river.color,
      'stroke-width': river.width * this.config.pixelsPerMile,
      'stroke-linecap': 'round',
      class: 'river',
      opacity: 0.7
    });
    group.appendChild(riverPath);

    // Render Goldmeadow Plains
    const plains = this.features.goldmeadowPlains;
    const plainsPoints = plains.region.map(p => this.polarToCartesian(p.angle, p.distance));
    const plainsPath = this.createPolygonPath(plainsPoints);
    const plainsPolygon = this.createSVGElement('path', {
      d: plainsPath,
      fill: plains.color,
      opacity: 0.4,
      class: 'plains',
      'stroke': '#D4B896',
      'stroke-width': 1
    });
    group.appendChild(plainsPolygon);

    // Render Ironhold Mountains
    const mountains = this.features.ironholdMountains;
    mountains.peaks.forEach(peak => {
      const pos = this.polarToCartesian(peak.angle, peak.distance);
      const mountainIcon = this.createMountainIcon(pos.x, pos.y, 20);
      group.appendChild(mountainIcon);
    });

    // Render Shimmerwood Forest
    const forest = this.features.shimmerwoodForest;
    const forestPoints = forest.region.map(p => this.polarToCartesian(p.angle, p.distance));
    const forestPath = this.createPolygonPath(forestPoints);
    const forestPolygon = this.createSVGElement('path', {
      d: forestPath,
      fill: forest.color,
      opacity: 0.5,
      class: 'forest shimmerwood',
      'stroke': '#1a3a0f',
      'stroke-width': 2
    });
    group.appendChild(forestPolygon);

    // Add shimmer effect
    if (forest.shimmer) {
      forestPolygon.setAttribute('filter', 'url(#shimmer-effect)');
      this.createShimmerFilter();
    }

    this.layers.terrain.appendChild(group);
  }

  // Render trade routes
  renderRoutes() {
    const group = this.createSVGElement('g', { id: 'trade-routes' });

    Object.values(this.routes).forEach(route => {
      if (route.type === 'water') return; // Skip water routes (rendered with river)

      const points = route.points.map(locKey => {
        const loc = this.locations[locKey];
        return this.polarToCartesian(loc.coordinates.angle, loc.coordinates.distance);
      });

      points.forEach((point, i) => {
        if (i < points.length - 1) {
          const nextPoint = points[i + 1];
          const line = this.createSVGElement('line', {
            x1: point.x,
            y1: point.y,
            x2: nextPoint.x,
            y2: nextPoint.y,
            stroke: route.color,
            'stroke-width': route.type === 'major' ? 3 : 2,
            'stroke-dasharray': route.type === 'major' ? '8,4' : '5,3',
            class: `trade-route route-${route.type}`,
            'data-route': route.name,
            opacity: 0.6
          });
          group.appendChild(line);
        }
      });
    });

    this.layers.routes.appendChild(group);
  }

  // Render faction territories (toggleable overlay)
  renderFactionTerritories() {
    const group = this.createSVGElement('g', { id: 'faction-territories' });
    group.style.display = this.visibilityState.factions ? 'block' : 'none';

    Object.entries(this.factions).forEach(([key, faction]) => {
      if (faction.secret && !this.visibilityState.showSecrets) return;

      const territoryPoints = [];
      faction.territories.forEach(locKey => {
        const loc = this.locations[locKey];
        if (loc) {
          const pos = this.polarToCartesian(loc.coordinates.angle, loc.coordinates.distance);
          territoryPoints.push(pos);
        }
      });

      if (territoryPoints.length > 0) {
        // Create influence radius around each territory
        territoryPoints.forEach(point => {
          const circle = this.createSVGElement('circle', {
            cx: point.x,
            cy: point.y,
            r: 50,
            fill: faction.color,
            opacity: 0.2,
            class: `faction-territory faction-${key}`,
            'stroke': faction.color,
            'stroke-width': 2,
            'stroke-opacity': 0.4
          });
          group.appendChild(circle);
        });
      }
    });

    this.layers.factions.appendChild(group);
  }

  // Render all locations
  renderLocations() {
    const group = this.createSVGElement('g', { id: 'locations' });

    Object.entries(this.locations).forEach(([key, location]) => {
      if (location.type === 'corruption-core') return; // Skip maelstrom (already rendered)

      const pos = this.polarToCartesian(location.coordinates.angle, location.coordinates.distance);
      const isSecondary = !location.type.startsWith('city-');

      const locGroup = this.createSVGElement('g', {
        class: `location location-${location.type}`,
        'data-location': key,
        'data-secret': location.secret || false,
        transform: `translate(${pos.x}, ${pos.y})`
      });

      // Location marker
      const marker = this.createLocationMarker(location);
      locGroup.appendChild(marker);

      // Location label
      const label = this.createSVGElement('text', {
        x: 0,
        y: -20,
        'text-anchor': 'middle',
        class: `location-label ${isSecondary ? 'secondary' : 'primary'}`,
        fill: '#3D2817'
      });
      label.textContent = location.name;
      locGroup.appendChild(label);

      // Population indicator for cities
      if (location.population) {
        const popLabel = this.createSVGElement('text', {
          x: 0,
          y: 25,
          'text-anchor': 'middle',
          class: 'population-label',
          fill: '#6B5D52',
          'font-size': '10px'
        });
        popLabel.textContent = `Pop: ${(location.population / 1000).toFixed(1)}k`;
        locGroup.appendChild(popLabel);
      }

      group.appendChild(locGroup);
    });

    this.layers.locations.appendChild(group);
  }

  // Create location marker based on type
  createLocationMarker(location) {
    const group = this.createSVGElement('g', { class: 'location-marker' });

    // Base circle
    const circle = this.createSVGElement('circle', {
      cx: 0,
      cy: 0,
      r: location.type.startsWith('city-') ? 12 : 8,
      fill: location.color || '#8B6F47',
      stroke: '#3D2817',
      'stroke-width': 2,
      class: 'marker-base',
      filter: 'url(#marker-shadow)'
    });

    // Create shadow filter if it doesn't exist
    this.createMarkerShadowFilter();

    group.appendChild(circle);

    // Icon overlay
    const icon = this.createIconForType(location.icon || location.type);
    if (icon) {
      group.appendChild(icon);
    }

    return group;
  }

  // Create icon based on location type
  createIconForType(iconType) {
    const g = this.createSVGElement('g', { class: `icon-${iconType}` });

    switch (iconType) {
      case 'tower':
        // University tower
        const tower = this.createSVGElement('rect', {
          x: -3,
          y: -6,
          width: 6,
          height: 12,
          fill: '#FFF',
          stroke: '#3D2817',
          'stroke-width': 1
        });
        g.appendChild(tower);
        break;

      case 'fortress':
        // Fortress battlements
        const wall = this.createSVGElement('path', {
          d: 'M -6,-2 L -6,4 L -3,4 L -3,0 L 0,0 L 0,4 L 3,4 L 3,0 L 6,0 L 6,4 L 6,-2 Z',
          fill: '#FFF',
          stroke: '#3D2817',
          'stroke-width': 1
        });
        g.appendChild(wall);
        break;

      case 'mountain':
        // Mountain peak
        const peak = this.createSVGElement('path', {
          d: 'M 0,-6 L -5,4 L 5,4 Z',
          fill: '#FFF',
          stroke: '#3D2817',
          'stroke-width': 1
        });
        g.appendChild(peak);
        break;

      case 'crossroads':
        // Cross symbol
        const cross1 = this.createSVGElement('line', {
          x1: -5,
          y1: 0,
          x2: 5,
          y2: 0,
          stroke: '#FFF',
          'stroke-width': 2
        });
        const cross2 = this.createSVGElement('line', {
          x1: 0,
          y1: -5,
          x2: 0,
          y2: 5,
          stroke: '#FFF',
          'stroke-width': 2
        });
        g.appendChild(cross1);
        g.appendChild(cross2);
        break;

      case 'anchor':
        // Simple anchor
        const anchorCircle = this.createSVGElement('circle', {
          cx: 0,
          cy: -3,
          r: 2,
          fill: 'none',
          stroke: '#FFF',
          'stroke-width': 1.5
        });
        const anchorLine = this.createSVGElement('line', {
          x1: 0,
          y1: -3,
          x2: 0,
          y2: 4,
          stroke: '#FFF',
          'stroke-width': 1.5
        });
        const anchorArm = this.createSVGElement('path', {
          d: 'M -4,4 L 0,2 L 4,4',
          fill: 'none',
          stroke: '#FFF',
          'stroke-width': 1.5
        });
        g.appendChild(anchorCircle);
        g.appendChild(anchorLine);
        g.appendChild(anchorArm);
        break;

      case 'tomb':
        // Tomb/grave marker
        const tombRect = this.createSVGElement('rect', {
          x: -4,
          y: -2,
          width: 8,
          height: 6,
          fill: '#333',
          stroke: '#FFF',
          'stroke-width': 1
        });
        const tombTop = this.createSVGElement('path', {
          d: 'M -4,-2 L 0,-6 L 4,-2 Z',
          fill: '#333',
          stroke: '#FFF',
          'stroke-width': 1
        });
        g.appendChild(tombRect);
        g.appendChild(tombTop);
        break;

      case 'spiral':
        // Spiral for cult
        const spiral = this.createSVGElement('path', {
          d: 'M 0,0 C 2,0 2,-2 0,-2 C -3,-2 -3,1 0,1 C 4,1 4,-4 0,-4',
          fill: 'none',
          stroke: '#FFF',
          'stroke-width': 1.5
        });
        g.appendChild(spiral);
        break;

      default:
        // Default star marker
        const star = this.createSVGElement('circle', {
          cx: 0,
          cy: 0,
          r: 3,
          fill: '#FFF'
        });
        g.appendChild(star);
    }

    return g;
  }

  // Render distance rings
  renderDistanceRings() {
    const group = this.createSVGElement('g', { id: 'distance-rings' });
    group.style.display = this.visibilityState.distanceRings ? 'block' : 'none';

    [10, 20, 30, 40, 50].forEach(distance => {
      const radius = distance * this.config.pixelsPerMile;
      const circle = this.createSVGElement('circle', {
        cx: this.config.centerX,
        cy: this.config.centerY,
        r: radius,
        fill: 'none',
        stroke: '#8B6F47',
        'stroke-width': 1,
        'stroke-dasharray': '3,3',
        opacity: 0.4,
        class: 'distance-ring'
      });

      // Distance label
      const label = this.createSVGElement('text', {
        x: this.config.centerX + radius - 30,
        y: this.config.centerY - 5,
        fill: '#6B5D52',
        'font-size': '12px',
        class: 'distance-label'
      });
      label.textContent = `${distance}mi`;

      group.appendChild(circle);
      group.appendChild(label);
    });

    this.layers.ui.appendChild(group);
  }

  // Helper: Create smooth path through points
  createSmoothPath(points) {
    if (points.length < 2) return '';

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const curr = points[i];
      const prev = points[i - 1];

      // Simple quadratic curve for smoothness
      const cpx = (prev.x + curr.x) / 2;
      const cpy = (prev.y + curr.y) / 2;

      if (i === 1) {
        path += ` Q ${cpx} ${cpy}, ${curr.x} ${curr.y}`;
      } else {
        path += ` T ${curr.x} ${curr.y}`;
      }
    }

    return path;
  }

  // Helper: Create polygon path
  createPolygonPath(points) {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ' Z';
    return path;
  }

  // Helper: Create mountain icon
  createMountainIcon(x, y, size) {
    const g = this.createSVGElement('g', {
      transform: `translate(${x}, ${y})`,
      class: 'mountain-icon'
    });

    const peak1 = this.createSVGElement('path', {
      d: `M 0,${-size} L ${-size * 0.7},${size * 0.3} L ${size * 0.7},${size * 0.3} Z`,
      fill: '#6B5D52',
      stroke: '#3D2817',
      'stroke-width': 1.5
    });

    const peak2 = this.createSVGElement('path', {
      d: `M ${-size * 0.4},${-size * 0.6} L ${-size},${size * 0.3} L ${size * 0.2},${size * 0.3} Z`,
      fill: '#8B7D72',
      stroke: '#3D2817',
      'stroke-width': 1.5,
      opacity: 0.8
    });

    // Snow cap
    const snow = this.createSVGElement('path', {
      d: `M ${-size * 0.3},${-size * 0.7} L 0,${-size} L ${size * 0.3},${-size * 0.7}`,
      fill: '#FFF',
      opacity: 0.8
    });

    g.appendChild(peak2);
    g.appendChild(peak1);
    g.appendChild(snow);

    return g;
  }

  // Helper: Create SVG element
  createSVGElement(type, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  // Create marker shadow filter
  createMarkerShadowFilter() {
    const defs = this.svg.querySelector('defs');
    if (!defs || defs.querySelector('#marker-shadow')) return;

    const filter = this.createSVGElement('filter', { id: 'marker-shadow' });
    const blur = this.createSVGElement('feGaussianBlur', {
      in: 'SourceAlpha',
      stdDeviation: '2'
    });
    const offset = this.createSVGElement('feOffset', {
      dx: '2',
      dy: '2',
      result: 'offsetblur'
    });
    const merge = this.createSVGElement('feMerge');
    const mergeNode1 = this.createSVGElement('feMergeNode');
    const mergeNode2 = this.createSVGElement('feMergeNode', { in: 'SourceGraphic' });

    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);
    filter.appendChild(blur);
    filter.appendChild(offset);
    filter.appendChild(merge);
    defs.appendChild(filter);
  }

  // Create shimmer effect filter
  createShimmerFilter() {
    const defs = this.svg.querySelector('defs');
    if (!defs || defs.querySelector('#shimmer-effect')) return;

    const filter = this.createSVGElement('filter', { id: 'shimmer-effect' });
    const turbulence = this.createSVGElement('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: '0.01',
      numOctaves: '2',
      result: 'turbulence'
    });
    const displacementMap = this.createSVGElement('feDisplacementMap', {
      in2: 'turbulence',
      in: 'SourceGraphic',
      scale: '3',
      xChannelSelector: 'R',
      yChannelSelector: 'G'
    });

    filter.appendChild(turbulence);
    filter.appendChild(displacementMap);
    defs.appendChild(filter);
  }

  // Toggle layer visibility
  toggleLayer(layerName) {
    this.visibilityState[layerName] = !this.visibilityState[layerName];

    switch (layerName) {
      case 'corruption':
        this.layers.corruption.style.display = this.visibilityState.corruption ? 'block' : 'none';
        break;
      case 'factions':
        const factionGroup = this.svg.querySelector('#faction-territories');
        if (factionGroup) {
          factionGroup.style.display = this.visibilityState.factions ? 'block' : 'none';
        }
        break;
      case 'routes':
        this.layers.routes.style.display = this.visibilityState.routes ? 'block' : 'none';
        break;
      case 'distanceRings':
        const ringsGroup = this.svg.querySelector('#distance-rings');
        if (ringsGroup) {
          ringsGroup.style.display = this.visibilityState.distanceRings ? 'block' : 'none';
        }
        break;
    }
  }

  // Export as PNG
  exportAsPNG(filename = 'bleeding-borderlands-map.png', scale = 2.5) {
    const svgData = new XMLSerializer().serializeToString(this.svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = this.config.canvasWidth * scale;
    canvas.height = this.config.canvasHeight * scale;

    img.onload = function() {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  // Export as SVG
  exportAsSVG(filename = 'bleeding-borderlands-map.svg') {
    const svgData = new XMLSerializer().serializeToString(this.svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
}

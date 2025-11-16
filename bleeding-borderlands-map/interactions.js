// Interaction Handler - Manages tooltips, clicks, and user interactions
class InteractionHandler {
  constructor(renderer, locations, factions, corruptionZones) {
    this.renderer = renderer;
    this.locations = locations;
    this.factions = factions;
    this.corruptionZones = corruptionZones;
    this.tooltip = null;
    this.detailPanel = null;
    this.selectedLocation = null;
  }

  // Initialize interaction handlers
  initialize() {
    this.createTooltip();
    this.createDetailPanel();
    this.attachLocationHandlers();
    this.attachControlHandlers();
  }

  // Create tooltip element
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'map-tooltip';
    this.tooltip.className = 'map-tooltip hidden';
    document.body.appendChild(this.tooltip);
  }

  // Create detail panel
  createDetailPanel() {
    this.detailPanel = document.getElementById('detail-panel');
    if (!this.detailPanel) {
      console.error('Detail panel element not found');
    }
  }

  // Attach hover and click handlers to locations
  attachLocationHandlers() {
    const locationElements = this.renderer.svg.querySelectorAll('.location');

    locationElements.forEach(element => {
      const locationKey = element.getAttribute('data-location');
      const location = this.locations[locationKey];

      if (!location) return;

      // Hover events
      element.addEventListener('mouseenter', (e) => {
        this.showTooltip(location, e);
        element.style.cursor = 'pointer';
        element.style.opacity = '0.8';
      });

      element.addEventListener('mousemove', (e) => {
        this.updateTooltipPosition(e);
      });

      element.addEventListener('mouseleave', (e) => {
        this.hideTooltip();
        element.style.opacity = '1';
      });

      // Click event
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showDetailPanel(location, locationKey);
        this.selectedLocation = locationKey;
      });
    });

    // Close detail panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.location') && !e.target.closest('#detail-panel')) {
        this.hideDetailPanel();
      }
    });
  }

  // Attach control button handlers
  attachControlHandlers() {
    // Toggle buttons
    const toggles = {
      'toggle-corruption': 'corruption',
      'toggle-factions': 'factions',
      'toggle-routes': 'routes',
      'toggle-distance': 'distanceRings'
    };

    Object.entries(toggles).forEach(([buttonId, layerName]) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', () => {
          this.renderer.toggleLayer(layerName);
          button.classList.toggle('active');
        });
      }
    });

    // Export buttons
    const exportPNG = document.getElementById('export-png');
    if (exportPNG) {
      exportPNG.addEventListener('click', () => {
        this.renderer.exportAsPNG();
      });
    }

    const exportSVG = document.getElementById('export-svg');
    if (exportSVG) {
      exportSVG.addEventListener('click', () => {
        this.renderer.exportAsSVG();
      });
    }

    // Distance calculator
    const calcButton = document.getElementById('calculate-distance');
    if (calcButton) {
      calcButton.addEventListener('click', () => {
        this.startDistanceCalculator();
      });
    }

    // Close detail panel button
    const closeButton = document.getElementById('close-detail');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.hideDetailPanel();
      });
    }
  }

  // Show tooltip on hover
  showTooltip(location, event) {
    const corruption = this.getCorruptionLevel(location.coordinates.distance);
    const faction = location.faction ? this.factions[location.faction] : null;

    let html = `
      <div class="tooltip-header">
        <span class="tooltip-emoji">${location.emoji}</span>
        <span class="tooltip-name">${location.name}</span>
      </div>
      <div class="tooltip-body">
        ${location.population ? `<div class="tooltip-row"><strong>Population:</strong> ${location.population.toLocaleString()}</div>` : ''}
        <div class="tooltip-row"><strong>Distance from Maelstrom:</strong> ${location.coordinates.distance} miles</div>
        <div class="tooltip-row"><strong>Corruption Level:</strong> ${corruption.level} - ${corruption.name}</div>
        ${faction ? `<div class="tooltip-row"><strong>Faction:</strong> ${faction.emoji} ${faction.name}</div>` : ''}
        ${location.features.length > 0 ? `
          <div class="tooltip-features">
            <strong>Features:</strong>
            <ul>
              ${location.features.slice(0, 3).map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');
    this.updateTooltipPosition(event);
  }

  // Update tooltip position
  updateTooltipPosition(event) {
    const offset = 15;
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = event.pageX + offset;
    let y = event.pageY + offset;

    // Adjust if tooltip goes off screen
    if (x + tooltipWidth > viewportWidth) {
      x = event.pageX - tooltipWidth - offset;
    }

    if (y + tooltipHeight > viewportHeight) {
      y = event.pageY - tooltipHeight - offset;
    }

    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }

  // Hide tooltip
  hideTooltip() {
    this.tooltip.classList.add('hidden');
  }

  // Show detail panel on click
  showDetailPanel(location, locationKey) {
    if (!this.detailPanel) return;

    const corruption = this.getCorruptionLevel(location.coordinates.distance);
    const faction = location.faction ? this.factions[location.faction] : null;
    const connectedLocations = this.findConnectedLocations(locationKey);

    let html = `
      <div class="detail-header">
        <h2>${location.emoji} ${location.name}</h2>
        <button id="close-detail" class="close-btn">&times;</button>
      </div>
      <div class="detail-content">
        <div class="detail-section">
          <h3>Overview</h3>
          <p>${location.description}</p>
        </div>

        <div class="detail-section detail-stats">
          ${location.population ? `
            <div class="stat-item">
              <span class="stat-label">Population</span>
              <span class="stat-value">${location.population.toLocaleString()}</span>
            </div>
          ` : ''}
          <div class="stat-item">
            <span class="stat-label">Distance from Maelstrom</span>
            <span class="stat-value">${location.coordinates.distance} miles</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Corruption</span>
            <span class="stat-value corruption-${corruption.level}">${corruption.name} (${corruption.corruption})</span>
          </div>
          ${faction ? `
            <div class="stat-item">
              <span class="stat-label">Controlling Faction</span>
              <span class="stat-value">${faction.emoji} ${faction.name}</span>
            </div>
          ` : ''}
        </div>

        ${location.features.length > 0 ? `
          <div class="detail-section">
            <h3>Key Features</h3>
            <ul class="feature-list">
              ${location.features.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${location.npcs && location.npcs.length > 0 ? `
          <div class="detail-section">
            <h3>Notable NPCs</h3>
            <ul class="npc-list">
              ${location.npcs.map(npc => `<li>${npc}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${connectedLocations.length > 0 ? `
          <div class="detail-section">
            <h3>Connected Locations</h3>
            <ul class="connected-list">
              ${connectedLocations.map(conn => `
                <li>
                  <span class="connection-name">${conn.location.emoji} ${conn.location.name}</span>
                  <span class="connection-distance">${conn.distance.toFixed(1)} miles</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${location.secret && location.secretInfo ? `
          <div class="detail-section secret-section">
            <h3>🔒 Secret Information (GM Only)</h3>
            <p class="secret-text">${location.secretInfo}</p>
          </div>
        ` : ''}

        ${faction && faction.countdown ? `
          <div class="detail-section faction-countdown">
            <h3>${faction.emoji} Faction Countdown</h3>
            <p><strong>Goal:</strong> ${faction.countdown.goal}</p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${faction.countdown.progress * 100}%"></div>
            </div>
            <p class="progress-text">${(faction.countdown.progress * 100).toFixed(0)}% complete - ${faction.countdown.monthsRemaining} months remaining</p>
          </div>
        ` : ''}
      </div>
    `;

    this.detailPanel.innerHTML = html;
    this.detailPanel.classList.remove('hidden');

    // Reattach close button handler
    const closeBtn = this.detailPanel.querySelector('#close-detail');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideDetailPanel());
    }
  }

  // Hide detail panel
  hideDetailPanel() {
    if (this.detailPanel) {
      this.detailPanel.classList.add('hidden');
    }
    this.selectedLocation = null;
  }

  // Get corruption level based on distance from Maelstrom
  getCorruptionLevel(distance) {
    for (let zone of this.corruptionZones) {
      if (distance >= zone.minDistance && distance <= zone.maxDistance) {
        return zone;
      }
    }
    return this.corruptionZones[0]; // Default to safe zone
  }

  // Find connected locations (via trade routes or proximity)
  findConnectedLocations(locationKey) {
    const location = this.locations[locationKey];
    const connections = [];
    const maxProximity = 50; // miles

    Object.entries(this.locations).forEach(([key, otherLoc]) => {
      if (key === locationKey || otherLoc.type === 'corruption-core') return;

      const pos1 = this.renderer.polarToCartesian(
        location.coordinates.angle,
        location.coordinates.distance
      );
      const pos2 = this.renderer.polarToCartesian(
        otherLoc.coordinates.angle,
        otherLoc.coordinates.distance
      );

      const distance = this.renderer.calculateDistance(pos1, pos2);

      if (distance <= maxProximity) {
        connections.push({
          location: otherLoc,
          distance: distance,
          key: key
        });
      }
    });

    // Sort by distance
    connections.sort((a, b) => a.distance - b.distance);

    return connections.slice(0, 5); // Return top 5 closest
  }

  // Distance calculator
  startDistanceCalculator() {
    alert('Distance Calculator: Click two locations on the map to calculate the distance between them.\n\nFeature coming in next update!');
    // TODO: Implement two-click distance calculator
  }

  // Calculate travel time based on distance and terrain
  calculateTravelTime(distance, corruptionLevel = 0) {
    const baseSpeed = 24; // miles per day (normal travel)
    const corruptionMultiplier = 1 + (corruptionLevel * 0.3); // Slower in corrupted areas
    const days = (distance / baseSpeed) * corruptionMultiplier;

    return {
      days: Math.ceil(days),
      hours: Math.ceil(days * 24)
    };
  }
}

// Path Finder - Find safest route between two locations
class PathFinder {
  constructor(renderer, locations, corruptionZones) {
    this.renderer = renderer;
    this.locations = locations;
    this.corruptionZones = corruptionZones;
  }

  // Find safest path avoiding high corruption
  findSafestPath(startKey, endKey) {
    const start = this.locations[startKey];
    const end = this.locations[endKey];

    if (!start || !end) return null;

    const startPos = this.renderer.polarToCartesian(
      start.coordinates.angle,
      start.coordinates.distance
    );
    const endPos = this.renderer.polarToCartesian(
      end.coordinates.angle,
      end.coordinates.distance
    );

    // Simple straight-line path (can be enhanced with A* pathfinding)
    return {
      start: startPos,
      end: endPos,
      waypoints: [startPos, endPos],
      totalDistance: this.renderer.calculateDistance(startPos, endPos),
      avgCorruption: this.calculatePathCorruption(startPos, endPos)
    };
  }

  // Calculate average corruption along a path
  calculatePathCorruption(start, end) {
    const samples = 10;
    let totalCorruption = 0;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;

      const dx = x - this.renderer.config.centerX;
      const dy = y - this.renderer.config.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy) / this.renderer.config.pixelsPerMile;

      // Find corruption level at this point
      for (let zone of this.corruptionZones) {
        if (distance >= zone.minDistance && distance <= zone.maxDistance) {
          totalCorruption += zone.level;
          break;
        }
      }
    }

    return totalCorruption / (samples + 1);
  }
}

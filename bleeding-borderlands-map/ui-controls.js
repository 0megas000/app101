// UI Controls - Manages sidebars, toggles, zoom controls, and interface state
// Coordinates between all UI elements and core systems

class UIControls {
  constructor(mapRenderer, panZoom, dataManager, locationEditor) {
    this.mapRenderer = mapRenderer;
    this.panZoom = panZoom;
    this.dataManager = dataManager;
    this.locationEditor = locationEditor;

    // UI Elements
    this.elements = {};
    this.sidebars = {
      left: null,
      right: null
    };

    // State
    this.toggleStates = {
      corruption: true,
      factions: false,
      routes: true,
      distanceRings: false,
      secrets: false,
      editMode: false
    };

    this.saveStatusTimer = null;
  }

  // Initialize all UI controls
  initialize() {
    this.cacheElements();
    this.setupToggleControls();
    this.setupZoomControls();
    this.setupSidebarControls();
    this.setupSaveControls();
    this.setupSearchFilter();
    this.setupKeyboardShortcuts();
    this.startSaveStatusUpdater();
    this.updateAllIndicators();
  }

  // Cache all UI element references
  cacheElements() {
    this.elements = {
      // Sidebars
      leftSidebar: document.getElementById('left-sidebar'),
      rightSidebar: document.getElementById('right-sidebar'),
      locationList: document.getElementById('location-list'),
      legend: document.getElementById('legend'),

      // Toggles
      toggleCorruption: document.getElementById('toggle-corruption'),
      toggleFactions: document.getElementById('toggle-factions'),
      toggleRoutes: document.getElementById('toggle-routes'),
      toggleDistance: document.getElementById('toggle-distance-rings'),
      toggleSecrets: document.getElementById('toggle-secrets'),
      toggleLabels: document.getElementById('toggle-labels'),
      editModeToggle: document.getElementById('toggle-edit-mode'),

      // Zoom controls
      zoomIn: document.getElementById('btn-zoom-in'),
      zoomOut: document.getElementById('btn-zoom-out'),
      zoomReset: document.getElementById('btn-zoom-reset'),
      zoomDisplay: document.getElementById('zoom-level'),

      // Save controls
      saveButton: document.getElementById('btn-manual-save'),
      saveStatus: document.getElementById('save-status-text'),
      exportButton: document.getElementById('btn-export-json'),
      importButton: document.getElementById('btn-import-json'),
      importFileInput: document.getElementById('hidden-file-input'),

      // Search/filter
      searchInput: document.getElementById('location-search'),
      filterDropdown: document.getElementById('location-filter'),

      // Misc
      helpButton: document.getElementById('btn-help'),
      collapseSidebarLeft: document.getElementById('toggle-left-sidebar'),
      collapseSidebarRight: document.getElementById('toggle-right-sidebar'),
      undoButton: document.getElementById('btn-undo'),
      redoButton: document.getElementById('btn-redo'),
      resetButton: document.getElementById('btn-reset-data')
    };

    this.sidebars.left = this.elements.leftSidebar;
    this.sidebars.right = this.elements.rightSidebar;
  }

  // === TOGGLE CONTROLS ===

  setupToggleControls() {
    // Corruption zones toggle
    if (this.elements.toggleCorruption) {
      this.elements.toggleCorruption.checked = this.toggleStates.corruption;
      this.elements.toggleCorruption.addEventListener('change', (e) => {
        this.handleToggle('corruption', e.target.checked);
      });
    }

    // Faction territories toggle
    if (this.elements.toggleFactions) {
      this.elements.toggleFactions.checked = this.toggleStates.factions;
      this.elements.toggleFactions.addEventListener('change', (e) => {
        this.handleToggle('factions', e.target.checked);
      });
    }

    // Trade routes toggle
    if (this.elements.toggleRoutes) {
      this.elements.toggleRoutes.checked = this.toggleStates.routes;
      this.elements.toggleRoutes.addEventListener('change', (e) => {
        this.handleToggle('routes', e.target.checked);
      });
    }

    // Distance rings toggle
    if (this.elements.toggleDistance) {
      this.elements.toggleDistance.checked = this.toggleStates.distanceRings;
      this.elements.toggleDistance.addEventListener('change', (e) => {
        this.handleToggle('distanceRings', e.target.checked);
      });
    }

    // Secrets toggle
    if (this.elements.toggleSecrets) {
      this.elements.toggleSecrets.checked = this.toggleStates.secrets;
      this.elements.toggleSecrets.addEventListener('change', (e) => {
        this.handleToggle('secrets', e.target.checked);
      });
    }

    // Edit mode toggle
    if (this.elements.editModeToggle) {
      this.elements.editModeToggle.checked = this.toggleStates.editMode;
      this.elements.editModeToggle.addEventListener('change', (e) => {
        this.handleToggle('editMode', e.target.checked);
      });
    }
  }

  handleToggle(toggleName, enabled) {
    this.toggleStates[toggleName] = enabled;

    switch(toggleName) {
      case 'corruption':
      case 'factions':
      case 'routes':
      case 'secrets':
        this.mapRenderer.toggleLayer(toggleName, enabled);
        break;

      case 'distanceRings':
        this.toggleDistanceRings(enabled);
        break;

      case 'editMode':
        this.locationEditor.toggleEditMode(enabled);
        this.updateEditModeUI(enabled);
        break;
    }
  }

  toggleDistanceRings(show) {
    // Implement distance rings rendering
    // This would add/remove distance ring elements from the map
    console.log(`Distance rings: ${show ? 'shown' : 'hidden'}`);
  }

  updateEditModeUI(enabled) {
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
      if (enabled) {
        mapContainer.classList.add('edit-mode');
      } else {
        mapContainer.classList.remove('edit-mode');
      }
    }
  }

  // === ZOOM CONTROLS ===

  setupZoomControls() {
    // Zoom in button
    if (this.elements.zoomIn) {
      this.elements.zoomIn.addEventListener('click', () => {
        this.panZoom.zoomIn();
      });
    }

    // Zoom out button
    if (this.elements.zoomOut) {
      this.elements.zoomOut.addEventListener('click', () => {
        this.panZoom.zoomOut();
      });
    }

    // Reset button
    if (this.elements.zoomReset) {
      this.elements.zoomReset.addEventListener('click', () => {
        this.panZoom.resetView();
      });
    }

    // Listen for zoom changes to update display
    if (this.mapRenderer.svg) {
      this.mapRenderer.svg.addEventListener('zoomchange', (e) => {
        this.updateZoomDisplay(e.detail.percentage);
      });
    }
  }

  updateZoomDisplay(percentage) {
    if (this.elements.zoomDisplay) {
      this.elements.zoomDisplay.textContent = `${percentage}%`;
    }
  }

  // === SIDEBAR CONTROLS ===

  setupSidebarControls() {
    // Left sidebar collapse
    if (this.elements.collapseSidebarLeft) {
      this.elements.collapseSidebarLeft.addEventListener('click', () => {
        this.toggleSidebar('left');
      });
    }

    // Right sidebar collapse
    if (this.elements.collapseSidebarRight) {
      this.elements.collapseSidebarRight.addEventListener('click', () => {
        this.toggleSidebar('right');
      });
    }
  }

  toggleSidebar(side) {
    const sidebar = this.sidebars[side];
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed');

    // Store preference
    localStorage.setItem(`sidebar-${side}-collapsed`, sidebar.classList.contains('collapsed'));
  }

  // Restore sidebar states from localStorage
  restoreSidebarStates() {
    ['left', 'right'].forEach(side => {
      const collapsed = localStorage.getItem(`sidebar-${side}-collapsed`) === 'true';
      if (collapsed && this.sidebars[side]) {
        this.sidebars[side].classList.add('collapsed');
      }
    });
  }

  // === SAVE CONTROLS ===

  setupSaveControls() {
    // Manual save button
    if (this.elements.saveButton) {
      this.elements.saveButton.addEventListener('click', () => {
        this.handleManualSave();
      });
    }

    // Export button
    if (this.elements.exportButton) {
      this.elements.exportButton.addEventListener('click', () => {
        this.handleExport();
      });
    }

    // Import button
    if (this.elements.importButton) {
      this.elements.importButton.addEventListener('click', () => {
        if (this.elements.importFileInput) {
          this.elements.importFileInput.click();
        }
      });
    }

    // Import file input
    if (this.elements.importFileInput) {
      this.elements.importFileInput.addEventListener('change', (e) => {
        this.handleImport(e.target.files[0]);
      });
    }

    // Listen for save events
    document.addEventListener('datasave', (e) => {
      this.updateSaveStatus(e.detail.success);
    });
  }

  handleManualSave() {
    const success = this.dataManager.save();
    if (success) {
      this.showNotification('Map data saved successfully', 'success');
    } else {
      this.showNotification('Failed to save map data', 'error');
    }
  }

  handleExport() {
    this.dataManager.exportJSON();
    this.showNotification('Map data exported', 'success');
  }

  handleImport(file) {
    if (!file) return;

    const confirmed = confirm(
      'Importing will replace all current data. Continue?\n\n' +
      'Your current data will be backed up automatically.'
    );

    if (!confirmed) return;

    this.dataManager.importJSON(file, (error, data) => {
      if (error) {
        this.showNotification('Import failed: ' + error.message, 'error');
      } else {
        this.showNotification('Map data imported successfully', 'success');
        // Refresh UI
        this.locationEditor.renderLocationList();
        this.mapRenderer.render();
      }
    });

    // Reset file input
    if (this.elements.importFileInput) {
      this.elements.importFileInput.value = '';
    }
  }

  updateSaveStatus(success) {
    if (!this.elements.saveStatus) return;

    if (success) {
      this.elements.saveStatus.textContent = 'Saved';
      this.elements.saveStatus.className = 'save-status success';
    } else {
      this.elements.saveStatus.textContent = 'Error';
      this.elements.saveStatus.className = 'save-status error';
    }

    // Reset after 3 seconds
    setTimeout(() => {
      this.updateSaveStatusText();
    }, 3000);
  }

  startSaveStatusUpdater() {
    // Update "Last saved" text every 10 seconds
    this.saveStatusTimer = setInterval(() => {
      this.updateSaveStatusText();
    }, 10000);

    this.updateSaveStatusText();
  }

  updateSaveStatusText() {
    if (!this.elements.saveStatus) return;

    const timeSince = this.dataManager.getTimeSinceLastSave();
    this.elements.saveStatus.textContent = `Last saved: ${timeSince}`;

    // Color code based on time
    if (timeSince.includes('sec')) {
      this.elements.saveStatus.className = 'save-status recent';
    } else if (timeSince.includes('min') || timeSince.includes('Never')) {
      this.elements.saveStatus.className = 'save-status';
    } else {
      this.elements.saveStatus.className = 'save-status old';
    }
  }

  // === SEARCH & FILTER ===

  setupSearchFilter() {
    // Search input
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    // Filter dropdown
    if (this.elements.filterDropdown) {
      this.elements.filterDropdown.addEventListener('change', (e) => {
        this.handleFilter(e.target.value);
      });
    }
  }

  handleSearch(query) {
    query = query.toLowerCase().trim();

    const locationItems = this.elements.locationList?.querySelectorAll('.location-item');
    if (!locationItems) return;

    locationItems.forEach(item => {
      const name = item.querySelector('.location-item-name')?.textContent.toLowerCase() || '';

      if (query === '' || name.includes(query)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });

    // Update section visibility (hide empty sections)
    this.updateSectionVisibility();
  }

  handleFilter(filterType) {
    const locationSections = this.elements.locationList?.querySelectorAll('.location-section');
    if (!locationSections) return;

    locationSections.forEach(section => {
      const sectionTitle = section.querySelector('.section-header')?.textContent.toLowerCase() || '';

      if (filterType === 'all') {
        section.style.display = '';
      } else if (sectionTitle.includes(filterType.toLowerCase())) {
        section.style.display = '';
      } else {
        section.style.display = 'none';
      }
    });
  }

  updateSectionVisibility() {
    const sections = this.elements.locationList?.querySelectorAll('.location-section');
    if (!sections) return;

    sections.forEach(section => {
      const visibleItems = section.querySelectorAll('.location-item:not([style*="display: none"])');
      if (visibleItems.length === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = '';
      }
    });
  }

  // === KEYBOARD SHORTCUTS ===

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch(e.key.toLowerCase()) {
        case 'c':
          if (!e.ctrlKey && !e.metaKey) {
            this.toggleControl('corruption');
            e.preventDefault();
          }
          break;

        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            this.toggleControl('factions');
            e.preventDefault();
          }
          break;

        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            this.toggleControl('routes');
            e.preventDefault();
          }
          break;

        case 'd':
          if (!e.ctrlKey && !e.metaKey) {
            this.toggleControl('distanceRings');
            e.preventDefault();
          }
          break;

        case 'e':
          if (!e.ctrlKey && !e.metaKey) {
            this.toggleControl('editMode');
            e.preventDefault();
          }
          break;

        case 's':
          if (e.ctrlKey || e.metaKey) {
            this.handleManualSave();
            e.preventDefault();
          }
          break;

        case '+':
        case '=':
          this.panZoom.zoomIn();
          e.preventDefault();
          break;

        case '-':
        case '_':
          this.panZoom.zoomOut();
          e.preventDefault();
          break;

        case '0':
          this.panZoom.resetView();
          e.preventDefault();
          break;

        case 'escape':
          // Close any open modals
          this.closeAllModals();
          break;

        case '?':
          this.showHelpDialog();
          e.preventDefault();
          break;
      }
    });
  }

  toggleControl(controlName) {
    const checkbox = this.elements[`toggle${controlName.charAt(0).toUpperCase() + controlName.slice(1)}`]
                  || this.elements[`${controlName}Toggle`];

    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }
  }

  // === MISC CONTROLS ===

  setupFullscreenButton() {
    if (!this.elements.fullscreenButton) return;

    this.elements.fullscreenButton.addEventListener('click', () => {
      this.toggleFullscreen();
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll('.modal:not(.hidden)');
    modals.forEach(modal => {
      modal.classList.add('hidden');
    });
  }

  showHelpDialog() {
    const helpContent = `
      <h2>Keyboard Shortcuts</h2>
      <ul>
        <li><kbd>C</kbd> - Toggle Corruption Zones</li>
        <li><kbd>F</kbd> - Toggle Faction Territories</li>
        <li><kbd>R</kbd> - Toggle Trade Routes</li>
        <li><kbd>D</kbd> - Toggle Distance Rings</li>
        <li><kbd>E</kbd> - Toggle Edit Mode</li>
        <li><kbd>Ctrl+S</kbd> - Manual Save</li>
        <li><kbd>+</kbd> / <kbd>-</kbd> - Zoom In/Out</li>
        <li><kbd>0</kbd> - Reset View</li>
        <li><kbd>ESC</kbd> - Close Modals</li>
        <li><kbd>?</kbd> - Show Help</li>
      </ul>
      <h2>Mouse Controls</h2>
      <ul>
        <li><strong>Scroll</strong> - Zoom in/out</li>
        <li><strong>Click + Drag</strong> - Pan map</li>
        <li><strong>Click Location</strong> - View details</li>
      </ul>
      <h2>Edit Mode</h2>
      <ul>
        <li><strong>Click Map</strong> - Add new location</li>
        <li><strong>Drag Location</strong> - Reposition</li>
      </ul>
    `;

    this.showModal('Help', helpContent);
  }

  showModal(title, content) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('help-modal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'help-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
            <button class="close-btn" onclick="this.closest('.modal').classList.add('hidden')">&times;</button>
          </div>
          <div class="modal-body">${content}</div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.querySelector('.modal-title').textContent = title;
      modal.querySelector('.modal-body').innerHTML = content;
    }

    modal.classList.remove('hidden');

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // === UPDATE ALL INDICATORS ===

  updateAllIndicators() {
    // Update zoom display
    this.updateZoomDisplay(this.panZoom.getZoomPercentage());

    // Update save status
    this.updateSaveStatusText();

    // Restore sidebar states
    this.restoreSidebarStates();
  }

  // === CLEANUP ===

  destroy() {
    if (this.saveStatusTimer) {
      clearInterval(this.saveStatusTimer);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIControls;
}

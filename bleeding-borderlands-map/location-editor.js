// Location Editor - Full CRUD interface for managing map locations
// Handles add/edit/delete with forms, validation, and drag-to-reposition

class LocationEditor {
  constructor(dataManager, mapRenderer, panZoom) {
    this.dataManager = dataManager;
    this.mapRenderer = mapRenderer;
    this.panZoom = panZoom;

    // Editor state
    this.isEditMode = false;
    this.currentLocation = null;
    this.isDraggingLocation = false;
    this.draggedLocationId = null;

    // UI elements (will be set after DOM ready)
    this.editorModal = null;
    this.editorForm = null;
    this.locationList = null;

    // Validation rules
    this.validationRules = {
      name: { required: true, minLength: 1, maxLength: 50 },
      position: { required: true, bounds: { x: [-120, 120], y: [-120, 120] } },
      elevation: { min: -1000, max: 10000 },
      population: { min: 0, max: 1000000 },
      corruption: { min: 0, max: 4 }
    };
  }

  // Initialize after DOM is ready
  initialize() {
    this.editorModal = document.getElementById('location-editor-modal');
    this.editorForm = document.getElementById('location-editor-form');
    this.locationList = document.getElementById('location-list');

    this.setupEventListeners();
    this.renderLocationList();
  }

  // Setup all event listeners
  setupEventListeners() {
    // Add location button
    const addBtn = document.getElementById('btn-add-location');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddLocationModal());
    }

    // Edit mode toggle
    const editModeToggle = document.getElementById('toggle-edit-mode');
    if (editModeToggle) {
      editModeToggle.addEventListener('change', (e) => this.toggleEditMode(e.target.checked));
    }

    // Form submission
    if (this.editorForm) {
      this.editorForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Cancel button
    const cancelBtn = document.getElementById('editor-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideEditorModal());
    }

    // Close modal on outside click
    if (this.editorModal) {
      this.editorModal.addEventListener('click', (e) => {
        if (e.target === this.editorModal) {
          this.hideEditorModal();
        }
      });
    }

    // Listen for data changes
    document.addEventListener('locationchange', (e) => {
      this.renderLocationList();
    });

    // Map click in edit mode (to place new location)
    this.mapRenderer.svg.addEventListener('click', (e) => {
      if (this.isEditMode && !this.isDraggingLocation) {
        this.handleMapClick(e);
      }
    });
  }

  // Toggle edit mode
  toggleEditMode(enabled) {
    this.isEditMode = enabled;
    this.panZoom.setPanEnabled(!enabled);

    // Update cursor and visual indicators
    if (enabled) {
      this.mapRenderer.svg.style.cursor = 'crosshair';
      this.enableLocationDragging();
    } else {
      this.mapRenderer.svg.style.cursor = 'grab';
      this.disableLocationDragging();
    }

    // Dispatch event
    const event = new CustomEvent('editmodechange', { detail: { enabled } });
    document.dispatchEvent(event);
  }

  // === ADD LOCATION ===

  // Show add location modal
  showAddLocationModal() {
    this.currentLocation = null;
    this.resetForm();

    // Set modal title
    const title = this.editorModal.querySelector('.modal-title');
    if (title) title.textContent = 'Add New Location';

    // Show modal
    this.editorModal.style.display = 'flex';
    this.editorModal.classList.remove('hidden');

    // Focus name field
    const nameField = document.getElementById('edit-name');
    if (nameField) nameField.focus();
  }

  // Handle map click to place new location
  handleMapClick(event) {
    // Don't place if clicking on existing location
    if (event.target.closest('.location')) return;

    // Get click position in SVG coordinates
    const svgPos = this.getSVGPosition(event);
    const realPos = coordHelpers.svgToReal(svgPos.x, svgPos.y);

    // Prompt for location name
    const name = prompt('Enter location name:');
    if (!name) return;

    // Pre-fill form with clicked position
    this.showAddLocationModal();
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-x').value = realPos.x.toFixed(1);
    document.getElementById('edit-y').value = realPos.y.toFixed(1);
  }

  // === EDIT LOCATION ===

  // Show edit location modal
  showEditLocationModal(locationId) {
    const location = this.dataManager.getLocation(locationId);
    if (!location) return;

    this.currentLocation = location;
    this.populateForm(location);

    // Set modal title
    const title = this.editorModal.querySelector('.modal-title');
    if (title) title.textContent = `Edit: ${location.name}`;

    // Show modal
    this.editorModal.style.display = 'flex';
    this.editorModal.classList.remove('hidden');
  }

  // Populate form with location data
  populateForm(location) {
    document.getElementById('edit-name').value = location.name || '';
    document.getElementById('edit-type').value = location.type || 'city';
    document.getElementById('edit-x').value = location.position?.x || 0;
    document.getElementById('edit-y').value = location.position?.y || 0;
    document.getElementById('edit-population').value = location.population || '';
    document.getElementById('edit-corruption').value = location.corruption || 0;
    document.getElementById('edit-faction').value = location.faction || '';
    document.getElementById('edit-description').value = location.description || '';
    document.getElementById('edit-secret').checked = location.secret || false;
    document.getElementById('edit-important').checked = location.important || false;
    document.getElementById('edit-discovered').checked = location.discovered !== false;
    document.getElementById('edit-notes').value = location.notes || '';
  }

  // Populate connected locations checkboxes
  populateConnectedLocations(connectedIds) {
    const container = document.getElementById('connected-locations-list');
    if (!container) return;

    container.innerHTML = '';
    const allLocations = this.dataManager.getLocations();

    Object.values(allLocations).forEach(loc => {
      if (loc.id === this.currentLocation?.id) return; // Skip self

      const div = document.createElement('div');
      div.className = 'checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = loc.id;
      checkbox.id = `conn-${loc.id}`;
      checkbox.checked = connectedIds.includes(loc.id);

      const label = document.createElement('label');
      label.htmlFor = `conn-${loc.id}`;
      label.textContent = `${loc.emoji || ''} ${loc.name}`;

      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);
    });
  }

  // === DELETE LOCATION ===

  // Show delete confirmation
  showDeleteConfirmation(locationId) {
    const location = this.dataManager.getLocation(locationId);
    if (!location) return;

    const confirmed = confirm(
      `Delete "${location.name}"?\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      this.dataManager.deleteLocation(locationId);
      this.mapRenderer.removeLocation(locationId);
    }
  }

  // === FORM HANDLING ===

  // Handle form submission
  handleFormSubmit(event) {
    event.preventDefault();

    // Collect form data
    const formData = this.collectFormData();

    // Validate
    const validation = this.validateFormData(formData);
    if (!validation.valid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    // Add or update
    try {
      if (this.currentLocation) {
        // Update existing
        this.dataManager.updateLocation(this.currentLocation.id, formData);
        this.mapRenderer.updateLocation(this.currentLocation.id, formData);
      } else {
        // Add new
        const id = this.dataManager.addLocation(formData);
        this.mapRenderer.addLocation(formData);
      }

      // Close modal
      this.hideEditorModal();

      // Show success message
      this.showNotification('Location saved successfully', 'success');
    } catch (error) {
      this.showNotification('Error saving location: ' + error.message, 'error');
    }
  }

  // Collect form data
  collectFormData() {
    // Get basic fields
    const data = {
      name: document.getElementById('edit-name').value.trim(),
      type: document.getElementById('edit-type').value,
      position: {
        x: parseFloat(document.getElementById('edit-x').value),
        y: parseFloat(document.getElementById('edit-y').value)
      },
      population: parseInt(document.getElementById('edit-population').value) || undefined,
      corruption: parseInt(document.getElementById('edit-corruption').value) || 0,
      faction: document.getElementById('edit-faction').value || undefined,
      description: document.getElementById('edit-description').value.trim(),
      secret: document.getElementById('edit-secret').checked,
      important: document.getElementById('edit-important').checked,
      discovered: document.getElementById('edit-discovered').checked,
      notes: document.getElementById('edit-notes').value.trim()
    };

    // Preserve existing ID if editing
    if (this.currentLocation) {
      data.id = this.currentLocation.id;
    }

    return data;
  }

  // Validate form data
  validateFormData(data) {
    const errors = [];

    // Name validation
    if (!data.name || data.name.length === 0) {
      errors.push('Name is required');
    } else if (data.name.length > 50) {
      errors.push('Name must be 50 characters or less');
    }

    // Check for duplicate name (if adding or renaming)
    if (!this.currentLocation || this.currentLocation.name !== data.name) {
      const existing = Object.values(this.dataManager.getLocations())
        .find(loc => loc.name.toLowerCase() === data.name.toLowerCase());
      if (existing) {
        errors.push('A location with this name already exists');
      }
    }

    // Position validation
    if (isNaN(data.position.x) || isNaN(data.position.y)) {
      errors.push('Position coordinates must be numbers');
    } else {
      if (data.position.x < -120 || data.position.x > 120) {
        errors.push('X coordinate must be between -120 and 120');
      }
      if (data.position.y < -120 || data.position.y > 120) {
        errors.push('Y coordinate must be between -120 and 120');
      }
    }

    // Elevation validation
    if (data.elevation < -1000 || data.elevation > 10000) {
      errors.push('Elevation must be between -1000 and 10000 feet');
    }

    // Population validation
    if (data.population !== undefined && (data.population < 0 || data.population > 1000000)) {
      errors.push('Population must be between 0 and 1,000,000');
    }

    // Corruption validation
    if (data.corruption < 0 || data.corruption > 4) {
      errors.push('Corruption level must be between 0 and 4');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Show validation errors
  showValidationErrors(errors) {
    const errorContainer = document.getElementById('form-errors');
    if (!errorContainer) return;

    errorContainer.innerHTML = errors.map(err =>
      `<div class="error-message">${err}</div>`
    ).join('');

    errorContainer.style.display = 'block';
  }

  // Reset form
  resetForm() {
    if (this.editorForm) {
      this.editorForm.reset();
    }

    const errorContainer = document.getElementById('form-errors');
    if (errorContainer) {
      errorContainer.innerHTML = '';
      errorContainer.style.display = 'none';
    }

    // Clear connected locations
    const connContainer = document.getElementById('connected-locations-list');
    if (connContainer) {
      connContainer.innerHTML = '';
    }
  }

  // Hide editor modal
  hideEditorModal() {
    if (this.editorModal) {
      this.editorModal.style.display = 'none';
      this.editorModal.classList.add('hidden');
    }
    this.currentLocation = null;
    this.resetForm();
  }

  // === LOCATION LIST ===

  // Render location list in sidebar
  renderLocationList() {
    if (!this.locationList) return;

    const locations = this.dataManager.getLocations();
    const categories = this.categorizeLocations(locations);

    this.locationList.innerHTML = '';

    Object.entries(categories).forEach(([category, locs]) => {
      if (locs.length === 0) return;

      const section = this.createLocationSection(category, locs);
      this.locationList.appendChild(section);
    });
  }

  // Categorize locations by type
  categorizeLocations(locations) {
    const categories = {
      'Cities': [],
      'Settlements': [],
      'Landmarks': [],
      'Secrets': [],
      'Custom': []
    };

    Object.values(locations).forEach(loc => {
      if (loc.type === 'corruption-core') return; // Skip maelstrom

      if (loc.type.startsWith('city-')) {
        categories['Cities'].push(loc);
      } else if (loc.type.startsWith('settlement-')) {
        categories['Settlements'].push(loc);
      } else if (loc.type.startsWith('location-')) {
        if (loc.secret) {
          categories['Secrets'].push(loc);
        } else {
          categories['Landmarks'].push(loc);
        }
      } else {
        categories['Custom'].push(loc);
      }
    });

    return categories;
  }

  // Create location section HTML
  createLocationSection(title, locations) {
    const section = document.createElement('div');
    section.className = 'location-section';

    const header = document.createElement('h3');
    header.className = 'section-header';
    header.innerHTML = `${title} <span class="count">(${locations.length})</span>`;
    header.addEventListener('click', () => section.classList.toggle('collapsed'));

    const list = document.createElement('div');
    list.className = 'location-items';

    locations.forEach(loc => {
      const item = this.createLocationItem(loc);
      list.appendChild(item);
    });

    section.appendChild(header);
    section.appendChild(list);

    return section;
  }

  // Create location item HTML
  createLocationItem(location) {
    const item = document.createElement('div');
    item.className = 'location-item';
    item.dataset.locationId = location.id;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'location-item-name';
    nameDiv.innerHTML = `${location.emoji || '📍'} ${location.name}`;
    nameDiv.addEventListener('click', () => this.focusOnLocation(location.id));

    const infoDiv = document.createElement('div');
    infoDiv.className = 'location-item-info';
    const pop = location.population ? `Pop: ${(location.population / 1000).toFixed(1)}k` : '';
    const faction = location.faction && location.faction !== 'none' ? FACTIONS[location.faction]?.name : '';
    infoDiv.textContent = [pop, faction].filter(Boolean).join(' | ');

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'location-item-actions';

    const viewBtn = this.createButton('👁️', 'View', () => this.focusOnLocation(location.id));
    const editBtn = this.createButton('✏️', 'Edit', () => this.showEditLocationModal(location.id));
    const deleteBtn = this.createButton('🗑️', 'Delete', () => this.showDeleteConfirmation(location.id));

    actionsDiv.appendChild(viewBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    item.appendChild(nameDiv);
    item.appendChild(infoDiv);
    item.appendChild(actionsDiv);

    return item;
  }

  // Create button helper
  createButton(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'location-action-btn';
    btn.innerHTML = icon;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // Focus map on location
  focusOnLocation(locationId) {
    const location = this.dataManager.getLocation(locationId);
    if (!location) return;

    const svgPos = coordHelpers.realToSVG(location.position.x, location.position.y);
    this.panZoom.focusOnLocation(svgPos.x, svgPos.y, 2.0, true);
  }

  // === DRAG TO REPOSITION ===

  enableLocationDragging() {
    const locationElements = this.mapRenderer.svg.querySelectorAll('.location');
    locationElements.forEach(el => {
      el.style.cursor = 'move';
      el.addEventListener('mousedown', this.handleDragStart.bind(this));
    });
  }

  disableLocationDragging() {
    const locationElements = this.mapRenderer.svg.querySelectorAll('.location');
    locationElements.forEach(el => {
      el.style.cursor = 'pointer';
      el.removeEventListener('mousedown', this.handleDragStart.bind(this));
    });
  }

  handleDragStart(event) {
    if (!this.isEditMode) return;

    this.isDraggingLocation = true;
    this.draggedLocationId = event.currentTarget.dataset.locationId;

    event.preventDefault();
    event.stopPropagation();

    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
  }

  handleDragMove(event) {
    if (!this.isDraggingLocation) return;

    const svgPos = this.getSVGPosition(event);
    const realPos = coordHelpers.svgToReal(svgPos.x, svgPos.y);

    // Update location position visually
    this.mapRenderer.moveLocation(this.draggedLocationId, svgPos.x, svgPos.y);
  }

  handleDragEnd(event) {
    if (!this.isDraggingLocation) return;

    const svgPos = this.getSVGPosition(event);
    const realPos = coordHelpers.svgToReal(svgPos.x, svgPos.y);

    // Update location in data
    this.dataManager.updateLocation(this.draggedLocationId, {
      position: { x: realPos.x, y: realPos.y }
    });

    this.isDraggingLocation = false;
    this.draggedLocationId = null;

    document.removeEventListener('mousemove', this.handleDragMove.bind(this));
    document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
  }

  // === UTILITIES ===

  // Get SVG position from mouse event
  getSVGPosition(event) {
    const CTM = this.mapRenderer.svg.getScreenCTM();
    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d
    };
  }

  // Estimate elevation based on position (terrain-aware)
  estimateElevation(x, y) {
    // Near ocean/coast
    if (x < -50) return 0;
    if (x < -20) return 100;

    // Plains
    if (x < 30) return 400;

    // Foothills
    if (x < 50) return 1500;

    // Mountains
    return 3000;
  }

  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Destroy/cleanup
  destroy() {
    this.toggleEditMode(false);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocationEditor;
}

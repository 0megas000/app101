// Data Manager - Handles localStorage persistence, auto-save, import/export
// Manages map data state and synchronization

class DataManager {
  constructor(defaultData) {
    this.defaultData = defaultData;
    this.storageKey = 'bleeding-borderlands-map-data';
    this.backupPrefix = 'bleeding-borderlands-backup-';
    this.maxBackups = 3;

    // Current data state
    this.data = null;
    this.isDirty = false;
    this.lastSaved = null;

    // Auto-save settings
    this.autoSaveInterval = 30000; // 30 seconds
    this.autoSaveTimer = null;

    // Undo/redo history
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 10;

    // Initialize
    this.load();
    this.startAutoSave();
  }

  // Load data from localStorage or use defaults
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);

      if (stored) {
        const parsed = JSON.parse(stored);

        // Validate data structure
        if (this.validateData(parsed)) {
          this.data = parsed;
          this.lastSaved = new Date(parsed.lastModified || Date.now());
          console.log('✓ Loaded saved map data from localStorage');
          return true;
        } else {
          console.warn('⚠ Stored data invalid, using defaults');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);

      // Try to recover from backup
      if (this.recoverFromBackup()) {
        return true;
      }
    }

    // Use default data
    this.data = this.cloneData(this.defaultData);
    this.lastSaved = new Date();
    return false;
  }

  // Save data to localStorage
  save(silent = false) {
    try {
      // Create backup before saving
      this.createBackup();

      // Update metadata
      this.data.lastModified = new Date().toISOString();
      this.data.version = this.data.version || "1.0";

      // Save to localStorage
      const serialized = JSON.stringify(this.data);
      localStorage.setItem(this.storageKey, serialized);

      this.lastSaved = new Date();
      this.isDirty = false;

      if (!silent) {
        console.log('✓ Map data saved successfully');
        this.dispatchSaveEvent(true);
      }

      return true;
    } catch (error) {
      console.error('Error saving data:', error);

      // Check if quota exceeded
      if (error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
      }

      this.dispatchSaveEvent(false, error.message);
      return false;
    }
  }

  // Auto-save if dirty
  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        console.log('Auto-saving...');
        this.save(true);
      }
    }, this.autoSaveInterval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // Mark data as modified
  markDirty() {
    this.isDirty = true;
  }

  // Get time since last save (formatted)
  getTimeSinceLastSave() {
    if (!this.lastSaved) return 'Never';

    const seconds = Math.floor((Date.now() - this.lastSaved) / 1000);

    if (seconds < 60) return `${seconds} sec ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  // Validate data structure
  validateData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.locations || typeof data.locations !== 'object') return false;
    if (!data.version) return false;
    return true;
  }

  // Clone data (deep copy)
  cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  // === LOCATION MANAGEMENT ===

  // Get all locations
  getLocations() {
    return this.data.locations || {};
  }

  // Get location by ID
  getLocation(id) {
    return this.data.locations[id] || null;
  }

  // Add new location
  addLocation(location) {
    // Generate ID if not provided
    if (!location.id) {
      location.id = this.generateLocationId(location.name);
    }

    // Check for duplicate ID
    if (this.data.locations[location.id]) {
      throw new Error(`Location ID "${location.id}" already exists`);
    }

    // Add to data
    this.saveHistory();
    this.data.locations[location.id] = location;
    this.markDirty();

    this.dispatchLocationEvent('add', location);
    return location.id;
  }

  // Update existing location
  updateLocation(id, updates) {
    if (!this.data.locations[id]) {
      throw new Error(`Location "${id}" not found`);
    }

    this.saveHistory();
    this.data.locations[id] = { ...this.data.locations[id], ...updates };
    this.markDirty();

    this.dispatchLocationEvent('update', this.data.locations[id]);
  }

  // Delete location
  deleteLocation(id) {
    if (!this.data.locations[id]) {
      throw new Error(`Location "${id}" not found`);
    }

    this.saveHistory();
    const deleted = this.data.locations[id];
    delete this.data.locations[id];
    this.markDirty();

    this.dispatchLocationEvent('delete', deleted);
  }

  // Generate unique location ID from name
  generateLocationId(name) {
    const base = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let id = base;
    let counter = 1;

    while (this.data.locations[id]) {
      id = `${base}-${counter}`;
      counter++;
    }

    return id;
  }

  // === UNDO/REDO ===

  // Save current state to history
  saveHistory() {
    // Remove any redo states after current index
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add current state
    this.history.push(this.cloneData(this.data));

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  // Undo last change
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.data = this.cloneData(this.history[this.historyIndex]);
      this.markDirty();
      this.dispatchUndoRedoEvent('undo');
      return true;
    }
    return false;
  }

  // Redo last undone change
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.data = this.cloneData(this.history[this.historyIndex]);
      this.markDirty();
      this.dispatchUndoRedoEvent('redo');
      return true;
    }
    return false;
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  // === BACKUP & RECOVERY ===

  // Create backup in localStorage
  createBackup() {
    try {
      const timestamp = Date.now();
      const backupKey = this.backupPrefix + timestamp;

      localStorage.setItem(backupKey, JSON.stringify(this.data));

      // Clean old backups
      this.cleanOldBackups();
    } catch (error) {
      console.warn('Failed to create backup:', error);
    }
  }

  // Remove old backups (keep only maxBackups)
  cleanOldBackups() {
    try {
      const backups = [];

      // Find all backup keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.backupPrefix)) {
          const timestamp = parseInt(key.replace(this.backupPrefix, ''));
          backups.push({ key, timestamp });
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp - a.timestamp);

      // Remove old backups
      for (let i = this.maxBackups; i < backups.length; i++) {
        localStorage.removeItem(backups[i].key);
      }
    } catch (error) {
      console.warn('Failed to clean old backups:', error);
    }
  }

  // Recover from most recent backup
  recoverFromBackup() {
    try {
      const backups = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.backupPrefix)) {
          const timestamp = parseInt(key.replace(this.backupPrefix, ''));
          backups.push({ key, timestamp });
        }
      }

      if (backups.length === 0) return false;

      // Get most recent backup
      backups.sort((a, b) => b.timestamp - a.timestamp);
      const backupData = localStorage.getItem(backups[0].key);

      if (backupData) {
        this.data = JSON.parse(backupData);
        console.log('✓ Recovered from backup');
        return true;
      }
    } catch (error) {
      console.error('Failed to recover from backup:', error);
    }

    return false;
  }

  // === EXPORT/IMPORT ===

  // Export data as JSON file
  exportJSON(filename) {
    filename = filename || `bleeding-borderlands-${new Date().toISOString().slice(0,10)}.json`;

    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
    console.log(`✓ Exported data to ${filename}`);
  }

  // Import data from JSON file
  importJSON(file, callback) {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);

        if (!this.validateData(imported)) {
          throw new Error('Invalid data format');
        }

        // Create backup before importing
        this.createBackup();

        // Replace current data
        this.data = imported;
        this.save();

        console.log('✓ Imported data successfully');
        if (callback) callback(null, imported);

        this.dispatchImportEvent(true);
      } catch (error) {
        console.error('Import failed:', error);
        if (callback) callback(error);

        this.dispatchImportEvent(false, error.message);
      }
    };

    reader.readAsText(file);
  }

  // Reset to default data
  resetToDefaults(confirmed = false) {
    if (!confirmed) {
      throw new Error('Reset requires confirmation');
    }

    // Create backup
    this.createBackup();

    // Reset data
    this.data = this.cloneData(this.defaultData);
    this.save();

    console.log('✓ Reset to default data');
    this.dispatchResetEvent();
  }

  // === STORAGE MANAGEMENT ===

  // Handle quota exceeded error
  handleQuotaExceeded() {
    console.warn('LocalStorage quota exceeded, cleaning up...');

    // Try to free space by removing old backups
    this.cleanOldBackups();

    // Try saving again
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      console.log('✓ Saved after cleanup');
    } catch (error) {
      alert('Storage quota exceeded. Please export your data and clear browser storage.');
    }
  }

  // Get storage usage info
  getStorageInfo() {
    try {
      const currentData = localStorage.getItem(this.storageKey);
      const used = currentData ? currentData.length : 0;
      const usedKB = (used / 1024).toFixed(2);

      // Approximate quota (varies by browser)
      const quotaKB = 5120; // ~5MB typical
      const percentage = ((used / (quotaKB * 1024)) * 100).toFixed(1);

      return { used, usedKB, quotaKB, percentage };
    } catch (error) {
      return null;
    }
  }

  // === EVENT DISPATCHING ===

  dispatchSaveEvent(success, error = null) {
    const event = new CustomEvent('datasave', {
      detail: { success, error, timestamp: new Date() }
    });
    document.dispatchEvent(event);
  }

  dispatchLocationEvent(action, location) {
    const event = new CustomEvent('locationchange', {
      detail: { action, location }
    });
    document.dispatchEvent(event);
  }

  dispatchImportEvent(success, error = null) {
    const event = new CustomEvent('dataimport', {
      detail: { success, error }
    });
    document.dispatchEvent(event);
  }

  dispatchResetEvent() {
    const event = new CustomEvent('datareset', {});
    document.dispatchEvent(event);
  }

  dispatchUndoRedoEvent(action) {
    const event = new CustomEvent('undoredo', {
      detail: { action, canUndo: this.canUndo(), canRedo: this.canRedo() }
    });
    document.dispatchEvent(event);
  }

  // === CLEANUP ===

  destroy() {
    this.stopAutoSave();

    // Save if dirty
    if (this.isDirty) {
      this.save(true);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataManager;
}

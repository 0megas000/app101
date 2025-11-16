// Pan-Zoom Navigation System for SVG Map
// Provides smooth mouse wheel zoom, click-drag panning, and touch support

class PanZoomController {
  constructor(svgElement, config) {
    this.svg = svgElement;
    this.config = config;

    // View state
    this.viewBox = {
      x: 0,
      y: 0,
      width: config.canvasWidth,
      height: config.canvasHeight
    };

    this.currentZoom = config.defaultZoom || 1.0;
    this.minZoom = config.minZoom || 0.5;
    this.maxZoom = config.maxZoom || 4.0;

    // Pan state
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    this.panOffset = { x: 0, y: 0 };

    // Animation
    this.animationDuration = 300; // ms

    // Initialize
    this.setupEventListeners();
    this.resetView();
  }

  // Setup all event listeners
  setupEventListeners() {
    // Mouse wheel zoom
    this.svg.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Mouse pan
    this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.svg.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.svg.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

    // Touch support
    this.svg.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.svg.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.svg.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    // Prevent context menu on right-click
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Get mouse position in SVG coordinates
  getMousePosition(event) {
    const CTM = this.svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };

    return {
      x: (event.clientX - CTM.e) / CTM.a,
      y: (event.clientY - CTM.f) / CTM.d
    };
  }

  // Handle mouse wheel zoom
  handleWheel(event) {
    event.preventDefault();

    // Get mouse position before zoom
    const mousePos = this.getMousePosition(event);

    // Calculate zoom delta
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = this.currentZoom * delta;

    // Clamp zoom to limits
    if (newZoom < this.minZoom || newZoom > this.maxZoom) {
      return;
    }

    // Zoom toward mouse cursor
    this.zoomToPoint(mousePos.x, mousePos.y, newZoom);
  }

  // Zoom to a specific point
  zoomToPoint(x, y, newZoom, animated = false) {
    const oldZoom = this.currentZoom;
    const zoomRatio = newZoom / oldZoom;

    // Calculate new viewBox to keep point under cursor fixed
    const newWidth = this.config.canvasWidth / newZoom;
    const newHeight = this.config.canvasHeight / newZoom;

    // Calculate offset to keep mouse point fixed
    const relativeX = (x - this.viewBox.x) / this.viewBox.width;
    const relativeY = (y - this.viewBox.y) / this.viewBox.height;

    const newX = x - (relativeX * newWidth);
    const newY = y - (relativeY * newHeight);

    // Update view
    this.currentZoom = newZoom;
    this.setViewBox(newX, newY, newWidth, newHeight, animated);

    // Dispatch zoom event
    this.dispatchZoomEvent();
  }

  // Set viewBox with optional animation
  setViewBox(x, y, width, height, animated = false) {
    // Clamp to map bounds with buffer
    const buffer = this.config.canvasWidth * 0.2;
    const maxX = this.config.canvasWidth + buffer - width;
    const maxY = this.config.canvasHeight + buffer - height;

    x = Math.max(-buffer, Math.min(maxX, x));
    y = Math.max(-buffer, Math.min(maxY, y));

    this.viewBox = { x, y, width, height };

    if (animated) {
      this.animateViewBox();
    } else {
      this.updateViewBox();
    }
  }

  // Update SVG viewBox attribute
  updateViewBox() {
    const { x, y, width, height } = this.viewBox;
    this.svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }

  // Animate viewBox transition
  animateViewBox() {
    const svg = this.svg;
    const { x, y, width, height } = this.viewBox;

    // Create smooth transition
    svg.style.transition = `viewBox ${this.animationDuration}ms ease-out`;
    this.updateViewBox();

    setTimeout(() => {
      svg.style.transition = '';
    }, this.animationDuration);
  }

  // Handle mouse down (start pan)
  handleMouseDown(event) {
    // Only pan with left mouse button
    if (event.button !== 0) return;

    // Don't pan if clicking on interactive elements
    if (event.target.classList.contains('location') ||
        event.target.closest('.location')) {
      return;
    }

    this.isPanning = true;
    this.startPoint = this.getMousePosition(event);
    this.svg.style.cursor = 'grabbing';

    event.preventDefault();
  }

  // Handle mouse move (pan)
  handleMouseMove(event) {
    if (!this.isPanning) return;

    const currentPoint = this.getMousePosition(event);
    const dx = currentPoint.x - this.startPoint.x;
    const dy = currentPoint.y - this.startPoint.y;

    // Update viewBox position
    this.setViewBox(
      this.viewBox.x - dx,
      this.viewBox.y - dy,
      this.viewBox.width,
      this.viewBox.height
    );

    this.startPoint = currentPoint;
  }

  // Handle mouse up (end pan)
  handleMouseUp(event) {
    if (this.isPanning) {
      this.isPanning = false;
      this.svg.style.cursor = 'grab';
    }
  }

  // Touch handling
  touchStartPos = null;
  touchStartDistance = 0;

  handleTouchStart(event) {
    event.preventDefault();

    if (event.touches.length === 1) {
      // Single touch - pan
      const touch = event.touches[0];
      this.touchStartPos = this.getMousePosition(touch);
      this.isPanning = true;
    } else if (event.touches.length === 2) {
      // Two touches - pinch zoom
      this.isPanning = false;
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.touchStartDistance = this.getTouchDistance(touch1, touch2);
    }
  }

  handleTouchMove(event) {
    event.preventDefault();

    if (event.touches.length === 1 && this.isPanning) {
      // Pan
      const touch = event.touches[0];
      const currentPos = this.getMousePosition(touch);
      const dx = currentPos.x - this.touchStartPos.x;
      const dy = currentPos.y - this.touchStartPos.y;

      this.setViewBox(
        this.viewBox.x - dx,
        this.viewBox.y - dy,
        this.viewBox.width,
        this.viewBox.height
      );

      this.touchStartPos = currentPos;
    } else if (event.touches.length === 2) {
      // Pinch zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = this.getTouchDistance(touch1, touch2);

      const zoomRatio = currentDistance / this.touchStartDistance;
      const newZoom = this.currentZoom * zoomRatio;

      if (newZoom >= this.minZoom && newZoom <= this.maxZoom) {
        // Zoom toward midpoint of touches
        const midpoint = this.getTouchMidpoint(touch1, touch2);
        this.zoomToPoint(midpoint.x, midpoint.y, newZoom);
        this.touchStartDistance = currentDistance;
      }
    }
  }

  handleTouchEnd(event) {
    if (event.touches.length === 0) {
      this.isPanning = false;
      this.touchStartPos = null;
    }
  }

  getTouchDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getTouchMidpoint(touch1, touch2) {
    const x = (touch1.clientX + touch2.clientX) / 2;
    const y = (touch1.clientY + touch2.clientY) / 2;
    return this.getMousePosition({ clientX: x, clientY: y });
  }

  // Public API methods

  // Zoom in
  zoomIn(animated = true) {
    const centerX = this.viewBox.x + this.viewBox.width / 2;
    const centerY = this.viewBox.y + this.viewBox.height / 2;
    const newZoom = Math.min(this.maxZoom, this.currentZoom * 1.3);
    this.zoomToPoint(centerX, centerY, newZoom, animated);
  }

  // Zoom out
  zoomOut(animated = true) {
    const centerX = this.viewBox.x + this.viewBox.width / 2;
    const centerY = this.viewBox.y + this.viewBox.height / 2;
    const newZoom = Math.max(this.minZoom, this.currentZoom / 1.3);
    this.zoomToPoint(centerX, centerY, newZoom, animated);
  }

  // Reset to default view
  resetView(animated = true) {
    this.currentZoom = this.config.defaultZoom;
    this.setViewBox(0, 0, this.config.canvasWidth, this.config.canvasHeight, animated);
    this.dispatchZoomEvent();
  }

  // Zoom to specific zoom level
  setZoom(zoomLevel, animated = true) {
    const centerX = this.viewBox.x + this.viewBox.width / 2;
    const centerY = this.viewBox.y + this.viewBox.height / 2;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
    this.zoomToPoint(centerX, centerY, newZoom, animated);
  }

  // Pan to location (center on coordinates)
  panToLocation(x, y, animated = true) {
    const newX = x - this.viewBox.width / 2;
    const newY = y - this.viewBox.height / 2;
    this.setViewBox(newX, newY, this.viewBox.width, this.viewBox.height, animated);
  }

  // Focus on location with zoom
  focusOnLocation(x, y, zoomLevel = 2.0, animated = true) {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
    this.currentZoom = newZoom;

    const newWidth = this.config.canvasWidth / newZoom;
    const newHeight = this.config.canvasHeight / newZoom;
    const newX = x - newWidth / 2;
    const newY = y - newHeight / 2;

    this.setViewBox(newX, newY, newWidth, newHeight, animated);
    this.dispatchZoomEvent();
  }

  // Get current zoom percentage (for display)
  getZoomPercentage() {
    return Math.round(this.currentZoom * 100);
  }

  // Get current center coordinates
  getCenterCoordinates() {
    return {
      x: this.viewBox.x + this.viewBox.width / 2,
      y: this.viewBox.y + this.viewBox.height / 2
    };
  }

  // Dispatch zoom change event
  dispatchZoomEvent() {
    const event = new CustomEvent('zoomchange', {
      detail: {
        zoom: this.currentZoom,
        percentage: this.getZoomPercentage(),
        viewBox: { ...this.viewBox }
      }
    });
    this.svg.dispatchEvent(event);
  }

  // Enable/disable panning (for edit mode)
  setPanEnabled(enabled) {
    if (enabled) {
      this.svg.style.cursor = 'grab';
    } else {
      this.svg.style.cursor = 'default';
      this.isPanning = false;
    }
  }

  // Fit bounds (show specific area)
  fitBounds(minX, minY, maxX, maxY, padding = 0.1, animated = true) {
    const width = maxX - minX;
    const height = maxY - minY;

    // Add padding
    const paddedWidth = width * (1 + padding * 2);
    const paddedHeight = height * (1 + padding * 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate zoom to fit
    const zoomX = this.config.canvasWidth / paddedWidth;
    const zoomY = this.config.canvasHeight / paddedHeight;
    const newZoom = Math.min(zoomX, zoomY, this.maxZoom);

    this.currentZoom = newZoom;
    const newWidth = this.config.canvasWidth / newZoom;
    const newHeight = this.config.canvasHeight / newZoom;

    this.setViewBox(
      centerX - newWidth / 2,
      centerY - newHeight / 2,
      newWidth,
      newHeight,
      animated
    );

    this.dispatchZoomEvent();
  }

  // Destroy (cleanup event listeners)
  destroy() {
    // Remove all event listeners
    this.svg.removeEventListener('wheel', this.handleWheel);
    this.svg.removeEventListener('mousedown', this.handleMouseDown);
    this.svg.removeEventListener('mousemove', this.handleMouseMove);
    this.svg.removeEventListener('mouseup', this.handleMouseUp);
    this.svg.removeEventListener('mouseleave', this.handleMouseUp);
    this.svg.removeEventListener('touchstart', this.handleTouchStart);
    this.svg.removeEventListener('touchmove', this.handleTouchMove);
    this.svg.removeEventListener('touchend', this.handleTouchEnd);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PanZoomController;
}

# 🗺️ Bleeding Borderlands Interactive Map

An interactive SVG regional map for the "Bleeding Borderlands" D&D campaign featuring dynamic corruption zones, faction territories, and rich location details.

## 🎯 Features

### Core Functionality
- **Scalable Vector Graphics (SVG)** - Fully zoomable and crisp at any resolution
- **Interactive Elements** - Hover for quick info, click for detailed panels
- **Corruption Visualization** - 5 levels of reality distortion radiating from The Maelstrom
- **Faction Territories** - Toggleable overlays showing sphere of influence
- **Trade Routes** - Major and minor routes connecting cities
- **Geographic Features** - Rivers, mountains, forests, and plains
- **Export Options** - Download as high-res PNG or editable SVG

### Interactive Features
- **Hover Tooltips** - Quick location info on mouseover
- **Detail Panels** - Comprehensive information on click
- **Layer Toggles** - Show/hide corruption, factions, routes, distance rings
- **Distance Calculator** - Measure distances between locations
- **Keyboard Shortcuts** - Quick access to common functions

## 📁 File Structure

```
bleeding-borderlands-map/
├── index.html          # Main interface
├── styles.css          # Dark fantasy styling
├── map-data.js         # Location and faction data
├── map-renderer.js     # SVG generation and rendering
├── interactions.js     # Event handlers and tooltips
└── README.md           # This file
```

## 🚀 Getting Started

### Quick Start
1. Open `index.html` in a modern web browser
2. The map will automatically load and render
3. Hover over locations for quick info
4. Click locations for detailed information
5. Use controls on the left to toggle layers

### Browser Compatibility
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Internet Explorer (Not supported)

### No Installation Required
This is a standalone HTML/CSS/JavaScript application. No build tools, npm packages, or server required.

## 🎮 How to Use

### Navigation
- **Hover** over any location to see a tooltip with quick information
- **Click** on a location to open the detailed information panel
- **Click outside** or press **ESC** to close the detail panel
- Use browser zoom (Ctrl/Cmd + Mouse Wheel) to zoom the entire page

### Controls

#### Layer Toggles
- **Corruption Zones** (C) - Show/hide the 5 corruption levels
- **Faction Territories** (F) - Display faction influence areas
- **Trade Routes** (R) - Show roads connecting cities
- **Distance Rings** (D) - Display concentric circles at 10-mile intervals

#### Export Options
- **Export as PNG** - Download high-resolution 3000x3000px image
- **Export as SVG** - Download vector file for editing in Illustrator/Inkscape

### Keyboard Shortcuts
- `C` - Toggle Corruption Zones
- `F` - Toggle Faction Territories
- `R` - Toggle Trade Routes
- `D` - Toggle Distance Rings
- `ESC` - Close Detail Panel

## 🗺️ Map Data

### The Maelstrom
- **Location:** Center of map (0, 0)
- **Size:** 32-mile diameter (16-mile radius)
- **Growth:** 200-300 feet per month
- **Corruption:** Level 4 (Planar Chaos)

### Major Cities (5)

1. **🎓 Thornwick Academy**
   - Direction: NNW, 38 miles from Maelstrom
   - Population: 18,500
   - Faction: Empirical Academy
   - Type: University city

2. **⚜️ Goldspire**
   - Direction: NE, 41 miles from Maelstrom
   - Population: 22,000
   - Faction: Vigilant Order
   - Type: Fortress city

3. **⛰️ Ironhold**
   - Direction: SE, 44 miles from Maelstrom
   - Population: 16,800
   - Faction: Empirical Academy
   - Type: Mountain fortress

4. **🛤️ Crossroads End**
   - Direction: SSW, 39 miles from Maelstrom
   - Population: 14,200
   - Faction: Pragmatic Coalition
   - Type: Trade hub

5. **⚓ Haven's Rest**
   - Direction: SW, 35 miles from Maelstrom
   - Population: 19,500
   - Faction: Pragmatic Coalition
   - Type: River port

### Secondary Locations

- **⚰️ Mount Thyros** - Ancient tomb (SECRET: Thyros the Ender sleeps here)
- **🌊 Shimmerwood Forest** - Fey forest with hidden lake (SECRET: Isril the Blind)
- **🌀 Threshold Commune** - Ascendant Cult settlement inside Maelstrom
- **😱 Ghosthaven** - Major refugee camp (15,000 people)
- **🏘️ Millhaven** - Village on corruption edge

### Factions (6)

1. **🧪 Empirical Academy** - Scientists seeking to understand the Maelstrom
2. **⚜️ Vigilant Order** - Holy warriors believing in divine punishment
3. **🌀 Ascendant Cult** - Believers embracing corruption as evolution
4. **🛡️ Pragmatic Coalition** - Practical survivors focused on evacuation
5. **🚶 The Pilgrims** - Nomads navigating corruption zones
6. **👁️ Divine Awakeners** - SECRET cult seeking to awaken sleeping gods

### Corruption Levels

| Level | Name | Distance | Corruption | Color |
|-------|------|----------|------------|-------|
| 0 | Safe Zone | 32+ mi | 0% | Transparent |
| 1 | Reality Flutter | 24-32 mi | 10-25% | Light Purple |
| 2 | Dimensional Bleeding | 16-24 mi | 25-50% | Medium Purple |
| 3 | Reality Storm | 8-16 mi | 50-75% | Dark Purple |
| 4 | Planar Chaos | 0-8 mi | 75-100% | Black/Violet |

## 🎨 Customization

### Editing Location Data
Edit `map-data.js` to add/modify locations:

```javascript
locationName: {
  name: "Location Name",
  emoji: "🏰",
  type: "city-fortress",
  population: 10000,
  coordinates: { angle: 45, distance: 30 }, // NE, 30 miles
  corruption: 0,
  faction: "factionKey",
  features: ["Feature 1", "Feature 2"],
  description: "Full description here..."
}
```

### Coordinate System
- **Origin (0,0):** Maelstrom center
- **Angles:**
  - 0° = North
  - 90° = East
  - 180° = South
  - 270° = West
- **Distance:** In miles from Maelstrom center
- **Scale:** 10 pixels = 1 mile

### Adding New Factions
Edit the `FACTIONS` object in `map-data.js`:

```javascript
factionKey: {
  name: "Faction Name",
  emoji: "⚔️",
  color: "#HEXCOLOR",
  territories: ["location1", "location2"],
  influence: 0.7, // 0-1 scale
  description: "Faction description",
  countdown: {
    goal: "Their ultimate goal",
    progress: 0.45,
    monthsRemaining: 6
  }
}
```

## 🔧 Technical Details

### Technologies Used
- Pure HTML5/CSS3/JavaScript (ES6+)
- SVG for vector graphics
- No external libraries or frameworks
- No build process required

### Performance
- Initial load: <2 seconds on modern browsers
- SVG rendering: Instant
- Memory usage: <50MB
- File size: ~50KB total

### Browser Console
Open browser console (F12) for debug access:
- `window.mapRenderer` - Direct access to renderer
- `window.interactionHandler` - Access to interactions
- Helpful keyboard shortcuts displayed on load

## 📱 Responsive Design

The map adapts to different screen sizes:
- **Desktop (1400px+):** Three-column layout with all panels
- **Tablet (768px-1400px):** Single-column layout, fixed detail panels
- **Mobile (<768px):** Optimized for touch, simplified controls

## 🖨️ Printing

Use browser print function (Ctrl/Cmd + P) for a clean map printout:
- Controls and panels hidden automatically
- Map optimized for paper
- Corruption zones visible
- Locations labeled clearly

## 🎭 GM vs Player Versions

### Current Version: GM Mode
Shows all locations including secrets:
- Mount Thyros (Thyros the Ender)
- Shimmerwood hidden lake (Isril the Blind)
- Divine Awakeners faction

### Creating Player Version
To hide secrets for players:
1. Open `map-renderer.js`
2. Set `showSecrets: false` in visibility state
3. Secret locations will be hidden until toggled

## 🐛 Troubleshooting

### Map Not Rendering
- Ensure all files are in the same directory
- Check browser console for errors (F12)
- Try a different browser (Chrome recommended)

### Tooltips Not Showing
- Ensure JavaScript is enabled
- Clear browser cache
- Check for popup blockers

### Export Not Working
- Some browsers require user interaction for downloads
- Try right-click "Save As" on the map
- Use Chrome/Edge for best export compatibility

## 🔮 Future Enhancements

Potential features for future versions:
- **Time Slider** - Animate corruption spread over months
- **Path Finder** - Calculate safest routes avoiding corruption
- **Session Markers** - Track party location and journey
- **Custom Pins** - GM notes and markers
- **Encounter Zones** - Mark dangerous areas
- **Animated Effects** - Swirling Maelstrom, shimmering forest
- **Mobile App** - Dedicated iOS/Android version
- **Multi-language** - Localization support

## 📝 License

This map is created for the "Bleeding Borderlands" D&D campaign. Feel free to adapt and modify for your own campaigns.

## 🙏 Credits

**Map Design:** Created for Bleeding Borderlands campaign
**Technologies:** HTML5, CSS3, JavaScript, SVG
**Fonts:** Cinzel, Lora, Inter (Google Fonts)
**Inspiration:** Darkest Dungeon aesthetic meets fantasy cartography

## 📧 Support

For questions, suggestions, or bug reports:
- Check the browser console for error messages
- Verify all files are present and unmodified
- Test in a different browser

---

**"The Maelstrom grows. Reality tears. Six factions race against time. Only one can prevent the end."**

*Interactive SVG Map for D&D Campaign | Scale: 10 pixels = 1 mile*

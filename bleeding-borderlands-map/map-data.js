// Bleeding Borderlands Map Data - Enhanced Version with Ocean & Coastal Geography
// Canvas: 2400x2400px | Scale: 10px = 1 mile | Total area: 240 miles × 240 miles

const MAP_CONFIG = {
  centerX: 1200, // Canvas center (Maelstrom)
  centerY: 1200,
  pixelsPerMile: 10,
  maelstromRadius: 16, // miles
  maelstromExpansionPerMonth: 250 / 5280, // ~250 feet in miles
  canvasWidth: 2400,
  canvasHeight: 2400,
  totalAreaMiles: 240,
  minZoom: 0.5,
  maxZoom: 4.0,
  defaultZoom: 1.0
};

// Coordinate conversion helpers
const coordHelpers = {
  // Real world coordinates (miles from Maelstrom) → SVG canvas coordinates (pixels)
  realToSVG: (realX, realY) => ({
    x: MAP_CONFIG.centerX + (realX * MAP_CONFIG.pixelsPerMile),
    y: MAP_CONFIG.centerY - (realY * MAP_CONFIG.pixelsPerMile) // Negative because SVG Y increases downward
  }),

  // SVG canvas coordinates → Real world coordinates
  svgToReal: (svgX, svgY) => ({
    x: (svgX - MAP_CONFIG.centerX) / MAP_CONFIG.pixelsPerMile,
    y: (MAP_CONFIG.centerY - svgY) / MAP_CONFIG.pixelsPerMile
  }),

  // Polar (angle, distance) → Real world coordinates
  polarToReal: (angle, distance) => {
    const angleRad = (angle - 90) * (Math.PI / 180); // 0° = North
    return {
      x: distance * Math.cos(angleRad),
      y: distance * Math.sin(angleRad)
    };
  }
};

// OCEAN & COASTLINE DATA
const OCEAN = {
  ceruleanSea: {
    name: "Cerulean Sea",
    bounds: {
      west: -120,  // Western map edge
      east: -50,   // Eastern edge of ocean
      north: 120,  // Northern map edge
      south: -120  // Southern map edge
    },
    color: "#1A5F7A",
    colorDeep: "#0D3B4A",
    features: {
      wavePattern: true,
      shimmerEffect: true,
      depthGradient: true
    }
  }
};

const COASTLINE = {
  mainCoast: {
    name: "Sapphire Coast",
    length: 95, // miles N-S
    points: [ // Series of points defining coastline from north to south
      { x: -50, y: 50 },   // Northern headland
      { x: -52, y: 40 },   // Bay curve
      { x: -50, y: 30 },   // Rocky point
      { x: -51, y: 20 },   // Cliff section
      { x: -50, y: 10 },   // Small bay
      { x: -53, y: 5 },    // Delta northern edge
      { x: -55, y: 0 },    // Delta center (Haven's Rest)
      { x: -53, y: -5 },   // Delta southern edge
      { x: -50, y: -10 },  // Southern cliffs
      { x: -52, y: -20 },  // Cove
      { x: -50, y: -30 },  // Rocky shore
      { x: -51, y: -40 },  // Beach section
      { x: -50, y: -50 }   // Southern headland
    ],
    features: {
      cliffs: [
        { start: { x: -50, y: 30 }, end: { x: -51, y: 20 }, height: '60ft' },
        { start: { x: -50, y: -10 }, end: { x: -52, y: -20 }, height: '40ft' }
      ],
      beaches: [
        { center: { x: -51, y: -40 }, length: 8 }
      ],
      islands: [
        { x: -60, y: 25, size: 2, name: "Seastack Isle" },
        { x: -62, y: 0, size: 1.5, name: "Gull Rock" },
        { x: -58, y: -15, size: 3, name: "Shipwreck Island" }
      ]
    }
  },

  silverflowDelta: {
    name: "Silverflow Delta",
    center: { x: -53, y: 0 }, // Where river meets ocean
    width: 12,  // miles E-W
    depth: 8,   // miles inland
    channels: [
      { name: "Main Channel", width: 0.08, depth: 35, path: "main" },
      { name: "North Arm", width: 0.04, depth: 20, path: "north" },
      { name: "South Arm", width: 0.04, depth: 18, path: "south" },
      { name: "Merchant Channel", width: 0.03, depth: 15, path: "merchant" }
    ],
    marshland: {
      area: 40, // square miles
      type: "tidal",
      color: "#6B8E4E"
    },
    sandbars: [
      { x: -58, y: 2 },
      { x: -60, y: -1 },
      { x: -57, y: -3 }
    ]
  }
};

const LOCATIONS = {
  // === CENTRAL FEATURE ===
  maelstrom: {
    id: "maelstrom",
    name: "The Maelstrom",
    emoji: "🌀",
    type: "corruption-core",
    position: { x: 0, y: 0 },
    elevation: 350, // Base elevation (pre-corruption)
    radius: 16,
    corruption: 4,
    description: "A 32-mile wide reality-warping corruption zone at the center of the Bleeding Borderlands. Purple energies swirl as dimensions collide and reality itself tears apart.",
    features: ["Reality Storm", "Planar Chaos", "Dimensional Bleeding", "Spreading 200-300 feet/month"],
    color: "#4A0E4E",
    secret: false
  },

  // === MAJOR CITIES ===
  thornwick: {
    id: "thornwick",
    name: "Thornwick Academy",
    emoji: "🎓",
    type: "city-university",
    population: 18500,
    position: { x: -27, y: 27 }, // NNW, 38 miles
    elevation: 1200,
    corruption: 0,
    faction: "empiricalAcademy",
    features: ["Observatory Complex", "Great Library", "Student Dormitories", "Research Laboratories", "Seven Hills"],
    npcs: ["Chancellor Mira Ashford", "Dr. Elara Voss", "Professor Magnus Gearwright"],
    description: "A city built around learning and discovery. Ancient stone towers house countless scholars studying the Maelstrom's mysteries. The Observatory Complex dominates the skyline, its telescopes pointed toward both stars and the corruption.",
    connectedTo: ["goldspire", "crossroads", "haven", "millhaven"],
    icon: "tower",
    color: "#2E5C8A",
    secret: false
  },

  goldspire: {
    id: "goldspire",
    name: "Goldspire",
    emoji: "⚜️",
    type: "city-fortress",
    population: 22000,
    position: { x: 29, y: 29 }, // NE, 41 miles
    elevation: 800,
    corruption: 0,
    faction: "vigilantOrder",
    features: ["The Golden Citadel", "Cathedral District", "Holy Barracks", "Healing Sanctums", "Three Hills", "River Crossing"],
    npcs: ["High Commander Aldric Vorn", "High Priestess Seraphine", "Inquisitor Theron"],
    description: "The stronghold of the Vigilant Order. Golden spires reach toward the heavens, and holy magic radiates from the massive cathedral at its center. The city serves as the main base for the Order's crusade against corruption.",
    connectedTo: ["thornwick", "ironhold", "ghosthaven"],
    icon: "fortress",
    color: "#D4AF37",
    secret: false
  },

  ironhold: {
    id: "ironhold",
    name: "Ironhold",
    emoji: "⛰️",
    type: "city-mountain",
    population: 16800,
    position: { x: 31, y: -31 }, // SE, 44 miles
    elevation: 3200,
    corruption: 0,
    faction: "pragmaticCoalition",
    features: ["Mountain Fortress", "Deep Mines", "Foundry District", "Underground Vaults", "Iron Valley", "Terraced Agriculture"],
    npcs: ["Forge-Master Durgan", "Captain Rodrik Stone", "Master Engineer Kira"],
    description: "Built into the mountains themselves, Ironhold is a fortress of stone and steel. Its deep mines provide resources for the war against corruption, while its walls stand as an unbreakable barrier.",
    connectedTo: ["goldspire", "crossroads", "mountThyros"],
    icon: "mountain",
    color: "#6B6B6B",
    secret: false
  },

  crossroads: {
    id: "crossroads",
    name: "Crossroads End",
    emoji: "🛤️",
    type: "city-trade",
    population: 14200,
    position: { x: -28, y: -27 }, // SSW, 39 miles
    elevation: 450,
    corruption: 0,
    faction: "pragmaticCoalition",
    features: ["Grand Bazaar", "Trade Guildhall", "Wagon Yards", "Merchant Quarter", "Five Roads Meet", "Tent Cities"],
    npcs: ["Guildmaster Torin Blackwell", "Merchant Prince Vex", "Caravan Master Lysa"],
    description: "The beating heart of commerce in the Borderlands. Multiple trade routes converge here, creating a bustling hub of merchants, travelers, and fortune seekers. The markets never sleep.",
    connectedTo: ["thornwick", "ironhold", "haven"],
    icon: "crossroads",
    color: "#8B6F47",
    secret: false
  },

  haven: {
    id: "haven",
    name: "Haven's Rest",
    emoji: "⚓",
    type: "city-port",
    population: 19500,
    position: { x: -50, y: 0 }, // DUE WEST at coastline (CORRECTED)
    elevation: 15,
    corruption: 0,
    faction: "pragmaticCoalition",
    features: ["Riverside District", "Harbor Docks", "Warehouse Quarter", "Fisherman's Wharf", "Delta Channels", "Refugee Processing", "Ocean Port"],
    npcs: ["Harbor Master Elena Tide", "Captain Gregor Storm", "Dockmaster Quinn"],
    description: "A thriving ocean port where the Silverflow River meets the Cerulean Sea. Ships and barges carry goods and refugees along the river and across the ocean. The city sits at the delta, controlling both river and sea trade. It has become a crucial evacuation point as the Maelstrom spreads.",
    connectedTo: ["thornwick", "crossroads", "shimmerwood"],
    icon: "anchor",
    color: "#2C5F8D",
    secret: false
  },

  // === KEY SECONDARY LOCATIONS ===
  mountThyros: {
    id: "mountThyros",
    name: "Mount Thyros",
    emoji: "⚰️",
    type: "location-tomb",
    position: { x: 35, y: -35 }, // SE, 50 miles
    elevation: 9200,
    corruption: 1,
    faction: "none",
    features: ["Ancient Tomb", "Sealed Chambers", "Mysterious Aura", "Storm Clouds", "Jagged Peak"],
    secret: true,
    secretInfo: "The sleeping god Thyros the Ender rests within this mountain, sealed away millennia ago. The Divine Awakeners seek to find and awaken him.",
    description: "An imposing mountain peak shrouded in ancient mystery and perpetual storm clouds. Local legends speak of a great evil sealed within, though few dare approach.",
    connectedTo: ["ironhold"],
    icon: "tomb",
    color: "#3D3D3D"
  },

  shimmerwood: {
    id: "shimmerwood",
    name: "Shimmerwood Forest",
    emoji: "🌲",
    type: "location-forest",
    position: { x: -40, y: 15 }, // Between coast and plains, NW
    elevation: 650,
    corruption: 0,
    faction: "divineAwakeners",
    features: ["Ancient Trees", "Fey Touch", "Hidden Paths", "Magical Shimmer", "180 Square Miles"],
    description: "A vast ancient forest with an otherworldly shimmer to its leaves. The trees seem to whisper secrets, and strange lights dance between the branches. The northwestern section shows signs of corruption.",
    connectedTo: ["haven", "thornwick"],
    icon: "forest",
    color: "#2D5016",
    secret: false
  },

  isrilLake: {
    id: "isrilLake",
    name: "Isril's Hidden Lake",
    emoji: "🌊",
    type: "location-secret",
    position: { x: -40, y: 15 }, // Central Shimmerwood (same general area)
    elevation: 650,
    corruption: 0,
    faction: "divineAwakeners",
    features: ["Impossibly Clear Water", "White Sand Shores", "Perfect Oval", "Magical Concealment", "Dimensional Reflections"],
    secret: true,
    secretInfo: "Deep within Shimmerwood lies a hidden lake where Isril the Blind, the god of forgotten dreams, sleeps beneath the waters. The lake is 1.2 miles long, 200+ feet deep, and magically concealed. Only the Divine Awakeners know the way.",
    description: "A hidden lake deep within the forest. Its existence is known only to a select few. The water reflects impossible scenes from other times and places.",
    connectedTo: ["shimmerwood"],
    icon: "lake",
    color: "#4A9ED8"
  },

  threshold: {
    id: "threshold",
    name: "The Threshold Commune",
    emoji: "🌀",
    type: "settlement-cult",
    population: 800,
    position: { x: 0, y: -15 }, // S, 15 miles from center (inside Maelstrom edge)
    elevation: 350,
    corruption: 3,
    faction: "ascendantCult",
    features: ["Phase-shifting Buildings", "Transformation Chambers", "Corruption Embrace", "Cult Headquarters", "Reality Distortion"],
    npcs: ["Prophet Kaelith", "Transformed Believers", "Corruption-touched Guards"],
    description: "A settlement within the corruption zone itself. Buildings phase between realities, and the inhabitants embrace their transformation. The Ascendant Cult considers this their promised land.",
    connectedTo: [],
    icon: "spiral",
    color: "#8B4789",
    secret: false
  },

  ghosthaven: {
    id: "ghosthaven",
    name: "Ghosthaven",
    emoji: "⛺",
    type: "settlement-refugee",
    population: 15000,
    position: { x: 0, y: 30 }, // N, between Thornwick and Goldspire
    elevation: 600,
    corruption: 1,
    faction: "pragmaticCoalition",
    features: ["Tent City", "Refugee Aid Station", "Makeshift Walls", "Overcrowded Camps", "River Access"],
    npcs: ["Coordinator Maya Stone", "Guard Captain Dorian", "Healer Marta"],
    description: "A sprawling refugee camp housing those displaced by the Maelstrom's spread. Tents stretch as far as the eye can see. The Pragmatic Coalition works tirelessly to provide aid and maintain order.",
    connectedTo: ["thornwick", "goldspire"],
    icon: "tent",
    color: "#7A7A7A",
    secret: false
  },

  millhaven: {
    id: "millhaven",
    name: "Millhaven",
    emoji: "🏘️",
    type: "village",
    population: 1200,
    position: { x: -20, y: 18 }, // NW
    elevation: 800,
    corruption: 1,
    faction: "empiricalAcademy",
    features: ["Old Mill", "Farming Community", "Research Outpost", "Corruption Edge Watch"],
    npcs: ["Mayor Grendel", "Miller Jorik", "Academy Researcher Finn"],
    description: "A small farming village on the edge of the corruption zone. The old mill still turns, but the fields grow smaller each month as the Maelstrom spreads. Academy researchers monitor the corruption's advance.",
    connectedTo: ["thornwick"],
    icon: "mill",
    color: "#DAA520",
    secret: false
  },

  malacharChamber: {
    id: "malacharChamber",
    name: "Malachar's Chamber",
    emoji: "💀",
    type: "location-secret",
    position: { x: 2, y: 0 }, // 2 miles from Maelstrom center
    elevation: -450, // 800 feet below surface
    corruption: 4,
    faction: "none",
    features: ["Underground Chamber", "Dimensional Anchor", "Sleeping God", "Reality Tear Source", "Sealed Prison"],
    secret: true,
    secretInfo: "The source of the Maelstrom. Malachar the Unchained, god of chaos, sleeps 800 feet beneath the surface, 2 miles from the corruption's epicenter. His dreams bleed into reality, causing the dimensional catastrophe.",
    description: "Deep beneath the Maelstrom lies a chamber that predates civilization. What sleeps there is the cause of all the chaos above.",
    connectedTo: [],
    icon: "skull",
    color: "#1A0A1F"
  }
};

// GEOGRAPHIC FEATURES
const GEOGRAPHIC_FEATURES = {
  // === SILVERFLOW RIVER (CORRECTED - FLOWS EAST TO WEST) ===
  silverflowRiver: {
    name: "Silverflow River",
    type: "river",
    length: 285, // total miles
    source: { x: 80, y: 20, elevation: 8000 }, // Ironspine Mountains
    mouth: { x: -53, y: 0, elevation: 0 }, // Ocean at Haven's Rest

    // River course in sections
    course: [
      // Upper River (Mountains)
      { x: 80, y: 20, width: 0.015, elevation: 8000, section: "source" },
      { x: 70, y: 18, width: 0.02, elevation: 6500, section: "upper" },
      { x: 60, y: 16, width: 0.025, elevation: 5000, section: "upper" },
      { x: 50, y: 15, width: 0.03, elevation: 3500, section: "upper" },

      // Middle River (Plains)
      { x: 40, y: 12, width: 0.04, elevation: 2000, section: "middle" },
      { x: 30, y: 10, width: 0.045, elevation: 1200, section: "middle" },
      { x: 20, y: 8, width: 0.05, elevation: 800, section: "middle" },

      // Near Goldspire (crosses north of city)
      { x: 28, y: 32, width: 0.045, elevation: 850, section: "middle" },

      // Corruption Zone (Bleeding Reach)
      { x: 10, y: 5, width: 0.05, elevation: 600, section: "corruption", corrupted: true },
      { x: 0, y: 3, width: 0.05, elevation: 500, section: "corruption", corrupted: true },
      { x: -10, y: 2, width: 0.05, elevation: 400, section: "corruption", corrupted: true },

      // Lower River (approaching coast)
      { x: -20, y: 1, width: 0.055, elevation: 300, section: "lower" },
      { x: -30, y: 0, width: 0.06, elevation: 200, section: "lower" },
      { x: -40, y: 0, width: 0.06, elevation: 100, section: "lower" },

      // Delta approach
      { x: -45, y: 0, width: 0.06, elevation: 50, section: "delta" },
      { x: -50, y: 0, width: 0.065, elevation: 10, section: "delta" },
      { x: -53, y: 0, width: 0.07, elevation: 0, section: "delta" } // Spreads into delta
    ],

    color: "#2196F3",
    corruptionColor: "#9C4DCC",
    description: "A mighty river flowing 285 miles from the Ironspine Mountains to the Cerulean Sea. It passes through the corruption zone (the Bleeding Reach) before reaching Haven's Rest."
  },

  // Tributaries
  brightwaterStream: {
    name: "Brightwater Stream",
    type: "stream",
    length: 28,
    source: { x: -25, y: 35, elevation: 1500 },
    mouth: { x: -27, y: 27, elevation: 1200 }, // Joins near Thornwick
    course: [
      { x: -25, y: 35, width: 0.003 },
      { x: -26, y: 30, width: 0.004 },
      { x: -27, y: 27, width: 0.005 }
    ],
    color: "#4FC3F7",
    description: "A clear, spring-fed stream flowing through the hills north of Thornwick Academy."
  },

  ironCreek: {
    name: "Iron Creek",
    type: "stream",
    length: 35,
    source: { x: 45, y: -25, elevation: 7800 },
    mouth: { x: 35, y: -15, elevation: 3500 },
    course: [
      { x: 45, y: -25, width: 0.004 },
      { x: 40, y: -20, width: 0.005 },
      { x: 35, y: -15, width: 0.006 }
    ],
    color: "#B87333", // Slight rust color (iron-rich)
    description: "A cold mountain stream rich in iron and copper minerals, flowing from the Three Sisters peaks."
  },

  // === TERRAIN REGIONS ===
  goldmeadowPlains: {
    name: "Golden Plains",
    type: "plains",
    area: 5100, // square miles
    bounds: [
      { x: -15, y: 40 },
      { x: 45, y: 40 },
      { x: 50, y: -30 },
      { x: -20, y: -35 }
    ],
    elevation: { min: 250, max: 650 },
    color: "#E8DC9F",
    description: "Once the breadbasket of three kingdoms, now mostly abandoned. Rolling grasslands with scattered farms.",
    corruption: 40 // 40% corrupted in NW quadrant
  },

  ironspineMountains: {
    name: "Ironspine Mountains",
    type: "mountains",
    area: 5400, // square miles
    bounds: [
      { x: 35, y: 60 },
      { x: 80, y: 60 },
      { x: 85, y: -60 },
      { x: 30, y: -60 }
    ],
    elevation: { min: 800, max: 9200 },
    peaks: [
      { name: "Mount Thyros", x: 35, y: -35, elevation: 9200 },
      { name: "Mount Ironhold", x: 31, y: -31, elevation: 8400 },
      { name: "North Sister", x: 40, y: -25, elevation: 7800 },
      { name: "Middle Sister", x: 42, y: -26, elevation: 7600 },
      { name: "South Sister", x: 41, y: -28, elevation: 7400 },
      { name: "Watchpeak", x: 50, y: 10, elevation: 6900 },
      { name: "Copper Crown", x: 45, y: -15, elevation: 6200 }
    ],
    color: "#736B5E",
    snowlineElevation: 7000,
    description: "A dramatic mountain range running 120 miles north-south, with peaks reaching over 9,000 feet."
  },

  shimmerwoodForest: {
    name: "Shimmerwood Forest",
    type: "forest",
    area: 180, // square miles
    bounds: [
      { x: -60, y: 35 },
      { x: -25, y: 35 },
      { x: -20, y: 0 },
      { x: -55, y: 5 }
    ],
    elevation: { min: 300, max: 1200 },
    center: { x: -40, y: 15 },
    color: "#2D5016",
    shimmer: true,
    hiddenLake: { x: -40, y: 15, radius: 0.6 },
    corruption: 30, // NW 30% corrupted
    description: "An ancient mixed forest covering 180 square miles, with trees over 800 years old. The northwestern section shows corruption."
  },

  coastalPlain: {
    name: "Coastal Lowlands",
    type: "plain",
    bounds: [
      { x: -50, y: 60 },
      { x: -20, y: 60 },
      { x: -15, y: -60 },
      { x: -50, y: -60 }
    ],
    elevation: { min: 0, max: 200 },
    color: "#E8F5E3",
    description: "Flat coastal plains extending 30 miles inland from the ocean, with rich soil."
  }
};

// TRADE ROUTES
const TRADE_ROUTES = {
  circleRoad: {
    name: "Circle Road",
    type: "major",
    points: ["thornwick", "goldspire", "ironhold", "crossroads", "haven", "thornwick"],
    status: "partially-compromised",
    color: "#8B6F47",
    width: 3,
    description: "The main road connecting all five major cities in a rough circle around the Maelstrom."
  },

  kingsHighway: {
    name: "King's Highway",
    type: "major",
    points: ["goldspire", "ghosthaven", "crossroads"],
    status: "active",
    color: "#8B6F47",
    width: 2,
    description: "The primary north-south trade route."
  },

  scholarsPath: {
    name: "Scholar's Path",
    type: "secondary",
    points: ["thornwick", "millhaven", "crossroads"],
    status: "active",
    color: "#8B6F47",
    width: 2,
    description: "Well-traveled route connecting the Academy to trade centers."
  },

  coastalRoad: {
    name: "Coastal Road",
    type: "secondary",
    points: ["haven", "shimmerwood"],
    status: "active",
    color: "#8B6F47",
    width: 2,
    description: "Road running along the coast and forest edge."
  }
};

// FACTIONS (unchanged)
const FACTIONS = {
  empiricalAcademy: {
    name: "Empirical Academy",
    emoji: "🧪",
    color: "#2E5C8A",
    territories: ["thornwick", "millhaven"],
    influence: 0.7,
    description: "Scholars and scientists seeking to understand and stop the Maelstrom through research.",
    countdown: { goal: "Scientific breakthrough to stabilize reality", progress: 0.45, monthsRemaining: 6 }
  },
  vigilantOrder: {
    name: "Vigilant Order",
    emoji: "⚜️",
    color: "#D4AF37",
    territories: ["goldspire"],
    influence: 0.8,
    description: "Holy warriors believing the Maelstrom is divine punishment.",
    countdown: { goal: "Divine ritual to cleanse the Maelstrom", progress: 0.35, monthsRemaining: 8 }
  },
  ascendantCult: {
    name: "Ascendant Cult",
    emoji: "🌀",
    color: "#8B4789",
    territories: ["threshold"],
    influence: 0.6,
    description: "Believers embracing corruption as evolution.",
    countdown: { goal: "Convert enough followers for mass ascension", progress: 0.55, monthsRemaining: 5 }
  },
  pragmaticCoalition: {
    name: "Pragmatic Coalition",
    emoji: "🛡️",
    color: "#4A7C59",
    territories: ["ghosthaven", "crossroads", "haven", "ironhold"],
    influence: 0.5,
    description: "Practical alliance focused on survival and evacuation.",
    countdown: { goal: "Evacuate all civilians beyond safe distance", progress: 0.40, monthsRemaining: 7 }
  },
  pilgrims: {
    name: "The Pilgrims",
    emoji: "🚶",
    color: "#8C8C8C",
    territories: [],
    influence: 0.3,
    description: "Nomadic survivors navigating corruption zones.",
    countdown: { goal: "Map all safe paths through corruption", progress: 0.60, monthsRemaining: 4 }
  },
  divineAwakeners: {
    name: "Divine Awakeners",
    emoji: "👁️",
    color: "#C0C0C0",
    territories: ["shimmerwood"],
    influence: 0.4,
    secret: true,
    description: "Secret cult seeking to awaken sleeping gods.",
    countdown: { goal: "Awaken both sleeping gods", progress: 0.25, monthsRemaining: 10 }
  }
};

// CORRUPTION ZONES (unchanged)
const CORRUPTION_ZONES = [
  { level: 0, name: "Safe Zone", minDistance: 32, maxDistance: 120, color: "transparent", corruption: "0%", description: "Safe from corruption effects" },
  { level: 1, name: "Reality Flutter", minDistance: 24, maxDistance: 32, color: "rgba(139, 71, 137, 0.15)", corruption: "10-25%", description: "Minor reality distortions" },
  { level: 2, name: "Dimensional Bleeding", minDistance: 16, maxDistance: 24, color: "rgba(139, 71, 137, 0.35)", corruption: "25-50%", description: "Frequent reality breaks" },
  { level: 3, name: "Reality Storm", minDistance: 8, maxDistance: 16, color: "rgba(139, 71, 137, 0.6)", corruption: "50-75%", description: "Severe reality distortion" },
  { level: 4, name: "Planar Chaos", minDistance: 0, maxDistance: 8, color: "rgba(74, 14, 78, 0.85)", corruption: "75-100%", description: "Complete reality collapse" }
];

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MAP_CONFIG, OCEAN, COASTLINE, LOCATIONS, GEOGRAPHIC_FEATURES, TRADE_ROUTES, FACTIONS, CORRUPTION_ZONES, coordHelpers };
}

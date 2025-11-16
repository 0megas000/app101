// Bleeding Borderlands Map Data
// All distances in miles, angles in degrees (0 = East, 90 = North)

const MAP_CONFIG = {
  centerX: 600,
  centerY: 600,
  pixelsPerMile: 10,
  maelstromRadius: 16, // miles
  maelstromExpansionPerMonth: 250 / 5280, // ~250 feet in miles
  canvasWidth: 1200,
  canvasHeight: 1200
};

const LOCATIONS = {
  // === CENTRAL FEATURE ===
  maelstrom: {
    name: "The Maelstrom",
    emoji: "🌀",
    type: "corruption-core",
    coordinates: { angle: 0, distance: 0 },
    radius: 16,
    corruption: 4,
    description: "A 32-mile wide reality-warping corruption zone at the center of the Bleeding Borderlands. Purple energies swirl as dimensions collide and reality itself tears apart.",
    features: ["Reality Storm", "Planar Chaos", "Dimensional Bleeding", "Spreading 200-300 feet/month"],
    color: "#4A0E4E"
  },

  // === MAJOR CITIES ===
  thornwick: {
    name: "Thornwick Academy",
    emoji: "🎓",
    type: "city-university",
    population: 18500,
    coordinates: { angle: 337.5, distance: 38 }, // NNW
    corruption: 0,
    faction: "empiricalAcademy",
    features: ["Observatory Complex", "Great Library", "Student Dormitories", "Research Laboratories"],
    npcs: ["Chancellor Mira Ashford", "Dr. Elara Voss", "Professor Magnus Gearwright"],
    description: "A city built around learning and discovery. Ancient stone towers house countless scholars studying the Maelstrom's mysteries. The Observatory Complex dominates the skyline, its telescopes pointed toward both stars and the corruption.",
    icon: "tower",
    color: "#2E5C8A"
  },

  goldspire: {
    name: "Goldspire",
    emoji: "⚜️",
    type: "city-fortress",
    population: 22000,
    coordinates: { angle: 45, distance: 41 }, // NE
    corruption: 0,
    faction: "vigilantOrder",
    features: ["The Golden Citadel", "Cathedral District", "Holy Barracks", "Healing Sanctums"],
    npcs: ["High Commander Aldric Vorn", "High Priestess Seraphine", "Inquisitor Theron"],
    description: "The stronghold of the Vigilant Order. Golden spires reach toward the heavens, and holy magic radiates from the massive cathedral at its center. The city serves as the main base for the Order's crusade against corruption.",
    icon: "fortress",
    color: "#D4AF37"
  },

  ironhold: {
    name: "Ironhold",
    emoji: "⛰️",
    type: "city-mountain",
    population: 16800,
    coordinates: { angle: 135, distance: 44 }, // SE
    corruption: 0,
    faction: "empiricalAcademy",
    features: ["Mountain Fortress", "Deep Mines", "Foundry District", "Underground Vaults"],
    npcs: ["Forge-Master Durgan", "Captain Rodrik Stone", "Master Engineer Kira"],
    description: "Built into the mountains themselves, Ironhold is a fortress of stone and steel. Its deep mines provide resources for the war against corruption, while its walls stand as an unbreakable barrier.",
    icon: "mountain",
    color: "#6B6B6B"
  },

  crossroads: {
    name: "Crossroads End",
    emoji: "🛤️",
    type: "city-trade",
    population: 14200,
    coordinates: { angle: 202.5, distance: 39 }, // SSW
    corruption: 0,
    faction: "pragmaticCoalition",
    features: ["Grand Bazaar", "Trade Guildhall", "Wagon Yards", "Merchant Quarter"],
    npcs: ["Guildmaster Torin Blackwell", "Merchant Prince Vex", "Caravan Master Lysa"],
    description: "The beating heart of commerce in the Borderlands. Multiple trade routes converge here, creating a bustling hub of merchants, travelers, and fortune seekers. The markets never sleep.",
    icon: "crossroads",
    color: "#8B6F47"
  },

  haven: {
    name: "Haven's Rest",
    emoji: "⚓",
    type: "city-port",
    population: 19500,
    coordinates: { angle: 225, distance: 35 }, // SW
    corruption: 0,
    faction: "pragmaticCoalition",
    features: ["Riverside District", "Harbor Docks", "Warehouse Quarter", "Fisherman's Wharf"],
    npcs: ["Harbor Master Elena Tide", "Captain Gregor Storm", "Dockmaster Quinn"],
    description: "A thriving river port on the Silverflow. Ships and barges carry goods and refugees along the river. The city has become a crucial evacuation point as the Maelstrom spreads.",
    icon: "anchor",
    color: "#2C5F8D"
  },

  // === KEY SECONDARY LOCATIONS ===
  mountThyros: {
    name: "Mount Thyros",
    emoji: "⚰️",
    type: "location-tomb",
    coordinates: { angle: 145, distance: 50 }, // SE, beyond Ironhold
    corruption: 1,
    faction: "none",
    features: ["Ancient Tomb", "Sealed Chambers", "Mysterious Aura", "Thyros the Ender sleeps here"],
    secret: true,
    secretInfo: "The sleeping god Thyros the Ender rests within this mountain, sealed away millennia ago. The Divine Awakeners seek to find and awaken him.",
    description: "An imposing mountain peak shrouded in ancient mystery. Local legends speak of a great evil sealed within, though few dare approach.",
    icon: "tomb",
    color: "#3D3D3D"
  },

  shimmerwood: {
    name: "Shimmerwood Forest",
    emoji: "🌊",
    type: "location-forest",
    coordinates: { angle: 247.5, distance: 42 }, // Between SW and W
    corruption: 0,
    faction: "divineAwakeners",
    features: ["Fey-touched Trees", "Hidden Lake", "Magical Shimmer", "Isril the Blind sleeps in the lake"],
    secret: true,
    secretInfo: "Deep within the forest lies a hidden lake where Isril the Blind, the god of forgotten dreams, sleeps beneath the waters. Only the Divine Awakeners know the way.",
    description: "A vast forest with an otherworldly shimmer to its leaves. The trees seem to whisper secrets, and strange lights dance between the branches. Few who enter find what they seek.",
    icon: "forest",
    color: "#2D5016"
  },

  threshold: {
    name: "The Threshold Commune",
    emoji: "🌀",
    type: "settlement-cult",
    population: 800,
    coordinates: { angle: 180, distance: 17 }, // S, just inside Maelstrom
    corruption: 3,
    faction: "ascendantCult",
    features: ["Phase-shifting Buildings", "Transformation Chambers", "Corruption Embrace", "Cult Headquarters"],
    npcs: ["Prophet Kaelith", "Transformed Believers", "Corruption-touched Guards"],
    description: "A settlement within the corruption zone itself. Buildings phase between realities, and the inhabitants embrace their transformation. The Ascendant Cult considers this their promised land.",
    icon: "spiral",
    color: "#8B4789"
  },

  ghosthaven: {
    name: "Ghosthaven",
    emoji: "😱",
    type: "settlement-refugee",
    population: 15000,
    coordinates: { angle: 0, distance: 30 }, // N, between Thornwick and Goldspire
    corruption: 1,
    faction: "pragmaticCoalition",
    features: ["Tent City", "Refugee Aid Station", "Makeshift Walls", "Overcrowded Camps"],
    npcs: ["Coordinator Maya Stone", "Guard Captain Dorian", "Healer Marta"],
    description: "A sprawling refugee camp housing those displaced by the Maelstrom's spread. Tents stretch as far as the eye can see. The Pragmatic Coalition works tirelessly to provide aid and maintain order.",
    icon: "tent",
    color: "#7A7A7A"
  },

  millhaven: {
    name: "Millhaven",
    emoji: "🏘️",
    type: "village",
    population: 1200,
    coordinates: { angle: 315, distance: 28 }, // NW
    corruption: 1,
    faction: "empiricalAcademy",
    features: ["Old Mill", "Farming Community", "Research Outpost", "Corruption Edge Watch"],
    npcs: ["Mayor Grendel", "Miller Jorik", "Academy Researcher Finn"],
    description: "A small farming village on the edge of the corruption zone. The old mill still turns, but the fields grow smaller each month as the Maelstrom spreads. Academy researchers monitor the corruption's advance.",
    icon: "mill",
    color: "#DAA520"
  }
};

const GEOGRAPHIC_FEATURES = {
  silverflowRiver: {
    name: "Silverflow River",
    type: "river",
    points: [
      { angle: 45, distance: 45 },   // Near Goldspire (NE)
      { angle: 0, distance: 30 },     // Through Ghosthaven
      { angle: 225, distance: 35 },   // Haven's Rest (SW)
      { angle: 245, distance: 50 }    // Exit SW
    ],
    width: 3, // miles
    color: "#2C5F8D",
    description: "A major navigable river flowing from the northeast mountains through Haven's Rest and beyond. Critical for trade and transportation."
  },

  goldmeadowPlains: {
    name: "Goldmeadow Plains",
    type: "plains",
    region: [
      { angle: 315, distance: 25 },
      { angle: 0, distance: 35 },
      { angle: 45, distance: 35 },
      { angle: 337.5, distance: 30 }
    ],
    color: "#E8D896",
    description: "Once fertile farmland, now mostly abandoned due to the Maelstrom's spread. Scattered farms and fields lie empty."
  },

  ironholdMountains: {
    name: "Ironhold Mountains",
    type: "mountains",
    region: [
      { angle: 115, distance: 35 },
      { angle: 145, distance: 55 },
      { angle: 180, distance: 50 },
      { angle: 160, distance: 40 }
    ],
    peaks: [
      { name: "Mount Thyros", angle: 145, distance: 50 },
      { name: "Iron Peak", angle: 135, distance: 44 },
      { name: "Watchman's Crest", angle: 160, distance: 48 }
    ],
    color: "#6B5D52",
    description: "A rugged mountain range providing natural defenses and rich mineral deposits. Home to Ironhold and the ancient Mount Thyros."
  },

  shimmerwoodForest: {
    name: "Shimmerwood Forest",
    type: "forest",
    region: [
      { angle: 225, distance: 35 },
      { angle: 270, distance: 45 },
      { angle: 247.5, distance: 50 },
      { angle: 230, distance: 40 }
    ],
    hiddenLake: { angle: 247.5, distance: 42 },
    color: "#2D5016",
    shimmer: true,
    description: "A dense, fey-touched forest with magical properties. Strange lights and whispers emanate from within. Contains a hidden lake."
  }
};

const TRADE_ROUTES = {
  circleRoad: {
    name: "Circle Road",
    type: "major",
    points: ["thornwick", "goldspire", "ironhold", "crossroads", "haven", "thornwick"],
    status: "partially-compromised",
    color: "#8B6F47",
    description: "The main road connecting all five major cities in a rough circle around the Maelstrom. Some sections are compromised by corruption."
  },

  kingsHighway: {
    name: "King's Highway",
    type: "major",
    points: ["goldspire", "ghosthaven", "crossroads"],
    status: "active",
    color: "#8B6F47",
    description: "The primary north-south trade route from Goldspire to Crossroads End."
  },

  scholarsPath: {
    name: "Scholar's Path",
    type: "secondary",
    points: ["thornwick", "millhaven", "crossroads"],
    status: "active",
    color: "#8B6F47",
    description: "A well-traveled route connecting Thornwick Academy to Crossroads End."
  },

  riverRoute: {
    name: "River Trade Route",
    type: "water",
    follows: "silverflowRiver",
    status: "active",
    color: "#4A7BA7",
    description: "Major shipping route along the Silverflow River."
  }
};

const FACTIONS = {
  empiricalAcademy: {
    name: "Empirical Academy",
    emoji: "🧪",
    color: "#2E5C8A",
    territories: ["thornwick", "millhaven", "ironhold"],
    influence: 0.7,
    description: "Scholars and scientists seeking to understand and stop the Maelstrom through research and innovation.",
    countdown: {
      goal: "Scientific breakthrough to stabilize reality",
      progress: 0.45,
      monthsRemaining: 6
    }
  },

  vigilantOrder: {
    name: "Vigilant Order",
    emoji: "⚜️",
    color: "#D4AF37",
    territories: ["goldspire"],
    influence: 0.8,
    description: "Holy warriors and clerics who believe the Maelstrom is divine punishment. They seek to purge corruption through faith and steel.",
    countdown: {
      goal: "Divine ritual to cleanse the Maelstrom",
      progress: 0.35,
      monthsRemaining: 8
    }
  },

  ascendantCult: {
    name: "Ascendant Cult",
    emoji: "🌀",
    color: "#8B4789",
    territories: ["threshold"],
    influence: 0.6,
    description: "Believers who embrace the corruption as evolution. They seek to transform all life through the Maelstrom's power.",
    countdown: {
      goal: "Convert enough followers to trigger mass ascension",
      progress: 0.55,
      monthsRemaining: 5
    }
  },

  pragmaticCoalition: {
    name: "Pragmatic Coalition",
    emoji: "🛡️",
    color: "#5A8F5A",
    territories: ["ghosthaven", "crossroads", "haven"],
    influence: 0.5,
    description: "A practical alliance focused on survival, evacuation, and helping refugees. They believe in adapting rather than fighting or embracing.",
    countdown: {
      goal: "Evacuate all civilians beyond safe distance",
      progress: 0.40,
      monthsRemaining: 7
    }
  },

  pilgrims: {
    name: "The Pilgrims",
    emoji: "🚶",
    color: "#8C8C8C",
    territories: [],
    influence: 0.3,
    description: "Nomadic survivors who have learned to navigate the corruption zones. They guide refugees and seek lost artifacts.",
    countdown: {
      goal: "Map all safe paths through corruption",
      progress: 0.60,
      monthsRemaining: 4
    }
  },

  divineAwakeners: {
    name: "Divine Awakeners",
    emoji: "👁️",
    color: "#C0C0C0",
    territories: ["shimmerwood"],
    influence: 0.4,
    secret: true,
    description: "A secret cult seeking to awaken the sleeping gods Thyros and Isril. They believe only divine intervention can stop the Maelstrom.",
    countdown: {
      goal: "Awaken both sleeping gods",
      progress: 0.25,
      monthsRemaining: 10
    }
  }
};

const CORRUPTION_ZONES = [
  {
    level: 0,
    name: "Safe Zone",
    minDistance: 32,
    maxDistance: 100,
    color: "transparent",
    corruption: "0%",
    description: "Safe from corruption effects"
  },
  {
    level: 1,
    name: "Reality Flutter",
    minDistance: 24,
    maxDistance: 32,
    color: "rgba(139, 71, 137, 0.15)",
    corruption: "10-25%",
    description: "Minor reality distortions, occasional dimensional echoes"
  },
  {
    level: 2,
    name: "Dimensional Bleeding",
    minDistance: 16,
    maxDistance: 24,
    color: "rgba(139, 71, 137, 0.35)",
    corruption: "25-50%",
    description: "Frequent reality breaks, creatures from other planes appear"
  },
  {
    level: 3,
    name: "Reality Storm",
    minDistance: 8,
    maxDistance: 16,
    color: "rgba(139, 71, 137, 0.6)",
    corruption: "50-75%",
    description: "Severe reality distortion, physical laws inconsistent"
  },
  {
    level: 4,
    name: "Planar Chaos",
    minDistance: 0,
    maxDistance: 8,
    color: "rgba(74, 14, 78, 0.85)",
    corruption: "75-100%",
    description: "Complete reality collapse, multiple dimensions collide"
  }
];

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAP_CONFIG,
    LOCATIONS,
    GEOGRAPHIC_FEATURES,
    TRADE_ROUTES,
    FACTIONS,
    CORRUPTION_ZONES
  };
}

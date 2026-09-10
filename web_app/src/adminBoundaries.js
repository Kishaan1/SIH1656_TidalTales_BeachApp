/**
 * Hierarchical Administrative Boundaries and Multi-Tier Geographic Labels for 3D Globe
 * - Level 1: State / Provincial borders (visible at altitude < 1.8)
 * - Level 2: Coastal District / County lines (visible at altitude < 0.8)
 * - Progressive Place Names: Tier 1 (States) and Tier 2 (Cities / Districts)
 * Styling: Vintage sun-bleached coastal parchment palette (#A89F91, terracotta, muted teal)
 */

// --------------------------------------------------------------------------
// 1. Level 1: State / Provincial Border Line Paths (Altitude < 1.8)
// --------------------------------------------------------------------------
export const stateBorderPaths = [
  // --- INDIA COASTAL STATES ---
  // Tamil Nadu / Kerala Border (Western Ghats ridge line)
  {
    id: 'tn-ker',
    name: 'Tamil Nadu - Kerala Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [8.088, 77.538],
      [8.500, 77.200],
      [8.850, 77.100],
      [9.500, 77.150],
      [9.900, 77.100],
      [10.150, 76.950],
      [10.500, 76.750],
      [10.850, 76.600],
      [11.200, 76.450],
      [11.600, 76.350],
      [11.850, 75.900],
    ],
  },
  // Kerala / Karnataka Border
  {
    id: 'ker-kar',
    name: 'Kerala - Karnataka Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [12.100, 75.800],
      [12.350, 75.500],
      [12.750, 75.050],
      [12.870, 74.880],
    ],
  },
  // Tamil Nadu / Karnataka Border
  {
    id: 'tn-kar',
    name: 'Tamil Nadu - Karnataka Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [11.600, 76.350],
      [11.950, 77.050],
      [12.150, 77.400],
      [12.750, 77.850],
      [12.980, 78.350],
    ],
  },
  // Tamil Nadu / Andhra Pradesh Border
  {
    id: 'tn-ap',
    name: 'Tamil Nadu - Andhra Pradesh Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [12.980, 78.350],
      [13.200, 79.150],
      [13.450, 79.800],
      [13.550, 80.180],
    ],
  },
  // Karnataka / Goa Border
  {
    id: 'kar-goa',
    name: 'Karnataka - Goa Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [14.900, 74.150],
      [15.100, 74.300],
      [15.450, 74.250],
      [15.700, 74.200],
    ],
  },
  // Goa / Maharashtra Border
  {
    id: 'goa-mah',
    name: 'Goa - Maharashtra Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [15.780, 73.680],
      [15.800, 73.950],
      [15.700, 74.200],
    ],
  },
  // Maharashtra / Gujarat Border
  {
    id: 'mah-guj',
    name: 'Maharashtra - Gujarat Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [20.100, 72.800],
      [20.300, 73.200],
      [20.800, 73.700],
      [21.400, 74.000],
    ],
  },
  // Andhra Pradesh / Odisha Border
  {
    id: 'ap-od',
    name: 'Andhra Pradesh - Odisha Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [18.900, 84.500],
      [19.100, 83.800],
      [18.800, 83.100],
      [18.200, 82.200],
    ],
  },
  // Odisha / West Bengal Border
  {
    id: 'od-wb',
    name: 'Odisha - West Bengal Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [21.600, 87.500],
      [21.900, 87.100],
      [22.250, 86.800],
    ],
  },

  // --- USA COASTAL STATES ---
  // California / Oregon Border
  {
    id: 'ca-or',
    name: 'California - Oregon Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [42.000, -124.250],
      [42.000, -120.000],
    ],
  },
  // California / Nevada Border
  {
    id: 'ca-nv',
    name: 'California - Nevada Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [42.000, -120.000],
      [39.000, -120.000],
      [35.000, -114.600],
    ],
  },
  // Florida / Georgia Border
  {
    id: 'fl-ga',
    name: 'Florida - Georgia Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [30.700, -81.450],
      [30.400, -82.100],
      [30.600, -84.900],
    ],
  },
  // Florida / Alabama Border
  {
    id: 'fl-al',
    name: 'Florida - Alabama Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [30.600, -84.900],
      [31.000, -85.000],
      [31.000, -87.500],
      [30.250, -87.500],
    ],
  },

  // --- AUSTRALIA STATES ---
  // Queensland / New South Wales Border
  {
    id: 'qld-nsw',
    name: 'Queensland - New South Wales Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [-28.160, 153.550],
      [-28.400, 152.800],
      [-29.000, 150.000],
      [-29.000, 141.000],
    ],
  },
  // New South Wales / Victoria Border
  {
    id: 'nsw-vic',
    name: 'New South Wales - Victoria Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [-37.500, 149.980],
      [-36.500, 148.000],
      [-35.800, 145.000],
      [-34.200, 141.000],
    ],
  },

  // --- EUROPE REGIONAL BORDERS ---
  // France / Spain Coastal Border (Catalonia / Occitanie)
  {
    id: 'fr-es-med',
    name: 'France - Spain Mediterranean Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [42.430, 3.160],
      [42.450, 2.900],
      [42.500, 2.500],
      [42.650, 1.800],
    ],
  },
  // France / Italy Coastal Border (Côte d'Azur / Liguria)
  {
    id: 'fr-it-cotedazur',
    name: 'France - Italy Côte d\'Azur Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [43.780, 7.530],
      [44.050, 7.550],
      [44.250, 7.450],
    ],
  },

  // --- UAE EMIRATE BOUNDARIES ---
  // Dubai / Abu Dhabi Coastal Boundary
  {
    id: 'uae-dxb-auh',
    name: 'Dubai - Abu Dhabi Border',
    color: 'rgba(168, 159, 145, 0.65)',
    stroke: 0.7,
    dashLength: 0.015,
    dashGap: 0.01,
    coords: [
      [24.850, 54.950],
      [24.750, 55.150],
      [24.600, 55.400],
    ],
  },
];

// --------------------------------------------------------------------------
// 2. Level 2: Coastal District / County Lines (Altitude < 0.8)
// --------------------------------------------------------------------------
export const districtBorderPaths = [
  // --- TAMIL NADU COASTAL DISTRICTS ---
  // Chennai / Chengalpattu (ECR boundary)
  {
    id: 'dist-chn-cgl',
    name: 'Chennai - Chengalpattu Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [12.920, 80.250],
      [12.900, 80.180],
      [12.850, 80.120],
    ],
  },
  // Chengalpattu / Villupuram
  {
    id: 'dist-cgl-vpm',
    name: 'Chengalpattu - Villupuram Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [12.250, 80.050],
      [12.200, 79.800],
      [12.150, 79.550],
    ],
  },
  // Villupuram / Cuddalore
  {
    id: 'dist-vpm-cud',
    name: 'Villupuram - Cuddalore Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [11.850, 79.780],
      [11.800, 79.600],
      [11.750, 79.400],
    ],
  },
  // Nagapattinam / Ramanathapuram
  {
    id: 'dist-nag-ram',
    name: 'Nagapattinam - Ramanathapuram Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [10.250, 79.850],
      [10.100, 79.500],
      [9.900, 79.200],
    ],
  },
  // Ramanathapuram / Thoothukudi
  {
    id: 'dist-ram-tut',
    name: 'Ramanathapuram - Thoothukudi Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [9.150, 78.850],
      [9.100, 78.500],
      [9.050, 78.200],
    ],
  },
  // Thoothukudi / Kanyakumari
  {
    id: 'dist-tut-kan',
    name: 'Thoothukudi - Kanyakumari Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [8.400, 77.850],
      [8.350, 77.650],
      [8.300, 77.500],
    ],
  },

  // --- KERALA COASTAL DISTRICTS ---
  // Thiruvananthapuram / Kollam
  {
    id: 'dist-tvm-klm',
    name: 'Thiruvananthapuram - Kollam Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [8.760, 76.710],
      [8.850, 76.850],
      [8.950, 77.050],
    ],
  },
  // Kollam / Alappuzha
  {
    id: 'dist-klm-alp',
    name: 'Kollam - Alappuzha Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [9.100, 76.500],
      [9.200, 76.650],
      [9.250, 76.800],
    ],
  },
  // Alappuzha / Ernakulam (Kochi)
  {
    id: 'dist-alp-ekm',
    name: 'Alappuzha - Ernakulam Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [9.750, 76.300],
      [9.800, 76.450],
      [9.850, 76.600],
    ],
  },
  // Ernakulam / Thrissur
  {
    id: 'dist-ekm-tsr',
    name: 'Ernakulam - Thrissur Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [10.200, 76.180],
      [10.250, 76.350],
      [10.300, 76.500],
    ],
  },
  // Kozhikode / Kannur
  {
    id: 'dist-clt-knr',
    name: 'Kozhikode - Kannur Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [11.700, 75.550],
      [11.750, 75.700],
      [11.800, 75.850],
    ],
  },

  // --- GOA DISTRICTS ---
  // North Goa / South Goa (Zuari River boundary)
  {
    id: 'dist-ngo-sgo',
    name: 'North Goa - South Goa Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [15.420, 73.800],
      [15.400, 73.950],
      [15.380, 74.150],
    ],
  },

  // --- MAHARASHTRA COASTAL DISTRICTS ---
  // Mumbai City / Mumbai Suburban
  {
    id: 'dist-mum-sub',
    name: 'Mumbai City - Suburban Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [19.040, 72.820],
      [19.060, 72.860],
      [19.050, 72.900],
    ],
  },
  // Mumbai / Raigad (Thane Creek / Harbour)
  {
    id: 'dist-mum-rgd',
    name: 'Mumbai - Raigad Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [18.920, 72.950],
      [18.880, 73.020],
      [18.820, 73.100],
    ],
  },
  // Raigad / Ratnagiri
  {
    id: 'dist-rgd-rtn',
    name: 'Raigad - Ratnagiri Border',
    color: 'rgba(168, 159, 145, 0.40)',
    stroke: 0.5,
    dashLength: 0.008,
    dashGap: 0.018,
    coords: [
      [17.950, 73.100],
      [17.900, 73.300],
      [17.850, 73.500],
    ],
  },
];

// --------------------------------------------------------------------------
// 3. Progressive Administrative Place Names (Tier 1 & Tier 2)
// --------------------------------------------------------------------------
export const administrativeLabels = [
  // --- TIER 1: Major Coastal States & Provinces (Visible at Altitude < 1.8) ---
  // India
  { name: 'Tamil Nadu', lat: 11.1271, lng: 78.6569, minAltitude: 1.8, type: 'state' },
  { name: 'Kerala', lat: 10.8505, lng: 76.2711, minAltitude: 1.8, type: 'state' },
  { name: 'Karnataka', lat: 14.2500, lng: 75.5000, minAltitude: 1.8, type: 'state' },
  { name: 'Goa', lat: 15.3500, lng: 74.0500, minAltitude: 1.8, type: 'state' },
  { name: 'Maharashtra', lat: 19.2500, lng: 74.5000, minAltitude: 1.8, type: 'state' },
  { name: 'Gujarat', lat: 22.2500, lng: 71.5000, minAltitude: 1.8, type: 'state' },
  { name: 'Andhra Pradesh', lat: 15.9129, lng: 79.7400, minAltitude: 1.8, type: 'state' },
  { name: 'Odisha', lat: 20.9517, lng: 85.0985, minAltitude: 1.8, type: 'state' },
  { name: 'West Bengal', lat: 22.9868, lng: 87.8550, minAltitude: 1.8, type: 'state' },

  // USA
  { name: 'California', lat: 36.7783, lng: -119.4179, minAltitude: 1.8, type: 'state' },
  { name: 'Florida', lat: 27.9944, lng: -81.7603, minAltitude: 1.8, type: 'state' },
  { name: 'Hawaii', lat: 20.7984, lng: -156.3319, minAltitude: 1.8, type: 'state' },
  { name: 'New York', lat: 42.1657, lng: -74.9481, minAltitude: 1.8, type: 'state' },

  // Australia
  { name: 'Queensland', lat: -20.9176, lng: 142.7028, minAltitude: 1.8, type: 'state' },
  { name: 'New South Wales', lat: -31.8402, lng: 145.6128, minAltitude: 1.8, type: 'state' },
  { name: 'Victoria', lat: -37.0201, lng: 144.9646, minAltitude: 1.8, type: 'state' },
  { name: 'Western Australia', lat: -25.0423, lng: 122.0000, minAltitude: 1.8, type: 'state' },

  // Europe / Mediterranean
  { name: 'Provence-Alpes-Côte d\'Azur', lat: 43.9352, lng: 6.0679, minAltitude: 1.8, type: 'state' },
  { name: 'Catalonia', lat: 41.5912, lng: 1.5209, minAltitude: 1.8, type: 'state' },
  { name: 'Andalusia', lat: 37.5443, lng: -4.7278, minAltitude: 1.8, type: 'state' },

  // Southeast Asia / Middle East / Latin America / Africa
  { name: 'Bali', lat: -8.4095, lng: 115.1889, minAltitude: 1.8, type: 'state' },
  { name: 'Phuket Province', lat: 8.0300, lng: 98.3500, minAltitude: 1.8, type: 'state' },
  { name: 'Dubai Emirate', lat: 25.0657, lng: 55.1713, minAltitude: 1.8, type: 'state' },
  { name: 'Rio de Janeiro State', lat: -22.3000, lng: -42.8000, minAltitude: 1.8, type: 'state' },
  { name: 'Western Cape', lat: -33.2278, lng: 21.8569, minAltitude: 1.8, type: 'state' },

  // --- TIER 2: Coastal Districts & Port Cities (Visible at Altitude < 0.8) ---
  // India Coastal Cities & Districts
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, minAltitude: 0.8, type: 'city' },
  { name: 'Kanyakumari', lat: 8.0883, lng: 77.5385, minAltitude: 0.8, type: 'district' },
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366, minAltitude: 0.8, type: 'city' },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673, minAltitude: 0.8, type: 'city' },
  { name: 'Kozhikode', lat: 11.2588, lng: 75.7804, minAltitude: 0.8, type: 'city' },
  { name: 'Mangaluru', lat: 12.9141, lng: 74.8560, minAltitude: 0.8, type: 'city' },
  { name: 'Udupi', lat: 13.3409, lng: 74.7421, minAltitude: 0.8, type: 'district' },
  { name: 'Panaji', lat: 15.4909, lng: 73.8278, minAltitude: 0.8, type: 'city' },
  { name: 'Mumbai', lat: 18.9220, lng: 72.8347, minAltitude: 0.8, type: 'city' },
  { name: 'Ratnagiri', lat: 16.9902, lng: 73.3120, minAltitude: 0.8, type: 'district' },
  { name: 'Surat', lat: 21.1702, lng: 72.8311, minAltitude: 0.8, type: 'city' },
  { name: 'Dwarka', lat: 22.2442, lng: 68.9685, minAltitude: 0.8, type: 'city' },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185, minAltitude: 0.8, type: 'city' },
  { name: 'Puri', lat: 19.8135, lng: 85.8312, minAltitude: 0.8, type: 'city' },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, minAltitude: 0.8, type: 'city' },

  // International Coastal Hubs & Cities
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, minAltitude: 0.8, type: 'city' },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, minAltitude: 0.8, type: 'city' },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611, minAltitude: 0.8, type: 'city' },
  { name: 'Miami', lat: 25.7617, lng: -80.1918, minAltitude: 0.8, type: 'city' },
  { name: 'Honolulu', lat: 21.3069, lng: -157.8583, minAltitude: 0.8, type: 'city' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, minAltitude: 0.8, type: 'city' },
  { name: 'Brisbane', lat: -27.4698, lng: 153.0251, minAltitude: 0.8, type: 'city' },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631, minAltitude: 0.8, type: 'city' },
  { name: 'Perth', lat: -31.9505, lng: 115.8605, minAltitude: 0.8, type: 'city' },
  { name: 'Nice', lat: 43.7102, lng: 7.2620, minAltitude: 0.8, type: 'city' },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698, minAltitude: 0.8, type: 'city' },
  { name: 'Cannes', lat: 43.5528, lng: 7.0174, minAltitude: 0.8, type: 'city' },
  { name: 'Barcelona', lat: 41.3851, lng: 2.1734, minAltitude: 0.8, type: 'city' },
  { name: 'Valencia', lat: 39.4699, lng: -0.3763, minAltitude: 0.8, type: 'city' },
  { name: 'Denpasar', lat: -8.6705, lng: 115.2126, minAltitude: 0.8, type: 'city' },
  { name: 'Kuta', lat: -8.7233, lng: 115.1723, minAltitude: 0.8, type: 'city' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, minAltitude: 0.8, type: 'city' },
  { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729, minAltitude: 0.8, type: 'city' },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241, minAltitude: 0.8, type: 'city' },
];

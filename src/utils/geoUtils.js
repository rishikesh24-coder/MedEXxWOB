/**
 * Centralized Geospatial Mapping & Route Utility for MedEx India Live Tracking
 * Provides standard geographic coordinates for hospitals, logistics hubs, and highway corridors.
 */

// City & Institutional Geocoordinates across India
export const CITY_COORDINATES = {
  // Western Corridor (Maharashtra / Gujarat)
  'Mumbai': [19.0760, 72.8777],
  'Navi Mumbai': [19.0330, 73.0297],
  'Belapur': [19.0144, 73.0408],
  'Pune': [18.5204, 73.8567],
  'Parel': [19.0034, 72.8427],
  'Bandra': [19.0522, 72.8277],
  'Chembur': [19.0522, 72.8994],
  'Vashi': [19.0771, 72.9986],
  'Thane': [19.2183, 72.9781],
  'Apollo Hospital': [19.0144, 73.0408], // Belapur, Navi Mumbai
  'Lilavati Hospital': [19.0522, 72.8277], // Bandra, Mumbai
  'Tata Memorial Centre': [19.0034, 72.8427], // Parel, Mumbai
  'Hinduja Hospital': [19.0330, 72.8400], // Mahim, Mumbai
  'Kokilaben Hospital': [19.1311, 72.8267], // Andheri, Mumbai
  'City Hospital': [18.5204, 73.8567], // Pune
  'Vadodara': [22.3072, 73.1812], // NH-48 Central Logistics Hub
  'Surat': [21.1702, 72.8311],
  'Ahmedabad': [23.0225, 72.5714],

  // National Capital Region (Delhi / Gurgaon / Noida)
  'Delhi': [28.6139, 77.2090],
  'New Delhi': [28.6139, 77.2090],
  'Saket': [28.5273, 77.2155],
  'AIIMS': [28.5672, 77.2100],
  'Max Super Speciality Hospital': [28.5273, 77.2155],
  'Gurgaon': [28.4595, 77.0266],
  'Gurugram': [28.4595, 77.0266],
  'Fortis Memorial Research Institute': [28.4595, 77.0266],
  'Sir Ganga Ram Hospital': [28.6387, 77.1895],
  'Noida': [28.5355, 77.3910],

  // Southern Corridor (Bangalore / Vellore / Chennai / Hyderabad)
  'Bangalore': [12.9716, 77.5946],
  'Bengaluru': [12.9716, 77.5946],
  'Manipal Hospital': [12.9592, 77.6499],
  'Vellore': [12.9165, 79.1325],
  'CMC Vellore': [12.9248, 79.1345],
  'Chennai': [13.0827, 80.2707],
  'Hyderabad': [17.3850, 78.4867],

  // Northern Corridor (Chandigarh / Jaipur / Lucknow)
  'Chandigarh': [30.7333, 76.7794],
  'PGIMER Chandigarh': [30.7645, 76.7766],
  'Jaipur': [26.9124, 75.7873],
  'Lucknow': [26.8467, 80.9462],
  'Kolkata': [22.5726, 88.3639],
};

// Default center of India geographic boundary
export const INDIA_MAP_CENTER = [22.5000, 79.0000];
export const DEFAULT_MAP_ZOOM = 5;

/**
 * Extracts a recognizable city name from a hospital name or address string.
 */
export const extractCity = (nameOrAddress) => {
  if (!nameOrAddress) return 'India';
  const text = String(nameOrAddress);

  // Check parenthesized city e.g. "Max Super Speciality (Delhi)"
  const parenMatch = text.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const candidate = parenMatch[1].trim();
    for (const city of Object.keys(CITY_COORDINATES)) {
      if (candidate.toLowerCase().includes(city.toLowerCase())) {
        return city;
      }
    }
  }

  // Check direct matches in string
  const knownCities = [
    'Mumbai', 'Navi Mumbai', 'Pune', 'Delhi', 'New Delhi', 'Gurgaon', 'Gurugram',
    'Vadodara', 'Surat', 'Bangalore', 'Bengaluru', 'Vellore', 'Chennai', 'Hyderabad',
    'Chandigarh', 'Jaipur', 'Kolkata', 'Ahmedabad', 'Lucknow'
  ];

  for (const city of knownCities) {
    if (text.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }

  return 'India';
};

/**
 * Resolves coordinates from a hospital name or city string.
 */
export const resolveCoordinates = (nameOrCity, defaultFallback = [19.0760, 72.8777]) => {
  if (!nameOrCity) return defaultFallback;
  const str = String(nameOrCity).toLowerCase();

  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (str.includes(key.toLowerCase())) {
      return coords;
    }
  }

  return defaultFallback;
};

/**
 * Builds intermediate waypoints between origin, current checkpoint, and destination
 * to simulate realistic highway paths across India.
 */
export const buildCurvedHighwayPath = (origin, current, destination) => {
  const points = [];
  points.push(origin);

  const latDiff = Math.abs(origin[0] - destination[0]);
  const lngDiff = Math.abs(origin[1] - destination[1]);

  if (latDiff > 3 || lngDiff > 3) {
    // Inter-state highway path via intermediate transit checkpoints
    const mid1 = [
      origin[0] * 0.65 + current[0] * 0.35,
      origin[1] * 0.65 + current[1] * 0.35 + 0.12
    ];
    points.push(mid1);
    points.push(current);

    const mid2 = [
      current[0] * 0.4 + destination[0] * 0.6,
      current[1] * 0.4 + destination[1] * 0.6 - 0.08
    ];
    points.push(mid2);
  } else {
    // Local / intra-corridor transfer
    points.push(current);
  }

  points.push(destination);
  return points;
};

/**
 * Centralized tracking route data architecture for Leaflet mapping.
 * Structure:
 * trackingRoute = {
 *   seller: { name, city, latitude, longitude, medicine, quantity, status },
 *   current: { label, latitude, longitude, status, lastUpdated, vehicleNo, temperature },
 *   destination: { name, city, latitude, longitude, medicine, quantity, eta },
 *   route: [[lat, lng], ...]
 * }
 */
export const getTrackingRouteData = (tracking) => {
  if (!tracking) {
    const origin = [28.5273, 77.2155];
    const current = [22.3072, 73.1812];
    const destination = [19.0144, 73.0408];
    const path = buildCurvedHighwayPath(origin, current, destination);

    return {
      seller: {
        name: 'Max Super Speciality Hospital',
        city: 'Delhi',
        latitude: origin[0],
        longitude: origin[1],
        medicine: 'Enoxaparin Sodium 40mg',
        quantity: 50,
        status: 'Package picked up'
      },
      current: {
        label: 'Vadodara Distribution Hub, NH-48',
        latitude: current[0],
        longitude: current[1],
        status: 'In Transit',
        lastUpdated: '2 minutes ago',
        vehicleNo: 'MH-04-AZ-4419 (Temp Controlled)',
        temperature: '4.2°C'
      },
      destination: {
        name: 'Apollo Hospital',
        city: 'Mumbai',
        latitude: destination[0],
        longitude: destination[1],
        medicine: 'Enoxaparin Sodium 40mg',
        quantity: 50,
        eta: 'Today • 6:30 PM'
      },
      route: path,
      origin,
      currentCoords: current,
      destinationCoords: destination
    };
  }

  // Check if explicit coordinates exist in tracking object
  let origin = tracking.coordinates?.origin;
  let current = tracking.coordinates?.current;
  let destination = tracking.coordinates?.destination;

  if (!origin) {
    origin = resolveCoordinates(tracking.senderHospital, [28.5273, 77.2155]);
  }
  if (!destination) {
    destination = resolveCoordinates(tracking.receiverHospital, [19.0144, 73.0408]);
  }
  if (!current) {
    current = resolveCoordinates(tracking.currentLocation, [
      (origin[0] + destination[0]) / 2,
      (origin[1] + destination[1]) / 2,
    ]);
  }

  const isDelivered = (tracking.status || '').toLowerCase() === 'delivered';
  const path = buildCurvedHighwayPath(origin, current, destination);

  return {
    seller: {
      name: tracking.senderHospital || 'Seller Hospital',
      city: extractCity(tracking.senderHospital),
      latitude: origin[0],
      longitude: origin[1],
      medicine: tracking.medicineName || 'Essential Medicine',
      quantity: tracking.quantity || 1,
      status: 'Package picked up'
    },
    current: {
      label: tracking.currentLocation || 'In Transit Checkpoint',
      latitude: isDelivered ? destination[0] : current[0],
      longitude: isDelivered ? destination[1] : current[1],
      status: tracking.status || 'In Transit',
      lastUpdated: '2 minutes ago',
      vehicleNo: tracking.vehicleNo || 'Medical Cold-Van',
      temperature: tracking.temperature || '4.0°C'
    },
    destination: {
      name: tracking.receiverHospital || 'Buyer Hospital',
      city: extractCity(tracking.receiverHospital),
      latitude: destination[0],
      longitude: destination[1],
      medicine: tracking.medicineName || 'Essential Medicine',
      quantity: tracking.quantity || 1,
      eta: tracking.eta || 'Today • 04:30 PM'
    },
    route: path,
    origin,
    currentCoords: isDelivered ? destination : current,
    destinationCoords: destination
  };
};

/**
 * Smoothly interpolates vehicle position along the waypoint route.
 * progress is a float between 0.0 (origin) and 1.0 (destination).
 */
export const interpolatePathPosition = (path, progress) => {
  if (!path || path.length === 0) return [22.5, 79.0];
  if (path.length === 1) return path[0];

  const totalSegments = path.length - 1;
  const clamped = Math.max(0, Math.min(1, progress));
  const segmentProgress = clamped * totalSegments;
  const segIndex = Math.min(Math.floor(segmentProgress), totalSegments - 1);
  const segRatio = segmentProgress - segIndex;

  const p1 = path[segIndex];
  const p2 = path[segIndex + 1];

  const lat = p1[0] + (p2[0] - p1[0]) * segRatio;
  const lng = p1[1] + (p2[1] - p1[1]) * segRatio;

  return [lat, lng];
};

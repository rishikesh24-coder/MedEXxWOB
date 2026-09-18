/**
 * Centralized Logistics Pricing & Distance Calculation Utility for MedEx
 * 
 * Provides distance-based estimated logistics pricing brackets,
 * straight-line Haversine geographic distance calculation, and
 * graceful fallback handling for missing coordinates.
 * 
 * NOTE: This is an INITIAL APPROXIMATE distance-based estimate.
 * Structured to allow seamless replacement with real carrier quotes later.
 */

import { CITY_COORDINATES, resolveCoordinates, extractCity } from '../utils/geoUtils.js';

/**
 * Distance Pricing Brackets:
 * - 0–25 km: ₹100 base delivery charge
 * - >25–50 km: ₹150
 * - >50–100 km: ₹250
 * - >100–200 km: ₹400
 * - >200–400 km: ₹650
 * - >400–700 km: ₹950
 * - >700–1000 km: ₹1,300
 * - >1000 km: ₹1,600
 */
export const LOGISTICS_PRICING_BRACKETS = [
  { minKm: 0, maxKm: 25, charge: 100, label: '0–25 km' },
  { minKm: 25, maxKm: 50, charge: 150, label: '26–50 km' },
  { minKm: 50, maxKm: 100, charge: 250, label: '51–100 km' },
  { minKm: 100, maxKm: 200, charge: 400, label: '101–200 km' },
  { minKm: 200, maxKm: 400, charge: 650, label: '201–400 km' },
  { minKm: 400, maxKm: 700, charge: 950, label: '401–700 km' },
  { minKm: 700, maxKm: 1000, charge: 1300, label: '701–1000 km' },
  { minKm: 1000, maxKm: Infinity, charge: 1600, label: '>1000 km' },
];

export const BASE_DELIVERY_CHARGE = 100;

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 * @param {Array<number>|object} coordsA - [lat, lon] or { latitude, longitude } or { lat, lng }
 * @param {Array<number>|object} coordsB - [lat, lon] or { latitude, longitude } or { lat, lng }
 * @returns {number|null} Distance in km rounded to integer, or null if invalid
 */
export const calculateHaversineDistance = (coordsA, coordsB) => {
  if (!coordsA || !coordsB) return null;

  const getLatLon = (c) => {
    if (Array.isArray(c) && c.length >= 2) {
      const lat = Number(c[0]);
      const lon = Number(c[1]);
      return (!isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null;
    }
    if (c && typeof c === 'object') {
      const lat = Number(c.latitude ?? c.lat);
      const lon = Number(c.longitude ?? c.lon ?? c.lng);
      return (!isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null;
    }
    return null;
  };

  const pA = getLatLon(coordsA);
  const pB = getLatLon(coordsB);

  if (!pA || !pB) return null;

  const [lat1, lon1] = pA;
  const [lat2, lon2] = pB;

  // Earth's radius in kilometers
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  if (isNaN(distance) || !isFinite(distance)) return null;
  return Math.round(distance);
};

/**
 * Determines the distance-based delivery charge from the centralized brackets.
 * @param {number|null} distanceKm
 * @returns {number|null} Charge in ₹, or null if distance is invalid
 */
export const getDeliveryChargeForDistance = (distanceKm) => {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm) || distanceKm < 0) {
    return null;
  }

  const dist = Number(distanceKm);
  for (const bracket of LOGISTICS_PRICING_BRACKETS) {
    if (dist <= bracket.maxKm) {
      return bracket.charge;
    }
  }

  return 1600;
};

export const KNOWN_HOSPITAL_LOCATIONS = {
  'apollo': { city: 'Mumbai', state: 'Maharashtra', locationText: 'Mumbai, Maharashtra' },
  'fortis': { city: 'Gurugram', state: 'Haryana', locationText: 'Gurugram, Haryana' },
  'max': { city: 'Delhi', state: 'Delhi NCR', locationText: 'Delhi NCR' },
  'lilavati': { city: 'Mumbai', state: 'Maharashtra', locationText: 'Mumbai, Maharashtra' },
  'tata memorial': { city: 'Mumbai', state: 'Maharashtra', locationText: 'Mumbai, Maharashtra' },
  'hinduja': { city: 'Mumbai', state: 'Maharashtra', locationText: 'Mumbai, Maharashtra' },
  'kokilaben': { city: 'Mumbai', state: 'Maharashtra', locationText: 'Mumbai, Maharashtra' },
  'aiims': { city: 'New Delhi', state: 'Delhi', locationText: 'New Delhi, Delhi' },
  'manipal': { city: 'Bengaluru', state: 'Karnataka', locationText: 'Bengaluru, Karnataka' },
  'cmc vellore': { city: 'Vellore', state: 'Tamil Nadu', locationText: 'Vellore, Tamil Nadu' },
  'pgimer': { city: 'Chandigarh', state: 'Punjab', locationText: 'Chandigarh' },
  'ganga ram': { city: 'Delhi', state: 'Delhi', locationText: 'Delhi' },
  'city hospital': { city: 'Pune', state: 'Maharashtra', locationText: 'Pune, Maharashtra' },
};

/**
 * Resolves hospital location details and coordinates from available metadata.
 * Uses existing coordinates if present, or resolves via city/name dictionary.
 * Does not call paid or external APIs.
 * @param {object|string} hospitalOrName
 * @returns {{ name: string, locationText: string, coordinates: Array<number>|null }}
 */
export const resolveHospitalLocation = (hospitalOrName) => {
  if (!hospitalOrName) {
    return { name: 'Hospital', locationText: '', coordinates: null };
  }

  const findKnownLocation = (str) => {
    if (!str) return null;
    const lower = String(str).toLowerCase();
    for (const [key, loc] of Object.entries(KNOWN_HOSPITAL_LOCATIONS)) {
      if (lower.includes(key)) {
        return loc.locationText;
      }
    }
    return null;
  };

  if (typeof hospitalOrName === 'string') {
    const coords = resolveCoordinates(hospitalOrName, null);
    const knownLoc = findKnownLocation(hospitalOrName);
    const city = extractCity(hospitalOrName);
    const locationText = knownLoc || (city !== 'India' ? city : '');
    return {
      name: hospitalOrName,
      locationText,
      coordinates: coords,
    };
  }

  const name = hospitalOrName.name || hospitalOrName.hospitalName || 'Hospital';
  const knownLoc = findKnownLocation(name);
  const city = hospitalOrName.city || extractCity(name) || '';
  const state = hospitalOrName.state || '';
  const locationParts = [city, state].filter(Boolean);
  const locationText = (locationParts.length > 0 && city !== 'India')
    ? locationParts.join(', ')
    : (knownLoc || (hospitalOrName.address || ''));

  // 1. Direct coordinates on the object
  if (hospitalOrName.coordinates) {
    const latLon = Array.isArray(hospitalOrName.coordinates)
      ? hospitalOrName.coordinates
      : [hospitalOrName.coordinates.latitude ?? hospitalOrName.coordinates.lat, hospitalOrName.coordinates.longitude ?? hospitalOrName.coordinates.lng];
    if (latLon[0] !== undefined && latLon[1] !== undefined && !isNaN(latLon[0]) && !isNaN(latLon[1])) {
      return { name, locationText, coordinates: latLon };
    }
  }

  if (hospitalOrName.latitude !== undefined && hospitalOrName.longitude !== undefined) {
    const lat = Number(hospitalOrName.latitude);
    const lon = Number(hospitalOrName.longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { name, locationText, coordinates: [lat, lon] };
    }
  }

  // 2. Resolve via name or address string against CITY_COORDINATES
  const searchCandidates = [name, hospitalOrName.address, city].filter(Boolean);
  for (const candidate of searchCandidates) {
    const coords = resolveCoordinates(candidate, null);
    if (coords) {
      return { name, locationText, coordinates: coords };
    }
  }

  return { name, locationText, coordinates: null };
};

/**
 * Calculates complete logistics estimate between seller and buyer for an order/requisition.
 * @param {object} request - The requisition / order object
 * @param {object} [userHospital] - The logged-in hospital record (optional fallback)
 * @returns {object} Standardized logistics estimate descriptor
 */
export const calculateLogisticsEstimate = (request, userHospital = null) => {
  if (!request) {
    return {
      isAvailable: false,
      sellerName: 'Seller Hospital',
      sellerLocation: '',
      buyerName: 'Buyer Hospital',
      buyerLocation: '',
      distanceKm: null,
      deliveryCharge: null,
      formattedDistance: 'Distance unavailable',
      formattedCharge: 'Delivery charge unavailable',
      bracketLabel: null,
      isColdChain: false,
      coldChainCharge: 0,
      disclaimer: 'Delivery charge is an estimated distance-based logistics cost.',
      note: 'Location coordinates unavailable for automated distance estimation.',
    };
  }

  // Identify Seller / Provider Hospital
  const sellerObj = {
    name: request.toHospitalName || request.sellerHospital || request.sellerHospitalName || request.fulfillingHospital?.name || 'Seller Hospital',
    city: request.toHospitalCity || request.sellerCity || request.fulfillingHospital?.city,
    state: request.toHospitalState || request.sellerState || request.fulfillingHospital?.state,
    address: request.toHospitalAddress || request.sellerAddress || request.fulfillingHospital?.address,
    latitude: request.toHospitalLatitude || request.sellerLatitude,
    longitude: request.toHospitalLongitude || request.sellerLongitude,
    coordinates: request.toHospitalCoordinates || request.sellerCoordinates,
  };

  // Identify Buyer / Requesting Hospital
  const buyerObj = {
    name: request.fromHospitalName || userHospital?.name || request.buyerHospital || request.buyerHospitalName || request.hospital?.name || 'Buyer Hospital',
    city: request.fromHospitalCity || userHospital?.city || request.buyerCity || request.hospital?.city,
    state: request.fromHospitalState || userHospital?.state || request.buyerState || request.hospital?.state,
    address: request.fromHospitalAddress || userHospital?.address || request.buyerAddress || request.hospital?.address,
    latitude: request.fromHospitalLatitude || userHospital?.latitude || request.buyerLatitude,
    longitude: request.fromHospitalLongitude || userHospital?.longitude || request.buyerLongitude,
    coordinates: request.fromHospitalCoordinates || userHospital?.coordinates || request.buyerCoordinates,
  };

  const sellerResolved = resolveHospitalLocation(sellerObj);
  const buyerResolved = resolveHospitalLocation(buyerObj);

  // Check existing stored distance on request if already persisted
  let distanceKm = null;
  if (request.distanceKm !== undefined && request.distanceKm !== null && !isNaN(request.distanceKm) && Number(request.distanceKm) >= 0) {
    distanceKm = Math.round(Number(request.distanceKm));
  } else if (sellerResolved.coordinates && buyerResolved.coordinates) {
    distanceKm = calculateHaversineDistance(sellerResolved.coordinates, buyerResolved.coordinates);
  }

  // Check cold-chain requirement from medicine data
  const storageStr = String(request.storageType || request.storage || request.medicineStorage || '').toLowerCase();
  const isColdChain = Boolean(
    request.isColdChain ||
    storageStr.includes('cold') ||
    storageStr.includes('2°c') ||
    storageStr.includes('refrigerat')
  );

  if (distanceKm !== null && !isNaN(distanceKm)) {
    // Check if delivery charge is already fixed on request, otherwise derive from brackets
    const deliveryCharge = (request.deliveryCharge !== undefined && request.deliveryCharge !== null && !isNaN(request.deliveryCharge))
      ? Number(request.deliveryCharge)
      : getDeliveryChargeForDistance(distanceKm);

    const bracket = LOGISTICS_PRICING_BRACKETS.find((b) => distanceKm <= b.maxKm) || LOGISTICS_PRICING_BRACKETS[LOGISTICS_PRICING_BRACKETS.length - 1];

    return {
      isAvailable: true,
      sellerName: sellerResolved.name,
      sellerLocation: sellerResolved.locationText,
      buyerName: buyerResolved.name,
      buyerLocation: buyerResolved.locationText,
      distanceKm,
      deliveryCharge,
      formattedDistance: `~${distanceKm.toLocaleString()} km`,
      formattedCharge: `₹${deliveryCharge.toLocaleString()}`,
      bracketLabel: bracket?.label || '',
      isColdChain,
      coldChainCharge: 0, // No fake surcharge added without a verified existing policy
      disclaimer: 'Delivery charge is an estimated distance-based logistics cost.',
      note: 'Approximate distance-based estimate • Final logistics cost may vary',
    };
  }

  // Graceful fallback when coordinates are missing
  return {
    isAvailable: false,
    sellerName: sellerResolved.name,
    sellerLocation: sellerResolved.locationText,
    buyerName: buyerResolved.name,
    buyerLocation: buyerResolved.locationText,
    distanceKm: null,
    deliveryCharge: null,
    formattedDistance: 'Distance unavailable',
    formattedCharge: 'Delivery charge unavailable',
    bracketLabel: null,
    isColdChain,
    coldChainCharge: 0,
    disclaimer: 'Delivery charge is an estimated distance-based logistics cost.',
    note: 'Location coordinates unavailable for automated distance estimation.',
  };
};

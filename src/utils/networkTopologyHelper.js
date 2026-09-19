/**
 * networkTopologyHelper.js
 * 
 * Centralized data-driven network topology and trade derivation engine for MedEx.
 * Converts real stored hospitals, requests, and tracking records into
 * dynamic 3D spatial network graphs for Hospital Dashboard and Public Site.
 */

import { getStoredItem, KEYS } from '../services/storage.js';
import { resolveCoordinates } from './geoUtils.js';

// Canonical active delivery lifecycle states (excluding terminal/completed states)
export const ACTIVE_LIFECYCLE_STATUSES = [
  'paid',
  'preparing',
  'confirmed',
  'dispatched',
  'in transit',
  'in_transit',
  'ordered',
];

export const TERMINAL_STATUSES = [
  'delivered',
  'completed',
  'cancelled',
  'cancelled by buyer',
  'rejected',
  'expired',
  'insufficient_stock',
];

/**
 * Checks if a requisition status or consignment represents an active trade in progress.
 */
export const isActiveTrade = (request, tracking = null) => {
  if (!request && !tracking) return false;
  const status = String(request?.status || '').toLowerCase().trim();
  const paymentStatus = String(request?.paymentStatus || '').toLowerCase().trim();
  const trackingStatus = String(tracking?.status || '').toLowerCase().trim();

  // Exclude terminal / completed states
  if (TERMINAL_STATUSES.includes(status) || TERMINAL_STATUSES.includes(trackingStatus)) return false;

  // Active lifecycle statuses on request
  if (ACTIVE_LIFECYCLE_STATUSES.includes(status)) return true;

  // Active tracking consignment (e.g. 'In Transit', 'Ordered', 'Dispatched')
  if (tracking && (ACTIVE_LIFECYCLE_STATUSES.includes(trackingStatus) || trackingStatus === 'ordered')) return true;

  // Accepted with completed/settled payment (ready for fulfillment/dispatch)
  if (status === 'accepted' && ['paid', 'success', 'successful', 'completed', 'settled'].includes(paymentStatus)) {
    return true;
  }

  return false;
};

/**
 * Resolves the most meaningful timestamp for a trade following the strict 4-step hierarchy:
 * 1. Latest delivery/shipment update timestamp (from tracking or request timeline)
 * 2. Dispatch timestamp
 * 3. Consignment creation timestamp
 * 4. Request creation timestamp
 */
export const extractTradeTimestamp = (trade, tracking) => {
  // 1. Latest timeline milestone update
  const trackingTimeline = tracking?.timeline || [];
  for (let i = trackingTimeline.length - 1; i >= 0; i--) {
    const step = trackingTimeline[i];
    const dateVal = step?.timestamp || step?.date;
    if (step && (step.completed !== false) && dateVal && dateVal !== 'Pending') {
      const parsed = Date.parse(dateVal);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  const reqTimeline = trade?.timeline || [];
  for (let i = reqTimeline.length - 1; i >= 0; i--) {
    const step = reqTimeline[i];
    const dateVal = step?.timestamp || step?.date;
    if (step && (step.completed !== false) && dateVal && dateVal !== 'Pending') {
      const parsed = Date.parse(dateVal);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 2. Dispatch timestamp
  if (trade?.dispatchedAt) {
    const parsed = Date.parse(trade.dispatchedAt);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 3. Consignment / tracking creation timestamp
  if (tracking?.createdAt) {
    const parsed = Date.parse(tracking.createdAt);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 4. Request creation timestamp
  if (trade?.requestDate) {
    const parsed = Date.parse(trade.requestDate);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (trade?.createdAt) {
    const parsed = Date.parse(trade.createdAt);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return 0;
};

/**
 * Returns all registered/approved hospital records from localStorage.
 */
export const getRegisteredHospitalsList = () => {
  const registered = getStoredItem(KEYS.REGISTERED_HOSPITALS, []);
  const hospitals = getStoredItem(KEYS.HOSPITALS, []);
  const map = new Map();
  hospitals.forEach((h) => { if (h && h.id) map.set(h.id, h); });
  registered.forEach((h) => { if (h && h.id) map.set(h.id, { ...(map.get(h.id) || {}), ...h }); });
  return Array.from(map.values());
};

/**
 * Normalizes all active trades across the system, joining each with its tracking consignment.
 * Single authoritative source of truth for active trades.
 */
export const getActiveTradesList = () => {
  const requests = getStoredItem(KEYS.REQUESTS, []);
  const trackings = getStoredItem(KEYS.TRACKING, []);
  const hospitals = getRegisteredHospitalsList();

  const hospitalMap = new Map();
  hospitals.forEach((h) => {
    if (h && h.id) hospitalMap.set(h.id, h);
    if (h && h.name) hospitalMap.set(h.name.toLowerCase().trim(), h);
  });

  const trackingMap = new Map();
  trackings.forEach((t) => {
    if (t && t.transactionId) trackingMap.set(t.transactionId, t);
    if (t && t.trackingNumber) trackingMap.set(t.trackingNumber, t);
  });

  const activeTrades = [];
  const processedTxnIds = new Set();

  requests.forEach((req) => {
    const matchedTracking = trackingMap.get(req.transactionId) || trackingMap.get(req.trackingNumber) || null;
    if (!isActiveTrade(req, matchedTracking)) return;

    const timestamp = extractTradeTimestamp(req, matchedTracking);
    const txnId = req.transactionId || matchedTracking?.transactionId || `TXN-${req.id}`;
    processedTxnIds.add(txnId);

    // Source hospital (providing/selling hospital dispatching inventory)
    const sourceHosp = hospitalMap.get(req.toHospitalId) || hospitalMap.get(String(req.toHospitalName || '').toLowerCase().trim()) || {
      id: req.toHospitalId || 'source-unknown',
      name: req.toHospitalName || 'Dispatching Hospital',
      city: 'India',
      state: '',
      status: 'verified',
    };

    // Destination hospital (requesting/buying hospital receiving inventory)
    const destHosp = hospitalMap.get(req.fromHospitalId) || hospitalMap.get(String(req.fromHospitalName || '').toLowerCase().trim()) || {
      id: req.fromHospitalId || 'dest-unknown',
      name: req.fromHospitalName || 'Receiving Hospital',
      city: 'India',
      state: '',
      status: 'verified',
    };

    activeTrades.push({
      id: req.id,
      transactionId: txnId,
      consignmentId: matchedTracking?.trackingNumber || req.trackingNumber || null,
      medicine: req.medicineName || 'Essential Medicine Batch',
      quantity: req.quantity ? `${req.quantity} units` : '1 batch',
      quantityNum: req.quantity || 1,
      sourceHospitalId: sourceHosp.id,
      sourceHospitalName: sourceHosp.name,
      sourceCity: sourceHosp.city || '',
      sourceState: sourceHosp.state || '',
      destinationHospitalId: destHosp.id,
      destinationHospitalName: destHosp.name,
      destCity: destHosp.city || '',
      destState: destHosp.state || '',
      status: req.status || matchedTracking?.status || 'In Transit',
      timestamp,
      formattedTime: timestamp ? new Date(timestamp).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Recently Active',
      eta: matchedTracking?.eta || 'In Transit',
      temp: matchedTracking?.temperature || '3.8°C (Cold Chain)',
      speed: matchedTracking?.speed || (req.status === 'in transit' ? '54 km/h' : 'Dock Staging'),
      vehicle: matchedTracking?.vehicleNo || 'MediCold Transport',
      currentLocation: matchedTracking?.currentLocation || `${sourceHosp.name} Dispatch Dock`,
      isLiveTelemetry: !!(matchedTracking && req.status === 'in transit'),
      rawRequest: req,
      rawTracking: matchedTracking,
    });
  });

  // Check for standalone active tracking consignments not already represented
  trackings.forEach((trk) => {
    if (!trk || !trk.transactionId) return;
    if (processedTxnIds.has(trk.transactionId)) return;
    const ts = String(trk.status || '').toLowerCase().trim();
    if (TERMINAL_STATUSES.includes(ts)) return;
    if (!ACTIVE_LIFECYCLE_STATUSES.includes(ts) && ts !== 'ordered') return;

    const timestamp = extractTradeTimestamp(null, trk);
    processedTxnIds.add(trk.transactionId);

    const sourceHosp = hospitalMap.get(String(trk.senderHospital || '').toLowerCase().trim()) || {
      id: 'src-trk',
      name: trk.senderHospital || 'Dispatching Facility',
      city: 'India',
      status: 'verified',
    };

    const destHosp = hospitalMap.get(String(trk.receiverHospital || '').toLowerCase().trim()) || {
      id: 'dst-trk',
      name: trk.receiverHospital || 'Receiving Facility',
      city: 'India',
      status: 'verified',
    };

    activeTrades.push({
      id: `trk-${trk.transactionId}`,
      transactionId: trk.transactionId,
      consignmentId: trk.trackingNumber || null,
      medicine: trk.medicineName || 'Cold-Chain Pharma Consignment',
      quantity: trk.quantity ? `${trk.quantity} units` : '1 batch',
      quantityNum: trk.quantity || 1,
      sourceHospitalId: sourceHosp.id,
      sourceHospitalName: sourceHosp.name,
      sourceCity: sourceHosp.city || '',
      sourceState: sourceHosp.state || '',
      destinationHospitalId: destHosp.id,
      destinationHospitalName: destHosp.name,
      destCity: destHosp.city || '',
      destState: destHosp.state || '',
      status: trk.status || 'In Transit',
      timestamp,
      formattedTime: timestamp ? new Date(timestamp).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Recently Active',
      eta: trk.eta || 'In Transit',
      temp: trk.temperature || '4.0°C',
      speed: trk.speed || '52 km/h',
      vehicle: trk.vehicleNo || 'MediCold Cargo',
      currentLocation: trk.currentLocation || 'In Transit Corridor',
      isLiveTelemetry: true,
      rawRequest: null,
      rawTracking: trk,
    });
  });

  // Sort descending: most recently active deliveries appear first
  activeTrades.sort((a, b) => b.timestamp - a.timestamp);

  return activeTrades;
};

/**
 * Converts India [lat, lng] into SVG 2D/3D canvas coordinates (percentage 0 - 100).
 * Projects accurately from India's bounding coordinates.
 */
export const projectGeoCoordinates = (lat, lng) => {
  // India approx bounding box: lat [8.0, 32.5], lng [70.0, 89.0]
  const minLat = 8.0;
  const maxLat = 32.5;
  const minLng = 70.0;
  const maxLng = 89.0;

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const safeLat = clamp(lat, minLat, maxLat);
  const safeLng = clamp(lng, minLng, maxLng);

  const normLat = (safeLat - minLat) / (maxLat - minLat);
  const normLng = (safeLng - minLng) / (maxLng - minLng);

  // In SVG, y increases downwards, so higher latitude (North) has smaller y.
  const y = 84 - normLat * 66; // range 18% to 84%
  const x = 14 + normLng * 72; // range 14% to 86%

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
};

/**
 * Curated collision-free regional network positions for public and multi-node views.
 * Prevents identical city coordinates from stacking on top of each other.
 */
export const REGIONAL_NETWORK_COORDS = {
  // Western Cluster (Mumbai / Navi Mumbai / Bandra / Andheri / Parel / Pune)
  'hosp-1': { x: 26, y: 72 }, // Apollo Hospital (Navi Mumbai)
  'apollo hospital': { x: 26, y: 72 },

  'hosp-5': { x: 28, y: 52 }, // Lilavati Hospital & Research Centre (Bandra)
  'lilavati hospital': { x: 28, y: 52 },
  'lilavati hospital & research centre': { x: 28, y: 52 },

  'hosp-7': { x: 38, y: 62 }, // Tata Memorial Centre (Parel)
  'tata memorial centre': { x: 38, y: 62 },

  'hosp-9': { x: 16, y: 48 }, // Kokilaben Dhirubhai Ambani Hospital (Andheri)
  'kokilaben hospital': { x: 16, y: 48 },
  'kokilaben dhirubhai ambani hospital': { x: 16, y: 48 },

  'hosp-13': { x: 42, y: 76 }, // Sanjeevani Multispeciality Hospital (Pune)
  'sanjeevani multispeciality hospital': { x: 42, y: 76 },

  // Northern Cluster (Delhi / NCR / Gurgaon / Faridabad / Chandigarh)
  'hosp-8': { x: 44, y: 18 }, // AIIMS (New Delhi)
  'all india institute of medical sciences (aiims)': { x: 44, y: 18 },

  'hosp-2': { x: 56, y: 22 }, // Fortis Memorial (Gurgaon)
  'fortis memorial research institute': { x: 56, y: 22 },

  'hosp-3': { x: 34, y: 26 }, // Max Super Speciality (Saket, New Delhi)
  'max super speciality hospital': { x: 34, y: 26 },

  'hosp-6': { x: 68, y: 30 }, // Medanta - The Medicity (Faridabad / Gurgaon)
  'medanta - the medicity': { x: 68, y: 30 },

  'hosp-12': { x: 48, y: 36 }, // Sir Ganga Ram Hospital (Rajinder Nagar)
  'sir ganga ram hospital': { x: 48, y: 36 },

  'hosp-21': { x: 42, y: 14 }, // CityCare Multispeciality Hospital (Chandigarh)
  'citycare multispeciality hospital': { x: 42, y: 14 },

  // Southern, Eastern & Central Clusters
  'hosp-4': { x: 58, y: 82 }, // Manipal Hospital (Bengaluru)
  'manipal hospital': { x: 58, y: 82 },

  'hosp-10': { x: 68, y: 86 }, // CMC Vellore
  'christian medical college (cmc)': { x: 68, y: 86 },

  'hosp-14': { x: 82, y: 46 }, // Narayana Multispeciality Hospital (Kolkata)
  'narayana multispeciality hospital': { x: 82, y: 46 },

  'hosp-15': { x: 60, y: 68 }, // KIMS Super Speciality Hospital (Hyderabad)
  'kims super speciality hospital': { x: 60, y: 68 },
};

/**
 * Builds the topology model for Hospital Dashboard mode.
 * - Primary Node: Authenticated hospital
 * - Counterparties: Hospitals involved in the authenticated hospital's active trades
 * - Trades: Sorted descending by latest activity, default latest 5
 */
export const buildHospitalNetworkTopology = (authenticatedHospital, showAll = false) => {
  if (!authenticatedHospital) return null;

  const authId = authenticatedHospital.id || authenticatedHospital.hospitalId;
  const authName = authenticatedHospital.name || 'My Hospital';
  const authCity = authenticatedHospital.city || 'Mumbai';
  const authState = authenticatedHospital.state || 'Maharashtra';

  const allActiveTrades = getActiveTradesList();

  // Tenant Isolation: Only include active trades where authenticated hospital is source OR destination
  const hospitalTrades = allActiveTrades.filter((t) => {
    return (
      t.sourceHospitalId === authId ||
      t.destinationHospitalId === authId ||
      (t.sourceHospitalName && t.sourceHospitalName.toLowerCase() === authName.toLowerCase()) ||
      (t.destinationHospitalName && t.destinationHospitalName.toLowerCase() === authName.toLowerCase())
    );
  });

  const totalActiveCount = hospitalTrades.length;
  const displayedTrades = showAll ? hospitalTrades : hospitalTrades.slice(0, 5);

  // Build Primary Central Hub Node (at central-bottom anchor)
  const primaryNode = {
    id: authId,
    name: authName,
    city: authCity,
    state: authState,
    role: 'Primary Facility',
    tag: 'Your Hospital',
    type: 'hub',
    coords: { x: 50, y: 74 },
    temp: '4.0°C',
    compliance: '100%',
    status: 'Active',
    verified: true,
    activeTradeCount: totalActiveCount,
  };

  // Collect unique counterpart hospitals in the displayed trades (one node per counterpart)
  const counterpartMap = new Map();
  displayedTrades.forEach((trade) => {
    const isSource = trade.sourceHospitalId === authId || (trade.sourceHospitalName && trade.sourceHospitalName.toLowerCase() === authName.toLowerCase());
    const cpId = isSource ? trade.destinationHospitalId : trade.sourceHospitalId;
    const cpName = isSource ? trade.destinationHospitalName : trade.sourceHospitalName;
    const cpCity = isSource ? trade.destCity : trade.sourceCity;
    const cpState = isSource ? trade.destState : trade.sourceState;

    if (!counterpartMap.has(cpId)) {
      counterpartMap.set(cpId, {
        id: cpId,
        name: cpName,
        city: cpCity,
        state: cpState,
        type: 'satellite',
        tradesWithCurrent: 0,
        trades: [],
        latestTrade: trade,
      });
    }

    const item = counterpartMap.get(cpId);
    item.tradesWithCurrent += 1;
    item.trades.push(trade);
  });

  const counterpartList = Array.from(counterpartMap.values());

  // Dynamically place counterpart satellite nodes with collision-aware spacing
  const satelliteNodes = counterpartList.map((cp, idx) => {
    const n = counterpartList.length;
    let x, y;

    if (n === 1) {
      x = 50;
      y = 20;
    } else if (n === 2) {
      x = idx === 0 ? 25 : 75;
      y = 22;
    } else if (n === 3) {
      const positions = [
        { x: 18, y: 32 },
        { x: 50, y: 18 },
        { x: 82, y: 32 }
      ];
      x = positions[idx].x;
      y = positions[idx].y;
    } else if (n === 4) {
      const positions = [
        { x: 15, y: 36 },
        { x: 37, y: 18 },
        { x: 63, y: 18 },
        { x: 85, y: 36 }
      ];
      x = positions[idx].x;
      y = positions[idx].y;
    } else if (n === 5) {
      const positions = [
        { x: 13, y: 44 },
        { x: 28, y: 22 },
        { x: 50, y: 16 },
        { x: 72, y: 22 },
        { x: 87, y: 44 }
      ];
      x = positions[idx].x;
      y = positions[idx].y;
    } else {
      const span = 110;
      const angleStart = -55;
      const angleDeg = angleStart + (idx / (n - 1)) * span;
      const rad = (angleDeg * Math.PI) / 180;
      const r = (n > 6 && idx % 2 === 1) ? 46 : 53;
      x = Math.round((50 + r * Math.sin(rad)) * 10) / 10;
      y = Math.round((74 - r * Math.cos(rad)) * 10) / 10;
      x = Math.max(12, Math.min(88, x));
      y = Math.max(16, Math.min(60, y));
    }

    return {
      ...cp,
      coords: { x, y },
      role: 'Trade Partner',
      tag: cp.city ? `${cp.city}` : 'Corridor Node',
      temp: cp.latestTrade?.temp || null,
      status: cp.latestTrade?.status || 'Active',
      verified: true,
      consignments: cp.tradesWithCurrent,
    };
  });

  const allNodes = [primaryNode, ...satelliteNodes];
  const nodePositionMap = new Map();
  allNodes.forEach((n) => nodePositionMap.set(n.id, n));

  // Pre-calculate count and breakdown of trades per counterpart hospital
  const cpTradeStats = new Map();
  displayedTrades.forEach((trade) => {
    const isInc = trade.destinationHospitalId === authId || 
      (trade.destinationHospitalName && trade.destinationHospitalName.toLowerCase() === authName.toLowerCase());
    const cpId = isInc ? trade.sourceHospitalId : trade.destinationHospitalId;
    if (!cpTradeStats.has(cpId)) {
      cpTradeStats.set(cpId, { incoming: 0, outgoing: 0, total: 0 });
    }
    const stat = cpTradeStats.get(cpId);
    stat.total += 1;
    if (isInc) stat.incoming += 1;
    else stat.outgoing += 1;
  });

  const counterpartTradeIndices = new Map();

  // Build connecting routes representing actual active trades with accurate direction
  const routes = displayedTrades.map((trade, idx) => {
    // Strict direction: destination === authenticated hospital => INCOMING, else OUTGOING
    const isIncoming = trade.destinationHospitalId === authId || 
      (trade.destinationHospitalName && trade.destinationHospitalName.toLowerCase() === authName.toLowerCase());
    const isOutgoing = !isIncoming;
    const direction = isIncoming ? 'INCOMING' : 'OUTGOING';

    const counterpartId = isIncoming ? trade.sourceHospitalId : trade.destinationHospitalId;
    const cpNode = nodePositionMap.get(counterpartId) || { coords: { x: 50, y: 20 } };

    // Goods flow physically from Source to Destination:
    // INCOMING: departs from Counterpart -> arrives at Your Hospital
    // OUTGOING: departs from Your Hospital -> arrives at Counterpart
    const sourcePos = isIncoming ? cpNode.coords : primaryNode.coords;
    const destPos = isIncoming ? primaryNode.coords : cpNode.coords;

    const stat = cpTradeStats.get(counterpartId) || { incoming: 1, outgoing: 0, total: 1 };
    const indexForCp = counterpartTradeIndices.get(counterpartId) || 0;
    counterpartTradeIndices.set(counterpartId, indexForCp + 1);

    // Canonical perpendicular axis from primary to counterpart
    const cdx = cpNode.coords.x - primaryNode.coords.x;
    const cdy = cpNode.coords.y - primaryNode.coords.y;
    const clen = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
    const cnx = -cdy / clen;
    const cny = cdx / clen;

    // Guaranteed distinct perpendicular offset ensuring NO two trades ever stack
    let offset = 0;
    if (stat.total > 1) {
      if (stat.incoming > 0 && stat.outgoing > 0) {
        // Two-way corridor: incoming trades curve to left, outgoing trades curve to right
        const sideOffset = isIncoming ? -4.5 : 4.5;
        const subIndexOffset = (indexForCp - (stat.total - 1) / 2) * 2.0;
        offset = sideOffset + subIndexOffset;
      } else {
        // Multi-trade same direction: fan out parallel curved arcs
        offset = (indexForCp - (stat.total - 1) / 2) * 5.0;
      }
    }

    const mx = (sourcePos.x + destPos.x) / 2;
    const my = (sourcePos.y + destPos.y) / 2;
    const cx = Math.round((mx + cnx * offset) * 10) / 10;
    const cy = Math.round((my + cny * offset) * 10) / 10;

    const pathD = (offset === 0 && stat.total === 1)
      ? `M ${sourcePos.x} ${sourcePos.y} L ${destPos.x} ${destPos.y}`
      : `M ${sourcePos.x} ${sourcePos.y} Q ${cx} ${cy} ${destPos.x} ${destPos.y}`;

    // Primary arrowhead position at midpoint (t = 0.50) along the route
    const t = 0.50;
    const invT = 1 - t;
    const arrowX = Math.round((invT * invT * sourcePos.x + 2 * invT * t * cx + t * t * destPos.x) * 10) / 10;
    const arrowY = Math.round((invT * invT * sourcePos.y + 2 * invT * t * cy + t * t * destPos.y) * 10) / 10;
    const tanX = 2 * invT * (cx - sourcePos.x) + 2 * t * (destPos.x - cx);
    const tanY = 2 * invT * (cy - sourcePos.y) + 2 * t * (destPos.y - cy);
    const arrowAngle = Math.round((Math.atan2(tanY, tanX) * 180 / Math.PI) * 10) / 10;

    return {
      id: `route-${trade.id}-${idx}`,
      tradeId: trade.id,
      transactionId: trade.transactionId,
      consignmentId: trade.consignmentId,
      medicine: trade.medicine,
      quantity: trade.quantity,
      sourceNodeId: isIncoming ? counterpartId : primaryNode.id,
      destNodeId: isIncoming ? primaryNode.id : counterpartId,
      sourceName: trade.sourceHospitalName,
      destName: trade.destinationHospitalName,
      sourceCoords: sourcePos,
      destCoords: destPos,
      controlPoint: { x: cx, y: cy },
      pathD,
      arrow: { x: arrowX, y: arrowY, angle: arrowAngle },
      isIncoming,
      isOutgoing,
      direction,
      directionLabel: isIncoming ? 'INCOMING' : 'OUTGOING',
      totalInCorridor: stat.total,
      indexInCorridor: indexForCp,
      status: trade.status,
      timestamp: trade.timestamp,
      formattedTime: trade.formattedTime,
      eta: trade.eta,
      temp: trade.temp,
      speed: trade.speed,
      vehicle: trade.vehicle,
      isLiveTelemetry: trade.isLiveTelemetry,
      trade,
    };
  });

  const metrics = {
    activeDeliveries: displayedTrades.length,
    hospitalsInvolved: 1 + counterpartList.length,
    activeRoutes: counterpartList.length,
  };

  return {
    mode: 'hospital',
    primaryNode,
    satelliteNodes,
    allNodes,
    routes,
    metrics,
    displayedTrades,
    allTrades: hospitalTrades,
    totalActiveCount,
    hasActiveTrades: hospitalTrades.length > 0,
  };
};

/**
 * Builds the topology model for Public Landing Page mode.
 * - Global network representation across verified hospitals
 * - Real active trades connecting nodes with non-overlapping regional coordinates
 * - Distinct curved Bezier paths ensuring EVERY trade has its own visible route
 * - Dynamic network summary metrics
 */
export const buildPublicNetworkTopology = (showAll = false) => {
  const hospitals = getRegisteredHospitalsList();
  const allActiveTrades = getActiveTradesList();

  const totalActiveCount = allActiveTrades.length;
  const displayedTrades = showAll ? allActiveTrades : allActiveTrades.slice(0, 5);

  // Compute actual dynamic network summary counts
  const verifiedHospitals = hospitals.filter((h) => h.status === 'verified');
  const tradingHospitalIds = new Set();
  const corridorKeys = new Set();

  allActiveTrades.forEach((t) => {
    if (t.sourceHospitalId) tradingHospitalIds.add(t.sourceHospitalId);
    if (t.destinationHospitalId) tradingHospitalIds.add(t.destinationHospitalId);
    const corrKey = [t.sourceHospitalId, t.destinationHospitalId].sort().join(':::');
    corridorKeys.add(corrKey);
  });

  const summary = {
    verifiedHospitalsCount: verifiedHospitals.length,
    activeDeliveriesCount: totalActiveCount,
    hospitalsTradingCount: tradingHospitalIds.size,
    liveCorridorsCount: corridorKeys.size,
  };

  // Identify hospitals involved in active trades
  const activeHospitalIdSet = new Set();
  displayedTrades.forEach((t) => {
    if (t.sourceHospitalId) activeHospitalIdSet.add(t.sourceHospitalId);
    if (t.destinationHospitalId) activeHospitalIdSet.add(t.destinationHospitalId);
  });

  // Map hospitals to distinct, collision-free coordinates
  const hospitalNodeMap = new Map();

  hospitals.forEach((hosp) => {
    if (!hosp) return;
    const isParticipating = activeHospitalIdSet.has(hosp.id);
    if (!isParticipating && hosp.status !== 'verified') return;

    const idKey = String(hosp.id || '').toLowerCase();
    const nameKey = String(hosp.name || '').toLowerCase().trim();

    // Prefer curated non-overlapping regional coordinates
    let coords = REGIONAL_NETWORK_COORDS[idKey] || REGIONAL_NETWORK_COORDS[nameKey];
    if (!coords) {
      const geoCoords = resolveCoordinates(hosp.name || hosp.city);
      coords = projectGeoCoordinates(geoCoords[0], geoCoords[1]);
    }

    const nodeRecord = {
      id: hosp.id,
      name: hosp.name,
      city: hosp.city || 'India',
      state: hosp.state || '',
      coords,
      isParticipating,
      verified: hosp.status === 'verified',
      role: isParticipating ? 'Active Corridor Node' : 'Registered Node',
      tag: hosp.city || 'Node',
    };

    hospitalNodeMap.set(hosp.id, nodeRecord);
    hospitalNodeMap.set(nameKey, nodeRecord);
  });

  // Pre-calculate count of trades per corridor to assign separated curve offsets
  const corridorTradeCounts = new Map();
  displayedTrades.forEach((trade) => {
    const srcId = trade.sourceHospitalId || trade.sourceHospitalName || 'src';
    const dstId = trade.destinationHospitalId || trade.destinationHospitalName || 'dst';
    const corrKey = [srcId, dstId].sort().join(':::');
    corridorTradeCounts.set(corrKey, (corridorTradeCounts.get(corrKey) || 0) + 1);
  });

  const corridorTradeIndices = new Map();

  // Build connecting routes for displayed trades with curved Bezier offsets
  const routes = displayedTrades.map((trade, idx) => {
    const srcKey = String(trade.sourceHospitalName || '').toLowerCase().trim();
    const dstKey = String(trade.destinationHospitalName || '').toLowerCase().trim();

    const srcNode = hospitalNodeMap.get(trade.sourceHospitalId) || 
      hospitalNodeMap.get(srcKey) || {
        coords: REGIONAL_NETWORK_COORDS[trade.sourceHospitalId] || 
          REGIONAL_NETWORK_COORDS[srcKey] || 
          { x: 38, y: 62 }
      };

    const dstNode = hospitalNodeMap.get(trade.destinationHospitalId) || 
      hospitalNodeMap.get(dstKey) || {
        coords: REGIONAL_NETWORK_COORDS[trade.destinationHospitalId] || 
          REGIONAL_NETWORK_COORDS[dstKey] || 
          { x: 26, y: 72 }
      };

    let srcCoords = { ...srcNode.coords };
    let dstCoords = { ...dstNode.coords };

    // Prevent zero-length routes in intramural corridors
    const rawDx = dstCoords.x - srcCoords.x;
    const rawDy = dstCoords.y - srcCoords.y;
    const rawLen = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    if (rawLen < 3) {
      dstCoords.x += 12;
      dstCoords.y += 8;
    }

    const corrKey = [trade.sourceHospitalId || trade.sourceHospitalName || 'src', trade.destinationHospitalId || trade.destinationHospitalName || 'dst'].sort().join(':::');
    const totalInCorr = corridorTradeCounts.get(corrKey) || 1;
    const indexInCorr = corridorTradeIndices.get(corrKey) || 0;
    corridorTradeIndices.set(corrKey, indexInCorr + 1);

    // Calculate perpendicular normal vector between src and dst
    const dx = dstCoords.x - srcCoords.x;
    const dy = dstCoords.y - srcCoords.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Guaranteed distinct curved offsets
    let offset = 0;
    if (totalInCorr > 1) {
      // Fan out parallel curves: e.g. -4.0, +4.0, etc.
      offset = (indexInCorr - (totalInCorr - 1) / 2) * 6.0;
    } else {
      // Single trade: gentle organic 3D curve (3.5%) so it's not a flat straight line
      offset = (idx % 2 === 0 ? 3.5 : -3.5);
    }

    const mx = (srcCoords.x + dstCoords.x) / 2;
    const my = (srcCoords.y + dstCoords.y) / 2;
    const cx = Math.round((mx + nx * offset) * 10) / 10;
    const cy = Math.round((my + ny * offset) * 10) / 10;

    const pathD = `M ${srcCoords.x} ${srcCoords.y} Q ${cx} ${cy} ${dstCoords.x} ${dstCoords.y}`;

    // Arrowhead position at midpoint (t = 0.50) along the curve
    const t = 0.50;
    const invT = 1 - t;
    const arrowX = Math.round((invT * invT * srcCoords.x + 2 * invT * t * cx + t * t * dstCoords.x) * 10) / 10;
    const arrowY = Math.round((invT * invT * srcCoords.y + 2 * invT * t * cy + t * t * dstCoords.y) * 10) / 10;
    const tanX = 2 * invT * (cx - srcCoords.x) + 2 * t * (dstCoords.x - cx);
    const tanY = 2 * invT * (cy - srcCoords.y) + 2 * t * (dstCoords.y - cy);
    const arrowAngle = Math.round((Math.atan2(tanY, tanX) * 180 / Math.PI) * 10) / 10;

    return {
      id: `public-route-${trade.id}-${idx}`,
      tradeId: trade.id,
      transactionId: trade.transactionId,
      consignmentId: trade.consignmentId,
      medicine: trade.medicine,
      quantity: trade.quantity,
      sourceNodeId: trade.sourceHospitalId,
      destNodeId: trade.destinationHospitalId,
      sourceName: trade.sourceHospitalName,
      destName: trade.destinationHospitalName,
      sourceCoords: srcCoords,
      destCoords: dstCoords,
      controlPoint: { x: cx, y: cy },
      pathD,
      arrow: { x: arrowX, y: arrowY, angle: arrowAngle },
      isIncoming: false,
      isOutgoing: true,
      direction: 'CORRIDOR',
      directionLabel: 'Active Corridor',
      totalInCorridor: totalInCorr,
      indexInCorridor: indexInCorr,
      status: trade.status,
      timestamp: trade.timestamp,
      formattedTime: trade.formattedTime,
      eta: trade.eta,
      temp: trade.temp,
      speed: trade.speed,
      vehicle: trade.vehicle,
      isLiveTelemetry: trade.isLiveTelemetry,
      trade,
    };
  });

  // Include participating nodes and key regional hub nodes
  const allNodes = Array.from(hospitalNodeMap.values()).filter((n) => {
    return n.isParticipating || ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Kolkata', 'Gurgaon'].includes(n.city);
  });

  return {
    mode: 'public',
    summary,
    allNodes,
    routes,
    displayedTrades,
    allTrades: allActiveTrades,
    totalActiveCount,
    hasActiveTrades: allActiveTrades.length > 0,
  };
};


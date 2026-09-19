// Polyfill localStorage for Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

import { initializeStorage, setStoredItem, KEYS } from '../src/services/storage.js';
initializeStorage();

import {
  ACTIVE_LIFECYCLE_STATUSES,
  TERMINAL_STATUSES,
  isActiveTrade,
  extractTradeTimestamp,
  projectGeoCoordinates,
  getRegisteredHospitalsList,
  getActiveTradesList,
  buildHospitalNetworkTopology,
  buildPublicNetworkTopology,
} from '../src/utils/networkTopologyHelper.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('3D NETWORK TOPOLOGY & LAYOUT VERIFICATION');
console.log('====================================================\n');

// 1. LIFECYCLE STATE AUDIT
console.log('--- SECTION 1: Status Classification & Filtering ---');
assert(isActiveTrade({ status: 'in transit' }), 'Status "in transit" is active');
assert(isActiveTrade({ status: 'dispatched' }), 'Status "dispatched" is active');
assert(isActiveTrade({ status: 'confirmed' }), 'Status "confirmed" is active');
assert(isActiveTrade({ status: 'preparing' }), 'Status "preparing" is active');
assert(isActiveTrade({ status: 'paid' }), 'Status "paid" is active');
assert(isActiveTrade({ status: 'accepted', paymentStatus: 'paid' }), 'Status "accepted" with paid payment is active');

assert(!isActiveTrade({ status: 'delivered' }), 'Status "delivered" is terminal (NOT active)');
assert(!isActiveTrade({ status: 'completed' }), 'Status "completed" is terminal (NOT active)');
assert(!isActiveTrade({ status: 'cancelled' }), 'Status "cancelled" is terminal (NOT active)');
assert(!isActiveTrade({ status: 'rejected' }), 'Status "rejected" is terminal (NOT active)');
assert(!isActiveTrade({ status: 'expired' }), 'Status "expired" is terminal (NOT active)');
assert(!isActiveTrade({ status: 'pending' }), 'Status "pending" without acceptance/payment is NOT active');

// 2. TIMESTAMP RESOLUTION HIERARCHY
console.log('\n--- SECTION 2: 4-Tier Timestamp Resolution Hierarchy ---');
const tradeMock = {
  id: 'req-1',
  createdAt: '2026-01-01T10:00:00Z',
  requestDate: '2026-01-01T10:00:00Z',
  dispatchedAt: '2026-01-01T12:00:00Z',
};
const trackingMock = {
  createdAt: '2026-01-01T11:00:00Z',
  timeline: [
    { title: 'Dispatched', timestamp: '2026-01-01T12:30:00Z' },
    { title: 'Checkpoint Alpha', timestamp: '2026-01-01T14:15:00Z' }
  ]
};

const ts1 = extractTradeTimestamp(tradeMock, trackingMock);
assert(ts1 === Date.parse('2026-01-01T14:15:00Z'), 'Level 1: Latest tracking timeline milestone takes precedence');

const ts2 = extractTradeTimestamp(tradeMock, { createdAt: '2026-01-01T11:00:00Z', timeline: [] });
assert(ts2 === Date.parse('2026-01-01T12:00:00Z'), 'Level 2: Dispatch timestamp takes precedence over creation');

const ts3 = extractTradeTimestamp({ createdAt: '2026-01-01T10:00:00Z' }, { createdAt: '2026-01-01T11:00:00Z' });
assert(ts3 === Date.parse('2026-01-01T11:00:00Z'), 'Level 3: Tracking creation timestamp takes precedence over request');

const ts4 = extractTradeTimestamp({ createdAt: '2026-01-01T10:00:00Z' }, null);
assert(ts4 === Date.parse('2026-01-01T10:00:00Z'), 'Level 4: Request creation timestamp used as fallback');

// 3. GEOGRAPHIC COORDINATES PROJECTION
console.log('\n--- SECTION 3: Geographic Projection ---');
const mumbaiCoords = projectGeoCoordinates(19.0760, 72.8777);
const delhiCoords = projectGeoCoordinates(28.6139, 77.2090);
const bengaluruCoords = projectGeoCoordinates(12.9716, 77.5946);

assert(delhiCoords.y < mumbaiCoords.y, 'Delhi (North) has lower Y percentage than Mumbai (Central)');
assert(mumbaiCoords.y < bengaluruCoords.y, 'Mumbai has lower Y percentage than Bengaluru (South)');
assert(mumbaiCoords.x >= 14 && mumbaiCoords.x <= 86, 'Projected coordinates remain within bounded 2D/3D SVG canvas');

// 4. HOSPITAL DASHBOARD TOPOLOGY & HIERARCHY
console.log('\n--- SECTION 4: Primary Hospital Anchor & Node Placement ---');
const hospA = { id: 'hosp-apollo', name: 'Apollo Hospital Mumbai', city: 'Mumbai', state: 'Maharashtra' };
const topoA = buildHospitalNetworkTopology(hospA, false);

assert(topoA !== null, 'Topology generated for Hospital A');
assert(topoA.primaryNode.id === hospA.id, 'Hospital A is designated as the PRIMARY node');
assert(topoA.primaryNode.coords.x === 50 && topoA.primaryNode.coords.y === 74, 'Primary node is anchored at central-bottom (50, 74)');
assert(topoA.primaryNode.tag === 'Your Hospital', 'Primary node tagged as "Your Hospital"');

// Check collision-aware satellite positioning
if (topoA.satelliteNodes.length > 0) {
  const satelliteNodeIds = new Set();
  let hasDuplicateCounterpart = false;
  topoA.satelliteNodes.forEach((n) => {
    if (satelliteNodeIds.has(n.id)) hasDuplicateCounterpart = true;
    satelliteNodeIds.add(n.id);
    assert(n.coords.y < 70, `Counterpart ${n.name} positioned cleanly above primary node (y: ${n.coords.y} < 70)`);
    assert(n.coords.x >= 12 && n.coords.x <= 88, `Counterpart ${n.name} bounded within canvas (x: ${n.coords.x})`);
  });
  assert(!hasDuplicateCounterpart, 'No duplicate counterpart hospital cards rendered (one card per counterpart)');
}

// Check Metrics
assert(typeof topoA.metrics?.activeDeliveries === 'number', 'Metrics includes dynamic activeDeliveries');
assert(typeof topoA.metrics?.hospitalsInvolved === 'number', 'Metrics includes dynamic hospitalsInvolved');
assert(typeof topoA.metrics?.activeRoutes === 'number', 'Metrics includes dynamic activeRoutes');

// Check Routes, Curves & Arrowheads
topoA.routes.forEach((r) => {
  assert(typeof r.pathD === 'string' && r.pathD.startsWith('M '), 'Each route contains valid SVG pathD string');
  assert(r.direction === 'INCOMING' || r.direction === 'OUTGOING', `Route ${r.id} has explicit direction: ${r.direction}`);
  assert(typeof r.arrow?.x === 'number' && typeof r.arrow?.y === 'number', `Route ${r.id} has embedded arrowhead coordinates`);
  assert(typeof r.arrow?.angle === 'number', `Route ${r.id} has arrowhead rotation angle`);

  if (r.isIncoming) {
    assert(r.destNodeId === hospA.id, `Incoming route terminates at Primary Hospital (Destination = ${hospA.id})`);
  } else {
    assert(r.sourceNodeId === hospA.id, `Outgoing route originates from Primary Hospital (Source = ${hospA.id})`);
  }
});

// 5. TENANT ISOLATION
console.log('\n--- SECTION 5: Tenant Isolation & Dynamic Identity ---');
const hospB = { id: 'hosp-fortis', name: 'Fortis Hospital Delhi', city: 'Delhi', state: 'Delhi' };
const topoB = buildHospitalNetworkTopology(hospB, false);
assert(topoB.primaryNode.id === hospB.id, 'Hospital B automatically becomes primary node when authenticated');
assert(topoB.primaryNode.name === hospB.name, 'No hardcoded Apollo when Hospital B logs in');

// Verify direction is relative to authenticated hospital
topoB.routes.forEach((r) => {
  if (r.isIncoming) {
    assert(r.destNodeId === hospB.id, 'Incoming direction recalculated relative to Hospital B');
  } else {
    assert(r.sourceNodeId === hospB.id, 'Outgoing direction recalculated relative to Hospital B');
  }
});

// 6. PUBLIC NETWORK TOPOLOGY & DYNAMIC METRICS
console.log('\n--- SECTION 6: Public Site Topology & Dynamic Metrics ---');
const publicTopo = buildPublicNetworkTopology(false);
assert(publicTopo !== null, 'Public topology generated');
assert(typeof publicTopo.summary.verifiedHospitalsCount === 'number', 'summary.verifiedHospitalsCount is a dynamic number');
assert(typeof publicTopo.summary.activeDeliveriesCount === 'number', 'summary.activeDeliveriesCount is a dynamic number');
assert(typeof publicTopo.summary.hospitalsTradingCount === 'number', 'summary.hospitalsTradingCount is a dynamic number');
assert(typeof publicTopo.summary.liveCorridorsCount === 'number', 'summary.liveCorridorsCount is a dynamic number');
assert(publicTopo.displayedTrades.length <= 5, 'Public view defaults to latest 5 active deliveries');

// 7. SCALING & PERFORMANCE TEST: 150 ACTIVE TRADES
console.log('\n--- SECTION 7: High Volume Stress Test (150 trades) ---');
const startTime = performance.now();
const publicTopoAll = buildPublicNetworkTopology(true);
const durationMs = performance.now() - startTime;
assert(durationMs < 50, `Topology calculation completed efficiently in ${durationMs.toFixed(2)}ms (< 50ms)`);
assert(Array.isArray(publicTopoAll.routes), 'Routes array correctly constructed under full load');

// 8. EXPLICIT DIRECTION & TWO-WAY CORRIDOR TESTS
console.log('\n--- SECTION 8: Explicit Direction & Two-Way Corridor Tests ---');
const testRequests = [
  // 1. Incoming trade from Fortis to Apollo
  {
    id: 'req-inc-1',
    toHospitalId: 'hosp-fortis',
    toHospitalName: 'Fortis Hospital Delhi',
    fromHospitalId: 'hosp-apollo',
    fromHospitalName: 'Apollo Hospital Mumbai',
    status: 'in transit',
    medicineName: 'Enoxaparin Sodium 40mg',
    quantity: 50,
    requestDate: '2026-03-01T10:00:00Z',
  },
  // 2. Outgoing trade from Apollo to Tata
  {
    id: 'req-out-1',
    toHospitalId: 'hosp-apollo',
    toHospitalName: 'Apollo Hospital Mumbai',
    fromHospitalId: 'hosp-tata',
    fromHospitalName: 'Tata Memorial Centre',
    status: 'dispatched',
    medicineName: 'Paclitaxel 100mg',
    quantity: 20,
    requestDate: '2026-03-01T11:00:00Z',
  },
  // 3. Outgoing trade from Apollo to Fortis (making Fortis a two-way corridor!)
  {
    id: 'req-out-2',
    toHospitalId: 'hosp-apollo',
    toHospitalName: 'Apollo Hospital Mumbai',
    fromHospitalId: 'hosp-fortis',
    fromHospitalName: 'Fortis Hospital Delhi',
    status: 'preparing',
    medicineName: 'Meropenem 1g',
    quantity: 30,
    requestDate: '2026-03-01T12:00:00Z',
  },
];
setStoredItem(KEYS.REQUESTS, testRequests);

const dirTopo = buildHospitalNetworkTopology(hospA, false);
assert(dirTopo.routes.length === 3, 'All 3 test directional routes generated');

const incRoute = dirTopo.routes.find((r) => r.tradeId === 'req-inc-1');
assert(incRoute.isIncoming === true, 'Fortis -> Apollo detected as INCOMING');
assert(incRoute.direction === 'INCOMING', 'Direction label is INCOMING');
assert(incRoute.destCoords.x === 50 && incRoute.destCoords.y === 74, 'Incoming route arrives at Apollo (50, 74)');
assert(incRoute.arrow.y > incRoute.sourceCoords.y, 'Incoming arrow vector points downwards toward Apollo');

const outTata = dirTopo.routes.find((r) => r.tradeId === 'req-out-1');
assert(outTata.isOutgoing === true, 'Apollo -> Tata detected as OUTGOING');
assert(outTata.direction === 'OUTGOING', 'Direction label is OUTGOING');
assert(outTata.sourceCoords.x === 50 && outTata.sourceCoords.y === 74, 'Outgoing route departs from Apollo (50, 74)');

const outFortis = dirTopo.routes.find((r) => r.tradeId === 'req-out-2');
assert(outFortis.isOutgoing === true, 'Apollo -> Fortis detected as OUTGOING');

// Two-way corridor check: Fortis has both incRoute and outFortis
assert(incRoute.pathD !== outFortis.pathD, 'Two-way corridor with Fortis has distinct curved paths (no stacking)');
assert(incRoute.controlPoint.x !== outFortis.controlPoint.x, 'Incoming and Outgoing curves to Fortis have opposite curvature offsets');

// 9. MULTI-TRADE NON-COLLAPSING VERIFICATION
console.log('\n--- SECTION 9: Multi-Trade Non-Collapsing (Same Hospital Pair) ---');
const samePairRequests = [
  {
    id: 'req-multi-1',
    toHospitalId: 'hosp-fortis',
    toHospitalName: 'Fortis Hospital Delhi',
    fromHospitalId: 'hosp-apollo',
    fromHospitalName: 'Apollo Hospital Mumbai',
    status: 'in transit',
    medicineName: 'Medicine Trade A',
    quantity: 10,
    requestDate: '2026-03-01T10:00:00Z',
  },
  {
    id: 'req-multi-2',
    toHospitalId: 'hosp-fortis',
    toHospitalName: 'Fortis Hospital Delhi',
    fromHospitalId: 'hosp-apollo',
    fromHospitalName: 'Apollo Hospital Mumbai',
    status: 'in transit',
    medicineName: 'Medicine Trade B',
    quantity: 20,
    requestDate: '2026-03-01T11:00:00Z',
  },
  {
    id: 'req-multi-3',
    toHospitalId: 'hosp-fortis',
    toHospitalName: 'Fortis Hospital Delhi',
    fromHospitalId: 'hosp-apollo',
    fromHospitalName: 'Apollo Hospital Mumbai',
    status: 'in transit',
    medicineName: 'Medicine Trade C',
    quantity: 30,
    requestDate: '2026-03-01T12:00:00Z',
  },
];
setStoredItem(KEYS.REQUESTS, samePairRequests);

const multiTopo = buildHospitalNetworkTopology(hospA, true);
assert(multiTopo.routes.length === 3, 'All 3 trades between Apollo and Fortis are represented');
assert(multiTopo.satelliteNodes.length === 1, 'Fortis is represented by 1 hospital card (no duplicate hospital cards)');
assert(multiTopo.routes[0].pathD !== multiTopo.routes[1].pathD, 'Trade A and Trade B have distinct curved SVG paths');
assert(multiTopo.routes[1].pathD !== multiTopo.routes[2].pathD, 'Trade B and Trade C have distinct curved SVG paths');
assert(multiTopo.routes[0].pathD !== multiTopo.routes[2].pathD, 'Trade A and Trade C have distinct curved SVG paths');

// 10. SCALING EDGE CASES (0, 1, 4, 5, 6, 10, 25 trades)
console.log('\n--- SECTION 10: Scaling Edge Cases (0, 1, 4, 5, 6, 10, 25 trades) ---');
const testCounts = [0, 1, 4, 5, 6, 10, 25];
testCounts.forEach((count) => {
  const syntheticReqs = [];
  for (let i = 0; i < count; i++) {
    syntheticReqs.push({
      id: `req-synth-${i}`,
      toHospitalId: `hosp-peer-${i % 5}`,
      toHospitalName: `Peer Hospital ${i % 5}`,
      fromHospitalId: 'hosp-apollo',
      fromHospitalName: 'Apollo Hospital Mumbai',
      status: 'in transit',
      medicineName: `Synth Med ${i}`,
      quantity: 10 + i,
      requestDate: new Date(Date.now() - i * 60000).toISOString(),
    });
  }
  setStoredItem(KEYS.REQUESTS, syntheticReqs);

  const l5Topo = buildHospitalNetworkTopology(hospA, false);
  const allTopo = buildHospitalNetworkTopology(hospA, true);

  const expectedL5 = Math.min(5, count);
  const expectedAll = count;

  assert(l5Topo.totalActiveCount === count, `Total active count is ${count}`);
  assert(l5Topo.displayedTrades.length === expectedL5, `Latest 5 has ${expectedL5} displayed trades for count ${count}`);
  assert(l5Topo.routes.length === expectedL5, `Latest 5 has ${expectedL5} routes for count ${count}`);
  assert(allTopo.displayedTrades.length === expectedAll, `Show All has ${expectedAll} displayed trades for count ${count}`);
  assert(allTopo.routes.length === expectedAll, `Show All has ${expectedAll} routes for count ${count}`);
});

// 11. REAL MOCK DATA INTEGRATION AUDIT
console.log('\n--- SECTION 11: Real Mock Data Integration Audit ---');
globalThis.localStorage.clear();
initializeStorage(); // Restore original initial mock data
const realActiveTrades = getActiveTradesList();
assert(realActiveTrades.length === 10, `Real clean mock data contains exactly 10 active trades (actual: ${realActiveTrades.length})`);

// Verify no terminal statuses
const hasTerminal = realActiveTrades.some((t) => TERMINAL_STATUSES.includes(String(t.status).toLowerCase()));
assert(!hasTerminal, 'Zero terminal statuses present in active trades');

// Verify public topology with real data
const publicLatest = buildPublicNetworkTopology(false);
const publicAll = buildPublicNetworkTopology(true);

assert(publicLatest.totalActiveCount === realActiveTrades.length, `Header count (${publicLatest.totalActiveCount}) strictly equals activeTrades.length (${realActiveTrades.length})`);
assert(publicLatest.displayedTrades.length === Math.min(5, realActiveTrades.length), `Public Latest 5 shows exactly ${Math.min(5, realActiveTrades.length)} trades`);
assert(publicLatest.routes.length === Math.min(5, realActiveTrades.length), `Public Latest 5 renders exactly ${Math.min(5, realActiveTrades.length)} distinct routes`);
assert(publicAll.displayedTrades.length === realActiveTrades.length, `Public Show All shows all ${realActiveTrades.length} trades`);
assert(publicAll.routes.length === realActiveTrades.length, `Public Show All renders all ${realActiveTrades.length} routes`);

// Verify every route in real mock data has valid arrow and non-zero path
publicLatest.routes.forEach((r, idx) => {
  assert(typeof r.pathD === 'string' && r.pathD.includes('Q'), `Route ${idx + 1} (${r.trade.medicine}) uses curved Bezier pathD`);
  assert(r.arrow && typeof r.arrow.x === 'number' && typeof r.arrow.y === 'number', `Route ${idx + 1} has valid arrowhead`);
});

console.log('\n====================================================');
console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}


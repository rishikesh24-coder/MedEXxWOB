import { INITIAL_REQUESTS, INITIAL_TRACKING, INITIAL_HOSPITALS } from '../src/services/mockData.js';
import { initializeStorage, getStoredItem, KEYS } from '../src/services/storage.js';

// Polyfill localStorage
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

initializeStorage();

import {
  isActiveTrade,
  getActiveTradesList,
  buildHospitalNetworkTopology,
  buildPublicNetworkTopology,
} from '../src/utils/networkTopologyHelper.js';

console.log('=== INITIAL_REQUESTS AUDIT ===');
console.log('Total requests in mockData:', INITIAL_REQUESTS.length);

const allStatuses = {};
INITIAL_REQUESTS.forEach((r) => {
  const s = r.status || 'unknown';
  allStatuses[s] = (allStatuses[s] || 0) + 1;
});
console.log('Status breakdown:', allStatuses);

console.log('\n=== ALL ACTIVE TRADES DERIVATION ===');
const activeTrades = getActiveTradesList();
console.log('Total Active Trades derived:', activeTrades.length);
activeTrades.forEach((t, i) => {
  console.log(`${i + 1}. [${t.id}] status='${t.status}' med='${t.medicine}' src='${t.sourceHospitalName}' -> dst='${t.destinationHospitalName}' time=${t.formattedTime}`);
});

console.log('\n=== CHECKING WHY 10 ACTIVE TRADES MIGHT EXIST ===');
// Let's check which requests might be considered active if status is slightly broader or if any other requests exist
INITIAL_REQUESTS.forEach((r, idx) => {
  const active = isActiveTrade(r);
  if (!active && (r.status === 'accepted' || r.status === 'confirmed' || r.status === 'processing')) {
    console.log(`Non-active candidate: [${r.id}] status='${r.status}' paymentStatus='${r.paymentStatus}' from='${r.fromHospitalName}' to='${r.toHospitalName}'`);
  }
});

console.log('\n=== CHECKING APOLLO TOPOLOGY ===');
const apolloHosp = getStoredItem(KEYS.HOSPITALS, []).find(h => h.id === 'hosp-1');
const topoHosp5 = buildHospitalNetworkTopology(apolloHosp, false);
console.log('Apollo Latest 5:');
console.log('  totalActiveCount:', topoHosp5.totalActiveCount);
console.log('  displayedTrades count:', topoHosp5.displayedTrades.length);
console.log('  routes count:', topoHosp5.routes.length);
console.log('  satelliteNodes count:', topoHosp5.satelliteNodes.length);

const topoHospAll = buildHospitalNetworkTopology(apolloHosp, true);
console.log('Apollo Show All:');
console.log('  totalActiveCount:', topoHospAll.totalActiveCount);
console.log('  displayedTrades count:', topoHospAll.displayedTrades.length);
console.log('  routes count:', topoHospAll.routes.length);
console.log('  satelliteNodes count:', topoHospAll.satelliteNodes.length);

console.log('\n=== CHECKING PUBLIC TOPOLOGY ===');
const topoPub5 = buildPublicNetworkTopology(false);
console.log('Public Latest 5:');
console.log('  totalActiveCount:', topoPub5.totalActiveCount);
console.log('  displayedTrades count:', topoPub5.displayedTrades.length);
console.log('  routes count:', topoPub5.routes.length);
console.log('  allNodes count:', topoPub5.allNodes.length);
console.log('\n=== INITIAL_TRACKING AUDIT ===');
console.log('Total tracking in mockData:', INITIAL_TRACKING.length);
INITIAL_TRACKING.forEach((t, idx) => {
  console.log(`${idx + 1}. [${t.transactionId} / ${t.trackingNumber}] status='${t.status}' from='${t.fromHospital}' to='${t.toHospital}' med='${t.medicineName || t.medicine}'`);
});

/**
 * telemetryNetworkData.js
 * 
 * Scalable data generator and clustering engine for Inter-Hospital Supply Telemetry.
 * Supports progressive disclosure from 10 to 100+ hospitals across 6 regional clusters.
 */

export const REGIONAL_CLUSTERS = [
  {
    id: 'mumbai',
    name: 'Mumbai Metro',
    state: 'Maharashtra',
    center: { x: 220, y: 350 },
    color: '#06B6D4', // Cyan
  },
  {
    id: 'pune',
    name: 'Pune Region',
    state: 'Maharashtra',
    center: { x: 340, y: 540 },
    color: '#0EA5E9', // Sky
  },
  {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'Delhi',
    center: { x: 420, y: 140 },
    color: '#38BDF8', // Light blue
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru Urban',
    state: 'Karnataka',
    center: { x: 680, y: 550 },
    color: '#F59E0B', // Amber
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad Central',
    state: 'Telangana',
    center: { x: 780, y: 360 },
    color: '#FB923C', // Orange
  },
  {
    id: 'other',
    name: 'Other Regional Hubs',
    state: 'National',
    center: { x: 660, y: 150 },
    color: '#A855F7', // Purple
  }
];

// 100 Hospital Master Pool
const HOSPITAL_MASTER_POOL = [
  // Mumbai Cluster (18)
  { id: 'H-MUM-01', name: 'Fortis Memorial Hospital', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-02', name: 'Lilavati Hospital & Research', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-03', name: 'Kokilaben Dhirubhai Ambani', city: 'Mumbai', clusterId: 'mumbai', tier: 'Super-Speciality' },
  { id: 'H-MUM-04', name: 'Nanavati Super Speciality', city: 'Mumbai', clusterId: 'mumbai', tier: 'Super-Speciality' },
  { id: 'H-MUM-05', name: 'Tata Memorial Centre', city: 'Mumbai', clusterId: 'mumbai', tier: 'Apex Oncology' },
  { id: 'H-MUM-06', name: 'KEM Memorial Hospital', city: 'Mumbai', clusterId: 'mumbai', tier: 'Teaching' },
  { id: 'H-MUM-07', name: 'P.D. Hinduja Hospital', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-08', name: 'Breach Candy Hospital', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-09', name: 'Saifee Hospital', city: 'Mumbai', clusterId: 'mumbai', tier: 'Secondary' },
  { id: 'H-MUM-10', name: 'Dr. L.H. Hiranandani Hospital', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-11', name: 'Global Hospitals Parel', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-12', name: 'Bombay Hospital & Medical Research', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-13', name: 'Wockhardt Hospital Mumbai Central', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-14', name: 'Jaslok Hospital & Research', city: 'Mumbai', clusterId: 'mumbai', tier: 'Tertiary' },
  { id: 'H-MUM-15', name: 'S.L. Raheja Hospital Mahim', city: 'Mumbai', clusterId: 'mumbai', tier: 'Secondary' },
  { id: 'H-MUM-16', name: 'Kohinoor Hospital Kurla', city: 'Mumbai', clusterId: 'mumbai', tier: 'Secondary' },
  { id: 'H-MUM-17', name: 'Holy Family Hospital Bandra', city: 'Mumbai', clusterId: 'mumbai', tier: 'Secondary' },
  { id: 'H-MUM-18', name: 'Criticare Asia Hospital Andheri', city: 'Mumbai', clusterId: 'mumbai', tier: 'Secondary' },

  // Pune Cluster (12)
  { id: 'H-PUN-01', name: 'Ruby Hall Clinic', city: 'Pune', clusterId: 'pune', tier: 'Tertiary' },
  { id: 'H-PUN-02', name: 'Jehangir Hospital', city: 'Pune', clusterId: 'pune', tier: 'Tertiary' },
  { id: 'H-PUN-03', name: 'Deenanath Mangeshkar Hospital', city: 'Pune', clusterId: 'pune', tier: 'Super-Speciality' },
  { id: 'H-PUN-04', name: 'Sahyadri Super Speciality', city: 'Pune', clusterId: 'pune', tier: 'Super-Speciality' },
  { id: 'H-PUN-05', name: 'Poona Hospital & Research', city: 'Pune', clusterId: 'pune', tier: 'Tertiary' },
  { id: 'H-PUN-06', name: 'Bharati Vidyapeeth Hospital', city: 'Pune', clusterId: 'pune', tier: 'Teaching' },
  { id: 'H-PUN-07', name: 'KEM Hospital Pune', city: 'Pune', clusterId: 'pune', tier: 'Teaching' },
  { id: 'H-PUN-08', name: 'Manipal Hospital Kharadi', city: 'Pune', clusterId: 'pune', tier: 'Tertiary' },
  { id: 'H-PUN-09', name: 'Inamdar Multispeciality', city: 'Pune', clusterId: 'pune', tier: 'Secondary' },
  { id: 'H-PUN-10', name: 'Sancheti Orthopaedic Institute', city: 'Pune', clusterId: 'pune', tier: 'Single Speciality' },
  { id: 'H-PUN-11', name: 'Noble Hospital Hadapsar', city: 'Pune', clusterId: 'pune', tier: 'Secondary' },
  { id: 'H-PUN-12', name: 'Jupiter Hospital Baner', city: 'Pune', clusterId: 'pune', tier: 'Tertiary' },

  // Delhi NCR Cluster (27)
  { id: 'H-DEL-01', name: 'All India Institute of Medical Sciences (AIIMS)', city: 'Delhi', clusterId: 'delhi', tier: 'National Apex' },
  { id: 'H-DEL-02', name: 'Max Super Speciality Saket', city: 'Delhi', clusterId: 'delhi', tier: 'Super-Speciality' },
  { id: 'H-DEL-03', name: 'Medanta - The Medicity', city: 'Gurugram', clusterId: 'delhi', tier: 'Super-Speciality' },
  { id: 'H-DEL-04', name: 'Fortis Escorts Heart Institute', city: 'Delhi', clusterId: 'delhi', tier: 'Single Speciality' },
  { id: 'H-DEL-05', name: 'Sir Ganga Ram Hospital', city: 'Delhi', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-06', name: 'Artemis Hospital Gurugram', city: 'Gurugram', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-07', name: 'BLK-Max Super Speciality', city: 'Delhi', clusterId: 'delhi', tier: 'Super-Speciality' },
  { id: 'H-DEL-08', name: 'Fortis Memorial Gurugram', city: 'Gurugram', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-09', name: 'Max Hospital Patparganj', city: 'Delhi', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-10', name: 'Indraprastha Apollo Sarita Vihar', city: 'Delhi', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-11', name: 'Moolchand Medcity', city: 'Delhi', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-12', name: 'Holy Family Hospital Okhla', city: 'Delhi', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-13', name: 'Venkateshwar Hospital Dwarka', city: 'Delhi', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-14', name: 'Safdarjung Hospital', city: 'Delhi', clusterId: 'delhi', tier: 'Teaching' },
  { id: 'H-DEL-15', name: 'Ram Manohar Lohia (RML)', city: 'Delhi', clusterId: 'delhi', tier: 'Teaching' },
  { id: 'H-DEL-16', name: 'Fortis Flt. Lt. Rajan Dhall Vasant Kunj', city: 'Delhi', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-17', name: 'Max Hospital Shalimar Bagh', city: 'Delhi', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-18', name: 'Paras Hospital Gurugram', city: 'Gurugram', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-19', name: 'Jaypee Hospital Noida', city: 'Noida', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-20', name: 'Yatharth Hospital Greater Noida', city: 'Noida', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-21', name: 'Fortis Hospital Noida', city: 'Noida', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-22', name: 'Metro Heart Institute Faridabad', city: 'Faridabad', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-23', name: 'Sarvodaya Hospital Faridabad', city: 'Faridabad', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-24', name: 'Asian Institute of Medical Sciences', city: 'Faridabad', clusterId: 'delhi', tier: 'Tertiary' },
  { id: 'H-DEL-25', name: 'Primus Super Speciality Chanakyapuri', city: 'Delhi', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-26', name: 'St. Stephen’s Hospital Tis Hazari', city: 'Delhi', clusterId: 'delhi', tier: 'Secondary' },
  { id: 'H-DEL-27', name: 'Action Cancer Hospital Paschim Vihar', city: 'Delhi', clusterId: 'delhi', tier: 'Oncology' },

  // Bengaluru Cluster (15)
  { id: 'H-BLR-01', name: 'Manipal Hospital Old Airport Rd', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Tertiary' },
  { id: 'H-BLR-02', name: 'Narayana Health City', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Super-Speciality' },
  { id: 'H-BLR-03', name: 'Aster CMI Hospital Hebbal', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Tertiary' },
  { id: 'H-BLR-04', name: 'Fortis Hospital Bannerghatta', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Tertiary' },
  { id: 'H-BLR-05', name: 'St. John’s Medical College Hospital', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Teaching' },
  { id: 'H-BLR-06', name: 'Sakra World Hospital Marathahalli', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Super-Speciality' },
  { id: 'H-BLR-07', name: 'BGS Gleneagles Global Hospital', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Tertiary' },
  { id: 'H-BLR-08', name: 'Columbia Asia Hospital Whitefield', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Secondary' },
  { id: 'H-BLR-09', name: 'Apollo Hospitals Sheshadripuram', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Tertiary' },
  { id: 'H-BLR-10', name: 'Vydehi Institute of Medical Sciences', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Teaching' },
  { id: 'H-BLR-11', name: 'Bowring and Lady Curzon Hospital', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Public' },
  { id: 'H-BLR-12', name: 'Victoria Hospital Fort', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Public' },
  { id: 'H-BLR-13', name: 'Sparsh Hospital Yeshwanthpur', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Secondary' },
  { id: 'H-BLR-14', name: 'Mazumdar Shaw Medical Center', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Oncology' },
  { id: 'H-BLR-15', name: 'Trustwell Hospitals JC Road', city: 'Bengaluru', clusterId: 'bengaluru', tier: 'Secondary' },

  // Hyderabad Cluster (14)
  { id: 'H-HYD-01', name: 'Yashoda Hospitals Secunderabad', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Tertiary' },
  { id: 'H-HYD-02', name: 'KIMS Hospitals Secunderabad', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Super-Speciality' },
  { id: 'H-HYD-03', name: 'CARE Hospitals Banjara Hills', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Tertiary' },
  { id: 'H-HYD-04', name: 'Continental Hospitals Gachibowli', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Super-Speciality' },
  { id: 'H-HYD-05', name: 'Sunshine Hospitals Gachibowli', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Secondary' },
  { id: 'H-HYD-06', name: 'AIG Hospitals Gachibowli', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Apex Gastro' },
  { id: 'H-HYD-07', name: 'Medicover Hospitals Madhapur', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Tertiary' },
  { id: 'H-HYD-08', name: 'Rainbow Children’s Hospital', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Pediatric' },
  { id: 'H-HYD-09', name: 'Aster Prime Hospital Ameerpet', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Secondary' },
  { id: 'H-HYD-10', name: 'Nizam’s Institute of Medical Sciences', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Autonomous' },
  { id: 'H-HYD-11', name: 'Osmania General Hospital', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Public Teaching' },
  { id: 'H-HYD-12', name: 'Gandhi Hospital Musheerabad', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Public Teaching' },
  { id: 'H-HYD-13', name: 'Basavatarakam Indo-American Cancer', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Oncology' },
  { id: 'H-HYD-14', name: 'Citizens Specialty Hospital', city: 'Hyderabad', clusterId: 'hyderabad', tier: 'Tertiary' },

  // Other Regional Hubs (14)
  { id: 'H-OTH-01', name: 'Zydus Hospital Ahmedabad', city: 'Ahmedabad', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-02', name: 'CIMS Hospital Ahmedabad', city: 'Ahmedabad', clusterId: 'other', tier: 'Super-Speciality' },
  { id: 'H-OTH-03', name: 'Apollo Hospitals Greams Road', city: 'Chennai', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-04', name: 'MIOT International Chennai', city: 'Chennai', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-05', name: 'Fortis Malar Hospital Chennai', city: 'Chennai', clusterId: 'other', tier: 'Secondary' },
  { id: 'H-OTH-06', name: 'AMRI Hospitals Dhakuria', city: 'Kolkata', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-07', name: 'Medica Superspecialty Kolkata', city: 'Kolkata', clusterId: 'other', tier: 'Super-Speciality' },
  { id: 'H-OTH-08', name: 'Fortis Hospital Anandapur', city: 'Kolkata', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-09', name: 'Eternal Hospital Jaipur', city: 'Jaipur', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-10', name: 'Manipal Hospital Jaipur', city: 'Jaipur', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-11', name: 'KIMSHEALTH Thiruvananthapuram', city: 'Kochi', clusterId: 'other', tier: 'Tertiary' },
  { id: 'H-OTH-12', name: 'Aster Medcity Kochi', city: 'Kochi', clusterId: 'other', tier: 'Super-Speciality' },
  { id: 'H-OTH-13', name: 'Max Super Speciality Dehradun', city: 'Dehradun', clusterId: 'other', tier: 'Secondary' },
  { id: 'H-OTH-14', name: 'AIIMS Rishikesh', city: 'Rishikesh', clusterId: 'other', tier: 'National Apex' },
];

const MEDICINES_POOL = [
  { name: 'Paracetamol 500mg', unit: 'tablets', baseQty: 300, temp: 'Room Temp' },
  { name: 'Amoxicillin 250mg', unit: 'capsules', baseQty: 150, temp: 'Room Temp' },
  { name: 'Cefixime 200mg', unit: 'tablets', baseQty: 200, temp: 'Room Temp' },
  { name: 'Azithromycin 500mg', unit: 'tablets', baseQty: 100, temp: 'Room Temp' },
  { name: 'Insulin Glargine 100IU', unit: 'pens', baseQty: 60, temp: '2°C - 8°C Cold-Chain' },
  { name: 'Meropenem 1g IV', unit: 'vials', baseQty: 40, temp: '2°C - 8°C Cold-Chain' },
  { name: 'Human Albumin 20%', unit: 'bottles', baseQty: 25, temp: '2°C - 8°C Cold-Chain' },
  { name: 'Enoxaparin Sodium 40mg', unit: 'syringes', baseQty: 80, temp: '2°C - 8°C Cold-Chain' },
  { name: 'Propofol 1% 20ml', unit: 'vials', baseQty: 50, temp: '15°C - 25°C Controlled' },
  { name: 'Pantoprazole 40mg IV', unit: 'vials', baseQty: 120, temp: 'Room Temp' },
];

/**
 * Generate a deterministic scalable network model based on network size (10, 25, 50, 100).
 */
export function generateScalableNetwork(networkSize = 100, currentHospitalName = 'Apollo Hospital') {
  const size = Math.max(10, Math.min(100, Number(networkSize) || 100));

  // Determine active hospitals
  let hospitalsSubset = HOSPITAL_MASTER_POOL.slice(0, size);

  // Ensure current hospital is explicitly represented at the center
  const currentHospId = 'MY-HOSP-HUB';
  const myHospital = {
    id: currentHospId,
    name: currentHospitalName,
    city: 'Mumbai',
    clusterId: 'mumbai',
    isCurrentHospital: true,
    tier: 'Central Hub',
    coords: { x: 500, y: 350 }, // Canvas center
  };

  // Map cluster coordinates with radial offsets for member hospitals
  const clusterMap = new Map();
  REGIONAL_CLUSTERS.forEach((c) => {
    clusterMap.set(c.id, {
      ...c,
      hospitals: [],
      hospitalCount: 0,
      incomingHospitals: 0,
      outgoingHospitals: 0,
      incomingUnits: 0,
      outgoingUnits: 0,
      activeTransfers: 0,
    });
  });

  // Distribute hospitals around cluster centers
  const hospitals = [myHospital];
  hospitalsSubset.forEach((h, idx) => {
    // If name matches current hospital, avoid duplication
    if (h.name.toLowerCase() === currentHospitalName.toLowerCase()) return;

    const cluster = clusterMap.get(h.clusterId) || clusterMap.get('other');
    const angle = (idx * (360 / 12) + (idx % 3) * 25) * (Math.PI / 180);
    const radius = 55 + (idx % 4) * 22; // Natural radial dispersion

    const coords = {
      x: Math.round(cluster.center.x + Math.cos(angle) * radius),
      y: Math.round(cluster.center.y + Math.sin(angle) * radius),
    };

    const hospObj = {
      ...h,
      coords,
      isCurrentHospital: false,
    };

    hospitals.push(hospObj);
    cluster.hospitals.push(hospObj);
  });

  // Generate transfers connecting to current hospital and between peer clusters
  const transfers = [];
  let trfCounter = 1;

  hospitals.forEach((h, idx) => {
    if (h.isCurrentHospital) return;

    // Distribute incoming vs outgoing relative to current hospital
    // roughly 60% incoming, 40% outgoing
    const isIncoming = (idx % 5) < 3;
    const medIndex = idx % MEDICINES_POOL.length;
    const med = MEDICINES_POOL[medIndex];
    const qtyMultiplier = 1 + (idx % 4);
    const quantity = med.baseQty * qtyMultiplier;

    // Transfer status
    let status = 'In Transit';
    let statusType = 'in_transit';
    if (idx % 7 === 0) {
      status = 'Delivered';
      statusType = 'delivered';
    } else if (idx % 5 === 0) {
      status = 'Preparing';
      statusType = 'preparing';
    } else if (idx % 9 === 0) {
      status = 'Delayed';
      statusType = 'delayed';
    }

    const distBase = Math.round(Math.hypot(h.coords.x - myHospital.coords.x, h.coords.y - myHospital.coords.y) / 18);
    const distanceKm = Math.max(4, distBase * 2.2).toFixed(1);
    const etaHours = Math.max(1, Math.round(Number(distanceKm) / 35));
    const etaMins = (idx * 15) % 60;
    const eta = statusType === 'delivered' ? 'Completed' : `${etaHours}h ${etaMins}m`;

    const sourceName = isIncoming ? h.name : currentHospitalName;
    const destinationName = isIncoming ? currentHospitalName : h.name;

    const transfer = {
      id: `TRF-${String(trfCounter++).padStart(4, '0')}`,
      direction: isIncoming ? 'incoming' : 'outgoing',
      source: sourceName,
      destination: destinationName,
      medicine: med.name,
      quantity,
      unit: med.unit,
      sourceHospitalId: isIncoming ? h.id : currentHospId,
      sourceHospitalName: sourceName,
      destinationHospitalId: isIncoming ? currentHospId : h.id,
      destinationHospitalName: destinationName,
      partnerHospitalId: h.id,
      partnerHospitalName: h.name,
      partnerCoords: h.coords,
      clusterId: h.clusterId,
      status,
      statusType,
      distanceKm: `${distanceKm} km`,
      eta,
      temp: med.temp,
    };

    transfers.push(transfer);

    // Update cluster aggregate counts
    const cluster = clusterMap.get(h.clusterId);
    if (cluster) {
      cluster.hospitalCount++;
      if (isIncoming) {
        cluster.incomingHospitals++;
        cluster.incomingUnits += quantity;
      } else {
        cluster.outgoingHospitals++;
        cluster.outgoingUnits += quantity;
      }
      if (statusType === 'in_transit' || statusType === 'preparing') {
        cluster.activeTransfers++;
      }
    }
  });

  // Calculate totals
  const totalHospitals = hospitals.length;
  const incomingTransfers = transfers.filter((t) => t.direction === 'incoming');
  const outgoingTransfers = transfers.filter((t) => t.direction === 'outgoing');
  const totalIncomingUnits = incomingTransfers.reduce((acc, t) => acc + t.quantity, 0);
  const totalOutgoingUnits = outgoingTransfers.reduce((acc, t) => acc + t.quantity, 0);
  const totalActiveTransfers = transfers.filter((t) => t.statusType === 'in_transit' || t.statusType === 'preparing').length;

  // Macro-cluster definitions for Low Zoom aggregation
  const macroClusters = {
    incoming: {
      id: 'macro-incoming',
      name: 'Incoming Hospitals Hub',
      direction: 'incoming',
      hospitalCount: incomingTransfers.length,
      totalUnits: totalIncomingUnits,
      activeTransfers: incomingTransfers.filter((t) => t.statusType === 'in_transit' || t.statusType === 'preparing').length,
      coords: { x: 230, y: 350 }, // Positioned west / left of Your Hospital
      color: '#10B981', // Green
    },
    outgoing: {
      id: 'macro-outgoing',
      name: 'Outgoing Hospitals Hub',
      direction: 'outgoing',
      hospitalCount: outgoingTransfers.length,
      totalUnits: totalOutgoingUnits,
      activeTransfers: outgoingTransfers.filter((t) => t.statusType === 'in_transit' || t.statusType === 'preparing').length,
      coords: { x: 770, y: 350 }, // Positioned east / right of Your Hospital
      color: '#EF4444', // Red
    },
  };

  return {
    hospitals,
    clusters: Array.from(clusterMap.values()).filter((c) => c.hospitalCount > 0),
    transfers,
    macroClusters,
    myHospital,
    metrics: {
      totalHospitals,
      totalTransfers: transfers.length,
      incomingHospitals: incomingTransfers.length,
      outgoingHospitals: outgoingTransfers.length,
      incomingUnits: totalIncomingUnits,
      outgoingUnits: totalOutgoingUnits,
      activeTransfers: totalActiveTransfers,
    },
  };
}


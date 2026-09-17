import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Truck, 
  MapPin, 
  Thermometer, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Activity, 
  CheckCircle2, 
  Navigation,
  Radio
} from 'lucide-react';

export const LiveSupplyNetworkMap = () => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedShipmentId, setSelectedShipmentId] = useState('TXN-773120');

  const shipments = [
    {
      id: 'TXN-773120',
      trackingNo: 'SMS-EXP-88912',
      medicine: 'Enoxaparin Sodium 40mg Prefilled',
      quantity: '50 units',
      origin: 'Apollo Hospital (Belapur, Navi Mumbai)',
      originCoords: { x: 80, y: 65 },
      destination: 'Fortis Hospital (Mulund, Mumbai)',
      destCoords: { x: 55, y: 35 },
      currentPos: { x: 67, y: 50 },
      state: 'IN TRANSIT',
      statusColor: 'bg-cyan-500 text-white',
      temp: '4.2°C (Cold-Chain Compliant)',
      eta: '45 mins remaining',
      vehicle: 'MH-04-AZ-4419 (Temp Controlled IoT)',
      speed: '58 km/h'
    },
    {
      id: 'TXN-984210',
      trackingNo: 'SMS-EXP-90145',
      medicine: 'Meropenem 1g IV Injection',
      quantity: '40 vials',
      origin: 'Kokilaben Dhirubhai (Andheri West)',
      originCoords: { x: 28, y: 45 },
      destination: 'Nanavati Super Speciality (Vile Parle)',
      destCoords: { x: 38, y: 58 },
      currentPos: { x: 33, y: 51 },
      state: 'PICKED UP',
      statusColor: 'bg-amber-500 text-white',
      temp: '3.9°C',
      eta: '25 mins remaining',
      vehicle: 'MH-02-EE-8812 (Cryo-Box Express)',
      speed: '42 km/h'
    },
    {
      id: 'TXN-451290',
      trackingNo: 'SMS-EXP-66231',
      medicine: 'Human Albumin 20% 100ml',
      quantity: '25 bottles',
      origin: 'Nanavati Super Speciality',
      originCoords: { x: 38, y: 58 },
      destination: 'KEM Memorial Hospital (Parel)',
      destCoords: { x: 45, y: 80 },
      currentPos: { x: 45, y: 80 },
      state: 'DELIVERED',
      statusColor: 'bg-emerald-500 text-white',
      temp: '4.0°C (Signed Off)',
      eta: 'Completed at 14:15',
      vehicle: 'MH-01-CR-1199',
      speed: '0 km/h (Docked)'
    },
    {
      id: 'TXN-312900',
      trackingNo: 'SMS-EXP-11209',
      medicine: 'Insulin Glargine 100 IU/ml',
      quantity: '60 pens',
      origin: 'Apollo Hospital (Belapur)',
      originCoords: { x: 80, y: 65 },
      destination: 'Kokilaben Dhirubhai (Andheri)',
      destCoords: { x: 28, y: 45 },
      currentPos: { x: 80, y: 65 },
      state: 'CONFIRMED',
      statusColor: 'bg-blue-500 text-white',
      temp: '3.6°C (Chamber Ready)',
      eta: 'Dispatch in 15 mins',
      vehicle: 'MediCold Van #08',
      speed: 'Stationary at Dispatch'
    }
  ];

  const filteredShipments = shipments.filter((s) => {
    if (activeFilter === 'ALL') return true;
    return s.state === activeFilter;
  });

  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId) || shipments[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Live Supply Network • Mumbai Metro Cluster
            </h3>
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              IOT TELEMETRY LIVE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time geospatial tracking of inter-hospital cold chain consignments moving between verified trauma & surgical centres.
          </p>
        </div>

        {/* Milestone Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {['ALL', 'IN TRANSIT', 'PICKED UP', 'CONFIRMED', 'DELIVERED'].map((st) => (
            <button
              key={st}
              onClick={() => setActiveFilter(st)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Spatial Map Canvas & Live Consignment Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Spatial Map Canvas (Left 2 cols) */}
        <div className="lg:col-span-2 relative h-80 sm:h-96 rounded-2xl bg-gradient-to-b from-[#081521] via-[#0B1E2D] to-[#050E17] border border-slate-800 shadow-xl p-4 overflow-hidden select-none">
          
          {/* Subtle Geospatial Grid */}
          <div className="absolute inset-0 bg-grid-dark opacity-35 pointer-events-none" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Map Top Metadata */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-300">
            <span className="font-mono text-[10px] text-cyan-300 flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              MUMBAI-METRO COORDINATES (19.0760° N, 72.8777° E)
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Active Consignments: <strong className="text-white">{filteredShipments.length}</strong>
            </span>
          </div>

          {/* SVG Map Routes & Nodes */}
          <svg className="absolute inset-0 w-full h-full p-4" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="liveHighway" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Render route corridors */}
            {shipments.map((s) => (
              <g key={s.id}>
                {/* Background transit route */}
                <line
                  x1={s.originCoords.x}
                  y1={s.originCoords.y}
                  x2={s.destCoords.x}
                  y2={s.destCoords.y}
                  stroke={selectedShipmentId === s.id ? '#06B6D4' : '#1E3547'}
                  strokeWidth={selectedShipmentId === s.id ? '2' : '1'}
                  strokeDasharray="2 2"
                />

                {/* Animated pulse packet along route */}
                {s.state === 'IN TRANSIT' && (
                  <circle r="1.6" fill="#06B6D4">
                    <animateMotion
                      path={`M ${s.originCoords.x} ${s.originCoords.y} L ${s.destCoords.x} ${s.destCoords.y}`}
                      dur="4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            ))}
          </svg>

          {/* Hospital Nodes Placed Geographically */}
          {[
            { name: 'Apollo Hospital', loc: 'Belapur Hub', coords: { x: 80, y: 65 }, isHub: true },
            { name: 'Fortis Hospital', loc: 'Mulund Dock', coords: { x: 55, y: 35 } },
            { name: 'Kokilaben Hospital', loc: 'Andheri West', coords: { x: 28, y: 45 } },
            { name: 'Nanavati Super Speciality', loc: 'Vile Parle', coords: { x: 38, y: 58 } },
            { name: 'KEM Hospital', loc: 'Parel Trauma', coords: { x: 45, y: 80 } },
          ].map((hosp, idx) => (
            <div
              key={idx}
              style={{ left: `${hosp.coords.x}%`, top: `${hosp.coords.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
            >
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shadow-lg transition-transform group-hover:scale-110 ${
                  hosp.isHub ? 'bg-primary-500 text-white ring-2 ring-primary-300' : 'bg-slate-800 text-cyan-300 border border-slate-700'
                }`}>
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="mt-1 px-1.5 py-0.5 rounded bg-[#091522]/90 border border-white/10 text-[9px] font-bold text-slate-200 whitespace-nowrap shadow-md">
                  {hosp.name}
                </div>
              </div>
            </div>
          ))}

          {/* Moving Vehicle Position Marker */}
          {selectedShipment && selectedShipment.state === 'IN TRANSIT' && (
            <div
              style={{ left: `${selectedShipment.currentPos.x}%`, top: `${selectedShipment.currentPos.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-500/50 animate-bounce">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-[8px] font-mono text-cyan-300 whitespace-nowrap">
                  {selectedShipment.speed}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Left Legend */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-[10px] text-slate-300 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-500" /> Dispatch Hub
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> In-Transit IoT
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Delivered
            </span>
          </div>

        </div>

        {/* Right Column: Selected Shipment Dossier */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Consignments
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {filteredShipments.map((s) => {
              const isSelected = selectedShipmentId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedShipmentId(s.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-primary-50/50 border-primary-400 shadow-sm ring-1 ring-primary-400'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {s.medicine}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-500">
                        {s.quantity} • AWB: {s.trackingNo}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${s.statusColor}`}>
                      {s.state}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{s.origin} ➔ {s.destination}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-cyan-700 font-bold flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-cyan-600" />
                      {s.temp}
                    </span>
                    <span className="text-slate-500">{s.eta}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick link to detailed track page */}
          <Link
            to={`/hospital/track?txn=${selectedShipment.id}`}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <span>Open Dedicated Live Tracker</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

    </div>
  );
};

export default LiveSupplyNetworkMap;

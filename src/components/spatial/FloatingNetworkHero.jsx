import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  Building2, 
  ShieldCheck, 
  Thermometer, 
  Truck, 
  Activity, 
  Radio, 
  ArrowRight, 
  ArrowDownLeft,
  ArrowUpRight,
  Layers, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Package 
} from 'lucide-react';
import { 
  buildHospitalNetworkTopology, 
  buildPublicNetworkTopology 
} from '../../utils/networkTopologyHelper.js';
import { getLiveHospitalRecord } from '../../services/storage.js';

export const FloatingNetworkHero = ({ mode = 'hospital', authenticatedHospital: propHospital = null }) => {
  const { user } = useSelector((state) => state.auth);
  const [showAll, setShowAll] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [storageTick, setStorageTick] = useState(0);

  // Live storage event listener to automatically update network when orders/shipments change
  useEffect(() => {
    const handleStorageUpdate = () => {
      setStorageTick((t) => t + 1);
    };
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('medex-request-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('medex-request-updated', handleStorageUpdate);
    };
  }, []);

  // Determine authenticated hospital with strict tenant isolation
  const authHospital = useMemo(() => {
    if (propHospital) return propHospital;
    const resolvedId = user?.hospitalId || user?.id;
    if (!resolvedId) return user;
    return getLiveHospitalRecord(resolvedId) || user;
  }, [propHospital, user, storageTick]);

  // Derive network topology data depending on mode
  const topology = useMemo(() => {
    if (mode === 'hospital' && authHospital) {
      return buildHospitalNetworkTopology(authHospital, showAll);
    }
    return buildPublicNetworkTopology(showAll);
  }, [mode, authHospital, showAll, storageTick]);

  if (!topology) return null;

  const {
    allNodes = [],
    routes = [],
    metrics = { activeDeliveries: 0, hospitalsInvolved: 0, activeRoutes: 0 },
    displayedTrades = [],
    totalActiveCount = 0,
    hasActiveTrades = false,
    primaryNode = null,
    summary = null,
  } = topology;

  // Selected trade object
  const activeSelectedTrade = useMemo(() => {
    if (!selectedTradeId) return null;
    return displayedTrades.find((t) => t.id === selectedTradeId) || null;
  }, [selectedTradeId, displayedTrades]);

  // Selected node object
  const activeSelectedNode = useMemo(() => {
    if (!selectedNodeId) return primaryNode || allNodes[0] || null;
    return allNodes.find((n) => n.id === selectedNodeId) || primaryNode || allNodes[0];
  }, [selectedNodeId, allNodes, primaryNode]);

  // Check if a node is currently highlighted by selection
  const isNodeHighlighted = (nodeId) => {
    if (selectedNodeId === nodeId) return true;
    if (activeSelectedTrade) {
      return (
        activeSelectedTrade.sourceHospitalId === nodeId ||
        activeSelectedTrade.destinationHospitalId === nodeId
      );
    }
    return false;
  };

  // Check if a route is selected or hovered
  const isRouteActive = (route) => {
    if (selectedTradeId && route.tradeId === selectedTradeId) return true;
    if (hoveredRouteId && route.id === hoveredRouteId) return true;
    return false;
  };

  return (
    <div className="relative w-full bg-gradient-to-b from-[#091B26] via-[#07151E] to-[#050E14] rounded-2xl p-4 sm:p-5 border border-cyan-500/20 shadow-2xl text-white overflow-hidden select-none">
      
      {/* Background blueprint matrix */}
      <div className="absolute inset-0 bg-grid-dark opacity-25 pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/10 text-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-mono text-xs font-bold text-slate-100 tracking-wide uppercase">
              {mode === 'hospital' ? 'Your Active Deliveries' : 'MedEx Hospital Network'}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {showAll
              ? `Showing all ${totalActiveCount} active trades`
              : `Showing ${displayedTrades.length} of ${totalActiveCount} active trades`}
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {hasActiveTrades && totalActiveCount > 5 && (
            <div className="inline-flex rounded-lg bg-white/5 border border-white/15 p-0.5 text-[10px] font-mono font-bold">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  !showAll ? 'bg-cyan-500 text-slate-950 shadow-sm font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                Latest 5
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  showAll ? 'bg-cyan-500 text-slate-950 shadow-sm font-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                Show All Active Trades
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-[10px] font-mono font-bold">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>{hasActiveTrades ? `${totalActiveCount} Active Trades` : 'Standing By'}</span>
          </div>
        </div>
      </div>

      {/* 2. Map Summary Metrics */}
      {mode === 'hospital' ? (
        <div className="relative z-10 grid grid-cols-3 gap-2 my-2.5 font-mono text-center">
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Active Deliveries</span>
            <span className="text-base font-black text-cyan-300">{metrics.activeDeliveries}</span>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Hospitals Involved</span>
            <span className="text-base font-black text-emerald-300">{metrics.hospitalsInvolved}</span>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Active Routes</span>
            <span className="text-base font-black text-amber-300">{metrics.activeRoutes}</span>
          </div>
        </div>
      ) : (
        summary && (
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5 text-center font-mono">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="text-[9px] uppercase text-slate-400 block tracking-wider font-semibold">Verified Hospitals</span>
              <span className="text-base font-black text-cyan-300">{summary.verifiedHospitalsCount}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="text-[9px] uppercase text-slate-400 block tracking-wider font-semibold">Active Deliveries</span>
              <span className="text-base font-black text-emerald-400">{summary.activeDeliveriesCount}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="text-[9px] uppercase text-slate-400 block tracking-wider font-semibold">Hospitals Trading</span>
              <span className="text-base font-black text-amber-300">{summary.hospitalsTradingCount}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="text-[9px] uppercase text-slate-400 block tracking-wider font-semibold">Live Corridors</span>
              <span className="text-base font-black text-sky-400">{summary.liveCorridorsCount}</span>
            </div>
          </div>
        )
      )}

      {/* 3. Direction Legend (Clear Accessible Visual Indicators) */}
      {mode === 'hospital' && (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/10 text-[10px] font-mono mb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold">Direction Legend:</span>
            
            {/* Incoming Legend */}
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[9px]">
                <span className="text-[10px]">←</span> INCOMING
              </span>
              <span className="text-slate-400 font-normal text-[9px] hidden sm:inline">(stock arriving at your hospital)</span>
            </div>

            {/* Outgoing Legend */}
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50" />
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[9px]">
                OUTGOING <span className="text-[10px]">→</span>
              </span>
              <span className="text-slate-400 font-normal text-[9px] hidden sm:inline">(stock leaving your hospital)</span>
            </div>
          </div>

          <span className="text-slate-500 text-[9px] hidden md:inline">Reference: Your Hospital (Bottom Hub)</span>
        </div>
      )}

      {/* 4. Interactive 3D Spatial Network Canvas */}
      <div className="relative h-72 sm:h-80 w-full my-1">
        
        {/* SVG Route Lines, Directional Arrows and Moving Particles */}
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {/* INCOMING GRADIENT (Teal / Cyan) */}
            <linearGradient id="routeGradientIncoming" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#088395" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.85" />
            </linearGradient>

            <linearGradient id="routeGradientIncomingSelected" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="1" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="1" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="1" />
            </linearGradient>

            {/* OUTGOING GRADIENT (Indigo / Violet / Blue) */}
            <linearGradient id="routeGradientOutgoing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4338CA" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#6366F1" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.85" />
            </linearGradient>

            <linearGradient id="routeGradientOutgoingSelected" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" stopOpacity="1" />
              <stop offset="50%" stopColor="#6366F1" stopOpacity="1" />
              <stop offset="100%" stopColor="#A5B4FC" stopOpacity="1" />
            </linearGradient>
            
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glowSelected" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Active Trade Routes with Embedded Directional Arrowheads */}
          {routes.map((route, idx) => {
            const isHighlighted = isRouteActive(route);
            const opacity = isHighlighted ? 0.95 : (hoveredRouteId ? 0.25 : (showAll && routes.length > 5 ? 0.4 : 0.65));
            const strokeWidth = isHighlighted ? 1.8 : 1.1;

            const isInc = route.isIncoming;
            const gradientId = isHighlighted 
              ? (isInc ? 'routeGradientIncomingSelected' : 'routeGradientOutgoingSelected')
              : (isInc ? 'routeGradientIncoming' : 'routeGradientOutgoing');
            const themeColor = isInc ? '#06B6D4' : '#818CF8';
            const highlightColor = isHighlighted ? '#FFFFFF' : themeColor;

            return (
              <g 
                key={route.id}
                onMouseEnter={() => setHoveredRouteId(route.id)}
                onMouseLeave={() => setHoveredRouteId(null)}
                onClick={() => {
                  setSelectedTradeId(route.tradeId);
                  setSelectedNodeId(route.isIncoming ? route.sourceNodeId : route.destNodeId);
                }}
                className="cursor-pointer"
              >
                {/* Active illuminated route */}
                <path
                  d={route.pathD}
                  stroke={`url(#${gradientId})`}
                  strokeWidth={strokeWidth}
                  filter={isHighlighted ? 'url(#glowSelected)' : 'url(#glow)'}
                  fill="none"
                  opacity={opacity}
                />

                {/* COMPACT DIRECTIONAL ARROWHEAD: sits directly at route midpoint (t=0.50), oriented in flow direction */}
                {route.arrow && (
                  <g 
                    transform={`translate(${route.arrow.x}, ${route.arrow.y}) rotate(${route.arrow.angle})`}
                    opacity={isHighlighted ? 1 : 0.85}
                  >
                    {/* Compact directional chevron (40-60% smaller than previous version) */}
                    <path
                      d="M -1.8 -1.5 L 1.5 0 L -1.8 1.5 z"
                      fill={isHighlighted ? '#FFFFFF' : themeColor}
                    />
                  </g>
                )}

                {/* Subtle moving pulse packet traveling in travel direction (Source -> Destination) */}
                <circle 
                  r={isHighlighted ? '1.5' : '1.0'} 
                  fill={isHighlighted ? '#FFFFFF' : themeColor} 
                  opacity={isHighlighted ? 0.9 : 0.65}
                >
                  <animateMotion
                    path={route.pathD}
                    dur={`${2.8 + (idx % 3) * 0.7}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* Empty State Banner within Canvas */}
        {!hasActiveTrades && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-10 pointer-events-none">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center mb-2">
              <Package className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-200">
              {mode === 'hospital' ? 'No active deliveries' : 'No active deliveries across the network'}
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mt-0.5">
              {mode === 'hospital'
                ? "You don't currently have any medicine shipments in progress."
                : 'Live trade routes will appear here when active shipments are available.'}
            </p>
          </div>
        )}

        {/* Render Hospital Node Anchors */}
        {allNodes.map((node) => {
          const isSelected = activeSelectedNode?.id === node.id;
          const isHighlighted = isNodeHighlighted(node.id);
          const isHub = node.type === 'hub';

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 group z-20 ${
                isSelected ? 'scale-105' : isHighlighted ? 'scale-105' : 'hover:scale-105'
              }`}
            >
              {/* Outer pulse glow on selected or highlighted nodes */}
              {(isSelected || isHighlighted) && (
                <div className="absolute -inset-2 rounded-2xl bg-cyan-400/25 blur-md animate-pulse pointer-events-none" />
              )}

              {/* Node Card Component */}
              {isHub ? (
                /* Primary Central Hospital Card */
                <div
                  className="relative px-3.5 py-2 rounded-2xl border flex items-center gap-2.5 backdrop-blur-md shadow-2xl transition-all
                    bg-gradient-to-r from-teal-950/95 via-[#0A333C]/95 to-cyan-950/95 border-cyan-400/80 text-white ring-2 ring-cyan-500/20"
                >
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>

                  <div className="text-left leading-tight">
                    <div 
                      className="text-[12px] font-black tracking-tight text-slate-50 truncate max-w-[120px] sm:max-w-[160px]" 
                      title={node.name}
                    >
                      {node.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                        Your Hospital
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[80px]">
                        {node.city}
                      </span>
                    </div>
                  </div>

                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5 shrink-0" />
                </div>
              ) : (
                /* Counterpart Satellite Hospital Card */
                <div
                  className={`relative px-2.5 py-1.5 rounded-xl border flex items-center gap-2 backdrop-blur-md shadow-lg transition-all ${
                    isSelected || isHighlighted
                      ? 'bg-cyan-950/95 border-cyan-400 text-white shadow-cyan-500/30 ring-1 ring-cyan-400'
                      : 'bg-slate-900/90 border-white/15 text-slate-200 hover:border-cyan-400/60 hover:bg-slate-900/95'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-white/10 text-cyan-300 flex items-center justify-center shrink-0">
                    <Truck className="w-3.5 h-3.5" />
                  </div>

                  <div className="text-left leading-tight">
                    <div 
                      className="text-[11px] font-bold tracking-tight text-slate-100 truncate max-w-[100px] sm:max-w-[130px]" 
                      title={node.name}
                    >
                      {node.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[65px]">
                        {node.city || 'Verified'}
                      </span>
                      <span className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                        {node.consignments || 1} active {node.consignments === 1 ? 'trade' : 'trades'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. Contextual Bottom Information Panel (Selected Delivery with Clear Direction Badges) */}
      <div className="relative z-10 pt-2 border-t border-white/10">
        {activeSelectedTrade ? (
          /* Contextual State: Selected Delivery Details */
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-400/40 text-xs transition-all">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold shrink-0">
                  Selected Delivery
                </span>

                {/* DIRECTION BADGE */}
                {mode === 'hospital' ? (
                  activeSelectedTrade.isIncoming ? (
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center gap-1 shrink-0">
                      <ArrowDownLeft className="w-3 h-3 text-cyan-400" />
                      <span>INCOMING TO YOUR HOSPITAL</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 flex items-center gap-1 shrink-0">
                      <ArrowUpRight className="w-3 h-3 text-indigo-400" />
                      <span>OUTGOING FROM YOUR HOSPITAL</span>
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center gap-1 shrink-0">
                    <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>ACTIVE CORRIDOR</span>
                  </span>
                )}

                <span className="text-xs font-extrabold text-slate-100 truncate">
                  {activeSelectedTrade.medicine}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-white/10 text-slate-300 border border-white/15 shrink-0">
                  Status: {activeSelectedTrade.status}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTradeId(null);
                  setSelectedNodeId(null);
                }}
                className="text-[10px] font-mono text-slate-400 hover:text-white underline shrink-0"
              >
                Clear selection
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-[10px] font-mono text-slate-300">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Route Flow</span>
                <span 
                  className="text-slate-100 font-bold truncate block" 
                  title={`${activeSelectedTrade.sourceHospitalName} ➔ ${activeSelectedTrade.destinationHospitalName}`}
                >
                  {activeSelectedTrade.sourceHospitalName} ➔ {activeSelectedTrade.destinationHospitalName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Consignment / Order ID</span>
                <span className="text-cyan-300 font-bold">
                  {activeSelectedTrade.consignmentId || activeSelectedTrade.transactionId}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Temperature / Telemetry</span>
                <span className="text-emerald-400 font-bold">
                  {activeSelectedTrade.isLiveTelemetry || activeSelectedTrade.temp 
                    ? activeSelectedTrade.temp 
                    : 'Telemetry nominal'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Last Activity</span>
                <span className="text-slate-200">{activeSelectedTrade.formattedTime}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Default State Overview */
          mode === 'hospital' ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100">{primaryNode?.name}</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 rounded">
                      Your Hospital
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {primaryNode?.city}{primaryNode?.state ? `, ${primaryNode?.state}` : ''} • {metrics.activeDeliveries} active {metrics.activeDeliveries === 1 ? 'delivery' : 'deliveries'} across {metrics.activeRoutes} {metrics.activeRoutes === 1 ? 'corridor' : 'corridors'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-[10px] text-slate-300 shrink-0">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Active Status</span>
                  <span className="text-emerald-400 font-bold">Operational</span>
                </div>
                <div className="border-l border-white/10 pl-3">
                  <span className="text-slate-500 block text-[9px] uppercase">Interaction</span>
                  <span className="text-cyan-300">Click route to inspect</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100">National Healthcare Corridor Network</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded">
                      Live Telemetry
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {summary?.verifiedHospitalsCount || 13} verified facilities • {totalActiveCount} active cold-chain medicine trades across India
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-[10px] text-slate-300 shrink-0">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Cold Chain</span>
                  <span className="text-emerald-400 font-bold">2°C – 8°C IoT</span>
                </div>
                <div className="border-l border-white/10 pl-3">
                  <span className="text-slate-500 block text-[9px] uppercase">Inspect</span>
                  <span className="text-cyan-300">Click any trade row below</span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* 6. Active Deliveries List (Rendered in both Hospital and Public views) */}
      <div className="relative z-10 mt-3 pt-3 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Truck className="w-3.5 h-3.5 text-cyan-400" />
            <span>ACTIVE DELIVERIES</span>
            <span className="text-[10px] font-mono text-slate-400">
              ({displayedTrades.length} of {totalActiveCount})
            </span>
          </div>

          {hasActiveTrades && totalActiveCount > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline font-bold"
            >
              {showAll ? 'Show latest 5' : `Show All Active Trades (${totalActiveCount})`}
            </button>
          )}
        </div>

        {displayedTrades.length === 0 ? (
          <p className="text-xs text-slate-400 py-2 italic">
            No active shipments in transit.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {displayedTrades.map((trade, idx) => {
              const isSelected = selectedTradeId === trade.id;
              const isInc = mode === 'hospital'
                ? (trade.destinationHospitalId === primaryNode?.id || 
                   (trade.destinationHospitalName && trade.destinationHospitalName.toLowerCase() === primaryNode?.name?.toLowerCase()))
                : false;

              return (
                <div
                  key={trade.id || `trade-${idx}`}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    isSelected
                      ? (isInc ? 'bg-cyan-950/60 border-cyan-400 shadow-md ring-1 ring-cyan-400/50' : 'bg-indigo-950/60 border-indigo-400 shadow-md ring-1 ring-indigo-400/50')
                      : 'bg-white/5 hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* DIRECTION BADGE IN LIST */}
                      {mode === 'hospital' ? (
                        isInc ? (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-0.5 shrink-0">
                            <ArrowDownLeft className="w-2.5 h-2.5 text-cyan-400" />
                            <span>INCOMING</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-0.5 shrink-0">
                            <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400" />
                            <span>OUTGOING</span>
                          </span>
                        )
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-0.5 shrink-0">
                          <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                          <span>ACTIVE CORRIDOR</span>
                        </span>
                      )}

                      <span className="font-extrabold text-slate-100 truncate max-w-[200px]" title={trade.medicine}>
                        {trade.medicine}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-white/10 text-slate-300 border border-white/15 shrink-0">
                        {trade.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      <span>{trade.quantity}</span>
                      <span>•</span>
                      <span className="truncate" title={`${trade.sourceHospitalName} ➔ ${trade.destinationHospitalName}`}>
                        {trade.sourceHospitalName} ➔ {trade.destinationHospitalName}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                      <span>Updated: {trade.formattedTime}</span>
                      {trade.consignmentId && <span>• AWB: {trade.consignmentId}</span>}
                      {trade.eta && <span>• ETA: {trade.eta}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTradeId(trade.id);
                      setSelectedNodeId(
                        trade.sourceHospitalId === primaryNode?.id 
                          ? trade.destinationHospitalId 
                          : trade.sourceHospitalId
                      );
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all shrink-0 flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950 shadow-sm'
                        : 'bg-white/10 hover:bg-white/20 text-cyan-300 border border-white/15'
                    }`}
                  >
                    <span>{isSelected ? 'Viewing on Map' : 'View on Map'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default FloatingNetworkHero;

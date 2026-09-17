import React, { useState } from 'react';
import { Building2, ShieldCheck, Thermometer, Truck, Activity, Radio, Sparkles } from 'lucide-react';

export const FloatingNetworkHero = () => {
  const [activeNode, setActiveNode] = useState('hub');

  const nodes = [
    {
      id: 'apollo',
      name: 'Apollo Hospital',
      role: 'Central Dispatch Hub',
      coords: { x: 50, y: 18 },
      tag: 'Primary Node',
      temp: '4.1°C',
      compliance: '100%',
      consignments: 14,
      status: 'Active',
      type: 'hub'
    },
    {
      id: 'fortis',
      name: 'Fortis Memorial',
      role: 'Cluster Partner A',
      coords: { x: 18, y: 78 },
      tag: '14.5 km',
      temp: '3.8°C',
      compliance: '99.8%',
      consignments: 5,
      status: 'In Transit',
      type: 'satellite'
    },
    {
      id: 'kokilaben',
      name: 'Kokilaben Hospital',
      role: 'Cluster Partner B',
      coords: { x: 50, y: 84 },
      tag: '9.2 km',
      temp: '4.4°C',
      compliance: '100%',
      consignments: 3,
      status: 'Connected',
      type: 'satellite'
    },
    {
      id: 'nanavati',
      name: 'Nanavati Super Speciality',
      role: 'Cluster Partner C',
      coords: { x: 82, y: 78 },
      tag: '18.1 km',
      temp: '4.0°C',
      compliance: '99.9%',
      consignments: 6,
      status: 'In Transit',
      type: 'satellite'
    },
  ];

  const activeNodeData = nodes.find((n) => n.id === activeNode) || nodes[0];

  return (
    <div className="relative w-full max-w-lg mx-auto bg-gradient-to-b from-[#0B1E2B] to-[#07131C] rounded-2xl p-4 sm:p-5 border border-primary-500/20 shadow-2xl text-white overflow-hidden select-none">
      
      {/* Background blueprint matrix */}
      <div className="absolute inset-0 bg-grid-dark opacity-30 pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar of the spatial visualizer */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-[11px] font-bold text-slate-300 tracking-wider uppercase">
            Live Inter-Hospital Supply Telemetry
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary-500/20 border border-primary-400/30 text-primary-300 text-[10px] font-mono">
          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>99.9% Uptime</span>
        </div>
      </div>

      {/* Interactive 3D Network Canvas */}
      <div className="relative h-64 sm:h-72 w-full my-2">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0A6E79" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
            
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Glowing Connecting lines from Apollo Hub to satellites */}
          {nodes.slice(1).map((satellite, idx) => (
            <g key={idx}>
              {/* Static background corridor */}
              <line
                x1={nodes[0].coords.x}
                y1={nodes[0].coords.y}
                x2={satellite.coords.x}
                y2={satellite.coords.y}
                stroke="#1E3A4C"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              {/* Dynamic illuminated route */}
              <line
                x1={nodes[0].coords.x}
                y1={nodes[0].coords.y}
                x2={satellite.coords.x}
                y2={satellite.coords.y}
                stroke="url(#routeGradient)"
                strokeWidth="1.8"
                filter="url(#glow)"
                opacity="0.85"
              />
              {/* Animated moving pulse packets */}
              <circle r="1.4" fill="#06B6D4" filter="url(#glow)">
                <animateMotion
                  path={`M ${nodes[0].coords.x} ${nodes[0].coords.y} L ${satellite.coords.x} ${satellite.coords.y}`}
                  dur={`${3.2 + idx * 0.8}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <circle r="1" fill="#FFFFFF">
                <animateMotion
                  path={`M ${satellite.coords.x} ${satellite.coords.y} L ${nodes[0].coords.x} ${nodes[0].coords.y}`}
                  dur={`${4.5 + idx * 0.6}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </svg>

        {/* Render Node Anchors */}
        {nodes.map((node) => {
          const isSelected = activeNode === node.id;
          const isHub = node.type === 'hub';

          return (
            <div
              key={node.id}
              onClick={() => setActiveNode(node.id)}
              style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 group z-20 ${
                isSelected ? 'scale-110' : 'hover:scale-105 opacity-90 hover:opacity-100'
              }`}
            >
              {/* Outer pulse aura */}
              {isSelected && (
                <div className="absolute -inset-2 rounded-2xl bg-primary-400/30 blur-md animate-pulse pointer-events-none" />
              )}

              {/* Node Card Container */}
              <div
                className={`relative px-2.5 py-1.5 rounded-xl border flex items-center gap-2 backdrop-blur-md shadow-xl transition-colors ${
                  isHub
                    ? 'bg-gradient-to-r from-[#0C3B44] to-[#0A2E38] border-primary-400/80 text-white'
                    : isSelected
                    ? 'bg-primary-950/90 border-cyan-400 text-white shadow-cyan-500/20'
                    : 'bg-[#0E2331]/85 border-white/15 text-slate-200 hover:border-primary-400/50'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isHub ? 'bg-primary-500 text-white shadow-sm' : 'bg-white/10 text-cyan-300'
                  }`}
                >
                  {isHub ? <Building2 className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                </div>

                <div className="text-left leading-none">
                  <div className="text-[11px] font-extrabold tracking-tight truncate max-w-[100px] sm:max-w-[120px]">
                    {node.name}
                  </div>
                  <div className="text-[9px] font-mono text-cyan-300/80 mt-0.5">
                    {node.tag}
                  </div>
                </div>

                {isHub && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Node Telemetry Strip */}
      <div className="relative z-10 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-mono">Cold-Chain Temp</span>
          <div className="flex items-center justify-center gap-1 font-bold text-cyan-300 mt-0.5 font-mono">
            <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeNodeData.temp}</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-mono">SLA Compliance</span>
          <div className="flex items-center justify-center gap-1 font-bold text-emerald-400 mt-0.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{activeNodeData.compliance}</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-mono">Active Packages</span>
          <div className="flex items-center justify-center gap-1 font-bold text-amber-300 mt-0.5 font-mono">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeNodeData.consignments} Lots</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FloatingNetworkHero;

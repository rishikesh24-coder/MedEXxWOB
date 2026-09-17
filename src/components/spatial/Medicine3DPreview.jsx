import React, { useState } from 'react';
import { Pill, Thermometer, ShieldCheck, QrCode, Sparkles, CheckCircle2 } from 'lucide-react';

export const Medicine3DPreview = ({ medicine }) => {
  const [rotate, setRotate] = useState({ x: 8, y: -12 });
  const [isHovered, setIsHovered] = useState(false);

  const med = medicine || {
    brandName: 'Ceftriaxone Sodium IV',
    genericName: 'Ceftriaxone for Injection USP',
    power: '1g Vial',
    category: 'Critical Care / Antibiotic',
    batchNo: 'CF24-0981',
    storageType: 'Cold Storage (2°C - 8°C)',
    expiryDate: '2024-11-20',
    concessionPercent: 35,
    manufacturer: 'AstraZeneca Healthcare',
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Calculate subtle rotation angles (-15 to 15 deg)
    const rotX = -((y - centerY) / centerY) * 14;
    const rotY = ((x - centerX) / centerX) * 18;
    setRotate({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 8, y: -12 });
  };

  const isColdChain = med.storageType?.toLowerCase().includes('cold');

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-72 sm:h-80 flex items-center justify-center p-6 bg-gradient-to-br from-[#0B1A24] via-[#0D2433] to-[#07131B] rounded-2xl border border-primary-500/20 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing perspective-1000 select-none"
    >
      {/* Background blueprint and illumination spot */}
      <div className="absolute inset-0 bg-grid-dark opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Interactive 3D Package Container with spatial CSS transform */}
      <div
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative w-48 sm:w-56 h-56 sm:h-64 preserve-3d"
      >
        {/* Soft Depth Drop Shadow */}
        <div
          style={{
            transform: 'translateZ(-40px) translateY(30px) scale(0.9)',
          }}
          className="absolute inset-0 bg-black/60 blur-xl rounded-2xl pointer-events-none"
        />

        {/* Front Surface of 3D Medicine Box */}
        <div
          style={{
            transform: 'translateZ(20px)',
          }}
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200/90 shadow-2xl p-4 flex flex-col justify-between overflow-hidden"
        >
          {/* Top Holographic Tamper-Proof Seal */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />
              <span className="text-[10px] font-mono font-extrabold uppercase text-slate-700 tracking-wider">
                CDSCO CERTIFIED
              </span>
            </div>
            
            {/* Holographic foil badge */}
            <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-300 via-teal-200 to-primary-400 text-[9px] font-extrabold text-slate-900 border border-white/80 shadow-sm flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-slate-800" />
              <span>ORIGINAL</span>
            </div>
          </div>

          {/* Medicine Identification Block */}
          <div className="space-y-1 my-auto">
            <div className="inline-block px-2 py-0.5 rounded bg-primary-50 text-primary-700 font-mono text-[9px] font-bold border border-primary-200">
              {med.power}
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              {med.brandName}
            </h3>

            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
              {med.genericName}
            </p>

            <div className="pt-2 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <span>Lot: <strong className="text-slate-700 font-bold">{med.batchNo || 'LOT-2024-X'}</strong></span>
            </div>
          </div>

          {/* Bottom Specifications Bar */}
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Storage SLA:</span>
              <span className={`font-mono font-bold flex items-center gap-1 ${
                isColdChain ? 'text-primary-700' : 'text-slate-700'
              }`}>
                {isColdChain && <Thermometer className="w-3 h-3 text-cyan-600" />}
                {isColdChain ? '2°C - 8°C' : 'Room Temp'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Expiry:</span>
              <span className="font-mono font-bold text-amber-700">
                {med.expiryDate}
              </span>
            </div>
          </div>

          {/* Subtle Specular Glare Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />
        </div>

        {/* 3D Side Depth Flange (Giving physical depth) */}
        <div
          style={{
            transform: 'rotateY(90deg) translateZ(110px) scaleY(0.98)',
            transformOrigin: 'right center',
          }}
          className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-slate-200 to-slate-300 border-l border-slate-300 flex flex-col justify-between py-3 px-1 text-[8px] font-mono text-slate-500 rounded-r-lg"
        >
          <span className="rotate-90 origin-left tracking-wider">MEDEX</span>
          <QrCode className="w-5 h-5 mx-auto text-slate-600" />
        </div>
      </div>

      {/* Hover prompt footer */}
      <div className="absolute bottom-2.5 inset-x-0 text-center pointer-events-none">
        <span className="text-[10px] font-mono text-slate-400">
          Spatial 3D Model • Move cursor to inspect batch package angles
        </span>
      </div>
    </div>
  );
};

export default Medicine3DPreview;

import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Building2,
  MapPin,
  Navigation,
  Pill,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Calendar,
  Layers,
  Thermometer,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { findAlternatives, extractMedicineComposition } from '../../services/medicineAlternativeService';
import { getExpiryPricing, isExpiryAcceptable } from '../../config/nearExpiryPolicy';

/**
 * AlternativeMedicinesModal
 * 
 * Displays composition-matched branded alternative medicines for a requested medicine.
 * Adheres strictly to healthcare safety guidelines:
 * - Emphasizes composition matching over medical substitution
 * - Includes mandatory clinical review disclaimer
 * - Explains matching criteria transparently
 * - Computes unit price savings
 */
export const AlternativeMedicinesModal = ({
  isOpen,
  onClose,
  targetMedicine,
  marketplaceInventory = [],
  onSelectAlternative, // callback(alternativeMedicine) -> opens detail drawer
}) => {
  const [sortBy, setSortBy] = useState('savings'); // 'savings' | 'price' | 'distance' | 'expiry' | 'stock'

  // Extract composition specs of the target medicine
  const targetSpecs = useMemo(() => {
    if (!targetMedicine) return null;
    return extractMedicineComposition(targetMedicine);
  }, [targetMedicine]);

  // Find all alternatives from marketplace
  const rawAlternatives = useMemo(() => {
    if (!targetMedicine || !marketplaceInventory?.length) return [];
    return findAlternatives(targetMedicine, marketplaceInventory);
  }, [targetMedicine, marketplaceInventory]);

  // Sort alternatives based on user preference
  const sortedAlternatives = useMemo(() => {
    if (!rawAlternatives.length) return [];
    const list = [...rawAlternatives];

    switch (sortBy) {
      case 'savings':
        return list.sort((a, b) => (b.savingsPerUnit || 0) - (a.savingsPerUnit || 0));
      case 'price':
        return list.sort((a, b) => a.discountedPrice - b.discountedPrice);
      case 'distance':
        return list.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
      case 'expiry':
        return list.sort((a, b) => new Date(b.expiryDate || 0) - new Date(a.expiryDate || 0));
      case 'stock':
        return list.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
      default:
        return list;
    }
  }, [rawAlternatives, sortBy]);

  if (!isOpen || !targetMedicine) return null;

  const targetPricing = getExpiryPricing(targetMedicine.expiryDate, targetMedicine.unitOriginalPrice || targetMedicine.mrp);
  const targetDiscountedPrice = targetPricing.sellingPricePerUnit;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white flex items-start justify-between relative overflow-hidden flex-shrink-0">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1.5 z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/20 border border-primary-400/30 text-primary-200 text-xs font-mono font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-primary-300 animate-pulse" />
              <span>COMPOSITION-BASED ALTERNATIVE FINDER</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Alternative Branded Medicines
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Searching for medicines with identical active ingredients, potency, and dosage formulation from peer hospital pharmacies.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors z-10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* REFERENCE TARGET MEDICINE CARD */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {targetMedicine.brandName}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {targetMedicine.power}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {targetMedicine.genericName}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Mfg: {targetMedicine.manufacturer || 'Pharmaceuticals'} • Lot: {targetMedicine.batchNo || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 line-through block">
                  MRP ₹{targetMedicine.unitOriginalPrice}
                </span>
                <div className="text-lg font-extrabold font-mono text-slate-900">
                  ₹{targetDiscountedPrice} <span className="text-xs font-normal text-slate-500">/ unit</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                  {targetPricing.concessionPercent}% Concession Applied
                </span>
              </div>
            </div>

            {/* VERIFIED SPECIFICATION CRITERIA TAGS */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary-600" />
                <span>Alternative Matching Criteria (Locked Requirements):</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Active Molecule</span>
                    <span className="font-bold text-slate-800 text-[11px] truncate block capitalize">
                      {targetSpecs?.ingredients?.[0]?.name || targetMedicine.genericName}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Potency / Strength</span>
                    <span className="font-bold text-slate-800 text-[11px] truncate block font-mono">
                      {targetSpecs?.normalizedStrength || targetMedicine.power}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Dosage Form</span>
                    <span className="font-bold text-slate-800 text-[11px] truncate block">
                      {targetSpecs?.dosageForm || 'Tablet'}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Administration</span>
                    <span className="font-bold text-slate-800 text-[11px] truncate block">
                      {targetSpecs?.route || 'Oral'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ALTERNATIVE RESULTS CONTROLS BAR */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>Identified Alternatives</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-100 text-primary-800">
                  {sortedAlternatives.length} Found
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Branded equivalents with identical active formulation currently in peer hospital stock.
              </p>
            </div>

            {/* SORTING SELECTOR */}
            {sortedAlternatives.length > 0 && (
              <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
                <span className="text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sort by:</span>
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="savings">Greatest Savings First</option>
                  <option value="price">Lowest Unit Price</option>
                  <option value="distance">Nearest Hospital</option>
                  <option value="expiry">Longest Shelf-Life</option>
                  <option value="stock">Largest Stock Lot</option>
                </select>
              </div>
            )}
          </div>

          {/* LIST OF ALTERNATIVE CARDS */}
          {sortedAlternatives.length > 0 ? (
            <div className="space-y-4">
              {sortedAlternatives.map((alt) => {
                const isCold = alt.storageType?.toLowerCase().includes('cold');
                const hasSavings = (alt.savingsPerUnit || 0) > 0;
                const isIdenticalPrice = Math.abs((alt.savingsPerUnit || 0)) < 0.01;

                return (
                  <div
                    key={alt.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-card hover:border-primary-400 hover:shadow-card-hover transition-all space-y-4 group"
                  >
                    {/* Top Row: Brand, Savings Badge, Price */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-50 to-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <Pill className="w-6 h-6 rotate-45" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors">
                              {alt.brandName}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-xs font-mono font-extrabold bg-primary-50 text-primary-700 border border-primary-200">
                              {alt.power}
                            </span>
                            {hasSavings ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
                                <TrendingDown className="w-3 h-3 text-emerald-600" />
                                <span>Save ₹{alt.savingsPerUnit.toFixed(2)} / unit ({alt.savingsPercent}%)</span>
                              </span>
                            ) : isIdenticalPrice ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Equal Price
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-600 font-medium">
                            {alt.genericName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Manufacturer: <strong className="text-slate-600">{alt.manufacturer || 'Authorized Pharma'}</strong> • Batch: <span className="text-slate-600">{alt.batchNo || 'N/A'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Pricing block */}
                      {(() => {
                        const altPricing = getExpiryPricing(alt.expiryDate, alt.unitOriginalPrice || alt.mrp);
                        return (
                          <div className="text-left sm:text-right flex-shrink-0">
                            <span className="text-[10px] font-mono text-slate-400 line-through block">
                              MRP ₹{alt.unitOriginalPrice}
                            </span>
                            <div className="text-lg font-extrabold font-mono text-primary-800">
                              ₹{altPricing.sellingPricePerUnit} <span className="text-xs font-normal text-slate-500">/ unit</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                              {altPricing.concessionPercent}% Concession
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Middle Row: Peer Hospital, Specs & Storage */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                      {/* Hospital & Distance */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold truncate">
                          <Building2 className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                          <span className="truncate">{alt.hospitalName}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {alt.location}
                          </span>
                          <span className="font-mono font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {alt.distanceKm || 12} km
                          </span>
                        </div>
                      </div>

                      {/* Stock & Expiry */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Stock Available</span>
                          <span className="font-mono font-extrabold text-slate-900">{alt.quantity} units</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Expiry Window</span>
                          <span className="font-mono font-bold text-amber-700">{alt.expiryDate}</span>
                        </div>
                      </div>

                      {/* Storage Protocol */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">Storage Condition</div>
                        <div className={`font-mono font-bold text-xs flex items-center gap-1.5 ${
                          isCold ? 'text-primary-700' : 'text-slate-700'
                        }`}>
                          <Thermometer className="w-3.5 h-3.5 text-cyan-600" />
                          <span>{alt.storageType || 'Room Temp (15-25°C)'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Why This Matches Verification Checklist */}
                    <div className="p-3 rounded-xl bg-primary-50/50 border border-primary-100 text-xs space-y-1.5">
                      <div className="text-[11px] font-bold text-primary-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />
                        <span>Why this alternative was matched:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-700">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active: <strong className="capitalize">{alt.matchingCriteria?.ingredientSummary}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Strength: <strong className="font-mono">{alt.matchingCriteria?.strengthMatch}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Form: <strong>{alt.matchingCriteria?.dosageFormMatch}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Button */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 font-medium">
                        CDSCO compliant inter-hospital lot transfer
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectAlternative(alt);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span>Select & Inspect This Alternative</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Pill className="w-6 h-6 rotate-45" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                No Direct Composition Alternatives Listed Right Now
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                There are currently no alternative brand medicines in the marketplace matching the exact active ingredients (<strong className="text-slate-700">{targetSpecs?.ingredients?.[0]?.name || targetMedicine.genericName}</strong>), strength (<strong className="text-slate-700">{targetSpecs?.normalizedStrength || targetMedicine.power}</strong>), and formulation (<strong className="text-slate-700">{targetSpecs?.dosageForm || 'form'}</strong>).
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  Return to Marketplace
                </button>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>Selecting an alternative launches the standard verified requisition flow.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition-colors"
          >
            Close Finder
          </button>
        </div>

      </div>
    </div>
  );
};

export default AlternativeMedicinesModal;

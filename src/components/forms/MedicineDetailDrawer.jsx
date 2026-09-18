import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Building2, 
  MapPin, 
  Thermometer, 
  Calendar, 
  ShieldCheck, 
  Send, 
  Sparkles, 
  Clock, 
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingDown,
  Info,
  Layers,
  ChevronDown,
  Box
} from 'lucide-react';
import Medicine3DPreview from '../spatial/Medicine3DPreview';
import MedicineImageGallery from '../hospital/MedicineImageGallery';
import PurchaseInvoiceViewer from '../hospital/PurchaseInvoiceViewer';
import { calculateOrderPricing } from '../../utils/pricingUtils';
import { findAlternatives, extractMedicineComposition, CLINICAL_SAFETY_DISCLAIMER } from '../../services/medicineAlternativeService';
import { validateRequisition } from '../../utils/validation';
import { getExpiryPricing, isExpiryAcceptable } from '../../config/nearExpiryPolicy';
import toast from 'react-hot-toast';

// ============================================================
// SAFE NUMERIC & CURRENCY HELPERS
// Ensures drawer NEVER crashes when numeric fields are missing/undefined
// ============================================================

function formatNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-IN')
    : fallback.toLocaleString('en-IN');
}

function formatCurrency(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? `₹${number.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : '₹0.00';
}

function formatDecimal(value, fractionDigits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(fractionDigits) : '0.00';
}

function normalizeMedicine(med) {
  if (!med) return null;

  const rawPrice = med.unitOriginalPrice ?? med.price ?? med.unitPrice ?? 0;
  const numPrice = Number(rawPrice);
  const safePrice = Number.isFinite(numPrice) ? Math.max(0, numPrice) : 0;

  const rawQty = med.quantity ?? med.stock ?? 0;
  const numQty = Number(rawQty);
  const safeQty = Number.isFinite(numQty) ? Math.max(0, Math.floor(numQty)) : 0;

  const rawConcession = med.concessionPercent ?? med.discountPercent ?? 0;
  const numConcession = Number(rawConcession);
  const safeConcession = Number.isFinite(numConcession) ? Math.max(0, Math.min(100, numConcession)) : 0;

  const rawDistance = med.distanceKm ?? med.distance ?? 12;
  const numDistance = Number(rawDistance);
  const safeDistance = Number.isFinite(numDistance) ? Math.max(0, numDistance) : 12;

  return {
    ...med,
    id: med.id || `med-${Math.random().toString(36).substr(2, 9)}`,
    brandName: med.brandName || med.medicineName || med.name || 'Not available',
    genericName: med.genericName || med.composition || 'Not available',
    power: med.power || med.strength || med.dosage || 'Not available',
    dosageForm: med.dosageForm || med.form || 'Tablet',
    route: med.route || 'Oral',
    hospitalName: med.hospitalName || med.hospital || med.seller || 'Authorized Hospital',
    location: med.location || med.city || 'Not available',
    distanceKm: safeDistance,
    batchNo: med.batchNo || med.batchNumber || med.batch || 'Not available',
    mfgDate: med.mfgDate || med.manufacturingDate || 'Not available',
    expiryDate: med.expiryDate || med.expiry || 'Not available',
    manufacturer: med.manufacturer || 'Not available',
    packSize: med.packing || med.packSize || med.unit || '15 Tablets',
    shelfLocation: med.shelfLocation || 'Rack A - Shelf 3',
    storageType: med.storageType || 'Room Temperature',
    category: med.category || 'Pharmaceutical',
    quantity: safeQty,
    stock: safeQty,
    unitOriginalPrice: safePrice,
    price: safePrice,
    unitPrice: safePrice,
    concessionPercent: safeConcession,
  };
}

/**
 * MedicineDetailDrawer
 * 
 * Rich, Apollo-style medicine product detail view:
 * 1. Actual medicine/product image gallery & fallback
 * 2. Medicine header, category, storage protocol
 * 3. Composition table (Active ingredient, strength, form, route, manufacturer, pack size)
 * 4. Manufacturer, batch number, expiry date
 * 5. Seller hospital & verified status
 * 6. Stock & unit pricing with concession discounts
 * 7. B2B Purchase Bill / Invoice provenance viewer
 * 8. Requisition submission workflow
 * 9. Composition-based alternative medicines with ALTERNATIVE badges and price comparisons
 */
export const MedicineDetailDrawer = ({ 
  isOpen, 
  onClose, 
  medicine, 
  onRequestSubmit,
  isRequestDisabled = false,
  onOpenAlternatives,
  marketplace = []
}) => {
  // Raw medicine object tracked internally for alternative switching
  const [activeMedRaw, setActiveMedRaw] = useState(medicine);
  const [requestQty, setRequestQty] = useState(1);
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [show3DView, setShow3DView] = useState(false);

  // Sync internal medicine when incoming prop changes
  useEffect(() => {
    setActiveMedRaw(medicine);
    setShow3DView(false);
  }, [medicine]);

  // Normalized safe medicine object guaranteed to never produce undefined field crashes
  const activeMed = useMemo(() => normalizeMedicine(activeMedRaw), [activeMedRaw]);

  useEffect(() => {
    if (activeMed) {
      const available = activeMed.quantity;
      if (available > 0) {
        setRequestQty(Math.min(10, available));
      } else {
        setRequestQty(0);
      }
    }
  }, [activeMedRaw]);

  // Composition-matched alternatives for the currently viewed medicine
  const alternatives = useMemo(() => {
    if (!activeMed || !marketplace?.length) return [];
    return findAlternatives(activeMed, marketplace);
  }, [activeMed, marketplace]);

  // Composition specifications
  const compositionSpecs = useMemo(() => {
    if (!activeMed) return null;
    return extractMedicineComposition(activeMed);
  }, [activeMed]);

  // Safe pricing calculation with resilient fallback guarantees
  const pricing = useMemo(() => {
    if (!activeMed) {
      return {
        unitOriginalPrice: 0,
        unitSellingPrice: 0,
        unitFinalPrice: 0,
        unitDiscount: 0,
        quantity: 0,
        originalSubtotal: 0,
        totalSavings: 0,
        concessionSavings: 0,
        medicineSubtotal: 0,
        subtotal: 0,
        distanceKm: 12,
        isColdChain: false,
        logisticsFee: 0,
        gstRate: 0.12,
        gstAmount: 0,
        totalPayable: 0,
        tierLabel: '',
      };
    }

    const calculated = calculateOrderPricing({
      unitOriginalPrice: activeMed.unitOriginalPrice,
      expiryDate: activeMed.expiryDate !== 'Not available' ? activeMed.expiryDate : null,
      concessionPercent: activeMed.concessionPercent,
      quantity: requestQty > 0 ? requestQty : 1,
      distanceKm: activeMed.distanceKm,
      isColdChain: String(activeMed.storageType || '').toLowerCase().includes('cold')
    });

    const subtotal = Number(calculated.medicineSubtotal ?? calculated.subtotal ?? 0);
    const savings = Number(calculated.totalSavings ?? calculated.concessionSavings ?? 0);
    const gst = Number(calculated.gstAmount ?? 0);
    const total = Number(calculated.totalPayable ?? 0);
    const sellingPrice = Number(calculated.unitSellingPrice ?? calculated.unitFinalPrice ?? activeMed.unitOriginalPrice);

    return {
      ...calculated,
      subtotal,
      medicineSubtotal: subtotal,
      totalSavings: savings,
      concessionSavings: savings,
      gstAmount: gst,
      totalPayable: total,
      unitSellingPrice: sellingPrice,
      unitFinalPrice: sellingPrice,
    };
  }, [activeMed, requestQty]);

  if (!isOpen || !activeMed) return null;

  const policyPricing = useMemo(() => {
    return getExpiryPricing(activeMed?.expiryDate, activeMed?.unitOriginalPrice);
  }, [activeMed?.expiryDate, activeMed?.unitOriginalPrice]);

  const concession = policyPricing.concessionPercent;
  const finalUnitPrice = pricing.unitFinalPrice;
  const totalAmount = pricing.totalPayable;
  const isColdChain = String(activeMed.storageType || '').toLowerCase().includes('cold');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeMed) return;

    if (!isExpiryAcceptable(activeMed.expiryDate)) {
      toast.error('Stock cannot be accepted or requested because the medicine expires within 1 month.');
      return;
    }

    if (activeMed.quantity <= 0) {
      toast.error('This medicine batch is currently out of stock.');
      return;
    }

    const { isValid, error, sanitizedData } = validateRequisition(
      { quantity: requestQty, notes: requestNotes },
      activeMed
    );

    if (!isValid) {
      toast.error(error || 'Invalid requisition parameters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRequestSubmit({
        medicine: activeMed,
        quantity: sanitizedData.quantity,
        notes: sanitizedData.notes,
        finalUnitPrice,
        totalAmount,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectAlternative = (altMedicine) => {
    setActiveMedRaw(altMedicine);
    // Smoothly scroll container to top
    const container = document.getElementById('medicine-detail-modal-body');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card Container */}
      <div 
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-scaleUp my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* TOP HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-200/90 flex items-start justify-between bg-slate-50/70 sticky top-0 z-20 backdrop-blur-md">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-700 border border-primary-200">
                CDSCO RULE 65 COMPLIANT
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>VERIFIED HOSPITAL STOCK</span>
              </span>
              {concession > 20 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {Math.round(concession)}% CONCESSION APPLIED
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {activeMed.brandName}
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium flex-wrap">
              <span className="font-bold text-primary-700 font-mono">{activeMed.power}</span>
              <span className="text-slate-300">•</span>
              <span>{activeMed.genericName}</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-500">{activeMed.dosageForm}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 cursor-pointer"
            title="Close detail view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE 2-COLUMN PRODUCT DETAIL BODY */}
        <div id="medicine-detail-modal-body" className="p-5 sm:p-8 overflow-y-auto space-y-8 flex-1 bg-slate-50/40 font-sans">
          
          {/* 2-COLUMN GRID (DESKTOP: 5 / 7 RATIO) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: IMAGES, 3D PREVIEW, PURCHASE INVOICE */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Product Image Gallery with Thumbnails & Fallback */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-mono">
                    Product Packaging
                  </span>
                  <button
                    type="button"
                    onClick={() => setShow3DView(!show3DView)}
                    className="text-[11px] font-bold text-primary-700 hover:text-primary-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>{show3DView ? 'Show Photo Gallery' : 'View 3D Hologram'}</span>
                  </button>
                </div>

                {show3DView ? (
                  <div className="space-y-2">
                    <Medicine3DPreview medicine={activeMed} />
                    <p className="text-[10px] text-center text-slate-400 font-mono">
                      Interactive 3D Digital Medicine Package
                    </p>
                  </div>
                ) : (
                  <MedicineImageGallery medicine={activeMed} />
                )}
              </div>

              {/* Purchase Bill / Provenance Invoice Viewer */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
                <PurchaseInvoiceViewer medicine={activeMed} />
              </div>

            </div>

            {/* RIGHT COLUMN: SPECS, PRICING, REQUISITION, COMPOSITION */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* SELLER HOSPITAL & STOCK STATUS CARD */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                      Listed By Seller Hospital
                    </span>
                    <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                      <Building2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      <span>{activeMed.hospitalName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{activeMed.location}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-emerald-700 font-bold">{formatNumber(activeMed.distanceKm, 12)} km away</span>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-extrabold shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>In Stock: {formatNumber(activeMed.quantity, 0)} units</span>
                    </span>
                  </div>
                </div>

                {/* Batch, Mfg, Expiry, Storage Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1 font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Batch Lot</span>
                    <span className="font-bold text-slate-800 text-xs">{activeMed.batchNo}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Mfg Date</span>
                    <span className="font-semibold text-slate-700 text-xs">{activeMed.mfgDate}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Expiry Date</span>
                    <span className="font-bold text-amber-700 text-xs">{activeMed.expiryDate}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Storage</span>
                    <span className={`font-bold text-[11px] truncate block ${
                      isColdChain ? 'text-cyan-700' : 'text-slate-700'
                    }`}>
                      {isColdChain ? 'Cold 2-8°C' : 'Room Temp'}
                    </span>
                  </div>
                </div>
              </div>

              {/* COMPOSITION SPECIFICATIONS TABLE */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary-600" />
                    <span>Active Pharmaceutical Composition</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Verified Formulation
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-500 font-semibold w-1/3">Active Ingredient</td>
                        <td className="py-2 text-slate-900 font-extrabold capitalize">
                          {compositionSpecs?.ingredients?.[0]?.name || activeMed.genericName}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500 font-semibold">Strength / Potency</td>
                        <td className="py-2 text-slate-900 font-extrabold font-mono">
                          {compositionSpecs?.normalizedStrength || activeMed.power}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500 font-semibold">Dosage Formulation</td>
                        <td className="py-2 text-slate-900 font-bold">
                          {compositionSpecs?.dosageForm || activeMed.dosageForm}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500 font-semibold">Administration Route</td>
                        <td className="py-2 text-slate-900 font-bold">
                          {compositionSpecs?.route || activeMed.route}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500 font-semibold">Manufacturer</td>
                        <td className="py-2 text-slate-900 font-bold">
                          {activeMed.manufacturer}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500 font-semibold">Packaging Unit</td>
                        <td className="py-2 text-slate-900 font-bold">
                          {activeMed.packSize}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PRICING AND REQUISITION FORM */}
              <form onSubmit={handleSubmit} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 line-through block">
                      Standard MRP {formatCurrency(activeMed.unitOriginalPrice)} / unit
                    </span>
                    <div className="text-2xl font-black font-mono text-primary-800 leading-tight">
                      {formatCurrency(finalUnitPrice)} <span className="text-xs font-normal text-slate-500">/ unit</span>
                    </div>
                  </div>

                  {concession > 0 && (
                    <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold">
                      {Math.round(concession)}% Concession Savings
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Quantity Required:</span>
                      <span className="text-slate-400 font-normal">Max: {formatNumber(activeMed.quantity, 0)}</span>
                    </div>
                    <input
                      type="number"
                      min={activeMed.quantity > 0 ? 1 : 0}
                      max={Math.max(1, activeMed.quantity)}
                      required
                      disabled={activeMed.quantity <= 0}
                      value={requestQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const max = Math.max(1, activeMed.quantity);
                        setRequestQty(Math.max(1, Math.min(max, Number.isFinite(val) ? val : 1)));
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Clinical Urgency / Requisition Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Inpatient surgical quota..."
                      value={requestNotes}
                      onChange={(e) => setRequestNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* ESCROW BREAKDOWN */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Base Subtotal ({formatNumber(requestQty, 0)} units):</span>
                    <span>{formatCurrency(pricing.subtotal)}</span>
                  </div>
                  {Number(pricing.concessionSavings) > 0 && (
                    <div className="flex justify-between text-amber-400 text-[11px]">
                      <span>Concession Savings:</span>
                      <span>-{formatCurrency(pricing.concessionSavings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>GST (12% Pharma):</span>
                    <span>+{formatCurrency(pricing.gstAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700 flex items-center justify-between font-bold">
                    <span className="text-slate-300">Total Escrow Value:</span>
                    <span className="text-base text-cyan-300">
                      {formatCurrency(pricing.totalPayable)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isRequestDisabled || activeMed.quantity <= 0}
                  className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-lg shadow-primary-600/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{activeMed.quantity <= 0 ? 'Out of Stock' : 'Request This Medicine'}</span>
                </button>
              </form>

            </div>

          </div>

          {/* SECTION: COMPOSITION-BASED ALTERNATIVES */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-primary-600 animate-pulse" />
                  <span>Composition-Based Alternatives</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-primary-100 text-primary-800">
                  {alternatives.length} {alternatives.length === 1 ? 'Option' : 'Options'} Found
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Different brands with the same active composition, strength and dosage form.
              </p>
            </div>

            {/* MANDATORY CLINICAL SAFETY NOTICE */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed font-medium">
                {CLINICAL_SAFETY_DISCLAIMER}
              </p>
            </div>

            {/* ALTERNATIVES GRID */}
            {alternatives.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {alternatives.map((alt) => {
                  const safeAlt = normalizeMedicine(alt);
                  const altUnitPrice = Number(safeAlt.discountedPrice ?? safeAlt.unitSellingPrice ?? safeAlt.unitOriginalPrice);
                  const hasSavings = (Number(safeAlt.savingsPerUnit) || 0) > 0;
                  const priceDiff = altUnitPrice - Number(finalUnitPrice || 0);

                  return (
                    <div 
                      key={safeAlt.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-primary-400 hover:shadow-card-hover transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2">
                        {/* VISIBLE ALTERNATIVE BADGE */}
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                            <span>ALTERNATIVE</span>
                          </span>

                          <span className="text-[10px] font-mono text-slate-500">
                            {formatNumber(safeAlt.quantity, 0)} available
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors">
                            {safeAlt.brandName}
                          </h4>
                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            {safeAlt.genericName} • {safeAlt.power}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Mfd by: {safeAlt.manufacturer}
                          </p>
                        </div>

                        {/* PRICE COMPARISON */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="text-[9px] text-slate-400 block">Unit Price</span>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {formatCurrency(altUnitPrice)} <span className="text-[9px] font-normal text-slate-500">/ unit</span>
                            </span>
                          </div>

                          {hasSavings ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              ₹{formatDecimal(safeAlt.savingsPerUnit, 2)} cheaper
                            </span>
                          ) : priceDiff > 0 ? (
                            <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                              +₹{formatDecimal(priceDiff, 2)} / unit
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                              Equal Price
                            </span>
                          )}
                        </div>

                        {/* SELLER HOSPITAL & DISTANCE */}
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span className="truncate font-semibold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                            <span className="truncate">{safeAlt.hospitalName}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                            {formatNumber(safeAlt.distanceKm, 12)} km
                          </span>
                        </div>

                        {/* WHY IS THIS AN ALTERNATIVE? CHECKLIST */}
                        <div className="p-2.5 rounded-xl bg-primary-50/50 border border-primary-100 text-[10px] space-y-1 text-slate-700">
                          <div className="font-bold text-primary-900 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-primary-600" />
                            <span>Verified Equivalence Criteria:</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 font-medium">
                            <div>✓ Same active ingredient</div>
                            <div>✓ Same strength ({safeAlt.power})</div>
                            <div>✓ Same dosage form ({safeAlt.dosageForm})</div>
                            <div>✓ Same route ({safeAlt.route})</div>
                          </div>
                        </div>
                      </div>

                      {/* SWITCH VIEW TRIGGER BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleSelectAlternative(safeAlt)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-primary-600 hover:text-white text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 group-hover:bg-primary-600 group-hover:text-white cursor-pointer"
                      >
                        <span>View This Alternative</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">
                  No direct composition alternatives currently listed in peer hospital stock
                </p>
                <p className="text-[11px] text-slate-500">
                  Other listings have different active ingredients, strengths, or formulations.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-slate-500 text-[11px]">
            CDSCO Rule 65 inter-hospital mutual exchange platform
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Close Detail View
          </button>
        </div>

      </div>
    </div>
  );
};

export default MedicineDetailDrawer;

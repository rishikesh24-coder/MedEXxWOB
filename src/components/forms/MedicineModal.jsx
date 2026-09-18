import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Calculator, Sparkles, AlertTriangle, ShieldCheck, ThermometerSnowflake, Package, Layers, Info } from 'lucide-react';
import { getExpiryPricing, isExpiryAcceptable } from '../../config/nearExpiryPolicy';
import { calculateMedicineExpiry } from '../../utils/expiryUtils';
import { validateMedicineForm } from '../../utils/validation';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { getStoredItem, KEYS } from '../../services/storage';
import toast from 'react-hot-toast';

export const MedicineModal = ({ isOpen, onClose, onSubmit, initialData = null, isEdit = false }) => {
  const [formData, setFormData] = useState({
    medicineId: '',
    medicineName: '',
    brandName: '',
    genericName: '',
    power: '',
    form: 'Tablet',
    category: 'Critical Care / Antibiotic',
    storageType: 'Room Temperature (15°C - 25°C)',
    shelfLocation: 'Rack A - Shelf 3',
    packing: '15 Tablets',
    mfgDate: '',
    expiryDate: '',
    batchNo: '',
    manufacturer: '',
    quantity: 100,
    unitOriginalPrice: 500,
    costRate: 425,
    minStockLevel: 20,
    concessionPercent: 20,
    notes: '',
  });

  const [autoSuggestedConcession, setAutoSuggestedConcession] = useState(null);
  const [masterMedicines, setMasterMedicines] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setMasterMedicines(getStoredItem(KEYS.MASTER_MEDICINES, []));
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        medicineId: initialData.medicineId || '',
        medicineName: initialData.brandName || initialData.medicineName || '',
        brandName: initialData.brandName || '',
        genericName: initialData.genericName || '',
        power: initialData.power || '',
        form: initialData.form || initialData.dosageForm || 'Tablet',
        category: initialData.category || 'Critical Care / Antibiotic',
        storageType: initialData.storageType || 'Room Temperature (15°C - 25°C)',
        shelfLocation: initialData.shelfLocation || 'Rack A - Shelf 3',
        packing: initialData.packing || initialData.packSize || '15 Tablets / Strip',
        packSize: initialData.packSize || initialData.packing || '15 Tablets / Strip',
        numberOfPacks: initialData.numberOfPacks || (initialData.quantity ? Math.ceil(initialData.quantity / (initialData.unitsPerPack || 15)) : 20),
        unitsPerPack: initialData.unitsPerPack || 15,
        totalUnits: initialData.totalUnits || initialData.quantity || 300,
        mfgDate: initialData.mfgDate || '',
        expiryDate: initialData.expiryDate || '',
        batchNo: initialData.batchNo || '',
        manufacturer: initialData.manufacturer || '',
        quantity: initialData.quantity || 300,
        unitOriginalPrice: initialData.unitOriginalPrice || initialData.mrp || 100,
        costRate: initialData.costRate || initialData.acquisitionCost || Math.round((initialData.unitOriginalPrice || 100) * 0.90),
        minStockLevel: initialData.minStockLevel || 100,
        concessionPercent: initialData.concessionPercent ?? 5,
        notes: initialData.notes || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
      setFormData({
        medicineId: '',
        medicineName: '',
        brandName: '',
        genericName: '',
        power: '',
        form: 'Tablet',
        category: 'Critical Care / Antibiotic',
        storageType: 'Room Temperature (15°C - 25°C)',
        shelfLocation: 'Rack A - Shelf 3',
        packing: '15 Tablets / Strip',
        packSize: '15 Tablets / Strip',
        numberOfPacks: 20,
        unitsPerPack: 15,
        totalUnits: 300,
        mfgDate: today,
        expiryDate: futureDate,
        batchNo: 'BAT-' + Math.floor(10000 + Math.random() * 90000),
        manufacturer: '',
        quantity: 300,
        unitOriginalPrice: 100,
        costRate: 90,
        minStockLevel: 100,
        concessionPercent: 5,
        notes: '',
      });
      setAutoSuggestedConcession(null);
    }
  }, [initialData, isOpen]);

  // Dynamic concession calculation strictly derived from batch expiry date
  const handleDateChange = (dateVal) => {
    setFormData((prev) => {
      const pricing = dateVal ? getExpiryPricing(dateVal, prev.unitOriginalPrice || 100) : null;
      return {
        ...prev,
        expiryDate: dateVal,
        concessionPercent: pricing?.acceptable ? pricing.concessionPercent : 0,
      };
    });
  };

  const handleBrandNameChange = (val) => {
    const trimmed = val.trim().toLowerCase();
    const match = masterMedicines.find(
      (m) =>
        (m.medicineName || '').trim().toLowerCase() === trimmed ||
        (m.brandName || '').trim().toLowerCase() === trimmed
    );

    if (match) {
      setFormData((prev) => ({
        ...prev,
        brandName: val,
        medicineName: match.medicineName || match.brandName,
        genericName: match.genericName || prev.genericName,
        power: match.strength || match.power || prev.power,
        form: match.dosageForm || match.form || prev.form,
        category: match.category || prev.category,
        manufacturer: match.manufacturer || prev.manufacturer,
        storageType: match.storageType || prev.storageType,
        packing: match.packing || prev.packing,
        costRate: match.costRate || prev.costRate,
        medicineId: match.id,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        brandName: val,
        medicineName: val,
      }));
    }
  };

  // Central policy pricing derivation
  const expiryPricing = formData.expiryDate
    ? getExpiryPricing(formData.expiryDate, formData.unitOriginalPrice || 100, null, formData.quantity || 1)
    : null;
  const isAcceptable = !formData.expiryDate || Boolean(expiryPricing?.acceptable);
  const finalUnitPrice = expiryPricing ? expiryPricing.sellingPricePerUnit : Number(formData.unitOriginalPrice || 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.expiryDate && !isExpiryAcceptable(formData.expiryDate)) {
      toast.error(expiryPricing?.rejectionReason || 'Stock cannot be accepted because the medicine expires within 1 month.');
      return;
    }

    const { isValid, errors, sanitizedData } = validateMedicineForm(formData);
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError || 'Please correct form validation errors.');
      return;
    }

    if (sanitizedData.expiryDate && !isExpiryAcceptable(sanitizedData.expiryDate)) {
      toast.error(expiryPricing?.rejectionReason || 'Stock cannot be accepted because the medicine expires within 1 month.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(sanitizedData);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to save medicine record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Medicine Record' : 'Add Medicine to Hospital Inventory'}
      subtitle="Enter pharmaceutical specifications, batch identification, cold chain conditions, and inventory thresholds."
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        
        {/* Field 1 & 2: Medicine Name / Brand Name & Generic Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Medicine / Brand Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              list="master-medicines-catalogue-datalist"
              placeholder="e.g. Augmentin 625 Duo, Meropenem IV"
              value={formData.brandName}
              onChange={(e) => handleBrandNameChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-semibold text-slate-900"
            />
            <datalist id="master-medicines-catalogue-datalist">
              {masterMedicines.map((m) => (
                <option key={m.id} value={m.medicineName || m.brandName}>
                  {m.genericName ? `${m.genericName} • ${m.strength || m.power}` : m.category}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Generic / Composition Name
            </label>
            <input
              type="text"
              placeholder="e.g. Amoxicillin + Clavulanic Acid"
              value={formData.genericName}
              onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Field 3 & 4 & 5: Dosage/Strength, Form & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dosage / Strength <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 625mg, 1g IV Vial, 40mg/0.4ml"
              value={formData.power}
              onChange={(e) => setFormData({ ...formData, power: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dosage Form <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.form}
              onChange={(e) => setFormData({ ...formData, form: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-medium text-slate-800"
            >
              <option value="Tablet">Tablet</option>
              <option value="Capsule">Capsule</option>
              <option value="Syrup">Syrup</option>
              <option value="Injection / Vial">Injection / Vial</option>
              <option value="Infusion Bottle">Infusion Bottle</option>
              <option value="Pre-filled Syringe / Pen">Pre-filled Syringe / Pen</option>
              <option value="Ampoule">Ampoule</option>
              <option value="Suspension">Suspension</option>
              <option value="Ointment / Gel">Ointment / Gel</option>
              <option value="Inhaler">Inhaler</option>
              <option value="Drops">Drops</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Therapeutic Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white text-xs"
            >
              <option value="Critical Care / Antibiotic">Critical Care / Antibiotic</option>
              <option value="Cardiology / Hematology">Cardiology / Hematology</option>
              <option value="Emergency / Plasma expander">Emergency / Plasma expander</option>
              <option value="Oncology">Oncology</option>
              <option value="Diabetes Care">Diabetes Care</option>
              <option value="Gastroenterology">Gastroenterology</option>
              <option value="Steroids / Anti-inflammatory">Steroids / Anti-inflammatory</option>
              <option value="Analgesics / Antipyretic">Analgesics / Antipyretic</option>
            </select>
          </div>
        </div>

        {/* Field 6 & 7 & 8: Batch No, Manufacturer & Storage Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Batch / Lot Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BAT-88210"
              value={formData.batchNo}
              onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Manufacturer Pharma
            </label>
            <input
              type="text"
              placeholder="e.g. Cipla, Sun Pharma, GSK"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Storage Condition
            </label>
            <select
              value={formData.storageType}
              onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-medium"
            >
              <option value="Room Temperature (15°C - 25°C)">Room Temperature (15°C - 25°C)</option>
              <option value="Cold Storage (2°C - 8°C)">Cold Storage (2°C - 8°C)</option>
              <option value="Deep Freeze (-20°C)">Deep Freeze (-20°C)</option>
              <option value="Protect from Light (<25°C)">Protect from Light (&lt;25°C)</option>
              <option value="Dry & Cool (<25°C)">Dry & Cool (&lt;25°C)</option>
            </select>
          </div>
        </div>

        {/* Packing / Pack Size & Shelf / Storage Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Packing / Pack Size
            </label>
            <input
              type="text"
              placeholder="e.g. 15 Tablets / Strip, 100 ml / Bottle"
              value={formData.packing}
              onChange={(e) => setFormData({ ...formData, packing: e.target.value, packSize: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shelf / Storage Location <span className="text-slate-400 font-normal">(Hospital Physical Location)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Rack A - Shelf 3, Pharmacy Room 1 - Rack B"
              value={formData.shelfLocation}
              onChange={(e) => setFormData({ ...formData, shelfLocation: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
            />
          </div>
        </div>

        {/* Packaging Breakdown: Number of Packs & Units per Pack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Number of Packs / Strips
            </label>
            <input
              type="number"
              min="1"
              value={formData.numberOfPacks}
              onChange={(e) => {
                const packs = Math.max(1, Number(e.target.value));
                const units = Number(formData.unitsPerPack) || 15;
                const tot = packs * units;
                setFormData((prev) => ({
                  ...prev,
                  numberOfPacks: packs,
                  quantity: tot,
                  totalUnits: tot,
                }));
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono font-bold"
              placeholder="e.g. 20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Units per Pack / Strip
            </label>
            <input
              type="number"
              min="1"
              value={formData.unitsPerPack}
              onChange={(e) => {
                const units = Math.max(1, Number(e.target.value));
                const packs = Number(formData.numberOfPacks) || 1;
                const tot = packs * units;
                setFormData((prev) => ({
                  ...prev,
                  unitsPerPack: units,
                  quantity: tot,
                  totalUnits: tot,
                }));
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono font-bold"
              placeholder="e.g. 15"
            />
          </div>
        </div>

        {/* Field 9 & 10: Manufacturing Date & Expiry Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Manufacturing Date (MFG)
            </label>
            <input
              type="date"
              value={formData.mfgDate}
              onChange={(e) => setFormData({ ...formData, mfgDate: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Expiry Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.expiryDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono font-bold"
            />
          </div>
        </div>

        {/* Central Policy Expiry Evaluation Callout */}
        {expiryPricing && !expiryPricing.acceptable && (
          <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs flex items-center justify-between font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span><strong>Cannot Accept:</strong> {expiryPricing.rejectionReason}</span>
            </div>
            <span className="font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
              REJECTED
            </span>
          </div>
        )}

        {expiryPricing && expiryPricing.acceptable && (
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            expiryPricing.concessionPercent > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0 text-primary-600" />
              <span>
                <strong>Policy Standard:</strong> {expiryPricing.remainingShelfLife.formatted} • {expiryPricing.concessionPercent > 0 ? `Near-expiry concession: ${expiryPricing.concessionPercent}%` : 'Full shelf life (0% concession)'}
              </span>
            </div>
            <span className="font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">
              {expiryPricing.tierBadge}
            </span>
          </div>
        )}

        {/* Field 11, Quantity, Unit Price & Minimum Stock Level */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-50/70 to-slate-50 border border-primary-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary-600" />
              <span className="text-xs font-bold text-primary-900">Stock Quantity & Pricing Parameters</span>
            </div>
            {expiryPricing?.acceptable && expiryPricing.concessionPercent > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Near-Expiry Concession: {expiryPricing.concessionPercent}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Stock Quantity (Units) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => {
                  const qty = Math.max(1, Number(e.target.value));
                  const units = Number(formData.unitsPerPack) || 15;
                  const packs = Math.max(1, Math.ceil(qty / units));
                  setFormData((prev) => ({
                    ...prev,
                    quantity: qty,
                    totalUnits: qty,
                    numberOfPacks: packs,
                  }));
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {formData.numberOfPacks || 1} packs × {formData.unitsPerPack || 15} units
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Unit MRP (₹ / unit) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.unitOriginalPrice}
                onChange={(e) => setFormData({ ...formData, unitOriginalPrice: Math.max(1, Number(e.target.value)) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Acquisition Cost (₹ / unit)
              </label>
              <input
                type="number"
                min="0"
                value={formData.costRate}
                onChange={(e) => setFormData({ ...formData, costRate: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono font-bold"
                placeholder="e.g. 90"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Reorder Level (Buffer)
              </label>
              <input
                type="number"
                min="0"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({ ...formData, minStockLevel: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono font-bold"
                placeholder="e.g. 20 units"
              />
            </div>
          </div>

          {/* Pricing Summary Row */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-primary-200/60 text-xs">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-slate-500">MRP: </span>
                <span className="font-bold text-slate-900 font-mono">₹{formData.unitOriginalPrice}</span>
              </div>
              <div className="border-l border-slate-300 pl-3">
                <span className="text-slate-500">Selling Price / Unit: </span>
                <span className="font-bold text-emerald-700 font-mono">₹{finalUnitPrice}</span>
                {expiryPricing?.acceptable && expiryPricing.concessionPercent > 0 && (
                  <span className="text-emerald-600 text-[11px] ml-1 font-semibold">({expiryPricing.concessionPercent}% concession • -₹{expiryPricing.concessionAmountPerUnit})</span>
                )}
              </div>
              {Number(formData.costRate) > 0 && (
                <div className="border-l border-slate-300 pl-3">
                  <span className="text-slate-500">Acquisition: </span>
                  <span className="font-bold text-slate-700 font-mono">₹{formData.costRate}</span>
                </div>
              )}
            </div>
            <div>
              <span className="text-slate-500">Total MRP: </span>
              <span className="font-extrabold text-primary-700 font-mono text-sm">
                {formatCurrency(Number(formData.unitOriginalPrice || 0) * Number(formData.quantity || 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Storage & Quality Notes
          </label>
          <textarea
            rows="2"
            placeholder="e.g. Original packaging sealed, temperature data logger verified, hospital central pharmacy bay A-3."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (expiryPricing && !expiryPricing.acceptable)}
            title={expiryPricing && !expiryPricing.acceptable ? expiryPricing.rejectionReason : ''}
            className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-primary-500/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <span>{isEdit ? 'Save Changes' : 'Add to Hospital Inventory'}</span>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
};

export default MedicineModal;

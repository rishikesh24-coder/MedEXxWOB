import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Package,
  Boxes,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  Tag,
  DollarSign,
  TrendingDown,
  Sparkles,
  Check,
  Info,
  ChevronRight,
  RotateCcw,
  Pill,
  Thermometer,
  ListFilter,
  Building2,
  PlusCircle,
  FileText,
  X,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { hospitalService } from '../../services/hospitalService';
import { fetchInventory } from '../../store/slices/hospitalSlice';
import { calculateMedicineExpiry } from '../../utils/expiryUtils';
import { getExpiryPricing, isExpiryAcceptable, getRemainingShelfLife, DAYS_PER_MONTH, NEAR_EXPIRY_SCHEDULE } from '../../config/nearExpiryPolicy';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import toast from 'react-hot-toast';

// Helper to reliably determine or infer administration route
const resolveRoute = (item) => {
  if (item?.route && typeof item.route === 'string' && item.route.trim()) {
    return item.route.trim();
  }
  const form = (item?.dosageForm || item?.form || '').toLowerCase();
  if (form.includes('inj') || form.includes('infus') || form.includes('vial') || form.includes('ampoule')) return 'Intravenous (IV)';
  if (form.includes('inhal') || form.includes('resp') || form.includes('aerosol') || form.includes('rotacap')) return 'Inhalation';
  if (form.includes('cream') || form.includes('oint') || form.includes('gel') || form.includes('lotion')) return 'Topical';
  if (form.includes('drop') || form.includes('ophth') || form.includes('otic')) return 'Ophthalmic';
  if (form.includes('syrup') || form.includes('susp') || form.includes('liquid') || form.includes('solution') || form.includes('elixir')) return 'Oral';
  if (form.includes('subling')) return 'Sublingual';
  if (form.includes('patch') || form.includes('transdermal')) return 'Transdermal';
  return 'Oral';
};

// Pure batch enrichment helper providing all required display & pricing attributes
const enrichBatchItem = (item, parentMed = null) => {
  const brand = (item?.brandName || item?.medicineName || parentMed?.brandName || 'Unknown Medicine').trim();
  const generic = (item?.genericName || item?.composition || parentMed?.genericName || 'Standard Formulation').trim();
  const power = (item?.power || item?.strength || item?.dosage || parentMed?.power || 'Standard').trim();
  const dosageForm = (item?.dosageForm || item?.form || parentMed?.dosageForm || 'Tablet').trim();
  const route = resolveRoute(item) || resolveRoute(parentMed || {}) || 'Oral';
  const batchNo = (item?.batchNo || item?.batchNumber || item?.batch || 'BAT-UNREGISTERED').trim();
  const expiryDate = item?.expiryDate || item?.expiry || '';

  const totalStock = Number(item?.quantity || item?.totalQuantity || 0);
  const reserved = Number(item?.reservedQuantity || 0);
  const available = item?.availableQuantity !== undefined ? Number(item.availableQuantity) : Math.max(0, totalStock - reserved);

  const mrp = Number(item?.mrp || item?.unitOriginalPrice || item?.unitPrice || 100);

  const expInfo = calculateMedicineExpiry(expiryDate);
  const policyPricing = getExpiryPricing(expiryDate, mrp, null, 1);
  const remainingLife = getRemainingShelfLife(expiryDate);
  const isAcceptable = isExpiryAcceptable(expiryDate);
  const isExpired = expInfo.isExpired || (remainingLife?.days || 0) <= 0;

  return {
    ...item,
    id: item?.id || `batch-${batchNo}-${expiryDate}`,
    brandName: brand,
    medicineName: brand,
    genericName: generic,
    composition: generic,
    power,
    strength: power,
    dosageForm,
    route,
    batchNo,
    batchNumber: batchNo,
    expiryDate,
    availableStock: available,
    mrp,
    concessionPercent: policyPricing.concessionPercent,
    concessionAmountPerUnit: policyPricing.concessionAmountPerUnit,
    sellingPricePerUnit: policyPricing.sellingPricePerUnit,
    policyPricing,
    remainingShelfLife: remainingLife,
    isAcceptable,
    isExpired,
    expiryStatus: expInfo.label,
    expiryColor: expInfo.color,
    category: item?.category || parentMed?.category || 'Pharmaceutical',
    storageType: item?.storageType || item?.storageCondition || parentMed?.storageType || 'Room Temperature',
  };
};

// Compact Filter and Sort Toolbar Component
const BatchFilterSortToolbar = ({
  searchQuery,
  onSearchChange,
  expiryFilter,
  onExpiryFilterChange,
  stockStatusFilter,
  onStockStatusFilterChange,
  dosageFormFilter,
  onDosageFormFilterChange,
  routeFilter,
  onRouteFilterChange,
  sortBy,
  onSortByChange,
  availableDosageForms = [],
  availableRoutes = [],
  matchingCount = 0,
  totalCount = 0,
  onClearFilters,
  isFilterActive = false,
}) => {
  return (
    <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-xs">
      {/* Search and Header Actions Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search medicine name, composition, strength, batch #..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Counter and Clear Filters Action */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0">
          <span className="text-xs font-mono font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            Showing <span className="text-primary-700 font-extrabold">{matchingCount}</span> of {totalCount} batches
          </span>
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!isFilterActive}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
              isFilterActive
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 cursor-pointer'
                : 'bg-white border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
            }`}
            title="Reset all filters and sorting"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        </div>
      </div>

      {/* Filter Select Controls Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* 1. Expiry Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Expiry Window
          </label>
          <select
            value={expiryFilter}
            onChange={(e) => onExpiryFilterChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="all">All Expiry Dates</option>
            <option value="1">Expiring in &lt; 1 month</option>
            <option value="2">Expiring in &lt; 2 months</option>
            <option value="3">Expiring in &lt; 3 months</option>
            <option value="4">Expiring in &lt; 4 months</option>
            <option value="5">Expiring in &lt; 5 months</option>
            <option value="6">Expiring in &lt; 6 months</option>
          </select>
        </div>

        {/* 2. Stock Status Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Stock Status
          </label>
          <select
            value={stockStatusFilter}
            onChange={(e) => onStockStatusFilterChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="all">All Stock Statuses</option>
            <option value="available">Available (In Stock &amp; Valid)</option>
            <option value="low_stock">Low Stock (≤ 25 Units)</option>
            <option value="expiring_soon">Expiring Soon (31–90 Days)</option>
          </select>
        </div>

        {/* 3. Dosage Form Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Dosage Form
          </label>
          <select
            value={dosageFormFilter}
            onChange={(e) => onDosageFormFilterChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="all">All Dosage Forms</option>
            {availableDosageForms.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Route Filter */}
        <div>
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Administration Route
          </label>
          <select
            value={routeFilter}
            onChange={(e) => onRouteFilterChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="all">All Routes</option>
            {availableRoutes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Sort By Control */}
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Sort Order
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="default">Default Order</option>
            <optgroup label="Expiry">
              <option value="expiry_asc">Expiry: Near → Far</option>
              <option value="expiry_desc">Expiry: Far → Near</option>
            </optgroup>
            <optgroup label="Available Stock">
              <option value="stock_asc">Stock: Low → High</option>
              <option value="stock_desc">Stock: High → Low</option>
            </optgroup>
            <optgroup label="Selling Price">
              <option value="price_asc">Selling Price: Low → High</option>
              <option value="price_desc">Selling Price: High → Low</option>
            </optgroup>
            <optgroup label="MRP">
              <option value="mrp_asc">MRP: Low → High</option>
              <option value="mrp_desc">MRP: High → Low</option>
            </optgroup>
            <optgroup label="Concession %">
              <option value="concession_desc">Highest Concession → Lowest</option>
              <option value="concession_asc">Lowest Concession → Highest</option>
            </optgroup>
          </select>
        </div>
      </div>
    </div>
  );
};

// Standardized 12-Attribute Batch Result Card Component
const BatchResultCard = ({ batch, onSelect, isSelected = false }) => {
  const isExpired = batch.isExpired;
  const isTooNearExpiry = !batch.isAcceptable || (batch.remainingShelfLife?.days || 0) <= 30;
  const noStock = batch.availableStock <= 0;
  const isSelectable = !isExpired && !isTooNearExpiry && !noStock;

  return (
    <div
      onClick={() => {
        if (isSelectable) {
          onSelect(batch);
        } else if (isTooNearExpiry) {
          toast.error('Cannot list stock expiring within 1 month (CDSCO hard rejection rule).');
        } else if (isExpired) {
          toast.error('This batch has expired and cannot be listed on the marketplace.');
        } else if (noStock) {
          toast.error('This batch has zero available units in stock.');
        }
      }}
      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
        isSelected
          ? 'border-primary-600 ring-2 ring-primary-500/30 bg-primary-50/20'
          : isSelectable
          ? 'border-slate-200 hover:border-primary-500 hover:shadow-md cursor-pointer bg-white group'
          : 'border-slate-200/70 bg-slate-50/85 opacity-80 cursor-not-allowed'
      }`}
    >
      <div className="space-y-3.5">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-2xs">
              Lot #{batch.batchNo}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {batch.dosageForm}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {batch.route}
            </span>
          </div>

          <div>
            {isTooNearExpiry ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                Non-Acceptable (≤ 1m)
              </span>
            ) : isExpired ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                Expired
              </span>
            ) : batch.concessionPercent > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {batch.concessionPercent}% Concession Tier
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                0% Concession (Standard)
              </span>
            )}
          </div>
        </div>

        {/* Medicine Name, Composition & Strength */}
        <div>
          <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors leading-tight">
            {batch.brandName}
          </h3>
          <p className="text-xs font-bold text-primary-700 font-mono mt-0.5">
            {batch.power} • {batch.dosageForm} • {batch.route}
          </p>
          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
            Composition: {batch.genericName}
          </p>
        </div>

        {/* Batch Stock & Expiry Information Grid */}
        <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Available Stock</span>
            <span className="text-sm font-extrabold font-mono text-slate-900">
              {formatNumber(batch.availableStock)}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-mono block">Units</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Expiry Date</span>
            <span className="text-xs font-bold font-mono text-slate-800 block truncate">
              {batch.expiryDate}
            </span>
            <span className="text-[9px] text-slate-500 font-mono block truncate">
              {batch.remainingShelfLife?.formatted || `${batch.remainingShelfLife?.days || 0}d left`}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Storage / Cond.</span>
            <span className="text-xs font-bold font-mono text-slate-700 block truncate">
              {batch.storageType || 'Room Temp'}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-mono block truncate">
              {batch.category}
            </span>
          </div>
        </div>

        {/* Concession & Pricing Breakdown Grid (All 4 required pricing values) */}
        <div className="grid grid-cols-4 gap-1.5 text-center p-2.5 rounded-xl bg-primary-50/50 border border-primary-100 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">MRP</span>
            <span className="text-xs font-bold font-mono text-slate-800">
              ₹{Number(batch.mrp).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Concession %</span>
            <span className="text-xs font-bold font-mono text-amber-700">
              {batch.concessionPercent}%
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-semibold">Concession ₹</span>
            <span className="text-xs font-bold font-mono text-slate-700">
              ₹{Number(batch.concessionAmountPerUnit).toFixed(2)}
            </span>
          </div>
          <div className="bg-emerald-100/60 rounded-lg p-0.5 border border-emerald-200/80">
            <span className="text-[10px] text-emerald-800 block font-bold">Selling Price</span>
            <span className="text-xs font-extrabold font-mono text-emerald-900">
              ₹{Number(batch.sellingPricePerUnit).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Status & Selection Row */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        {isTooNearExpiry ? (
          <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Cannot list — expires within 1 month</span>
          </span>
        ) : isExpired ? (
          <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Expired Batch (Cannot List)</span>
          </span>
        ) : noStock ? (
          <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Stock Exhausted (0 Units)</span>
          </span>
        ) : (
          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Verified &amp; Sellable</span>
          </span>
        )}

        {isSelectable ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(batch);
            }}
            className="px-3 py-1.5 rounded-xl bg-primary-600 text-white font-bold text-xs group-hover:bg-primary-700 transition-all flex items-center gap-1 shadow-sm flex-shrink-0"
          >
            <span>Select Batch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed flex-shrink-0"
          >
            {isTooNearExpiry ? 'Non-Sellable (≤ 30d)' : isExpired ? 'Expired' : 'Out of Stock'}
          </button>
        )}
      </div>
    </div>
  );
};

export const SellMedicinesWorkflow = ({ onBackToMarketplace }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { inventory = [], isLoading } = useSelector((state) => state.hospital);

  const hospitalId = user?.id;
  const hospitalName = user?.name || user?.hospitalName || 'Your Hospital Facility';

  // Wizard active step (1 to 5, and 6 is confirmation / complete)
  const [currentStep, setCurrentStep] = useState(1);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState('sell'); // 'sell' | 'my_listings'

  // Step 1 & Step 2 View & Filter State
  const [inventoryViewMode, setInventoryViewMode] = useState('batches'); // 'batches' | 'medicines'
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Batch-level Filtering & Sorting
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchExpiryFilter, setBatchExpiryFilter] = useState('all'); // 'all' | '1' | '2' | '3' | '4' | '5' | '6'
  const [batchStockStatusFilter, setBatchStockStatusFilter] = useState('all'); // 'all' | 'available' | 'low_stock' | 'expiring_soon' | 'rejected'
  const [batchDosageFormFilter, setBatchDosageFormFilter] = useState('all');
  const [batchRouteFilter, setBatchRouteFilter] = useState('all');
  const [batchSortBy, setBatchSortBy] = useState('default'); // 'default' | 'expiry_asc' | 'expiry_desc' | 'stock_asc' | 'stock_desc' | 'price_asc' | 'price_desc' | 'mrp_asc' | 'mrp_desc' | 'concession_desc' | 'concession_asc'
  const [step2ScopeMedicineOnly, setStep2ScopeMedicineOnly] = useState(true);

  // Step 2: Batch Selection
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Step 3: Quantity Selection
  const [sellingQuantity, setSellingQuantity] = useState('');
  const [quantityError, setQuantityError] = useState('');

  // Step 4: Concession / Discount
  const [concessionPercent, setConcessionPercent] = useState(10);
  const [concessionError, setConcessionError] = useState('');

  // Step 6: Confirmation Modal & Submission
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeclarationChecked, setIsDeclarationChecked] = useState(false);
  const [createdListingSuccess, setCreatedListingSuccess] = useState(null);

  // Active listings from storage
  const [hospitalListings, setHospitalListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);

  // Fetch hospital inventory if needed
  useEffect(() => {
    if (hospitalId) {
      dispatch(fetchInventory(hospitalId));
      loadHospitalListings();
    }
  }, [dispatch, hospitalId]);

  const loadHospitalListings = async () => {
    if (!hospitalId) return;
    try {
      setIsLoadingListings(true);
      const listings = await hospitalService.getSaleListings(hospitalId);
      setHospitalListings(listings || []);
    } catch (err) {
      console.error('Failed to load sale listings', err);
    } finally {
      setIsLoadingListings(false);
    }
  };

  // All enriched batches for the hospital inventory (filtered at data layer: <=1-month batches excluded)
  const allInventoryBatches = useMemo(() => {
    if (!inventory || inventory.length === 0) return [];
    const list = [];
    inventory.forEach((item) => {
      if (item.status === 'disposed' || item.status === 'pending_disposal') return;
      const expiryDate = item.expiryDate || item.expiry || '';
      // Hard near-expiry rule: exclude batches with <= 1 month remaining or expired
      if (!isExpiryAcceptable(expiryDate)) return;
      list.push(enrichBatchItem(item));
    });
    return list;
  }, [inventory]);

  // Group inventory by unique medicine (brand name + power / medicineId)
  // Only medicines with at least one eligible sellable batch (> 1 month remaining) are shown
  const groupedMedicines = useMemo(() => {
    if (!inventory || inventory.length === 0) return [];

    const map = new Map();

    inventory.forEach((item) => {
      // Exclude permanently disposed or non-hospital items
      if (item.status === 'disposed' || item.status === 'pending_disposal') return;

      const expiryDate = item.expiryDate || item.expiry || '';
      // Exclude batches with <= 1 month remaining or expired
      if (!isExpiryAcceptable(expiryDate)) return;

      const brand = (item.brandName || item.medicineName || '').trim();
      const power = (item.power || item.strength || item.dosage || '').trim();
      const key = `${brand.toLowerCase()}___${power.toLowerCase()}`;

      const totalStock = Number(item.quantity || item.totalQuantity || 0);
      const reserved = Number(item.reservedQuantity || 0);
      const available = item.availableQuantity !== undefined ? Number(item.availableQuantity) : Math.max(0, totalStock - reserved);

      if (!map.has(key)) {
        map.set(key, {
          key,
          medicineId: item.medicineId || item.id,
          brandName: brand,
          genericName: item.genericName || item.composition || '',
          power: power || 'Standard',
          category: item.category || 'Pharmaceutical',
          dosageForm: item.dosageForm || item.form || 'Tablet',
          route: resolveRoute(item),
          storageType: item.storageType || item.storageCondition || 'Room Temperature',
          batches: [],
          totalBatches: 0,
          totalAvailableUnits: 0,
          minMrp: Number(item.mrp || item.unitOriginalPrice || 100),
          maxMrp: Number(item.mrp || item.unitOriginalPrice || 100),
        });
      }

      const entry = map.get(key);
      const enriched = enrichBatchItem(item, entry);
      entry.batches.push(enriched);
      entry.totalBatches += 1;
      entry.totalAvailableUnits += available;

      const itemMrp = enriched.mrp;
      entry.minMrp = Math.min(entry.minMrp, itemMrp);
      entry.maxMrp = Math.max(entry.maxMrp, itemMrp);
    });

    return Array.from(map.values()).filter((med) => med.batches.length > 0);
  }, [inventory]);

  // Unique dosage forms and routes available across inventory batches
  const availableDosageForms = useMemo(() => {
    const set = new Set();
    allInventoryBatches.forEach((b) => {
      if (b.dosageForm) set.add(b.dosageForm);
    });
    return Array.from(set).sort();
  }, [allInventoryBatches]);

  const availableRoutes = useMemo(() => {
    const set = new Set();
    allInventoryBatches.forEach((b) => {
      if (b.route) set.add(b.route);
    });
    return Array.from(set).sort();
  }, [allInventoryBatches]);

  // Categories available in inventory
  const availableCategories = useMemo(() => {
    const set = new Set();
    groupedMedicines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [groupedMedicines]);

  // Filtered medicines for Step 1 (grouped view)
  const filteredMedicines = useMemo(() => {
    let result = groupedMedicines;

    if (categoryFilter !== 'all') {
      result = result.filter((m) => m.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.brandName.toLowerCase().includes(q) ||
          m.genericName.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.power.toLowerCase().includes(q)
      );
    }

    return result;
  }, [groupedMedicines, categoryFilter, searchQuery]);

  // Batches for the currently selected medicine in Step 2 (strictly eligible batches only)
  const selectedMedicineBatches = useMemo(() => {
    if (!selectedMedicine) return [];
    return (selectedMedicine.batches || []).filter((b) => isExpiryAcceptable(b.expiryDate));
  }, [selectedMedicine]);

  // Filter and sort pure helper for batches list
  const filterAndSortBatches = (batchesList) => {
    if (!batchesList || batchesList.length === 0) return [];
    let list = [...batchesList];

    // 1. Search Query (Medicine name, Composition, Strength, Batch number)
    if (batchSearchQuery.trim()) {
      const q = batchSearchQuery.toLowerCase().trim();
      list = list.filter((b) => {
        const matchName = (b.brandName || '').toLowerCase().includes(q);
        const matchGeneric = (b.genericName || '').toLowerCase().includes(q);
        const matchPower = (b.power || '').toLowerCase().includes(q);
        const matchBatch = (b.batchNo || '').toLowerCase().includes(q);
        return matchName || matchGeneric || matchPower || matchBatch;
      });
    }

    // 2. Expiry Filter (Month-based with strict '<' comparison: <1m, <2m, <3m, <4m, <5m, <6m)
    const expiryMonthsMap = {
      '1': 1 * DAYS_PER_MONTH, // < 30 days
      '<1': 1 * DAYS_PER_MONTH,
      '30': 1 * DAYS_PER_MONTH,
      '2': 2 * DAYS_PER_MONTH, // < 60 days
      '<2': 2 * DAYS_PER_MONTH,
      '60': 2 * DAYS_PER_MONTH,
      '3': 3 * DAYS_PER_MONTH, // < 90 days
      '<3': 3 * DAYS_PER_MONTH,
      '90': 3 * DAYS_PER_MONTH,
      '4': 4 * DAYS_PER_MONTH, // < 120 days
      '<4': 4 * DAYS_PER_MONTH,
      '120': 4 * DAYS_PER_MONTH,
      '5': 5 * DAYS_PER_MONTH, // < 150 days
      '<5': 5 * DAYS_PER_MONTH,
      '150': 5 * DAYS_PER_MONTH,
      '6': 6 * DAYS_PER_MONTH, // < 180 days
      '<6': 6 * DAYS_PER_MONTH,
      '180': 6 * DAYS_PER_MONTH,
    };
    if (batchExpiryFilter !== 'all' && expiryMonthsMap[batchExpiryFilter] !== undefined) {
      const maxDays = expiryMonthsMap[batchExpiryFilter];
      list = list.filter((b) => (b.remainingShelfLife?.days ?? 0) < maxDays);
    }

    // 3. Stock Status Filter
    if (batchStockStatusFilter === 'available') {
      list = list.filter((b) => b.availableStock > 0 && b.isAcceptable && !b.isExpired && (b.remainingShelfLife?.days || 0) > 30);
    } else if (batchStockStatusFilter === 'low_stock') {
      list = list.filter((b) => b.availableStock > 0 && b.availableStock <= 25);
    } else if (batchStockStatusFilter === 'expiring_soon') {
      list = list.filter((b) => (b.remainingShelfLife?.days || 0) <= 90 && (b.remainingShelfLife?.days || 0) > 30);
    } else if (batchStockStatusFilter === 'rejected') {
      list = list.filter((b) => !b.isAcceptable || b.isExpired || (b.remainingShelfLife?.days || 0) <= 30);
    }

    // 4. Dosage Form Filter
    if (batchDosageFormFilter !== 'all') {
      list = list.filter((b) => (b.dosageForm || '').toLowerCase() === batchDosageFormFilter.toLowerCase());
    }

    // 5. Route Filter
    if (batchRouteFilter !== 'all') {
      list = list.filter((b) => (b.route || '').toLowerCase() === batchRouteFilter.toLowerCase());
    }

    // 6. Sorting
    list.sort((a, b) => {
      switch (batchSortBy) {
        case 'expiry_asc': { // Near -> Far (earliest date first)
          const tA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
          const tB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
          return tA - tB;
        }
        case 'expiry_desc': { // Far -> Near (latest date first)
          const tA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
          const tB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
          return tB - tA;
        }
        case 'stock_asc': // Stock: Low -> High
          return Number(a.availableStock || 0) - Number(b.availableStock || 0);
        case 'stock_desc': // Stock: High -> Low
          return Number(b.availableStock || 0) - Number(a.availableStock || 0);
        case 'price_asc': // Selling Price: Low -> High
          return Number(a.sellingPricePerUnit || 0) - Number(b.sellingPricePerUnit || 0);
        case 'price_desc': // Selling Price: High -> Low
          return Number(b.sellingPricePerUnit || 0) - Number(a.sellingPricePerUnit || 0);
        case 'mrp_asc': // MRP: Low -> High
          return Number(a.mrp || 0) - Number(b.mrp || 0);
        case 'mrp_desc': // MRP: High -> Low
          return Number(b.mrp || 0) - Number(a.mrp || 0);
        case 'concession_desc': // Highest concession -> Lowest
          return Number(b.concessionPercent || 0) - Number(a.concessionPercent || 0);
        case 'concession_asc': // Lowest concession -> Highest
          return Number(a.concessionPercent || 0) - Number(b.concessionPercent || 0);
        default:
          return 0;
      }
    });

    return list;
  };

  const handleClearBatchFilters = () => {
    setBatchSearchQuery('');
    setBatchExpiryFilter('all');
    setBatchStockStatusFilter('all');
    setBatchDosageFormFilter('all');
    setBatchRouteFilter('all');
    setBatchSortBy('default');
  };

  const isBatchFilterActive =
    batchSearchQuery.trim() !== '' ||
    batchExpiryFilter !== 'all' ||
    batchStockStatusFilter !== 'all' ||
    batchDosageFormFilter !== 'all' ||
    batchRouteFilter !== 'all' ||
    batchSortBy !== 'default';

  // Batch Available Stock
  const batchAvailableStock = useMemo(() => {
    if (!selectedBatch) return 0;
    if (selectedBatch.availableStock !== undefined) return selectedBatch.availableStock;
    if (selectedBatch.availableQuantity !== undefined) return Number(selectedBatch.availableQuantity);
    const total = Number(selectedBatch.quantity || selectedBatch.totalQuantity || 0);
    const reserved = Number(selectedBatch.reservedQuantity || 0);
    return Math.max(0, total - reserved);
  }, [selectedBatch]);

  // Batch Unit MRP
  const batchMRP = useMemo(() => {
    if (!selectedBatch) return 100;
    return Number(selectedBatch.mrp || selectedBatch.unitOriginalPrice || 100);
  }, [selectedBatch]);

  // Live Pricing Calculations strictly derived via central Near-Expiry Concession Policy
  const pricingCalculations = useMemo(() => {
    const qty = Math.max(0, Math.floor(Number(sellingQuantity)) || 0);
    const targetExpiry = selectedBatch?.expiryDate;

    if (!targetExpiry) {
      return {
        quantity: qty,
        mrp: batchMRP,
        concessionPercent: 0,
        concessionAmountPerUnit: 0,
        sellingPricePerUnit: batchMRP,
        totalMRP: Math.round(batchMRP * qty * 100) / 100,
        totalConcession: 0,
        finalSellingPrice: Math.round(batchMRP * qty * 100) / 100,
        remainingStock: Math.max(0, batchAvailableStock - qty),
        acceptable: false,
        rejectionReason: 'Batch expiry date is required.',
        remainingShelfLife: { days: 0, months: 0, formatted: 'Unknown' },
        tierLabel: 'Unknown',
        tierBadge: 'Unknown',
      };
    }

    const policyPricing = getExpiryPricing(targetExpiry, batchMRP, null, Math.max(1, qty));

    return {
      quantity: qty,
      mrp: batchMRP,
      concessionPercent: policyPricing.concessionPercent,
      concessionAmountPerUnit: policyPricing.concessionAmountPerUnit,
      sellingPricePerUnit: policyPricing.sellingPricePerUnit,
      totalMRP: Math.round(batchMRP * qty * 100) / 100,
      totalConcession: Math.round(policyPricing.concessionAmountPerUnit * qty * 100) / 100,
      finalSellingPrice: Math.round(policyPricing.sellingPricePerUnit * qty * 100) / 100,
      remainingStock: Math.max(0, batchAvailableStock - qty),
      acceptable: policyPricing.acceptable,
      rejectionReason: policyPricing.rejectionReason,
      remainingShelfLife: policyPricing.remainingShelfLife,
      tierLabel: policyPricing.tierLabel,
      tierBadge: policyPricing.tierBadge,
    };
  }, [batchMRP, sellingQuantity, selectedBatch, batchAvailableStock]);

  // Validation handlers
  const handleSelectMedicine = (med) => {
    setSelectedMedicine(med);
    setSelectedBatch(null);
    setSellingQuantity('');
    setQuantityError('');
    setCurrentStep(2);
  };

  const handleSelectBatch = (batch) => {
    if (!isExpiryAcceptable(batch.expiryDate) || (batch.remainingShelfLife?.days || 0) <= 30) {
      toast.error('Cannot list stock expiring within 1 month (CDSCO hard rejection rule).');
      return;
    }
    if (batch.isExpired) {
      toast.error('This batch has expired and cannot be listed on the marketplace.');
      return;
    }
    if (batch.availableStock <= 0) {
      toast.error('This batch has zero available units in stock.');
      return;
    }
    setSelectedBatch(batch);
    setSellingQuantity('');
    setQuantityError('');
    setCurrentStep(3);
  };

  const handleSelectBatchDirectly = (batch) => {
    if (!isExpiryAcceptable(batch.expiryDate) || (batch.remainingShelfLife?.days || 0) <= 30) {
      toast.error('Cannot list stock expiring within 1 month (CDSCO hard rejection rule).');
      return;
    }
    if (batch.isExpired) {
      toast.error('This batch has expired and cannot be listed on the marketplace.');
      return;
    }
    if (batch.availableStock <= 0) {
      toast.error('This batch has zero available units in stock.');
      return;
    }

    const brand = batch.brandName;
    const power = batch.power;
    const key = `${brand.toLowerCase()}___${power.toLowerCase()}`;
    let med = groupedMedicines.find((m) => m.key === key);
    if (!med) {
      med = {
        key,
        medicineId: batch.medicineId || batch.id,
        brandName: brand,
        genericName: batch.genericName,
        power,
        category: batch.category,
        dosageForm: batch.dosageForm,
        storageType: batch.storageType,
        batches: [batch],
        totalBatches: 1,
        totalAvailableUnits: batch.availableStock,
        minMrp: batch.mrp,
        maxMrp: batch.mrp,
      };
    }

    setSelectedMedicine(med);
    setSelectedBatch(batch);
    setSellingQuantity('');
    setQuantityError('');
    setCurrentStep(3);
  };

  const handleQuantityChange = (val) => {
    setSellingQuantity(val);
    if (!val || val.trim() === '') {
      setQuantityError('Please enter the number of units to sell');
      return;
    }
    const num = Number(val);
    if (isNaN(num)) {
      setQuantityError('Quantity must be a valid number');
      return;
    }
    if (!Number.isInteger(num)) {
      setQuantityError('Quantity must be a whole integer without decimals');
      return;
    }
    if (num <= 0) {
      setQuantityError('Selling quantity must be greater than zero');
      return;
    }
    if (num > batchAvailableStock) {
      setQuantityError(`Quantity cannot exceed available stock (${batchAvailableStock} units)`);
      return;
    }
    setQuantityError('');
  };

  const handleQuantityPreset = (ratio) => {
    const calculated = Math.max(1, Math.floor(batchAvailableStock * ratio));
    handleQuantityChange(String(calculated));
  };

  const handleStep3Continue = () => {
    if (!isExpiryAcceptable(selectedBatch.expiryDate)) {
      toast.error('Cannot list stock expiring within 1 month.');
      return;
    }
    const num = Number(sellingQuantity);
    if (!sellingQuantity || isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      setQuantityError('Please enter a valid positive whole number of units to sell');
      return;
    }
    if (num > batchAvailableStock) {
      setQuantityError(`Quantity cannot exceed available stock (${batchAvailableStock} units)`);
      return;
    }
    setQuantityError('');
    setCurrentStep(4);
  };

  const handleStep4Continue = () => {
    if (!pricingCalculations.acceptable) {
      toast.error('Cannot list stock expiring within 1 month.');
      return;
    }
    setCurrentStep(5);
  };

  const handleProceedToConfirmation = () => {
    setIsDeclarationChecked(false);
    setIsConfirmModalOpen(true);
  };

  const handleFinalSubmitListing = async () => {
    if (!isDeclarationChecked) {
      toast.error('Please confirm the CDSCO regulatory compliance declaration');
      return;
    }

    try {
      setIsSubmitting(true);
      const listingInput = {
        sellerHospitalId: hospitalId,
        sellerHospitalName: hospitalName,
        hospitalId: hospitalId,
        batchId: selectedBatch.id,
        medicineId: selectedMedicine.medicineId,
        brandName: selectedMedicine.brandName,
        medicineName: selectedMedicine.brandName,
        genericName: selectedMedicine.genericName,
        power: selectedMedicine.power,
        category: selectedMedicine.category,
        dosageForm: selectedMedicine.dosageForm,
        storageType: selectedBatch.storageType || selectedMedicine.storageType,
        batchNo: selectedBatch.batchNo || selectedBatch.batchNumber,
        mfgDate: selectedBatch.mfgDate,
        expiryDate: selectedBatch.expiryDate,
        quantity: pricingCalculations.quantity,
        mrp: pricingCalculations.mrp,
        unitOriginalPrice: pricingCalculations.mrp,
        concessionPercent: pricingCalculations.concessionPercent,
      };

      const result = await hospitalService.createSaleListing(listingInput);

      // Refresh Redux inventory and local listings
      dispatch(fetchInventory(hospitalId));
      await loadHospitalListings();

      setCreatedListingSuccess(result);
      setIsConfirmModalOpen(false);
      setCurrentStep(6);
      toast.success(`Successfully listed ${pricingCalculations.quantity} units of ${selectedMedicine.brandName}!`);
    } catch (err) {
      toast.error(err.message || 'Failed to list medicine for sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetWorkflow = () => {
    setSelectedMedicine(null);
    setSelectedBatch(null);
    setSellingQuantity('');
    setQuantityError('');
    setConcessionPercent(10);
    setConcessionError('');
    setCreatedListingSuccess(null);
    setCurrentStep(1);
  };

  const handleCancelListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to cancel this sale listing? The reserved stock will be returned to your active inventory.')) {
      return;
    }
    try {
      await hospitalService.cancelSaleListing(listingId);
      toast.success('Sale listing cancelled and inventory stock returned');
      dispatch(fetchInventory(hospitalId));
      loadHospitalListings();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel listing');
    }
  };

  const stepsMetadata = [
    { number: 1, title: 'Select Medicine', subtitle: 'From Hospital Inventory' },
    { number: 2, title: 'Select Batch', subtitle: 'Expiry & Lot Data' },
    { number: 3, title: 'Selling Quantity', subtitle: 'Stock Validation' },
    { number: 4, title: 'Set Concession', subtitle: 'Discount % & ₹' },
    { number: 5, title: 'Price Summary', subtitle: 'Final Breakdown' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMarketplace}
            className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm"
            title="Return to Marketplace Hub"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Back to Marketplace Hub</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                Hospital Seller Portal
              </span>
              <span className="text-xs font-mono text-slate-400">CDSCO Compliant</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Sell Medicines on MedEx Exchange
            </h1>
          </div>
        </div>

        {/* View Toggle: Sell Wizard vs Active Listings */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => {
              setActiveWorkflowTab('sell');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeWorkflowTab === 'sell'
                ? 'bg-white text-primary-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-primary-600" />
            <span>List Medicine for Sale</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveWorkflowTab('my_listings');
              loadHospitalListings();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeWorkflowTab === 'my_listings'
                ? 'bg-white text-primary-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>My Sale Listings</span>
            {hospitalListings.length > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-mono font-bold">
                {hospitalListings.filter((l) => l.status === 'active').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ACTIVE LISTINGS TAB */}
      {activeWorkflowTab === 'my_listings' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Active Sale Listings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Medicines currently listed by <strong className="text-slate-700">{hospitalName}</strong> on the MedEx Marketplace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveWorkflowTab('sell');
                handleResetWorkflow();
              }}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Listing</span>
            </button>
          </div>

          {isLoadingListings ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading sale listings...</div>
          ) : hospitalListings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Sale Listings Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You have not listed any medicine lots for sale. Click &apos;Create New Listing&apos; to monetize excess inventory.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-mono uppercase text-slate-400 bg-slate-50/75">
                    <th className="p-3 font-semibold">Medicine</th>
                    <th className="p-3 font-semibold">Batch & Expiry</th>
                    <th className="p-3 font-semibold text-right">Quantity</th>
                    <th className="p-3 font-semibold text-right">MRP</th>
                    <th className="p-3 font-semibold text-right">Concession</th>
                    <th className="p-3 font-semibold text-right">Selling Price</th>
                    <th className="p-3 font-semibold text-right">Total Revenue</th>
                    <th className="p-3 font-semibold text-center">Status</th>
                    <th className="p-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hospitalListings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">{listing.brandName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{listing.power} • {listing.genericName}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="font-semibold text-slate-800">{listing.batchNo}</span>
                        <div className="text-[10px] text-slate-400">Exp: {listing.expiryDate}</div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatNumber(listing.quantity)} <span className="text-[10px] text-slate-400 font-normal">units</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400 line-through">
                        ₹{listing.mrp}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {listing.concessionPercent}% OFF (-₹{listing.concessionAmount})
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                        ₹{listing.sellingPrice}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-primary-800 text-sm">
                        ₹{formatNumber(listing.finalSellingPrice)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold capitalize ${
                          listing.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}>
                          {listing.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {listing.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleCancelListing(listing.id)}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline"
                          >
                            Cancel Listing
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SELL WIZARD VIEW */}
      {activeWorkflowTab === 'sell' && (
        <>
          {/* Wizard Step Progress Tracker */}
          {currentStep <= 5 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {stepsMetadata.map((s) => {
                  const isCompleted = currentStep > s.number;
                  const isCurrent = currentStep === s.number;

                  return (
                    <div
                      key={s.number}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-primary-50/80 border-primary-500 shadow-sm ring-1 ring-primary-400'
                          : isCompleted
                          ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                          : 'bg-slate-50 border-slate-200/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 ${
                            isCurrent
                              ? 'bg-primary-600 text-white'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.number}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xs font-bold leading-tight truncate ${
                              isCurrent ? 'text-primary-900' : 'text-slate-800'
                            }`}
                          >
                            {s.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate hidden sm:block">
                            {s.subtitle}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 1: SELECT MEDICINE OR BATCH FROM HOSPITAL INVENTORY */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-mono font-bold text-primary-600 uppercase tracking-wide">
                    STEP 1 OF 5 • INVENTORY SELECTION
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">
                    Select a Batch or Medicine from Your Hospital Inventory
                  </h2>
                  <p className="text-xs text-slate-500">
                    Choose from {hospitalName}&apos;s verified in-stock medications. Batches expiring in ≤ 1 month are non-sellable under CDSCO regulations.
                  </p>
                </div>

                {/* View Mode Toggle: All Batches vs Group by Medicine */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setInventoryViewMode('batches')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      inventoryViewMode === 'batches'
                        ? 'bg-white text-primary-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>All Batches ({allInventoryBatches.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryViewMode('medicines')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      inventoryViewMode === 'medicines'
                        ? 'bg-white text-primary-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>By Medicine ({groupedMedicines.length})</span>
                  </button>
                </div>
              </div>

              {/* VIEW 1: ALL SELLABLE BATCHES (WITH COMPREHENSIVE FILTER/SORT TOOLBAR) */}
              {inventoryViewMode === 'batches' && (
                <div className="space-y-4">
                  {/* Practical Filter/Sort Toolbar */}
                  <BatchFilterSortToolbar
                    searchQuery={batchSearchQuery}
                    onSearchChange={setBatchSearchQuery}
                    expiryFilter={batchExpiryFilter}
                    onExpiryFilterChange={setBatchExpiryFilter}
                    stockStatusFilter={batchStockStatusFilter}
                    onStockStatusFilterChange={setBatchStockStatusFilter}
                    dosageFormFilter={batchDosageFormFilter}
                    onDosageFormFilterChange={setBatchDosageFormFilter}
                    routeFilter={batchRouteFilter}
                    onRouteFilterChange={setBatchRouteFilter}
                    sortBy={batchSortBy}
                    onSortByChange={setBatchSortBy}
                    availableDosageForms={availableDosageForms}
                    availableRoutes={availableRoutes}
                    matchingCount={filterAndSortBatches(allInventoryBatches).length}
                    totalCount={allInventoryBatches.length}
                    onClearFilters={handleClearBatchFilters}
                    isFilterActive={isBatchFilterActive}
                  />

                  {/* Batches Grid */}
                  {(() => {
                    const filteredBatches = filterAndSortBatches(allInventoryBatches);
                    if (allInventoryBatches.length === 0) {
                      return (
                        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 space-y-2">
                          <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-sm font-bold text-slate-700">No medicines currently eligible for sale</div>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Medicines with 1 month or less remaining shelf life cannot be listed for sale.
                          </p>
                        </div>
                      );
                    }
                    if (filteredBatches.length === 0) {
                      return (
                        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 space-y-2">
                          <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-sm font-bold text-slate-700">No matching inventory batches found</div>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            No batches match your active filter and search criteria. Try clearing or adjusting your filters.
                          </p>
                          {isBatchFilterActive && (
                            <button
                              type="button"
                              onClick={handleClearBatchFilters}
                              className="mt-2 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 font-bold text-xs hover:bg-primary-100 transition-colors inline-flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset Filters</span>
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredBatches.map((b) => (
                          <BatchResultCard
                            key={b.id || `${b.batchNo}-${b.expiryDate}`}
                            batch={b}
                            onSelect={handleSelectBatchDirectly}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* VIEW 2: GROUPED BY MEDICINE */}
              {inventoryViewMode === 'medicines' && (
                <div className="space-y-4">
                  {/* Search & Category Filter Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="relative sm:col-span-8">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search your inventory by Brand Name, Salt (e.g. Dolo 650, Paracetamol)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none"
                      >
                        <option value="all">All Therapeutic Categories</option>
                        {availableCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Medicines List / Grid */}
                  {groupedMedicines.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 space-y-2">
                      <Pill className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-bold text-slate-700">No medicines currently eligible for sale</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Medicines with 1 month or less remaining shelf life cannot be listed for sale.
                      </p>
                    </div>
                  ) : filteredMedicines.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 space-y-2">
                      <Pill className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-bold text-slate-700">No matching medicines found</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        No medicine in your hospital&apos;s active inventory matches the search criteria. Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredMedicines.map((med) => {
                        return (
                          <div
                            key={med.key}
                            onClick={() => handleSelectMedicine(med)}
                            className="p-4 rounded-2xl border border-slate-200/90 hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group bg-white flex flex-col justify-between"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                                  {med.category}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-800 border border-primary-200">
                                  {med.totalBatches} {med.totalBatches === 1 ? 'Batch' : 'Batches'}
                                </span>
                              </div>

                              <div>
                                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors leading-tight">
                                  {med.brandName}
                                </h3>
                                <p className="text-xs font-bold text-primary-700 font-mono mt-0.5">
                                  {med.power} • {med.dosageForm} • {med.route}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {med.genericName}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Available Units</span>
                                <span className="font-mono font-extrabold text-slate-800">
                                  {formatNumber(med.totalAvailableUnits)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium text-right">MRP per Unit</span>
                                <span className="font-mono font-bold text-slate-700 block text-right">
                                  ₹{med.minMrp === med.maxMrp ? med.minMrp : `${med.minMrp} - ₹${med.maxMrp}`}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="p-2 rounded-xl bg-primary-50 group-hover:bg-primary-600 text-primary-700 group-hover:text-white transition-all shadow-sm flex-shrink-0"
                                title="Select this medicine to choose batch"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: SELECT BATCH */}
          {/* ============================================================== */}
          {currentStep === 2 && selectedMedicine && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-primary-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Medicine List</span>
                    </button>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] font-mono font-bold text-primary-600 uppercase tracking-wide">
                      STEP 2 OF 5 • BATCH SELECTION
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-1">
                    Select Batch / Lot for {selectedMedicine.brandName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Different batches have distinct expiry dates, quantities, and MRPs. Batches expiring in ≤ 1 month are non-sellable under CDSCO rules.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-xl bg-primary-50 border border-primary-200/70 text-right">
                    <div className="text-xs font-extrabold text-primary-900">{selectedMedicine.brandName} ({selectedMedicine.power})</div>
                    <div className="text-[10px] text-primary-700 font-mono">{selectedMedicine.genericName}</div>
                  </div>
                </div>
              </div>

              {/* Scope Switcher in Step 2: This Medicine Only vs All Hospital Batches */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStep2ScopeMedicineOnly(true)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      step2ScopeMedicineOnly
                        ? 'bg-white text-primary-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {selectedMedicine.brandName} Batches ({selectedMedicineBatches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep2ScopeMedicineOnly(false)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      !step2ScopeMedicineOnly
                        ? 'bg-white text-primary-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Hospital Batches ({allInventoryBatches.length})
                  </button>
                </div>
              </div>

              {/* Batch Filter & Sort Toolbar */}
              {(() => {
                const targetPool = step2ScopeMedicineOnly ? selectedMedicineBatches : allInventoryBatches;
                const filteredBatches = filterAndSortBatches(targetPool);

                return (
                  <div className="space-y-4">
                    <BatchFilterSortToolbar
                      searchQuery={batchSearchQuery}
                      onSearchChange={setBatchSearchQuery}
                      expiryFilter={batchExpiryFilter}
                      onExpiryFilterChange={setBatchExpiryFilter}
                      stockStatusFilter={batchStockStatusFilter}
                      onStockStatusFilterChange={setBatchStockStatusFilter}
                      dosageFormFilter={batchDosageFormFilter}
                      onDosageFormFilterChange={setBatchDosageFormFilter}
                      routeFilter={batchRouteFilter}
                      onRouteFilterChange={setBatchRouteFilter}
                      sortBy={batchSortBy}
                      onSortByChange={setBatchSortBy}
                      availableDosageForms={availableDosageForms}
                      availableRoutes={availableRoutes}
                      matchingCount={filteredBatches.length}
                      totalCount={targetPool.length}
                      onClearFilters={handleClearBatchFilters}
                      isFilterActive={isBatchFilterActive}
                    />

                    {targetPool.length === 0 ? (
                      <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 space-y-2">
                        <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="text-sm font-bold text-slate-700">No medicines currently eligible for sale</div>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Medicines with 1 month or less remaining shelf life cannot be listed for sale.
                        </p>
                      </div>
                    ) : filteredBatches.length === 0 ? (
                      <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 space-y-2">
                        <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="text-sm font-bold text-slate-700">No matching batches found</div>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          No batches match your filter criteria. Try clearing filters or switching scope.
                        </p>
                        {isBatchFilterActive && (
                          <button
                            type="button"
                            onClick={handleClearBatchFilters}
                            className="mt-2 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 font-bold text-xs hover:bg-primary-100 transition-colors inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredBatches.map((b) => (
                          <BatchResultCard
                            key={b.id || `${b.batchNo}-${b.expiryDate}`}
                            batch={b}
                            onSelect={handleSelectBatch}
                            isSelected={selectedBatch?.id === b.id || selectedBatch?.batchNo === b.batchNo}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: SELECT SELLING QUANTITY */}
          {/* ============================================================== */}
          {currentStep === 3 && selectedMedicine && selectedBatch && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs text-primary-700 font-bold hover:underline flex items-center gap-1 mb-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Batch Selection</span>
                  </button>
                  <span className="text-[11px] font-mono font-bold text-primary-600 uppercase tracking-wide">
                    STEP 3 OF 5 • QUANTITY SELECTION
                  </span>
                  <h2 className="text-lg font-black text-slate-900">
                    How Many Units Do You Want to Sell?
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Selected Lot</span>
                  <span className="text-xs font-mono font-extrabold text-slate-800">
                    Batch #{selectedBatch.batchNo}
                  </span>
                </div>
              </div>

              {/* Medicine & Batch Overview Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedMedicine.brandName}</div>
                  <div className="text-slate-500 font-mono mt-0.5">
                    {selectedMedicine.power} • {selectedMedicine.genericName}
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Available Stock</span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      {formatNumber(batchAvailableStock)} units
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Unit MRP</span>
                    <span className="font-extrabold text-primary-800 text-sm">
                      ₹{batchMRP}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantity Entry Field */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  Enter Units to Sell:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={batchAvailableStock}
                    step="1"
                    placeholder={`Enter units (1 to ${batchAvailableStock})`}
                    value={sellingQuantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className={`w-full px-4 py-3 text-base rounded-xl border font-mono font-bold focus:outline-none transition-all ${
                      quantityError
                        ? 'border-rose-300 focus:ring-2 focus:ring-rose-400 bg-rose-50/30 text-rose-900'
                        : 'border-slate-300 focus:ring-2 focus:ring-primary-500 text-slate-900'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    UNITS
                  </div>
                </div>

                {quantityError && (
                  <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{quantityError}</span>
                  </p>
                )}

                {/* Quick Presets */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">Quick Allocation:</span>
                  {[
                    { label: '25%', ratio: 0.25 },
                    { label: '50%', ratio: 0.5 },
                    { label: '75%', ratio: 0.75 },
                    { label: '100% (All)', ratio: 1.0 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleQuantityPreset(p.ratio)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border border-slate-200 bg-slate-100/70 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-800 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Remaining Stock Indicator */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Units Selected for Sale</span>
                  <span className="text-base font-extrabold font-mono text-primary-800">
                    {pricingCalculations.quantity} <span className="text-xs font-normal text-slate-500">units</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Remaining Hospital Stock</span>
                  <span className="text-base font-extrabold font-mono text-slate-800">
                    {formatNumber(pricingCalculations.remainingStock)} <span className="text-xs font-normal text-slate-500">units</span>
                  </span>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  ← Back to Batches
                </button>
                <button
                  type="button"
                  onClick={handleStep3Continue}
                  disabled={!sellingQuantity || Number(sellingQuantity) <= 0 || Boolean(quantityError)}
                  className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all flex items-center gap-1.5"
                >
                  <span>Set Concession / Discount</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: NEAR-EXPIRY CONCESSION POLICY RATE */}
          {/* ============================================================== */}
          {currentStep === 4 && selectedMedicine && selectedBatch && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-xs text-primary-700 font-bold hover:underline flex items-center gap-1 mb-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Quantity</span>
                  </button>
                  <span className="text-[11px] font-mono font-bold text-primary-600 uppercase tracking-wide">
                    STEP 4 OF 5 • POLICY CONCESSION RATE
                  </span>
                  <h2 className="text-lg font-black text-slate-900">
                    Near-Expiry Concession Calculation
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Selected Batch MRP</span>
                  <span className="text-base font-mono font-extrabold text-slate-900">
                    ₹{batchMRP} / unit
                  </span>
                </div>
              </div>

              {/* Hard Rejection Notice if <= 1 Month */}
              {!pricingCalculations.acceptable ? (
                <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <span>Cannot Accept or List Stock — Near-Expiry Policy</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    {pricingCalculations.rejectionReason || 'Stock cannot be accepted because the medicine expires within 1 month.'}
                  </p>
                  <p className="text-[11px] text-rose-600 font-mono">
                    Batch Expiry: {selectedBatch.expiryDate} ({pricingCalculations.remainingShelfLife?.formatted})
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      <strong>Single Source of Truth:</strong> Concession is automatically calculated from Batch #{selectedBatch.batchNo} expiry date. Manual discount overrides are prohibited.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[11px] bg-white text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {pricingCalculations.tierBadge}
                  </span>
                </div>
              )}

              {/* Complete Policy Parameters Grid */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-800 block uppercase tracking-wider font-mono">
                  Batch Lot & Concession Breakdown
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Medicine</span>
                    <span className="text-xs font-extrabold text-slate-900 truncate block mt-0.5">
                      {selectedMedicine.brandName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">{selectedMedicine.power}</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Batch Number</span>
                    <span className="text-xs font-mono font-extrabold text-slate-900 truncate block mt-0.5">
                      #{selectedBatch.batchNo}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">Lot Identifier</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Batch Expiry</span>
                    <span className="text-xs font-mono font-extrabold text-slate-900 truncate block mt-0.5">
                      {selectedBatch.expiryDate}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">Expiration Date</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Remaining Shelf Life</span>
                    <span className="text-xs font-extrabold text-primary-700 truncate block mt-0.5">
                      {pricingCalculations.remainingShelfLife?.formatted}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">{pricingCalculations.tierLabel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200/60">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Unit MRP</span>
                    <span className="text-sm font-extrabold font-mono text-slate-900 block mt-0.5">
                      ₹{pricingCalculations.mrp}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Catalog MRP</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200">
                    <span className="text-[10px] text-amber-700 block font-medium">Concession %</span>
                    <span className="text-sm font-extrabold font-mono text-amber-800 block mt-0.5">
                      {pricingCalculations.concessionPercent}% OFF
                    </span>
                    <span className="text-[10px] text-amber-600 font-mono block">Policy Tier Rate</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200">
                    <span className="text-[10px] text-amber-700 block font-medium">Concession ₹ / Unit</span>
                    <span className="text-sm font-extrabold font-mono text-amber-800 block mt-0.5">
                      -₹{pricingCalculations.concessionAmountPerUnit}
                    </span>
                    <span className="text-[10px] text-amber-600 font-mono block">Discount per Unit</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 block font-medium">Selling Price / Unit</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-800 block mt-0.5">
                      ₹{pricingCalculations.sellingPricePerUnit}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-mono block">Buyer Unit Rate</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200/60">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Listing Quantity</span>
                    <span className="text-sm font-extrabold font-mono text-slate-900 block mt-0.5">
                      {formatNumber(pricingCalculations.quantity)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">Units Selected</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Total MRP</span>
                    <span className="text-sm font-extrabold font-mono text-slate-900 block mt-0.5">
                      ₹{pricingCalculations.totalMRP}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">MRP × Quantity</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200">
                    <span className="text-[10px] text-amber-700 block font-medium">Total Concession</span>
                    <span className="text-sm font-extrabold font-mono text-amber-800 block mt-0.5">
                      -₹{pricingCalculations.totalConcession}
                    </span>
                    <span className="text-[10px] text-amber-600 font-mono block">Total Lot Discount</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-primary-200 bg-primary-50/40">
                    <span className="text-[10px] text-primary-700 block font-medium">Final Selling Price</span>
                    <span className="text-sm font-extrabold font-mono text-primary-900 block mt-0.5">
                      ₹{pricingCalculations.finalSellingPrice}
                    </span>
                    <span className="text-[10px] text-primary-700 font-mono block">Total Lot Revenue</span>
                  </div>
                </div>
              </div>

              {/* Policy Schedule Reference Helper */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">Standard Concession Schedule:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 font-mono text-[10px]">
                  <span>&gt; 6m: 0% concession</span>
                  <span>&gt; 5m &amp; &lt;= 6m: 5% concession</span>
                  <span>&gt; 4m &amp; &lt;= 5m: 10% concession</span>
                  <span>&gt; 3m &amp; &lt;= 4m: 15% concession</span>
                  <span>&gt; 2m &amp; &lt;= 3m: 20% concession</span>
                  <span>&gt; 1m &amp; &lt;= 2m: 30% concession</span>
                </div>
                <div className="text-rose-600 font-bold text-[10px] pt-0.5">
                  &lt;= 1 month: HARD REJECTION (Stock cannot be accepted or listed)
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  ← Back to Quantity
                </button>
                <button
                  type="button"
                  onClick={handleStep4Continue}
                  disabled={!pricingCalculations.acceptable}
                  className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all flex items-center gap-1.5"
                >
                  <span>Review Final Price Summary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: FINAL PRICE SUMMARY */}
          {/* ============================================================== */}
          {currentStep === 5 && selectedMedicine && selectedBatch && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-xs text-primary-700 font-bold hover:underline flex items-center gap-1 mb-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Concession</span>
                  </button>
                  <span className="text-[11px] font-mono font-bold text-primary-600 uppercase tracking-wide">
                    STEP 5 OF 5 • FINAL PRICE BREAKDOWN
                  </span>
                  <h2 className="text-lg font-black text-slate-900">
                    Review Medicine Listing Summary
                  </h2>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Ready to Publish
                </span>
              </div>

              {/* Specifications Matrix */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Medicine</span>
                    <span className="font-extrabold text-slate-900 block text-sm">
                      {selectedMedicine.brandName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedMedicine.power}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Batch Number</span>
                    <span className="font-extrabold font-mono text-slate-900 block text-sm">
                      {selectedBatch.batchNo}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Shelf: {selectedBatch.shelfLocation || 'Pharmacy Room'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Expiry Date</span>
                    <span className="font-bold font-mono text-amber-700 block text-sm">
                      {selectedBatch.expiryDate}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Mfg: {selectedBatch.mfgDate || '2024'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Listing Quantity</span>
                    <span className="font-extrabold font-mono text-slate-900 block text-sm">
                      {pricingCalculations.quantity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Remaining: {pricingCalculations.remainingStock}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exact Formula Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-700 flex items-center justify-between">
                  <span>Price Calculation Breakdown</span>
                  <span className="text-[10px] font-mono text-slate-500">Official MedEx Pricing Model</span>
                </div>

                <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600">MRP per unit</span>
                    <span className="font-mono font-bold text-slate-800">₹{pricingCalculations.mrp.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-600">Concession %</span>
                    <span className="font-mono font-bold text-amber-700">{pricingCalculations.concessionPercent}%</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-600">Concession ₹ per unit (MRP × Concession% ÷ 100)</span>
                    <span className="font-mono font-bold text-amber-700">-₹{pricingCalculations.concessionAmountPerUnit.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-600">Selling price per unit (MRP - Concession ₹)</span>
                    <span className="font-mono font-extrabold text-slate-900">₹{pricingCalculations.sellingPricePerUnit.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-600">Total MRP ({pricingCalculations.quantity} units × ₹{pricingCalculations.mrp})</span>
                    <span className="font-mono text-slate-500">₹{pricingCalculations.totalMRP.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-600">Total Concession Discount ({pricingCalculations.quantity} units × ₹{pricingCalculations.concessionAmountPerUnit})</span>
                    <span className="font-mono font-bold text-amber-700">-₹{pricingCalculations.totalConcession.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 bg-emerald-50/60 -mx-4 px-4 py-3 border-t border-emerald-200">
                    <div>
                      <span className="font-extrabold text-emerald-950 text-sm block">
                        Final Total Selling Price
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        Selling Price per Unit × Quantity
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black font-mono text-emerald-800">
                        ₹{pricingCalculations.finalSellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation CTA Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  ← Back to Concession
                </button>
                <button
                  type="button"
                  onClick={handleProceedToConfirmation}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <Tag className="w-4 h-4" />
                  <span>Proceed to Final Confirmation</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 6: SUCCESS CONFIRMATION STATE */}
          {/* ============================================================== */}
          {currentStep === 6 && createdListingSuccess && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 max-w-2xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
                  LISTING ACTIVE • MEDEX MARKETPLACE
                </span>
                <h2 className="text-2xl font-black text-slate-900">
                  Medicine Lot Successfully Listed!
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Your listing has been digitally recorded and is now discoverable by verified partner hospitals on MedEx.
                </p>
              </div>

              {/* Listing Card Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left text-xs space-y-3 font-mono">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Listing ID:</span>
                  <span className="font-extrabold text-slate-900">{createdListingSuccess.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seller Hospital:</span>
                  <span className="font-bold text-slate-800">{createdListingSuccess.sellerHospitalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Medicine:</span>
                  <span className="font-bold text-slate-800">
                    {createdListingSuccess.brandName} ({createdListingSuccess.power})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch Number:</span>
                  <span className="font-bold text-slate-800">{createdListingSuccess.batchNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Expiry Date:</span>
                  <span className="font-bold text-amber-700">{createdListingSuccess.expiryDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Listed Units:</span>
                  <span className="font-bold text-slate-900">{createdListingSuccess.quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Selling Price / Unit:</span>
                  <span className="font-bold text-emerald-700">₹{createdListingSuccess.sellingPrice} (MRP ₹{createdListingSuccess.mrp})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                  <span className="font-bold text-slate-700">Total Listed Revenue:</span>
                  <span className="font-extrabold text-emerald-800">₹{formatNumber(createdListingSuccess.finalSellingPrice)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetWorkflow}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  List Another Medicine
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkflowTab('my_listings');
                    loadHospitalListings();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  View My Sale Listings
                </button>
                <button
                  type="button"
                  onClick={onBackToMarketplace}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  Return to Marketplace Hub
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* FINAL CONFIRMATION MODAL (Step 6 Confirmation Summary) */}
      {/* ============================================================== */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-primary-950 text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Confirm Medicine Sale Listing</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Please verify the listing parameters below before publishing this lot to the active MedEx inter-hospital marketplace.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Seller Hospital:</span>
                  <span className="font-bold text-slate-800">{hospitalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Medicine:</span>
                  <span className="font-bold text-slate-800">{selectedMedicine.brandName} ({selectedMedicine.power})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch Number:</span>
                  <span className="font-bold text-slate-800">{selectedBatch.batchNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Expiry Date:</span>
                  <span className="font-bold text-amber-700">{selectedBatch.expiryDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity to Sell:</span>
                  <span className="font-extrabold text-slate-900">{pricingCalculations.quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Original MRP:</span>
                  <span className="text-slate-500">₹{pricingCalculations.mrp} / unit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Concession:</span>
                  <span className="font-bold text-amber-700">{pricingCalculations.concessionPercent}% (-₹{pricingCalculations.concessionAmountPerUnit}/unit)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Selling Price:</span>
                  <span className="font-bold text-emerald-700">₹{pricingCalculations.sellingPricePerUnit} / unit</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                  <span className="font-bold text-slate-800">Total Revenue:</span>
                  <span className="font-extrabold text-emerald-800">₹{formatNumber(pricingCalculations.finalSellingPrice)}</span>
                </div>
              </div>

              {/* Regulatory Compliance Declaration */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDeclarationChecked}
                  onChange={(e) => setIsDeclarationChecked(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-[11px] text-emerald-900 leading-snug font-medium">
                  I hereby confirm that this pharmaceutical lot is stored according to CDSCO Rule 65 norms, has not been recalled, and is physically reserved in hospital inventory for partner dispatch.
                </span>
              </label>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalSubmitListing}
                disabled={isSubmitting || !isDeclarationChecked}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Listing Medicine...</span>
                ) : (
                  <>
                    <Tag className="w-4 h-4" />
                    <span>List Medicine for Sale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellMedicinesWorkflow;

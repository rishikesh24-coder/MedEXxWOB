import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  Boxes, 
  Pill, 
  Send, 
  Building2, 
  Navigation, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Thermometer,
  Layers,
  ArrowRight,
  Eye,
  List,
  LayoutGrid,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  FileText,
  ShoppingBag,
  Tag,
  ArrowLeft
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { fetchMarketplace } from '../../store/slices/hospitalSlice';
import { createNewRequest } from '../../store/slices/requestSlice';
import MedicineDetailDrawer from '../../components/forms/MedicineDetailDrawer';
import AlternativeMedicinesModal from '../../components/hospital/AlternativeMedicinesModal';
import SellMedicinesWorkflow from '../../components/hospital/SellMedicinesWorkflow';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { isHospitalSuspended, getLiveHospitalRecord } from '../../services/storage';
import { validateRequisition } from '../../utils/validation';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { findAlternatives, findAlternativesForSearchQuery } from '../../services/medicineAlternativeService';
import { getExpiryPricing, isExpiryAcceptable } from '../../config/nearExpiryPolicy';

export const Marketplace = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || searchParams.get('mode');
  const [activeMode, setActiveMode] = useState(
    requestedTab === 'purchase' || requestedTab === 'sell' ? requestedTab : 'hub'
  );

  useEffect(() => {
    const tab = searchParams.get('tab') || searchParams.get('mode');
    if (tab === 'purchase' || tab === 'sell') {
      setActiveMode(tab);
    } else if (!tab && activeMode !== 'hub') {
      setActiveMode('hub');
    }
  }, [searchParams]);

  const handleSelectMode = (mode) => {
    setActiveMode(mode);
    if (mode === 'hub') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: mode });
    }
  };
  const { user } = useSelector((state) => state.auth);
  const { marketplace, isLoading } = useSelector((state) => state.hospital);

  const liveHospital = useMemo(() => {
    return getLiveHospitalRecord(user?.id) || user;
  }, [user]);

  const currentVerification = (
    liveHospital?.verification_status ||
    liveHospital?.verificationStatus ||
    (['verified', 'approved', 'pending', 'pending_approval', 'under_review', 'rejected'].includes((liveHospital?.status || '').toLowerCase())
      ? liveHospital.status
      : (user?.verification_status || 'verified'))
  ).toLowerCase();
  const currentStatus = (liveHospital?.status || user?.status || 'active').toLowerCase();
  const isSuspended = currentStatus === 'suspended';
  const isOperationalLocked = (currentVerification !== 'verified' && currentVerification !== 'approved') || isSuspended || currentStatus === 'inactive';

  const [search, setSearch] = useState('');
  const [powerFilter, setPowerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [maxDistance, setMaxDistance] = useState('all');
  const [onlyNearExpiry, setOnlyNearExpiry] = useState(false);
  const [viewMode, setViewMode] = useState('horizontal'); // 'horizontal' | 'scroll' | 'grid'
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance' | 'price_asc' | 'price_desc' | 'stock' | 'expiry'

  // Selected Medicine for Drawer Inspection
  const [activeDrawerMedicine, setActiveDrawerMedicine] = useState(null);

  // Alternative Medicines Finder State
  const [altTargetMedicine, setAltTargetMedicine] = useState(null);
  const [isAltModalOpen, setIsAltModalOpen] = useState(false);

  // Precomputed alternatives count map for instant badge rendering
  const alternativesCountMap = useMemo(() => {
    if (!marketplace?.length) return {};
    const map = {};
    marketplace.forEach((med) => {
      map[med.id] = findAlternatives(med, marketplace).length;
    });
    return map;
  }, [marketplace]);

  // Smart composition alternatives matching active search keyword
  const smartSearchAlternatives = useMemo(() => {
    if (!search || search.trim().length < 2 || !marketplace?.length) return [];
    return findAlternativesForSearchQuery(search, marketplace);
  }, [search, marketplace]);

  const handleOpenAlternatives = (med) => {
    setAltTargetMedicine(med);
    setIsAltModalOpen(true);
  };

  const handleSelectAlternative = (altMedicine) => {
    setIsAltModalOpen(false);
    setAltTargetMedicine(null);
    setActiveDrawerMedicine(altMedicine);
    toast.success(`Selected ${altMedicine.brandName} (${altMedicine.power}) for requisition review`);
  };

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchMarketplace({
        hospitalId: user.id,
        filters: {
          search,
          power: powerFilter,
          location: locationFilter,
          storageType: selectedStorage
        }
      }));
    }
  }, [dispatch, user?.id, search, powerFilter, locationFilter, selectedStorage]);

  const handleOpenDetail = (med) => {
    setActiveDrawerMedicine(med);
  };

  const handleRequisitionSubmit = async ({ medicine, quantity, notes, finalUnitPrice, totalAmount }) => {
    if (isOperationalLocked) {
      if (currentVerification === 'pending' || currentVerification === 'under_review' || currentVerification === 'pending_approval') {
        toast.error('Your hospital registration is currently under review. Ordering medicines is restricted until verified.');
      } else if (isSuspended) {
        toast.error('Your hospital account is currently suspended. Operational transactions are locked.');
      } else if (currentStatus === 'inactive') {
        toast.error('Your hospital account is currently inactive. Operational transactions are locked.');
      } else {
        toast.error('Your hospital registration was rejected. Operational transactions are locked.');
      }
      return;
    }

    const validation = validateRequisition({ quantity, notes }, medicine, user?.id);
    if (!validation.isValid) {
      toast.error(validation.error || 'Requisition failed validation');
      return;
    }

    const policyPricing = getExpiryPricing(medicine.expiryDate, medicine.unitOriginalPrice || medicine.mrp);
    if (!policyPricing.acceptable) {
      toast.error(policyPricing.rejectionReason || 'Stock cannot be accepted because the medicine expires within 1 month.');
      return;
    }

    const payload = {
      medicineId: medicine.id,
      medicineName: `${medicine.brandName} (${medicine.power})`,
      power: medicine.power,
      quantity: validation.sanitizedData.quantity,
      unitOriginalPrice: medicine.unitOriginalPrice,
      concessionPercent: policyPricing.concessionPercent,
      unitFinalPrice: policyPricing.sellingPricePerUnit,
      totalAmount,
      fromHospitalId: user?.id,
      fromHospitalName: user?.name || 'Authorized Buyer Hospital',
      toHospitalId: medicine.hospitalId,
      toHospitalName: medicine.hospitalName,
      notes: validation.sanitizedData.notes,
    };

    try {
      await dispatch(createNewRequest(payload)).unwrap();
      setActiveDrawerMedicine(null);
      toast.success(`Exchange request for ${medicine.brandName} sent to ${medicine.hospitalName}!`);
    } catch (err) {
      toast.error(err?.message || 'Failed to submit request');
    }
  };

  // Filter with additional criteria
  const filteredMarketplace = marketplace.filter((med) => {
    // Strictly filter out any expired or <=1 month inventory batches from trade floor
    if (!isExpiryAcceptable(med.expiryDate)) {
      return false;
    }
    if (selectedCategory !== 'all' && !med.category?.toLowerCase().includes(selectedCategory.toLowerCase())) {
      return false;
    }
    if (maxDistance !== 'all' && (med.distanceKm || 12) > Number(maxDistance)) {
      return false;
    }
    if (onlyNearExpiry) {
      const pricing = getExpiryPricing(med.expiryDate, med.unitOriginalPrice || med.mrp);
      if (pricing.concessionPercent <= 0) {
        return false;
      }
    }
    return true;
  });

  const searchActive = Boolean(search && search.trim().length >= 2);

  // Partition search results into Primary Matches and Composition-Based Alternatives with sorting
  const { primaryResults, alternativeResults } = useMemo(() => {
    const sortFn = (a, b) => {
      const priceA = getExpiryPricing(a.expiryDate, a.unitOriginalPrice || a.mrp).sellingPricePerUnit;
      const priceB = getExpiryPricing(b.expiryDate, b.unitOriginalPrice || b.mrp).sellingPricePerUnit;
      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'stock') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      if (sortBy === 'expiry') return new Date(a.expiryDate || '2099') - new Date(b.expiryDate || '2099');
      return 0; // relevance / default
    };

    if (!searchActive) {
      return { 
        primaryResults: [...filteredMarketplace].sort(sortFn), 
        alternativeResults: [] 
      };
    }
    const q = search.toLowerCase().trim();

    // Check direct brand name matches first
    const brandMatches = filteredMarketplace.filter((m) =>
      m.brandName?.toLowerCase().includes(q)
    );

    let primaries = [];
    let alternatives = [];

    if (brandMatches.length > 0) {
      primaries = brandMatches;
      const primaryIds = new Set(primaries.map((p) => p.id));
      alternatives = filteredMarketplace.filter((m) => !primaryIds.has(m.id));
    } else {
      const genericMatches = filteredMarketplace.filter((m) =>
        m.genericName?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.power?.toLowerCase().includes(q)
      );
      primaries = genericMatches.length > 0 ? genericMatches : filteredMarketplace;
      const primaryIds = new Set(primaries.map((p) => p.id));
      alternatives = filteredMarketplace.filter((m) => !primaryIds.has(m.id));
    }

    return { 
      primaryResults: primaries.sort(sortFn), 
      alternativeResults: alternatives.sort(sortFn) 
    };
  }, [searchActive, search, filteredMarketplace, sortBy]);

  const scrollShelf = (direction) => {
    const el = document.getElementById('horizontal-shelf-container');
    if (el) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const renderGridCard = (med, { isPrimary = false, isAlternative = false } = {}) => {
    const pricing = getExpiryPricing(med.expiryDate, med.unitOriginalPrice || med.mrp);
    const discountedPrice = pricing.sellingPricePerUnit;
    const isCold = med.storageType?.toLowerCase().includes('cold');
    const altCount = alternativesCountMap[med.id] || 0;
    const displayImg = med.images?.[0]?.url || med.image;

    return (
      <div
        key={med.id}
        onClick={() => handleOpenDetail(med)}
        className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between group cursor-pointer h-full relative ${
          isAlternative 
            ? 'border-emerald-300 shadow-md hover:border-emerald-500 hover:shadow-lg ring-1 ring-emerald-200/60' 
            : 'border-slate-200/90 shadow-card hover:shadow-card-hover hover:border-primary-400'
        }`}
      >
        <div className="space-y-3.5">
          {/* Card Top Tag Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {isAlternative ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ALTERNATIVE</span>
              </span>
            ) : isPrimary && searchActive ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-primary-100 text-primary-800 border border-primary-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary-600" />
                <span>PRIMARY MATCH</span>
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                {med.category || 'Pharmaceutical'}
              </span>
            )}

            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm ml-auto">
              {pricing.concessionPercent}% OFF
            </span>
          </div>

          {/* Product Image & Title */}
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200/90 text-primary-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm overflow-hidden p-1">
              {displayImg ? (
                <img
                  src={displayImg}
                  alt={med.brandName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 rounded-lg">
                  <Pill className="w-7 h-7 rotate-45" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors leading-tight truncate">
                {med.brandName}
              </h3>
              <p className="text-xs font-bold text-primary-700 mt-0.5 font-mono">{med.power}</p>
              <p className="text-[11px] text-slate-500 truncate">{med.genericName}</p>
            </div>
          </div>

          {/* Alternative Similarity Notice */}
          {isAlternative && (
            <div className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-[11px] text-emerald-900 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">
                Equivalent salt: <strong>{med.genericName}</strong> ({med.power})
              </span>
            </div>
          )}

          {/* Hospital & Location Meta */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold truncate max-w-[170px]">
                <Building2 className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                <span className="truncate">{med.hospitalName}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 flex-shrink-0">
                <Navigation className="w-3 h-3 text-emerald-500" />
                {med.distanceKm || 12} km away
              </span>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 truncate max-w-[140px]">
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">{med.location}</span>
              </span>

              <span className={`inline-flex items-center gap-1 font-mono font-semibold ${
                isCold ? 'text-primary-700' : 'text-slate-600'
              }`}>
                <Thermometer className="w-3 h-3 text-cyan-600" />
                {isCold ? 'Cold 2°C - 8°C' : 'Room Temp'}
              </span>
            </div>
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Available</span>
              <span className="font-mono font-extrabold text-slate-900 text-sm">{med.quantity}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Batch No.</span>
              <span className="font-mono font-semibold text-slate-700 text-xs truncate block">{med.batchNo || 'N/A'}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Expiry</span>
              <span className="font-mono font-bold text-amber-700 text-xs truncate block">{med.expiryDate}</span>
            </div>
          </div>
        </div>

        {/* Pricing and Request Button */}
        <div className="pt-4 mt-4 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-slate-400 line-through">MRP ₹{med.unitOriginalPrice}</span>
              <div className="text-base font-extrabold font-mono text-primary-800">
                ₹{discountedPrice} <span className="text-[10px] text-slate-500 font-normal">/ unit</span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(med);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all group-hover:scale-105"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Lot</span>
            </button>
          </div>

          {/* Alternative count pill or invoice indicator */}
          <div className="flex items-center gap-2">
            {altCount > 0 && !isAlternative && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAlternatives(med);
                }}
                className="w-full py-2 px-3 rounded-xl bg-teal-50/90 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                title="View composition-based alternative brands"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>{altCount} Composition Alternative{altCount > 1 ? 's' : ''} Available</span>
              </button>
            )}

            {isAlternative && med.invoice && (
              <div className="w-full py-1.5 px-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-medium flex items-center justify-center gap-1.5 font-mono">
                <FileText className="w-3.5 h-3.5 text-primary-600" />
                <span>Verified Invoice Attached</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHorizontalCard = (med, { isPrimary = false, isAlternative = false } = {}) => {
    const pricing = getExpiryPricing(med.expiryDate, med.unitOriginalPrice || med.mrp);
    const discountedPrice = pricing.sellingPricePerUnit;
    const isCold = med.storageType?.toLowerCase().includes('cold');
    const altCount = alternativesCountMap[med.id] || 0;
    const displayImg = med.images?.[0]?.url || med.image;

    return (
      <div
        key={med.id}
        onClick={() => handleOpenDetail(med)}
        className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 group cursor-pointer ${
          isAlternative 
            ? 'border-emerald-300 shadow-md hover:border-emerald-500 hover:shadow-lg ring-1 ring-emerald-200/60' 
            : 'border-slate-200/90 shadow-card hover:shadow-card-hover hover:border-primary-400'
        }`}
      >
        {/* Medicine & Formulation Info */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-[280px] lg:w-[34%]">
          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200/90 text-primary-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm overflow-hidden p-1">
            {displayImg ? (
              <img
                src={displayImg}
                alt={med.brandName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary-600 rounded-lg">
                <Pill className="w-7 h-7 rotate-45" />
              </div>
            )}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-700 transition-colors leading-tight">
                {med.brandName}
              </h3>

              {isAlternative ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm flex items-center gap-1 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ALTERNATIVE</span>
                </span>
              ) : isPrimary && searchActive ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-primary-100 text-primary-800 border border-primary-300 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-primary-600" />
                  <span>PRIMARY MATCH</span>
                </span>
              ) : null}

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm flex-shrink-0">
                {pricing.concessionPercent}% OFF
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-primary-700 font-mono">{med.power}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 truncate text-[11px]">{med.genericName}</span>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {med.category || 'Pharmaceutical'}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                isCold ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                <Thermometer className="w-3 h-3 text-cyan-600" />
                {isCold ? 'Cold 2°C - 8°C' : 'Room Temp'}
              </span>
              {med.invoice && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                  <FileText className="w-3 h-3 text-primary-600" />
                  <span>Invoice #{med.invoice.invoiceNumber || 'Verified'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hospital Provider & Location */}
        <div className="flex flex-col justify-center space-y-1.5 sm:w-52 lg:border-l lg:border-r border-slate-100 lg:px-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold truncate">
            <Building2 className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
            <span className="truncate">{med.hospitalName}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="truncate">{med.location}</span>
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Navigation className="w-3 h-3 text-emerald-600" />
              <span>{med.distanceKm || 12} km away</span>
            </span>
          </div>
        </div>

        {/* Batch Specifications: Units, Mfg, Expiry */}
        <div className="grid grid-cols-3 gap-2 flex-1 max-w-md text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Available</span>
            <span className="font-mono font-extrabold text-slate-900 text-sm block leading-tight">
              {med.quantity}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-mono">Units</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Batch No.</span>
            <span className="font-mono font-semibold text-slate-700 text-xs block leading-tight truncate">
              {med.batchNo || 'N/A'}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-mono">Lot #</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Expiry</span>
            <span className="font-mono font-bold text-amber-700 text-xs block leading-tight truncate">
              {med.expiryDate}
            </span>
            <span className="text-[9px] text-amber-700/80 uppercase font-mono">Window</span>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="flex items-center justify-between lg:flex-col lg:items-end lg:justify-center gap-2.5 min-w-[170px] border-t lg:border-t-0 border-slate-100 pt-3 lg:pt-0">
          <div className="text-left lg:text-right">
            <span className="text-[10px] font-mono text-slate-400 line-through block">MRP ₹{med.unitOriginalPrice}</span>
            <div className="text-lg font-extrabold font-mono text-primary-800 leading-tight">
              ₹{discountedPrice} <span className="text-[10px] text-slate-500 font-normal">/ unit</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            {altCount > 0 && !isAlternative && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAlternatives(med);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all hover:scale-105 flex-shrink-0"
                title="View composition-based alternative brands"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>{altCount} Alt{altCount > 1 ? 's' : ''}</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(med);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all group-hover:scale-105 flex-shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Lot</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCardList = (items, { isPrimary = false, isAlternative = false } = {}) => {
    if (viewMode === 'scroll') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-primary-600" />
              <span>Scroll horizontally to browse medicine lots</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollShelf('left')}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-sm"
                title="Scroll Left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollShelf('right')}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors shadow-sm"
                title="Scroll Right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div
            id="horizontal-shelf-container"
            className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-300"
          >
            {items.map((med) => (
              <div key={med.id} className="w-[350px] flex-shrink-0 snap-start">
                {renderGridCard(med, { isPrimary, isAlternative })}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((med) => renderGridCard(med, { isPrimary, isAlternative }))}
        </div>
      );
    }

    return (
      <div className="space-y-3.5">
        {items.map((med) => renderHorizontalCard(med, { isPrimary, isAlternative }))}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Compliance Status Notice */}
      {isOperationalLocked && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
          currentVerification === 'pending' || currentVerification === 'under_review' || currentVerification === 'pending_approval'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
            : isSuspended
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-950'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-950'
        }`}>
          <div>
            <div className="font-bold text-sm">
              Medicine Exchange Restricted • Facility Status: <span className="capitalize">{currentVerification.replace('_', ' ')}</span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {currentVerification === 'pending' || currentVerification === 'under_review' || currentVerification === 'pending_approval' ? (
                <span>Requisition requests and medicine lot exchanges are restricted until your hospital accreditation is verified by MEDEX Central Administration.</span>
              ) : isSuspended ? (
                <span>Your facility account has been suspended ({liveHospital?.suspensionReason || 'Administrative hold'}). Requisition orders are disabled.</span>
              ) : (
                <span>Your facility registration was rejected ({liveHospital?.rejectionReason || 'Documentation declined'}). Requisition orders are disabled.</span>
              )}
            </p>
          </div>
        </div>
      )}
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-secondary-950 via-secondary-900 to-[#0A3D44] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-secondary-800">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-cyan-300 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>VERIFIED INTER-HOSPITAL MEDICINE EXCHANGE</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            B2B Medicine Exchange Marketplace
          </h1>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Acquire critical pharmaceutical lots from verified partner hospital pharmacies with guaranteed cold-chain transport SLA and automated concession discounts.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-300 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="font-bold text-white">CDSCO Rule 65 Compliant</div>
            <div className="text-[10px] text-slate-400">All lot transfers digitally signed</div>
          </div>
        </div>
      </div>

      {/* FEATURE 1 — MARKETPLACE ENTRY BLOCKS (Hub View) */}
      {activeMode === 'hub' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* ENTRY BLOCK A: PURCHASE MEDICINES */}
            <div
              onClick={() => handleSelectMode('purchase')}
              className="p-6 rounded-2xl border-2 border-slate-200/90 bg-white hover:border-primary-500 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-800 text-white flex items-center justify-center shadow-lg shadow-primary-600/20 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-primary-50 text-primary-800 border border-primary-200">
                    Buyer Procurement
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 group-hover:text-primary-800 transition-colors">
                      Purchase Medicines
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Acquire critical pharmaceutical lots from verified partner hospital pharmacies with automated concession discounts, guaranteed cold-chain transport SLA, and digital CDSCO transfer requisitions.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Available Exchange Lots</span>
                    <span className="font-mono font-extrabold text-slate-800 text-sm">
                      {marketplace?.length || 0} Lots Listed
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Regulatory Framework</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      Rule 65 SLA Validated
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-primary-700 flex items-center gap-1.5 group-hover:underline">
                  <span>Open Purchase Marketplace</span>
                </span>
                <div className="w-9 h-9 rounded-xl bg-primary-50 group-hover:bg-primary-600 text-primary-700 group-hover:text-white flex items-center justify-center transition-all shadow-sm">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* ENTRY BLOCK B: SELL MEDICINES */}
            <div
              onClick={() => handleSelectMode('sell')}
              className="p-6 rounded-2xl border-2 border-slate-200/90 bg-white hover:border-emerald-500 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                    <Tag className="w-7 h-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Seller Portal
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                      Sell Medicines
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-300">
                      6-Step Workflow
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Monetize unutilized inventory stock. Select medicines directly from your hospital inventory, choose specific batches, configure custom concession rates, and list for verified partner facilities.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Batch Selection</span>
                    <span className="font-mono font-extrabold text-slate-800 text-sm">
                      Lot-Level Stock Control
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Pricing Control</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      Custom % & ₹ Concession
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 group-hover:underline">
                  <span>Start Sell Workflow</span>
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white flex items-center justify-center transition-all shadow-sm">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>

          {/* Quick Explainer Bar */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">How MedEx Inter-Hospital Exchange Works</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Secure peer-to-peer pharmaceutical liquidity network preventing stockouts while minimizing expired medicine write-offs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectMode('purchase')}
                className="px-4 py-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-800 text-xs font-bold transition-colors"
              >
                Browse Buyer Market
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode('sell')}
                className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
              >
                List Excess Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELL MEDICINES WORKFLOW VIEW */}
      {activeMode === 'sell' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-sm text-xs">
            <button
              type="button"
              onClick={() => handleSelectMode('hub')}
              className="font-bold text-slate-600 hover:text-primary-700 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace Hub</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Need to buy medicines instead?</span>
              <button
                type="button"
                onClick={() => handleSelectMode('purchase')}
                className="px-3 py-1 rounded-lg bg-primary-50 text-primary-800 font-bold hover:bg-primary-100 transition-colors"
              >
                Switch to Purchase
              </button>
            </div>
          </div>

          <SellMedicinesWorkflow onBackToMarketplace={() => handleSelectMode('hub')} />
        </div>
      )}

      {/* PURCHASE MEDICINES VIEW (Existing Marketplace) */}
      {activeMode === 'purchase' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Control Bar for Purchase Mode */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-sm text-xs">
            <button
              type="button"
              onClick={() => handleSelectMode('hub')}
              className="font-bold text-slate-600 hover:text-primary-700 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace Hub</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Want to sell excess stock?</span>
              <button
                type="button"
                onClick={() => handleSelectMode('sell')}
                className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Switch to Sell Medicines</span>
              </button>
            </div>
          </div>

          {/* Primary Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          
          {/* Main Keyword Search */}
          <div className="relative lg:col-span-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Brand Name, Salt Formulation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
            />
          </div>

          {/* Dosage / Power Filter */}
          <div className="lg:col-span-3">
            <input
              type="text"
              placeholder="Dosage (e.g. 1g, 40mg, 100ml)"
              value={powerFilter}
              onChange={(e) => setPowerFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Location Search */}
          <div className="relative lg:col-span-3">
            <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="City / Region (e.g. Mumbai, Delhi)"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Distance Radius */}
          <div className="lg:col-span-2">
            <select
              value={maxDistance}
              onChange={(e) => setMaxDistance(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Any Distance</option>
              <option value="15">Within 15 km</option>
              <option value="30">Within 30 km</option>
              <option value="50">Within 50 km</option>
            </select>
          </div>

        </div>

        {/* Smart Composition Alternatives Search Banner */}
        {smartSearchAlternatives.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 via-primary-50 to-teal-50 border border-teal-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-600 text-white shadow-sm flex-shrink-0 mt-0.5 sm:mt-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-900">
                    Smart Composition Match:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-teal-100 text-teal-900 border border-teal-200">
                    {smartSearchAlternatives.length} Alternative Brand{smartSearchAlternatives.length > 1 ? 's' : ''} Found
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                  Identical active formulation & strength available from peer hospital pharmacies for query "<strong className="text-slate-800">{search.trim()}</strong>".
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAlternatives(smartSearchAlternatives[0])}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-105 flex items-center justify-center gap-1.5 flex-shrink-0"
            >
              <span>Explore Alternatives</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Secondary Category Pills and View Switcher */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium text-[11px] mr-1">Therapeutic Class:</span>
            {['all', 'critical', 'cardiology', 'emergency', 'antibiotic', 'diabetes'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3.5 w-full md:w-auto">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyNearExpiry}
                onChange={(e) => setOnlyNearExpiry(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-[11px] text-amber-800 font-bold">Near-Expiry Discounts (25%+ OFF)</span>
            </label>

            <div className="flex items-center gap-3">
              {/* Sorting Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="stock">Highest Stock</option>
                <option value="expiry">Expiry (Soonest First)</option>
              </select>

              <span className="font-mono text-slate-400 text-xs hidden sm:inline">
                Showing: <strong className="text-slate-900">{filteredMarketplace.length}</strong> Lots
              </span>

              {/* View Switcher: Horizontal List (default), Horizontal Shelf, Grid */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('horizontal')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'horizontal'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Horizontal Medicine List (Rows)"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Horizontal List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scroll')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'scroll'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Horizontal Scroll Shelf"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Horizontal Shelf</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Medicine Cards Section */}
      {isLoading && marketplace.length === 0 ? (
        <LoadingSpinner text="Querying active marketplace lots..." />
      ) : searchActive ? (
        // SEARCH IS ACTIVE: Split into Primary Matches and Composition Alternatives
        primaryResults.length === 0 && alternativeResults.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm text-slate-700">No medicines found matching "{search.trim()}"</p>
            <p className="text-xs text-slate-400 mt-1">Try searching by generic salt name (e.g. Paracetamol) or resetting filters</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Primary Results Section */}
            {primaryResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />
                    <h2 className="text-base font-extrabold text-slate-900">
                      Primary Matches for "{search.trim()}"
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-50 text-primary-700 border border-primary-200">
                      {primaryResults.length} {primaryResults.length === 1 ? 'lot' : 'lots'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                    Direct brand or search keyword matches
                  </span>
                </div>

                {renderCardList(primaryResults, { isPrimary: true, isAlternative: false })}
              </div>
            )}

            {/* 2. Composition-Based Alternatives Section */}
            {alternativeResults.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm flex-shrink-0 mt-0.5 sm:mt-0">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-black text-slate-900">
                            Composition-Based Alternative Medicines
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-sm">
                            {alternativeResults.length} ALTERNATIVE{alternativeResults.length > 1 ? 'S' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                          Different brands with the <strong>same active composition, strength, and dosage form</strong> as your requested medicine. Available from peer hospital pharmacies.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-emerald-200/80 flex items-center gap-2 text-[11px] text-emerald-900 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span>
                      <strong>Clinical Safety Notice:</strong> For licensed medical professional reference only. Generic / brand substitution requires physician or hospital pharmacist verification.
                    </span>
                  </div>
                </div>

                {renderCardList(alternativeResults, { isPrimary: false, isAlternative: true })}
              </div>
            )}
          </div>
        )
      ) : filteredMarketplace.length > 0 ? (
        renderCardList(filteredMarketplace)
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
          <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="font-bold text-sm text-slate-700">No medicines found matching these criteria</p>
          <p className="text-xs text-slate-400 mt-1">Try resetting your dosage or location filters</p>
        </div>
      )}
        </div>
      )}

      {/* Detailed Medicine Inspection Drawer with 3D Preview */}
      <MedicineDetailDrawer
        isOpen={!!activeDrawerMedicine}
        onClose={() => setActiveDrawerMedicine(null)}
        medicine={activeDrawerMedicine}
        onRequestSubmit={handleRequisitionSubmit}
        isRequestDisabled={isSuspended}
        onOpenAlternatives={handleOpenAlternatives}
        marketplace={marketplace}
      />

      {/* Alternative Branded Medicines Finder Modal */}
      <AlternativeMedicinesModal
        isOpen={isAltModalOpen}
        onClose={() => {
          setIsAltModalOpen(false);
          setAltTargetMedicine(null);
        }}
        targetMedicine={altTargetMedicine}
        marketplaceInventory={marketplace}
        onSelectAlternative={handleSelectAlternative}
      />

    </div>
  );
};

export default Marketplace;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Boxes, 
  Search, 
  Plus, 
  ArrowRightLeft, 
  History, 
  Building2, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Package, 
  RotateCcw, 
  Pill, 
  ArrowRight, 
  ArrowLeft,
  ShieldCheck, 
  Check, 
  X, 
  Info,
  ChevronRight,
  FileText,
  Layers,
  Printer,
  Download,
  Eye,
  Percent,
  MapPin,
  Calendar,
  Hash,
  Sparkles
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { getStoredItem, KEYS } from '../../services/storage';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

/**
 * Robust composite medicine grouping key generator.
 * Identifies clinically distinct formulations by combining:
 * - Brand / display name
 * - Active generic molecule / composition
 * - Strength / dosage
 * - Dosage form
 * Ensures Paracetamol 500 mg Tablet != Paracetamol 500 mg Syrup != Paracetamol 650 mg Tablet.
 */
export const getMedicineGroupKey = (item) => {
  const name = (item.medicineName || item.medicine || item.brandName || '').trim().toLowerCase();
  const generic = (item.genericName || '').trim().toLowerCase();
  const strength = (item.strength || item.dosage || item.power || '').trim().toLowerCase().replace(/\s+/g, '');
  const form = (item.dosageForm || item.form || 'tablet').trim().toLowerCase();
  return `${name}___${generic}___${strength}___${form}`;
};

export const AdminInventory = () => {
  const adminState = useSelector((state) => state.admin);

  // Raw Central Inventory Data & Reference Data
  const [inventoryData, setInventoryData] = useState({ items: [], summary: {} });
  const [masterMedicines, setMasterMedicines] = useState([]);
  const [hospitalList, setHospitalList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --------------------------------------------------------------------------
  // VIEW MODE: 'medicine' (default) or 'hospital'
  // --------------------------------------------------------------------------
  const [inventoryMode, setInventoryMode] = useState('medicine');

  // --------------------------------------------------------------------------
  // HIERARCHICAL DRILL-DOWN STATE
  // Mode 'medicine':
  //   LEVEL 1: Aggregated Medicine Inventory (selectedMedicineKey === null)
  //   LEVEL 2: Hospital Contributors (selectedMedicineKey !== null && selectedHospitalId === null)
  //   LEVEL 3: Batches (selectedHospitalId !== null && selectedBatchId === null)
  //   LEVEL 4: Complete Lot Details + Bill (selectedBatchId !== null)
  // Mode 'hospital':
  //   LEVEL 1: Hospital Directory (selectedHospitalId === null)
  //   LEVEL 2: Hospital Medicines Inventory (selectedHospitalId !== null && selectedMedicineKey === null)
  //   LEVEL 3: Batches for Hospital + Medicine (selectedMedicineKey !== null && selectedBatchId === null)
  //   LEVEL 4: Complete Lot Details + Bill (selectedBatchId !== null)
  // --------------------------------------------------------------------------
  const [selectedMedicineKey, setSelectedMedicineKey] = useState(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  // Router hooks & Alert Target Highlighting State
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [highlightedBatchId, setHighlightedBatchId] = useState(null);
  const [highlightedMedicineKey, setHighlightedMedicineKey] = useState(null);
  const [highlightFeedback, setHighlightFeedback] = useState(null);
  const processedTargetRef = useRef(null);

  // Level 4 Bill Preview Modal State
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  // Level 1 Filters & Search State (Medicine Mode)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dosageFormFilter, setDosageFormFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');

  // Filters & Search State (Hospital Mode)
  const [hospitalSearchTerm, setHospitalSearchTerm] = useState('');
  const [hospitalSortBy, setHospitalSortBy] = useState('stock_desc');
  const [hospitalMedicineSearch, setHospitalMedicineSearch] = useState('');
  const [hospitalMedicineStatusFilter, setHospitalMedicineStatusFilter] = useState('all');

  // Mode Switch Handler
  const handleSwitchMode = (mode) => {
    if (mode === inventoryMode) return;
    setInventoryMode(mode);
    setSelectedMedicineKey(null);
    setSelectedHospitalId(null);
    setSelectedBatchId(null);
  };

  // Modals for Stock Operations (Preserving existing administrative capabilities)
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isTransferConfirmOpen, setIsTransferConfirmOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Add Stock Form State
  const [addForm, setAddForm] = useState({
    hospitalId: '',
    masterMedicineId: '',
    medicineName: '',
    genericName: '',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    strength: '500 mg',
    manufacturer: '',
    packing: '15 Tablets / Strip',
    packSize: '15 Tablets / Strip',
    numberOfPacks: 10,
    unitsPerPack: 15,
    unit: 'Tablet',
    shelfLocation: 'Rack A - Shelf 3',
    storageCondition: 'Room Temperature (15°C - 25°C)',
    batchNo: '',
    quantity: 150,
    totalUnits: 150,
    mfgDate: '',
    expiryDate: '',
    minStockLevel: 25,
    mrp: 100,
    concessionRate: 95,
    costRate: 90,
    notes: 'Admin override authorized batch addition',
    isFromDetails: false,
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    targetHospitalId: '',
    quantity: 25,
    note: 'Inter-hospital reallocation quota mandate',
  });

  // Load Inventory & Reference Data
  const loadInventory = async () => {
    setIsLoading(true);
    try {
      // Retrieve raw unified inventory from adminService
      const res = await adminService.getInventory('all', '', 'all', 'all', 'all');
      setInventoryData(res);
    } catch (err) {
      console.error('Failed to load inventory', err);
      toast.error('Failed to retrieve inventory records');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
      setMasterMedicines(masterMeds);

      let hosps = adminState?.hospitals || [];
      if (hosps.length === 0) {
        hosps = await adminService.getHospitals();
      }
      setHospitalList(hosps.filter((h) => h.status === 'verified' || !h.status));
    } catch (err) {
      console.error('Failed to load reference data', err);
    }
  };

  useEffect(() => {
    loadReferenceData();
    loadInventory();
  }, []);

  // --------------------------------------------------------------------------
  // AGGREGATION ENGINE: DERIVE MEDICINE HIERARCHY FROM RAW INVENTORY LOTS
  // --------------------------------------------------------------------------
  const rawItems = inventoryData.items || [];

  const aggregatedMedicines = useMemo(() => {
    if (!rawItems || rawItems.length === 0) return [];

    const groupsMap = new Map();

    rawItems.forEach((item) => {
      const key = getMedicineGroupKey(item);
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          medicineName: item.medicineName || item.medicine || item.brandName || 'Pharmaceutical',
          genericName: item.genericName || 'Active Generic Molecule',
          strength: item.strength || item.dosage || item.power || '',
          dosageForm: item.dosageForm || item.form || 'Tablet',
          category: item.category || 'Essential Medicines',
          manufacturer: item.manufacturer || 'Approved Pharmaceutical Lab',
          unit: item.unit || 'Tablet',
          packing: item.packing || item.packSize || 'Standard Packaging',
          totalStock: 0,
          availableStock: 0,
          reservedStock: 0,
          hospitalsMap: new Map(),
          lots: [],
          earliestExpiry: null,
          latestExpiry: null,
          prices: [],
        });
      }

      const group = groupsMap.get(key);
      const qty = Number(item.quantity || item.totalQuantity || item.totalStock || 0);
      const avail = Number(item.availableStock !== undefined ? item.availableStock : item.availableQuantity !== undefined ? item.availableQuantity : qty);
      const reserved = Number(item.reservedStock || item.reservedQuantity || 0);

      group.totalStock += qty;
      group.availableStock += avail;
      group.reservedStock += reserved;
      group.lots.push(item);

      const price = Number(item.concessionRate || item.unitFinalPrice || item.mrp || 0);
      if (price > 0) group.prices.push(price);

      if (item.expiryDate) {
        if (!group.earliestExpiry || item.expiryDate < group.earliestExpiry) {
          group.earliestExpiry = item.expiryDate;
        }
        if (!group.latestExpiry || item.expiryDate > group.latestExpiry) {
          group.latestExpiry = item.expiryDate;
        }
      }

      // Track by Contributing Hospital
      const hId = item.hospitalId || 'hosp-unknown';
      if (!group.hospitalsMap.has(hId)) {
        group.hospitalsMap.set(hId, {
          hospitalId: hId,
          hospitalName: item.hospitalName || item.hospital || 'Hospital Facility',
          hospitalCity: item.hospitalCity || '',
          hospitalState: item.hospitalState || '',
          location: item.location || (item.hospitalCity ? `${item.hospitalCity}, ${item.hospitalState || ''}` : 'Regional Facility'),
          units: 0,
          available: 0,
          batches: [],
          earliestExpiry: null,
        });
      }

      const hospEntry = group.hospitalsMap.get(hId);
      hospEntry.units += qty;
      hospEntry.available += avail;
      hospEntry.batches.push(item);
      if (item.expiryDate) {
        if (!hospEntry.earliestExpiry || item.expiryDate < hospEntry.earliestExpiry) {
          hospEntry.earliestExpiry = item.expiryDate;
        }
      }
    });

    // Finalize groups and calculate exact hospital contribution percentages dynamically
    return Array.from(groupsMap.values()).map((grp) => {
      const hospitalsList = Array.from(grp.hospitalsMap.values()).map((hosp) => {
        // Formula: hospital's total quantity for this medicine / total quantity of this medicine across all hospitals * 100
        const percentage = grp.totalStock > 0 ? (hosp.units / grp.totalStock) * 100 : 0;
        return {
          ...hosp,
          percentage: Number(percentage.toFixed(1)),
          batchesCount: hosp.batches.length,
          // Sort batches by expiry date soonest first
          batches: hosp.batches.sort((a, b) => new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31')),
        };
      }).sort((a, b) => b.units - a.units);

      // Determine overall stock status for the aggregated medicine
      const now = new Date();
      const allLotsExpired = grp.lots.length > 0 && grp.lots.every((l) => l.isExpired || (l.expiryDate && new Date(l.expiryDate) < now));
      const hasNearExpiryLot = grp.lots.some((l) => l.isNearExpiry);

      let overallStatus = 'in_stock';
      if (grp.totalStock === 0 || grp.availableStock === 0) {
        overallStatus = 'out_of_stock';
      } else if (allLotsExpired) {
        overallStatus = 'expired';
      } else if (grp.availableStock <= 25) {
        overallStatus = 'low_stock';
      } else if (hasNearExpiryLot) {
        overallStatus = 'expiring_soon';
      } else {
        overallStatus = 'in_stock';
      }

      // Unit price display range
      let priceDisplay = 'N/A';
      if (grp.prices.length > 0) {
        const minP = Math.min(...grp.prices);
        const maxP = Math.max(...grp.prices);
        priceDisplay = minP === maxP ? `₹${minP.toFixed(2)}` : `₹${minP.toFixed(2)} - ₹${maxP.toFixed(2)}`;
      }

      return {
        ...grp,
        hospitalsCount: hospitalsList.length,
        batchesCount: grp.lots.length,
        hospitalContributions: hospitalsList,
        overallStatus,
        priceDisplay,
      };
    });
  }, [rawItems]);

  // Global Summary Metrics calculated accurately across unique medicines and facilities
  const globalMetrics = useMemo(() => {
    const totalMedicines = aggregatedMedicines.length;
    const totalStockUnits = rawItems.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    const contributingHospitals = new Set(rawItems.map((i) => i.hospitalId)).size;
    const activeBatches = rawItems.length;

    return {
      totalMedicines,
      totalStockUnits,
      contributingHospitals,
      activeBatches,
    };
  }, [aggregatedMedicines, rawItems]);

  // Dynamic filter options
  const availableCategories = useMemo(() => {
    const cats = new Set(aggregatedMedicines.map((m) => m.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [aggregatedMedicines]);

  const availableDosageForms = useMemo(() => {
    const forms = new Set(aggregatedMedicines.map((m) => m.dosageForm).filter(Boolean));
    return Array.from(forms).sort();
  }, [aggregatedMedicines]);

  // Level 1: Filtered & Sorted Aggregated Medicines
  const filteredMedicines = useMemo(() => {
    return aggregatedMedicines.filter((med) => {
      // Search across medicine name, generic name, category, strength
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        med.medicineName.toLowerCase().includes(q) ||
        med.genericName.toLowerCase().includes(q) ||
        med.category.toLowerCase().includes(q) ||
        med.strength.toLowerCase().includes(q);

      // Status filter
      let matchStatus = true;
      if (statusFilter !== 'all') {
        matchStatus = med.overallStatus === statusFilter;
      }

      // Category filter
      let matchCategory = true;
      if (categoryFilter !== 'all') {
        matchCategory = med.category === categoryFilter;
      }

      // Dosage form filter
      let matchForm = true;
      if (dosageFormFilter !== 'all') {
        matchForm = med.dosageForm === dosageFormFilter;
      }

      return matchSearch && matchStatus && matchCategory && matchForm;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.medicineName.localeCompare(b.medicineName);
        case 'name_desc':
          return b.medicineName.localeCompare(a.medicineName);
        case 'stock_desc':
          return b.totalStock - a.totalStock;
        case 'stock_asc':
          return a.totalStock - b.totalStock;
        case 'hospitals_desc':
          return b.hospitalsCount - a.hospitalsCount;
        case 'batches_desc':
          return b.batchesCount - a.batchesCount;
        default:
          return 0;
      }
    });
  }, [aggregatedMedicines, searchTerm, statusFilter, categoryFilter, dosageFormFilter, sortBy]);

  // --------------------------------------------------------------------------
  // AGGREGATION ENGINE: DERIVE HOSPITAL HIERARCHY FROM RAW INVENTORY LOTS
  // --------------------------------------------------------------------------
  const aggregatedHospitals = useMemo(() => {
    if (!rawItems || rawItems.length === 0) return [];

    // Filter out rejected hospitals
    const rejectedHospIds = new Set(
      (adminState?.hospitals || [])
        .filter((h) => h.status === 'rejected')
        .map((h) => h.id)
    );

    const hospitalMap = new Map();

    rawItems.forEach((item) => {
      const hId = item.hospitalId || 'hosp-unknown';
      if (rejectedHospIds.has(hId)) return;

      if (!hospitalMap.has(hId)) {
        const hospObj = (adminState?.hospitals || []).find((h) => h.id === hId);
        hospitalMap.set(hId, {
          hospitalId: hId,
          hospitalName: item.hospitalName || hospObj?.name || 'Hospital Facility',
          hospitalCity: item.hospitalCity || hospObj?.city || '',
          hospitalState: item.hospitalState || hospObj?.state || '',
          location: item.location || hospObj?.address || (item.hospitalCity ? `${item.hospitalCity}, ${item.hospitalState || ''}` : 'Regional Facility'),
          status: hospObj?.status || 'verified',
          totalUnits: 0,
          batchesCount: 0,
          lots: [],
          medicinesMap: new Map(),
        });
      }

      const hosp = hospitalMap.get(hId);
      const qty = Number(item.quantity || item.totalQuantity || item.totalStock || 0);
      const avail = Number(item.availableStock !== undefined ? item.availableStock : item.availableQuantity !== undefined ? item.availableQuantity : qty);

      hosp.totalUnits += qty;
      hosp.batchesCount += 1;
      hosp.lots.push(item);

      // Group medicines inside this hospital
      const medKey = getMedicineGroupKey(item);
      if (!hosp.medicinesMap.has(medKey)) {
        hosp.medicinesMap.set(medKey, {
          key: medKey,
          medicineName: item.medicineName || item.medicine || item.brandName || 'Pharmaceutical',
          genericName: item.genericName || 'Active Generic Molecule',
          strength: item.strength || item.dosage || item.power || '',
          dosageForm: item.dosageForm || item.form || 'Tablet',
          category: item.category || 'Essential Medicines',
          totalUnits: 0,
          availableUnits: 0,
          batches: [],
          earliestExpiry: null,
          latestExpiry: null,
          prices: [],
        });
      }

      const med = hosp.medicinesMap.get(medKey);
      med.totalUnits += qty;
      med.availableUnits += avail;
      med.batches.push(item);

      const price = Number(item.concessionRate || item.unitFinalPrice || item.mrp || 0);
      if (price > 0) med.prices.push(price);

      if (item.expiryDate) {
        if (!med.earliestExpiry || item.expiryDate < med.earliestExpiry) {
          med.earliestExpiry = item.expiryDate;
        }
        if (!med.latestExpiry || item.expiryDate > med.latestExpiry) {
          med.latestExpiry = item.expiryDate;
        }
      }
    });

    // Finalize each hospital & its medicines
    return Array.from(hospitalMap.values())
      .filter((hosp) => hosp.totalUnits > 0 || hosp.batchesCount > 0)
      .map((hosp) => {
        const medicinesList = Array.from(hosp.medicinesMap.values()).map((med) => {
          med.batches.sort((a, b) => new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31'));

          const now = new Date();
          const allLotsExpired = med.batches.length > 0 && med.batches.every((l) => l.isExpired || (l.expiryDate && new Date(l.expiryDate) < now));
          const hasNearExpiryLot = med.batches.some((l) => l.isNearExpiry);

          let overallStatus = 'in_stock';
          if (med.totalUnits === 0 || med.availableUnits === 0) {
            overallStatus = 'out_of_stock';
          } else if (allLotsExpired) {
            overallStatus = 'expired';
          } else if (med.availableUnits <= 25) {
            overallStatus = 'low_stock';
          } else if (hasNearExpiryLot) {
            overallStatus = 'expiring_soon';
          }

          let priceDisplay = 'N/A';
          if (med.prices.length > 0) {
            const minP = Math.min(...med.prices);
            const maxP = Math.max(...med.prices);
            priceDisplay = minP === maxP ? `₹${minP.toFixed(2)}` : `₹${minP.toFixed(2)} - ₹${maxP.toFixed(2)}`;
          }

          return {
            ...med,
            batchesCount: med.batches.length,
            overallStatus,
            priceDisplay,
          };
        }).sort((a, b) => b.totalUnits - a.totalUnits);

        return {
          ...hosp,
          uniqueMedicinesCount: medicinesList.length,
          medicines: medicinesList,
        };
      });
  }, [rawItems, adminState?.hospitals]);

  // Filtered & Sorted Hospitals (Hospital Mode Level 1)
  const filteredHospitals = useMemo(() => {
    return aggregatedHospitals.filter((hosp) => {
      const q = hospitalSearchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        hosp.hospitalName.toLowerCase().includes(q) ||
        hosp.hospitalId.toLowerCase().includes(q) ||
        hosp.location.toLowerCase().includes(q) ||
        hosp.hospitalCity.toLowerCase().includes(q) ||
        hosp.hospitalState.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      switch (hospitalSortBy) {
        case 'stock_asc':
          return a.totalUnits - b.totalUnits;
        case 'name_asc':
          return a.hospitalName.localeCompare(b.hospitalName);
        case 'name_desc':
          return b.hospitalName.localeCompare(a.hospitalName);
        case 'medicines_desc':
          return b.uniqueMedicinesCount - a.uniqueMedicinesCount;
        case 'batches_desc':
          return b.batchesCount - a.batchesCount;
        case 'stock_desc':
        default:
          return b.totalUnits - a.totalUnits;
      }
    });
  }, [aggregatedHospitals, hospitalSearchTerm, hospitalSortBy]);

  // Active Hierarchical Context Objects
  const currentMedicineGroup = useMemo(() => {
    if (!selectedMedicineKey) return null;
    return aggregatedMedicines.find((m) => m.key === selectedMedicineKey) || null;
  }, [aggregatedMedicines, selectedMedicineKey]);

  const currentSelectedHospital = useMemo(() => {
    if (!selectedHospitalId) return null;
    return aggregatedHospitals.find((h) => h.hospitalId === selectedHospitalId) || null;
  }, [aggregatedHospitals, selectedHospitalId]);

  const currentHospitalContribution = useMemo(() => {
    if (!currentMedicineGroup || !selectedHospitalId) return null;
    return currentMedicineGroup.hospitalContributions.find((h) => h.hospitalId === selectedHospitalId) || null;
  }, [currentMedicineGroup, selectedHospitalId]);

  const currentHospitalMedicine = useMemo(() => {
    if (!currentSelectedHospital || !selectedMedicineKey) return null;
    return currentSelectedHospital.medicines.find((m) => m.key === selectedMedicineKey) || null;
  }, [currentSelectedHospital, selectedMedicineKey]);

  // Filtered medicines inside a selected hospital (Hospital Mode Level 2)
  const filteredHospitalMedicines = useMemo(() => {
    if (!currentSelectedHospital) return [];
    return currentSelectedHospital.medicines.filter((med) => {
      const q = hospitalMedicineSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        med.medicineName.toLowerCase().includes(q) ||
        med.genericName.toLowerCase().includes(q) ||
        med.category.toLowerCase().includes(q) ||
        med.strength.toLowerCase().includes(q);

      let matchStatus = true;
      if (hospitalMedicineStatusFilter !== 'all') {
        matchStatus = med.overallStatus === hospitalMedicineStatusFilter;
      }

      return matchSearch && matchStatus;
    });
  }, [currentSelectedHospital, hospitalMedicineSearch, hospitalMedicineStatusFilter]);

  const currentBatchLot = useMemo(() => {
    if (!selectedBatchId) return null;
    if (inventoryMode === 'hospital') {
      if (currentHospitalMedicine) {
        const found = currentHospitalMedicine.batches.find((b) => b.id === selectedBatchId);
        if (found) return found;
      }
    } else {
      if (currentHospitalContribution) {
        const found = currentHospitalContribution.batches.find((b) => b.id === selectedBatchId);
        if (found) return found;
      }
    }
    return rawItems.find((i) => i.id === selectedBatchId) || null;
  }, [inventoryMode, currentHospitalMedicine, currentHospitalContribution, selectedBatchId, rawItems]);

  // --------------------------------------------------------------------------
  // ALERT DEEP-LINKING & EXACT RECORD TARGETING ENGINE (Section 1 - 24)
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Wait until inventory has finished loading and rawItems are populated
    if (isLoading || !rawItems || rawItems.length === 0) return;

    const targetInvId = searchParams.get('inventoryLotId') || searchParams.get('inventoryId') || searchParams.get('lotId') || location.state?.alertTarget?.inventoryLotId || location.state?.alertTarget?.inventoryId;
    const targetBatchNo = searchParams.get('batchNo') || searchParams.get('batchId') || location.state?.alertTarget?.batchNo || location.state?.alertTarget?.batchId;
    const targetHospId = searchParams.get('hospitalId') || location.state?.alertTarget?.hospitalId;
    const targetMedName = searchParams.get('medicineName') || location.state?.alertTarget?.medicineName;
    const targetMedId = searchParams.get('medicineId') || location.state?.alertTarget?.medicineId;
    const targetMode = searchParams.get('mode');

    // If no target parameters exist, do nothing
    if (!targetInvId && !targetBatchNo && !targetMedName && !targetMedId && !targetHospId) {
      return;
    }

    // Deduplicate processing for the exact same target parameters
    const targetSignature = `${targetInvId || ''}__${targetBatchNo || ''}__${targetHospId || ''}__${targetMedName || ''}__${targetMedId || ''}`;
    if (processedTargetRef.current === targetSignature) {
      return;
    }
    processedTargetRef.current = targetSignature;

    // Helper to clean search parameters from URL so page reloads do not re-run animation
    const cleanTargetParams = () => {
      try {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('inventoryLotId');
        nextParams.delete('inventoryId');
        nextParams.delete('lotId');
        nextParams.delete('batchNo');
        nextParams.delete('batchId');
        nextParams.delete('hospitalId');
        nextParams.delete('medicineName');
        nextParams.delete('medicineId');
        nextParams.delete('targetType');
        nextParams.delete('mode');
        setSearchParams(nextParams, { replace: true });
        if (location.state?.alertTarget) {
          navigate(location.pathname + (nextParams.toString() ? `?${nextParams.toString()}` : ''), {
            replace: true,
            state: {},
          });
        }
      } catch (e) {
        console.warn('Failed to clean target search params', e);
      }
    };

    // 1. EXACT BATCH MATCHING HIERARCHY (Section 1, 15)
    let matchedLot = null;

    // Priority 1: inventoryId / lotId (Primary stable unique identifier)
    if (targetInvId) {
      matchedLot = rawItems.find((i) => i.id === targetInvId || i.inventoryId === targetInvId || i.lotId === targetInvId);
    }

    // Priority 2: batchId
    if (!matchedLot && targetBatchNo) {
      matchedLot = rawItems.find((i) => i.id === targetBatchNo || i.batchId === targetBatchNo);
    }

    // Priority 3: hospitalId + medicineId + batchNumber
    if (!matchedLot && targetHospId && targetMedId && targetBatchNo) {
      matchedLot = rawItems.find((i) => 
        i.hospitalId === targetHospId &&
        (i.medicineId === targetMedId || i.masterMedicineId === targetMedId) &&
        (i.batchNumber === targetBatchNo || i.batchNo === targetBatchNo)
      );
    }

    // Priority 4: hospitalId + medicineName + batchNumber
    if (!matchedLot && targetHospId && targetMedName && targetBatchNo) {
      const normMed = targetMedName.trim().toLowerCase();
      matchedLot = rawItems.find((i) => 
        i.hospitalId === targetHospId &&
        ((i.medicineName || i.medicine || i.brandName || '').trim().toLowerCase() === normMed ||
         (i.genericName || '').trim().toLowerCase() === normMed) &&
        (i.batchNumber === targetBatchNo || i.batchNo === targetBatchNo)
      );
    }

    // Priority 4b: medicineName + batchNumber (across hospitals fallback)
    if (!matchedLot && targetMedName && targetBatchNo) {
      const normMed = targetMedName.trim().toLowerCase();
      matchedLot = rawItems.find((i) => 
        ((i.medicineName || i.medicine || i.brandName || '').trim().toLowerCase() === normMed ||
         (i.genericName || '').trim().toLowerCase() === normMed) &&
        (i.batchNumber === targetBatchNo || i.batchNo === targetBatchNo)
      );
    }

    // IF EXACT BATCH RECORD FOUND:
    if (matchedLot) {
      const medKey = getMedicineGroupKey(matchedLot);
      const hospId = matchedLot.hospitalId;

      // Ensure appropriate view mode is active if specified
      if (targetMode === 'hospital') {
        setInventoryMode('hospital');
        setSelectedHospitalId(hospId);
        setSelectedMedicineKey(medKey);
        setSelectedBatchId(null);
      } else {
        // Default hierarchical view: Medicine -> Hospital -> Batches (Level 3)
        setInventoryMode('medicine');
        setSelectedMedicineKey(medKey);
        setSelectedHospitalId(hospId);
        setSelectedBatchId(null);
      }

      // Apply target highlight state
      setHighlightedBatchId(matchedLot.id);
      const medDisplayName = matchedLot.medicineName || matchedLot.medicine || targetMedName || 'Medicine';
      const batchDisplay = matchedLot.batchNumber || matchedLot.batchNo || targetBatchNo;
      const hospDisplay = matchedLot.hospitalName || matchedLot.hospital || 'Hospital';

      const feedbackMsg = `Focused on ${medDisplayName} — Batch ${batchDisplay} (${hospDisplay})`;
      setHighlightFeedback(feedbackMsg);
      toast.success(feedbackMsg, { icon: '🎯', id: 'inspect-target-toast' });

      // Smooth scroll to the exact target batch card
      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const targetElement = document.getElementById(`batch-card-${matchedLot.id}`);
        if (targetElement) {
          clearInterval(scrollTimer);
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        } else if (attempts > 30) {
          clearInterval(scrollTimer);
        }
      }, 75);

      // Temporary focus highlight duration (3-4 cycles, fades out smoothly after ~4.2s)
      const fadeTimer = setTimeout(() => {
        setHighlightedBatchId(null);
      }, 4200);

      cleanTargetParams();
      return () => {
        clearInterval(scrollTimer);
        clearTimeout(fadeTimer);
      };
    }

    // 2. AGGREGATED MEDICINE MATCHING (Section 4: Low Stock Alert targeting medicine)
    if (targetMedName || targetMedId) {
      let matchedMed = null;
      if (targetMedId) {
        matchedMed = aggregatedMedicines.find((m) => m.lots?.some((l) => l.medicineId === targetMedId || l.masterMedicineId === targetMedId));
      }
      if (!matchedMed && targetMedName) {
        const norm = targetMedName.trim().toLowerCase();
        matchedMed = aggregatedMedicines.find((m) => 
          m.medicineName.toLowerCase() === norm ||
          m.genericName.toLowerCase() === norm ||
          m.medicineName.toLowerCase().startsWith(norm)
        );
      }

      if (matchedMed) {
        setInventoryMode('medicine');

        // If target specifies a hospital, drill down to Level 2
        if (targetHospId && matchedMed.hospitalContributions.some((h) => h.hospitalId === targetHospId)) {
          setSelectedMedicineKey(matchedMed.key);
          setSelectedHospitalId(null);
          setSelectedBatchId(null);

          setHighlightedMedicineKey(matchedMed.key);
          const hospName = matchedMed.hospitalContributions.find((h) => h.hospitalId === targetHospId)?.hospitalName || 'Hospital';
          const feedbackMsg = `Focused on ${matchedMed.medicineName} (${hospName})`;
          setHighlightFeedback(feedbackMsg);
          toast.success(feedbackMsg, { icon: '🎯', id: 'inspect-med-toast' });

          let attempts = 0;
          const scrollTimer = setInterval(() => {
            attempts++;
            const targetElement = document.getElementById(`hosp-contrib-${targetHospId}`);
            if (targetElement) {
              clearInterval(scrollTimer);
              targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            } else if (attempts > 30) {
              clearInterval(scrollTimer);
            }
          }, 75);

          const fadeTimer = setTimeout(() => {
            setHighlightedMedicineKey(null);
          }, 4200);

          cleanTargetParams();
          return () => {
            clearInterval(scrollTimer);
            clearTimeout(fadeTimer);
          };
        } else {
          // Highlight in Level 1 Aggregated Medicine Table
          setSearchTerm('');
          setStatusFilter('all');
          setDosageFormFilter('all');
          setCategoryFilter('all');
          setSelectedMedicineKey(null);
          setSelectedHospitalId(null);
          setSelectedBatchId(null);

          setHighlightedMedicineKey(matchedMed.key);
          const feedbackMsg = `Focused on ${matchedMed.medicineName}`;
          setHighlightFeedback(feedbackMsg);
          toast.success(feedbackMsg, { icon: '🎯', id: 'inspect-med-toast' });

          let attempts = 0;
          const scrollTimer = setInterval(() => {
            attempts++;
            const targetElement = document.getElementById(`medicine-row-${matchedMed.key}`);
            if (targetElement) {
              clearInterval(scrollTimer);
              targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            } else if (attempts > 30) {
              clearInterval(scrollTimer);
            }
          }, 75);

          const fadeTimer = setTimeout(() => {
            setHighlightedMedicineKey(null);
          }, 4200);

          cleanTargetParams();
          return () => {
            clearInterval(scrollTimer);
            clearTimeout(fadeTimer);
          };
        }
      }
    }

    // 3. TARGET NOT FOUND (Section 14 & Test 6)
    toast.error('The referenced inventory lot could not be found.', {
      icon: '⚠️',
      duration: 4000,
      id: 'inspect-missing-toast',
    });
    cleanTargetParams();
  }, [isLoading, rawItems, aggregatedMedicines, searchParams, location.state]);

  // Clear Filters Handlers
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setDosageFormFilter('all');
    setSortBy('default');
  };

  const handleClearHospitalFilters = () => {
    setHospitalSearchTerm('');
    setHospitalSortBy('stock_desc');
  };

  const handleClearHospitalMedicineFilters = () => {
    setHospitalMedicineSearch('');
    setHospitalMedicineStatusFilter('all');
  };

  // --------------------------------------------------------------------------
  // ADMINISTRATIVE ACTION HANDLERS (Add Stock, Transfer Stock, Stock History)
  // --------------------------------------------------------------------------
  const handleOpenAddStockOverride = () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultExp = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    setAddForm({
      hospitalId: hospitalList[0]?.id || '',
      masterMedicineId: '',
      medicineName: '',
      genericName: '',
      category: 'Analgesics & Antipyretics',
      dosageForm: 'Tablet',
      strength: '500 mg',
      manufacturer: '',
      packing: '15 Tablets / Strip',
      packSize: '15 Tablets / Strip',
      numberOfPacks: 10,
      unitsPerPack: 15,
      unit: 'Tablet',
      shelfLocation: 'Rack A - Shelf 3',
      storageCondition: 'Room Temperature (15°C - 25°C)',
      batchNo: 'BATCH-' + Math.floor(1000 + Math.random() * 9000),
      quantity: 150,
      totalUnits: 150,
      mfgDate: today,
      expiryDate: defaultExp,
      minStockLevel: 25,
      mrp: 100,
      concessionRate: 95,
      costRate: 90,
      notes: 'Admin override - system assistance stock intake',
      isFromDetails: false,
    });
    setIsAddStockOpen(true);
  };

  const handleOpenAddStockFromBatch = () => {
    if (!currentBatchLot) return;
    const today = new Date().toISOString().split('T')[0];
    const uPerPack = currentBatchLot.unitsPerPack || 15;
    const nPacks = currentBatchLot.numberOfPacks || 10;
    const totUnits = nPacks * uPerPack;
    setAddForm({
      hospitalId: currentBatchLot.hospitalId,
      masterMedicineId: currentBatchLot.masterMedicineId || currentBatchLot.medicineId || '',
      medicineName: currentBatchLot.medicineName || currentBatchLot.medicine,
      genericName: currentBatchLot.genericName || '',
      category: currentBatchLot.category || '',
      dosageForm: currentBatchLot.dosageForm || currentBatchLot.form || 'Tablet',
      strength: currentBatchLot.strength || currentBatchLot.power || '',
      manufacturer: currentBatchLot.manufacturer || '',
      packing: currentBatchLot.packing || currentBatchLot.packSize || `${uPerPack} Tablets / Strip`,
      packSize: currentBatchLot.packSize || currentBatchLot.packing || `${uPerPack} Tablets / Strip`,
      numberOfPacks: nPacks,
      unitsPerPack: uPerPack,
      unit: currentBatchLot.unit || 'Tablet',
      shelfLocation: currentBatchLot.shelfLocation || 'Rack A - Shelf 3',
      storageCondition: currentBatchLot.storageCondition || currentBatchLot.storageType || 'Room Temperature (15°C - 25°C)',
      batchNo: currentBatchLot.batchNumber || currentBatchLot.batchNo || '',
      quantity: totUnits,
      totalUnits: totUnits,
      mfgDate: currentBatchLot.mfgDate || today,
      expiryDate: currentBatchLot.expiryDate || '',
      minStockLevel: currentBatchLot.minStockLevel || currentBatchLot.minimumStock || 20,
      mrp: currentBatchLot.mrp || currentBatchLot.unitOriginalPrice || 100,
      concessionRate: currentBatchLot.concessionRate || currentBatchLot.unitFinalPrice || 95,
      costRate: currentBatchLot.costRate || currentBatchLot.acquisitionCost || 90,
      notes: 'Admin override additional batch intake',
      isFromDetails: true,
    });
    setIsAddStockOpen(true);
  };

  const handleSelectMasterMedicine = (medName) => {
    const found = masterMedicines.find((m) => 
      (m.medicineName || m.brandName || '').toLowerCase() === medName.toLowerCase()
    );
    if (found) {
      const uPerPack = found.unitsPerPack || 15;
      const nPacks = 10;
      setAddForm((prev) => ({
        ...prev,
        masterMedicineId: found.id,
        medicineName: found.medicineName || found.brandName,
        genericName: found.genericName || prev.genericName,
        category: found.category || prev.category,
        dosageForm: found.dosageForm || found.form || prev.dosageForm,
        strength: found.dosage || found.strength || found.power || prev.strength,
        manufacturer: found.manufacturer || prev.manufacturer,
        packing: found.packing || found.packSize || `${uPerPack} Tablets / Strip`,
        packSize: found.packSize || found.packing || `${uPerPack} Tablets / Strip`,
        numberOfPacks: nPacks,
        unitsPerPack: uPerPack,
        quantity: nPacks * uPerPack,
        totalUnits: nPacks * uPerPack,
        unit: found.unit || prev.unit || 'Tablet',
        storageCondition: found.storageCondition || found.storageType || prev.storageCondition,
        mrp: found.mrp || prev.mrp || 100,
        concessionRate: found.concessionRate || prev.concessionRate || 95,
        costRate: found.costRate || prev.costRate || 90,
      }));
    } else {
      setAddForm((prev) => ({ ...prev, medicineName: medName }));
    }
  };

  const handleSubmitAddStock = async (e) => {
    e.preventDefault();
    if (!addForm.hospitalId) {
      toast.error('Please select a hospital');
      return;
    }
    if (!addForm.medicineName?.trim()) {
      toast.error('Please specify a medicine name');
      return;
    }
    if (!addForm.batchNo?.trim()) {
      toast.error('Please enter a batch number');
      return;
    }
    if (Number(addForm.quantity) <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (!addForm.expiryDate) {
      toast.error('Please provide an expiry date');
      return;
    }

    try {
      const result = await adminService.adminAddStock(addForm);
      toast.success(`Successfully saved stock: ${result.brandName} (${addForm.quantity} units)`);
      setIsAddStockOpen(false);
      await loadInventory();
    } catch (err) {
      toast.error(err.message || 'Failed to add stock');
    }
  };

  const handleOpenTransferModal = () => {
    if (!currentBatchLot) return;
    if (currentBatchLot.isExpired) {
      toast.error('Expired stock cannot be transferred under safety regulations');
      return;
    }
    if (Number(currentBatchLot.availableStock || 0) <= 0) {
      toast.error('Out-of-stock item cannot be transferred');
      return;
    }

    const availableTargets = hospitalList.filter((h) => h.id !== currentBatchLot.hospitalId);
    setTransferForm({
      targetHospitalId: availableTargets[0]?.id || '',
      quantity: Math.min(25, Number(currentBatchLot.availableStock || 1)),
      note: 'Inter-hospital emergency quota transfer',
    });
    setIsTransferOpen(true);
  };

  const handleProceedTransferConfirmation = (e) => {
    e.preventDefault();
    if (!transferForm.targetHospitalId) {
      toast.error('Please select a recipient hospital');
      return;
    }
    const transferQty = Number(transferForm.quantity);
    if (transferQty <= 0) {
      toast.error('Transfer quantity must be greater than 0');
      return;
    }
    if (transferQty > Number(currentBatchLot.availableStock || 0)) {
      toast.error(`Transfer quantity exceeds available stock (${currentBatchLot.availableStock} units)`);
      return;
    }

    setIsTransferOpen(false);
    setIsTransferConfirmOpen(true);
  };

  const handleExecuteTransfer = async () => {
    try {
      await adminService.transferStock({
        medicineId: currentBatchLot.id,
        sourceHospitalId: currentBatchLot.hospitalId,
        targetHospitalId: transferForm.targetHospitalId,
        quantity: Number(transferForm.quantity),
        note: transferForm.note,
      });

      toast.success(`Transferred ${transferForm.quantity} units to destination hospital`);
      setIsTransferConfirmOpen(false);
      await loadInventory();
    } catch (err) {
      toast.error(err.message || 'Failed to complete stock transfer');
    }
  };

  const handleOpenStockHistory = async () => {
    if (!currentBatchLot) return;
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const logs = await adminService.getStockHistory(
        currentBatchLot.medicineId || currentBatchLot.id,
        currentBatchLot.batchNumber || currentBatchLot.batchNo,
        currentBatchLot.hospitalId
      );
      setHistoryLogs(logs);
    } catch (err) {
      console.error('Failed to load stock history', err);
      toast.error('Could not retrieve stock movement history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const targetHospitalObj = hospitalList.find((h) => h.id === transferForm.targetHospitalId);

  return (
    <div className="space-y-6">
      
      {/* 1. TOP BANNER */}
      <div className="bg-gradient-to-r from-secondary-950 via-secondary-900 to-primary-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-primary-500/20 text-cyan-300 border border-primary-500/30">
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
              CENTRAL HEALTHCARE INVENTORY
            </span>
            <span className="text-xs text-slate-400 font-mono">Progressive Multi-Hospital Matrix</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Central Inventory Directory</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed">
            Consolidated overview of pharmaceutical formulations across the MedEx network. Drill down from unique medicines to hospital contributors, batch lots, and purchase bills.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-right">
            <div className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider">Network Stock</div>
            <div className="text-lg sm:text-xl font-black text-white font-mono">
              {globalMetrics.totalStockUnits.toLocaleString('en-IN')} Units
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-right">
            <div className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">Medicines</div>
            <div className="text-lg sm:text-xl font-black text-white font-mono">
              {globalMetrics.totalMedicines} Unique
            </div>
          </div>

          <button
            onClick={handleOpenAddStockOverride}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-lg shadow-primary-600/30 transition-all active:scale-95"
            title="Admin Override: Add Stock to Specific Hospital"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Stock</span>
          </button>
        </div>
      </div>

      {/* 2. INVENTORY VIEW SWITCHER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">
            VIEW INVENTORY BY:
          </span>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80 shadow-inner">
            <button
              onClick={() => handleSwitchMode('medicine')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inventoryMode === 'medicine'
                  ? 'bg-white text-primary-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Pill className="w-3.5 h-3.5 text-teal-600" />
              <span>Medicine</span>
            </button>

            <button
              onClick={() => handleSwitchMode('hospital')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inventoryMode === 'hospital'
                  ? 'bg-white text-primary-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-primary-600" />
              <span>Hospital</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            {inventoryMode === 'medicine' ? (
              <span>Hierarchy: <strong className="text-slate-700">Medicine → Hospitals → Batches</strong></span>
            ) : (
              <span>Hierarchy: <strong className="text-slate-700">Hospital → Medicines → Batches</strong></span>
            )}
          </span>
        </div>
      </div>

      {/* 3. PROGRESSIVE DRILL-DOWN BREADCRUMB NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-slate-500 overflow-x-auto py-0.5">
          
          {/* Mode: Medicine Breadcrumbs */}
          {inventoryMode === 'medicine' && (
            <>
              {/* Level 1 Breadcrumb: Inventory Root */}
              <button
                onClick={() => {
                  setSelectedMedicineKey(null);
                  setSelectedHospitalId(null);
                  setSelectedBatchId(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  !selectedMedicineKey
                    ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/80 shadow-xs'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-primary-600" />
                <span>Inventory</span>
              </button>

              {/* Level 2 Breadcrumb: Medicine */}
              {selectedMedicineKey && currentMedicineGroup && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedHospitalId(null);
                      setSelectedBatchId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all truncate max-w-[200px] sm:max-w-[260px] ${
                      selectedMedicineKey && !selectedHospitalId
                        ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/80 shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    title={currentMedicineGroup.medicineName}
                  >
                    <Pill className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">{currentMedicineGroup.medicineName}</span>
                  </button>
                </>
              )}

              {/* Level 3 Breadcrumb: Hospital */}
              {selectedHospitalId && currentHospitalContribution && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedBatchId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all truncate max-w-[180px] sm:max-w-[240px] ${
                      selectedHospitalId && !selectedBatchId
                        ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/80 shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    title={currentHospitalContribution.hospitalName}
                  >
                    <Building2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span className="truncate">{currentHospitalContribution.hospitalName}</span>
                  </button>
                </>
              )}

              {/* Level 4 Breadcrumb: Batch */}
              {selectedBatchId && currentBatchLot && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-900 font-mono font-bold border border-primary-200/80 shadow-xs truncate max-w-[160px]">
                    <Hash className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span className="truncate">Batch {currentBatchLot.batchNumber || currentBatchLot.batchNo}</span>
                  </span>
                </>
              )}
            </>
          )}

          {/* Mode: Hospital Breadcrumbs */}
          {inventoryMode === 'hospital' && (
            <>
              {/* Level 1 Breadcrumb: Inventory Root */}
              <button
                onClick={() => {
                  setSelectedHospitalId(null);
                  setSelectedMedicineKey(null);
                  setSelectedBatchId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-all"
              >
                <Boxes className="w-3.5 h-3.5 text-primary-600" />
                <span>Inventory</span>
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

              {/* Hospitals Directory Breadcrumb */}
              <button
                onClick={() => {
                  setSelectedHospitalId(null);
                  setSelectedMedicineKey(null);
                  setSelectedBatchId(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  !selectedHospitalId
                    ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/80 shadow-xs'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-primary-600" />
                <span>Hospitals</span>
              </button>

              {/* Level 2 Breadcrumb: Hospital */}
              {selectedHospitalId && currentSelectedHospital && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedMedicineKey(null);
                      setSelectedBatchId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all truncate max-w-[180px] sm:max-w-[240px] ${
                      selectedHospitalId && !selectedMedicineKey
                        ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/80 shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    title={currentSelectedHospital.hospitalName}
                  >
                    <Building2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span className="truncate">{currentSelectedHospital.hospitalName}</span>
                  </button>
                </>
              )}

              {/* Level 3 Breadcrumb: Medicine */}
              {selectedMedicineKey && currentHospitalMedicine && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedBatchId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all truncate max-w-[200px] sm:max-w-[260px] ${
                      selectedMedicineKey && !selectedBatchId
                        ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/80 shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    title={currentHospitalMedicine.medicineName}
                  >
                    <Pill className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">{currentHospitalMedicine.medicineName}</span>
                  </button>
                </>
              )}

              {/* Level 4 Breadcrumb: Batch */}
              {selectedBatchId && currentBatchLot && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-900 font-mono font-bold border border-primary-200/80 shadow-xs truncate max-w-[160px]">
                    <Hash className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span className="truncate">Batch {currentBatchLot.batchNumber || currentBatchLot.batchNo}</span>
                  </span>
                </>
              )}
            </>
          )}

        </div>

        {/* Quick Back Action */}
        {((inventoryMode === 'medicine' && selectedMedicineKey) || (inventoryMode === 'hospital' && selectedHospitalId)) && (
          <button
            onClick={() => {
              if (inventoryMode === 'medicine') {
                if (selectedBatchId) setSelectedBatchId(null);
                else if (selectedHospitalId) setSelectedHospitalId(null);
                else setSelectedMedicineKey(null);
              } else {
                if (selectedBatchId) setSelectedBatchId(null);
                else if (selectedMedicineKey) setSelectedMedicineKey(null);
                else setSelectedHospitalId(null);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {inventoryMode === 'medicine'
                ? selectedBatchId
                  ? `Back to ${currentHospitalContribution?.hospitalName || 'Batches'}`
                  : selectedHospitalId
                  ? `Back to ${currentMedicineGroup?.medicineName || 'Contributors'}`
                  : 'Back to Medicine Inventory'
                : selectedBatchId
                ? `Back to ${currentHospitalMedicine?.medicineName || 'Batches'}`
                : selectedMedicineKey
                ? `Back to ${currentSelectedHospital?.hospitalName || 'Hospital'}`
                : 'Back to Hospitals Directory'}
            </span>
          </button>
        )}
      </div>

      {/* Alert Target Inspection Notification Banner (Section 16) */}
      {highlightFeedback && (
        <div 
          role="status"
          aria-live="polite"
          className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-teal-50/90 border-2 border-teal-500/80 text-teal-900 shadow-md text-xs font-semibold"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-600"></span>
            </span>
            <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
            <span>{highlightFeedback}</span>
          </div>
          <button
            onClick={() => setHighlightFeedback(null)}
            className="p-1 rounded-lg text-teal-600 hover:text-teal-900 hover:bg-teal-100 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LEVEL 1: AGGREGATED MEDICINE INVENTORY                             */}
      {/* ------------------------------------------------------------------ */}
      {inventoryMode === 'medicine' && !selectedMedicineKey && (
        <div className="space-y-6">
          
          {/* Summary Metric Cards (Aggregated accurately across network) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Medicines</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2">{globalMetrics.totalMedicines}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Unique clinical formulations</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stock Units</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-primary-800 font-mono mt-2">{globalMetrics.totalStockUnits.toLocaleString('en-IN')}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Consolidated inventory doses</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contributing Hospitals</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-2">{globalMetrics.contributingHospitals}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Facilities holding stock</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Batches</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-cyan-700 font-mono mt-2">{globalMetrics.activeBatches}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Individual procurement lots</p>
            </div>

          </div>

          {/* Level 1 Search & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700">
                Showing <strong className="text-primary-700 font-mono">{filteredMedicines.length}</strong> unique pharmaceutical products
              </span>

              {/* Reset Filter Action */}
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors self-end sm:self-auto"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Filters</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              
              {/* Search across unique medicines */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search medicine (e.g. Dolo, Paracetamol, Amoxicillin)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>

              {/* Stock Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="expiring_soon">Expiring Soon</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              {/* Dosage Form Filter */}
              <div>
                <select
                  value={dosageFormFilter}
                  onChange={(e) => setDosageFormFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Dosage Forms</option>
                  {availableDosageForms.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Sort Dropdown */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="default">Sort: Default</option>
                  <option value="name_asc">Name (A → Z)</option>
                  <option value="name_desc">Name (Z → A)</option>
                  <option value="stock_desc">Total Stock: High to Low</option>
                  <option value="stock_asc">Total Stock: Low to High</option>
                  <option value="hospitals_desc">Contributing Hospitals: Most</option>
                  <option value="batches_desc">Batches: Most</option>
                </select>
              </div>

            </div>
          </div>

          {/* Level 1 Medicine Inventory Table (One row per unique medicine!) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16">
                <LoadingSpinner text="Aggregating network medicine inventory..." />
              </div>
            ) : filteredMedicines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-200/80">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Medicine Name</th>
                      <th className="py-3.5 px-3">Generic / Composition</th>
                      <th className="py-3.5 px-3">Strength & Form</th>
                      <th className="py-3.5 px-3 text-right">Total Stock</th>
                      <th className="py-3.5 px-3 text-center">Hospitals</th>
                      <th className="py-3.5 px-3 text-center">Batches</th>
                      <th className="py-3.5 px-3 text-center">Stock Status</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredMedicines.map((med) => {
                      const isTargeted = highlightedMedicineKey === med.key;
                      return (
                        <tr
                          key={med.key}
                          id={`medicine-row-${med.key}`}
                          onClick={() => setSelectedMedicineKey(med.key)}
                          className={`transition-colors group cursor-pointer ${
                            isTargeted ? 'alert-target-highlight shadow-md' : 'hover:bg-teal-50/30'
                          }`}
                          title="Click to drill into contributing hospitals"
                        >
                        {/* Medicine Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                              <Pill className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <span className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors block truncate text-xs">
                                {med.medicineName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal truncate block">
                                {med.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Generic / Composition */}
                        <td className="py-3.5 px-3">
                          <span className="font-semibold text-slate-800 block truncate max-w-[200px]" title={med.genericName}>
                            {med.genericName}
                          </span>
                        </td>

                        {/* Strength & Dosage Form */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 text-xs">{med.strength || 'Standard'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 text-[11px]">{med.dosageForm}</span>
                          </div>
                        </td>

                        {/* Total Stock Units */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-sm text-slate-900">
                            {med.totalStock.toLocaleString('en-IN')} units
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {med.availableStock.toLocaleString('en-IN')} available
                          </span>
                        </td>

                        {/* Number of Contributing Hospitals */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{med.hospitalsCount} {med.hospitalsCount === 1 ? 'Hospital' : 'Hospitals'}</span>
                          </span>
                        </td>

                        {/* Number of Batches */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-xs">
                            {med.batchesCount} {med.batchesCount === 1 ? 'Batch' : 'Batches'}
                          </span>
                        </td>

                        {/* Overall Stock Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <StatusBadge status={med.overallStatus} />
                        </td>

                        {/* Action Drill-Down */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMedicineKey(med.key);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold text-xs border border-primary-200/60 shadow-xs transition-all"
                          >
                            <span>View Contributors</span>
                            <ArrowRight className="w-3 h-3 text-primary-600" />
                          </button>
                        </td>

                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400">
                <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-bold text-slate-700">No medicines match your filter</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting search keywords or selecting all stock statuses.</p>
                <button
                  onClick={handleClearFilters}
                  className="mt-3 px-4 py-1.5 rounded-xl text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LEVEL 2: HOSPITAL CONTRIBUTORS FOR SELECTED MEDICINE               */}
      {/* ------------------------------------------------------------------ */}
      {inventoryMode === 'medicine' && selectedMedicineKey && currentMedicineGroup && !selectedHospitalId && (
        <div className="space-y-6">
          
          {/* Medicine Header Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    <Pill className="w-3 h-3 text-teal-600" />
                    <span>MEDICINE LEVEL 2</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• Category: {currentMedicineGroup.category}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {currentMedicineGroup.medicineName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  Active Generic: <strong className="text-slate-800">{currentMedicineGroup.genericName}</strong> • Strength: <strong className="text-slate-800">{currentMedicineGroup.strength || 'Standard'}</strong> • Form: <strong className="text-slate-800">{currentMedicineGroup.dosageForm}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={currentMedicineGroup.overallStatus} />
                {currentMedicineGroup.priceDisplay !== 'N/A' && (
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                    {currentMedicineGroup.priceDisplay}
                  </span>
                )}
              </div>
            </div>

            {/* 4 Summary Stats as Specified in Prompt */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Stock</span>
                <div className="text-lg sm:text-xl font-black text-primary-800 font-mono mt-1">
                  {currentMedicineGroup.totalStock.toLocaleString('en-IN')} units
                </div>
                <span className="text-[10px] text-slate-500">Across all network nodes</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contributing Hospitals</span>
                <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono mt-1">
                  {currentMedicineGroup.hospitalsCount} {currentMedicineGroup.hospitalsCount === 1 ? 'Hospital' : 'Hospitals'}
                </div>
                <span className="text-[10px] text-slate-500">Holding active stock</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Batches</span>
                <div className="text-lg sm:text-xl font-black text-teal-700 font-mono mt-1">
                  {currentMedicineGroup.batchesCount} {currentMedicineGroup.batchesCount === 1 ? 'Batch' : 'Batches'}
                </div>
                <span className="text-[10px] text-slate-500">Separately listed lots</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expiry Window</span>
                <div className="text-xs font-mono font-bold text-slate-800 mt-1.5 truncate">
                  {currentMedicineGroup.earliestExpiry || 'Valid'}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">
                  {currentMedicineGroup.latestExpiry ? `To ${currentMedicineGroup.latestExpiry}` : 'Statutory shelf-life'}
                </span>
              </div>

            </div>
          </div>

          {/* Section: Stock Contribution by Hospital */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary-600" />
                  <span>Stock Contribution by Hospital</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any hospital row or card to inspect its specific batch numbers and manufacturing lots.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl shrink-0">
                {currentMedicineGroup.hospitalContributions.length} Contributors
              </span>
            </div>

            {/* List of Hospital Contribution Rows/Cards */}
            <div className="space-y-3">
              {currentMedicineGroup.hospitalContributions.map((hosp) => (
                <div
                  key={hosp.hospitalId}
                  id={`hosp-contrib-${hosp.hospitalId}`}
                  onClick={() => setSelectedHospitalId(hosp.hospitalId)}
                  className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group bg-white space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary-600 transition-colors">
                          {hosp.hospitalName}
                        </h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{hosp.location || 'Facility'} • ID: {hosp.hospitalId}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                          {hosp.units.toLocaleString('en-IN')} units
                        </div>
                        <span className="text-[11px] font-bold text-primary-700 font-mono">
                          {hosp.percentage}% of total stock
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHospitalId(hosp.hospitalId);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-primary-50 group-hover:text-primary-700 font-bold text-xs transition-colors"
                      >
                        <span>View Batches</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Visual Contribution Bar (Dynamic Formula: hospital units / total medicine units * 100) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Proportional share of {currentMedicineGroup.medicineName}</span>
                      <span className="font-mono font-bold text-slate-800">{hosp.percentage}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
                      <div
                        style={{ width: `${Math.min(100, Math.max(3, hosp.percentage))}%` }}
                        className="h-full bg-gradient-to-r from-teal-500 to-primary-600 rounded-full transition-all duration-500"
                        title={`${hosp.hospitalName}: ${hosp.percentage}% (${hosp.units} units)`}
                      />
                    </div>
                  </div>

                  {/* Metadata line: Batches & Earliest Expiry */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 font-mono">
                        {hosp.batchesCount} {hosp.batchesCount === 1 ? 'Batch registered' : 'Batches registered'}
                      </span>
                      {hosp.earliestExpiry && (
                        <>
                          <span>•</span>
                          <span>Earliest expiry: <strong className="font-mono text-slate-700">{hosp.earliestExpiry}</strong></span>
                        </>
                      )}
                    </div>

                    <span className="text-primary-600 font-semibold group-hover:underline flex items-center gap-1">
                      <span>Inspect {hosp.batchesCount} {hosp.batchesCount === 1 ? 'batch' : 'batches'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LEVEL 3: BATCH LIST FOR SELECTED HOSPITAL + MEDICINE               */}
      {/* ------------------------------------------------------------------ */}
      {inventoryMode === 'medicine' && selectedMedicineKey && selectedHospitalId && currentHospitalContribution && !selectedBatchId && (
        <div className="space-y-6">
          
          {/* Hospital + Medicine Header Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-800 border border-primary-200">
                    <Building2 className="w-3 h-3 text-primary-600" />
                    <span>HOSPITAL BATCHES LEVEL 3</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• Holding Facility</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {currentHospitalContribution.hospitalName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  Holding Stock for: <strong className="text-primary-700 font-bold">{currentMedicineGroup.medicineName}</strong> ({currentMedicineGroup.genericName})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                  {currentHospitalContribution.percentage}% of Network Stock
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Contributed</span>
                <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
                  {currentHospitalContribution.units.toLocaleString('en-IN')} units
                </div>
                <span className="text-[10px] text-slate-500">From this facility</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contribution Share</span>
                <div className="text-lg sm:text-xl font-black text-primary-700 font-mono mt-1">
                  {currentHospitalContribution.percentage}%
                </div>
                <span className="text-[10px] text-slate-500">Of total {currentMedicineGroup.medicineName}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batches Registered</span>
                <div className="text-lg sm:text-xl font-black text-teal-700 font-mono mt-1">
                  {currentHospitalContribution.batchesCount} {currentHospitalContribution.batchesCount === 1 ? 'Batch' : 'Batches'}
                </div>
                <span className="text-[10px] text-slate-500">Individual production runs</span>
              </div>

            </div>
          </div>

          {/* Section: Batches from Hospital */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary-600" />
                  <span>Batches from {currentHospitalContribution.hospitalName}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each batch represents a distinct manufacturing consignment. Click a batch to inspect full statutory details and purchase bill.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl shrink-0">
                {currentHospitalContribution.batches.length} Distinct Lots
              </span>
            </div>

            {/* Batch Cards / Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentHospitalContribution.batches.map((batch) => {
                const isTargeted = highlightedBatchId === batch.id;
                return (
                  <div
                    key={batch.id}
                    id={`batch-card-${batch.id}`}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group bg-white space-y-3.5 ${
                      isTargeted
                        ? 'alert-target-highlight alert-pulse-target shadow-xl ring-2 ring-primary-500'
                        : 'border-slate-200/80 hover:border-primary-300 hover:shadow-md'
                    }`}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          Batch {batch.batchNumber || batch.batchNo}
                        </span>
                        <StatusBadge status={batch.status} />
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono block">
                        Location: {batch.shelfLocation || 'Rack A - Shelf 3'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-black font-mono text-slate-900 block">
                        {Number(batch.quantity || 0).toLocaleString('en-IN')} units
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {batch.availableStock !== undefined ? `${batch.availableStock} avail` : 'Available stock'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mfg Date</span>
                      <span className="font-mono font-semibold text-slate-700">{batch.mfgDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Expiry Date</span>
                      <span className={`font-mono font-bold ${batch.isExpired ? 'text-rose-600' : batch.isNearExpiry ? 'text-amber-600' : 'text-slate-800'}`}>
                        {batch.expiryDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">MRP Rate</span>
                      <span className="font-mono font-bold text-slate-900">₹{Number(batch.mrp || 100).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">MedEx Rate</span>
                      <span className="font-mono font-bold text-primary-700">₹{Number(batch.concessionRate || 95).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Intake: {batch.purchaseDate || batch.dateAdded || '2024-09-01'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBatchId(batch.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 font-bold hover:bg-primary-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Lot Details & Bill</span>
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HOSPITAL MODE - LEVEL 1: HOSPITAL INVENTORY DIRECTORY              */}
      {/* ------------------------------------------------------------------ */}
      {inventoryMode === 'hospital' && !selectedHospitalId && (
        <div className="space-y-6">
          
          {/* Summary Metric Cards for Hospitals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hospitals With Stock</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-2">{aggregatedHospitals.length}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Approved medical facilities</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stock Units</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-primary-800 font-mono mt-2">{globalMetrics.totalStockUnits.toLocaleString('en-IN')}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Consolidated inventory doses</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unique Formulations</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2">{globalMetrics.totalMedicines}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Distributed formulations</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Active Batches</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-cyan-700 font-mono mt-2">{globalMetrics.activeBatches}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Across all facilities</p>
            </div>
          </div>

          {/* Hospital Search & Sort Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700">
                HOSPITAL INVENTORY — Showing <strong className="text-primary-700 font-mono">{filteredHospitals.length}</strong> hospitals with stock
              </span>

              {hospitalSearchTerm && (
                <button
                  onClick={handleClearHospitalFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors self-end sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Search</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Search hospitals by name, ID, location */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search hospitals by name, ID, or location..."
                  value={hospitalSearchTerm}
                  onChange={(e) => setHospitalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>

              {/* Hospital Sort Dropdown */}
              <div>
                <select
                  value={hospitalSortBy}
                  onChange={(e) => setHospitalSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="stock_desc">Sort: Total Units (High to Low)</option>
                  <option value="stock_asc">Sort: Total Units (Low to High)</option>
                  <option value="name_asc">Hospital Name (A → Z)</option>
                  <option value="name_desc">Hospital Name (Z → A)</option>
                  <option value="medicines_desc">Unique Medicines: Most</option>
                  <option value="batches_desc">Batches: Most</option>
                </select>
              </div>
            </div>
          </div>

          {/* Hospital Cards Directory */}
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner text="Aggregating hospital inventories..." />
            </div>
          ) : filteredHospitals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHospitals.map((hosp) => (
                <div
                  key={hosp.hospitalId}
                  onClick={() => setSelectedHospitalId(hosp.hospitalId)}
                  className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-primary-400 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 group-hover:text-primary-600 transition-colors break-words leading-tight">
                            {hosp.hospitalName}
                          </h3>
                          <span className="font-mono text-[10px] text-slate-400 font-semibold inline-block mt-0.5">
                            ID: {hosp.hospitalId}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Active
                      </span>
                    </div>

                    {hosp.location && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{hosp.location}</span>
                      </p>
                    )}

                    {/* Aggregate Summary Metrics */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Medicines</span>
                        <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                          {hosp.uniqueMedicinesCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Units</span>
                        <span className="text-sm font-black font-mono text-primary-700 mt-0.5 block">
                          {hosp.totalUnits.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batches</span>
                        <span className="text-sm font-black font-mono text-teal-700 mt-0.5 block">
                          {hosp.batchesCount}
                        </span>
                      </div>
                    </div>

                    {/* Top medicines preview snippet */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock Preview:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {hosp.medicines.slice(0, 3).map((m) => (
                          <span key={m.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-medium truncate max-w-[170px]">
                            <span className="truncate">{m.medicineName}</span>
                            <span className="font-mono font-bold text-primary-700">({m.totalUnits}u)</span>
                          </span>
                        ))}
                        {hosp.medicines.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-medium self-center">
                            +{hosp.medicines.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Click to inspect inventory</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHospitalId(hosp.hospitalId);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-50 group-hover:bg-primary-600 text-primary-700 group-hover:text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      <span>View Inventory</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                {hospitalSearchTerm ? 'No hospitals match your search criteria' : 'No hospital inventory available.'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {hospitalSearchTerm
                  ? 'Try searching by a different hospital name, facility ID, or state/city.'
                  : 'Currently no active hospital stock lots are recorded in the central database.'}
              </p>
              {hospitalSearchTerm && (
                <button
                  onClick={handleClearHospitalFilters}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HOSPITAL MODE - LEVEL 2: SELECTED HOSPITAL'S MEDICINE INVENTORY   */}
      {/* ------------------------------------------------------------------ */}
      {inventoryMode === 'hospital' && selectedHospitalId && currentSelectedHospital && !selectedMedicineKey && (
        <div className="space-y-6">
          
          {/* Hospital Inventory Header Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-800 border border-primary-200">
                    <Building2 className="w-3 h-3 text-primary-600" />
                    <span>HOSPITAL INVENTORY LEVEL 2</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-medium">Facility ID: {currentSelectedHospital.hospitalId}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {currentSelectedHospital.hospitalName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{currentSelectedHospital.location || `${currentSelectedHospital.hospitalCity || 'Regional'}, ${currentSelectedHospital.hospitalState || 'India'}`}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                  Approved Network Facility
                </span>
              </div>
            </div>

            {/* Aggregate Metrics for this Hospital */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Facility Stock</span>
                <div className="text-lg sm:text-xl font-black text-primary-800 font-mono mt-1">
                  {currentSelectedHospital.totalUnits.toLocaleString('en-IN')} units
                </div>
                <span className="text-[10px] text-slate-500">Across all registered medicines</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unique Medicines</span>
                <div className="text-lg sm:text-xl font-black text-teal-700 font-mono mt-1">
                  {currentSelectedHospital.uniqueMedicinesCount} {currentSelectedHospital.uniqueMedicinesCount === 1 ? 'Medicine' : 'Medicines'}
                </div>
                <span className="text-[10px] text-slate-500">Distinct formulations stocked</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Batches</span>
                <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
                  {currentSelectedHospital.batchesCount} {currentSelectedHospital.batchesCount === 1 ? 'Batch' : 'Batches'}
                </div>
                <span className="text-[10px] text-slate-500">Individual procurement lots</span>
              </div>
            </div>
          </div>

          {/* Search & Filters inside this Hospital */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700">
                Showing <strong className="text-primary-700 font-mono">{filteredHospitalMedicines.length}</strong> medicines for {currentSelectedHospital.hospitalName}
              </span>

              {hospitalMedicineSearch && (
                <button
                  onClick={handleClearHospitalMedicineFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors self-end sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Search</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search medicines in ${currentSelectedHospital.hospitalName}...`}
                  value={hospitalMedicineSearch}
                  onChange={(e) => setHospitalMedicineSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>

              <div>
                <select
                  value={hospitalMedicineStatusFilter}
                  onChange={(e) => setHospitalMedicineStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="expiring_soon">Expiring Soon</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </div>

          {/* Hospital Medicines Table (ONE MEDICINE = ONE ROW!) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {filteredHospitalMedicines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-200/80">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Medicine</th>
                      <th className="py-3.5 px-3">Composition</th>
                      <th className="py-3.5 px-3">Strength & Form</th>
                      <th className="py-3.5 px-3 text-right">Quantity</th>
                      <th className="py-3.5 px-3 text-center">Batches</th>
                      <th className="py-3.5 px-3 text-center">Expiry</th>
                      <th className="py-3.5 px-3 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredHospitalMedicines.map((med) => (
                      <tr
                        key={med.key}
                        onClick={() => setSelectedMedicineKey(med.key)}
                        className="hover:bg-teal-50/30 transition-colors group cursor-pointer"
                        title="Click to drill into batches for this medicine"
                      >
                        {/* Medicine */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                              <Pill className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <span className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors block truncate text-xs">
                                {med.medicineName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal truncate block">
                                {med.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Composition */}
                        <td className="py-3.5 px-3 font-normal text-slate-600 max-w-xs">
                          <span className="truncate block text-xs" title={med.genericName}>
                            {med.genericName}
                          </span>
                        </td>

                        {/* Strength & Form */}
                        <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {med.strength || 'Standard'} • {med.dosageForm}
                        </td>

                        {/* Quantity (Aggregated across this hospital's batches) */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {med.totalUnits.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {med.availableUnits} avail
                          </span>
                        </td>

                        {/* Batches Count */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                            {med.batchesCount}
                          </span>
                        </td>

                        {/* Expiry (Earliest) */}
                        <td className="py-3.5 px-3 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                          {med.earliestExpiry || 'N/A'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <StatusBadge status={med.overallStatus} />
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMedicineKey(med.key);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-primary-50 group-hover:text-primary-700 text-slate-700 font-bold text-xs transition-colors"
                          >
                            <span>View Batches</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center p-8">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">
                  {hospitalMedicineSearch ? 'No matching medicines found in this facility' : 'No inventory recorded for this hospital.'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {hospitalMedicineSearch
                    ? 'Try searching with a generic molecule or broad brand term.'
                    : 'This facility has no stock lots currently assigned.'}
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HOSPITAL MODE - LEVEL 3: BATCH LIST FOR HOSPITAL + MEDICINE        */}
      {/* ------------------------------------------------------------------ */}
      {inventoryMode === 'hospital' && selectedHospitalId && selectedMedicineKey && currentSelectedHospital && currentHospitalMedicine && !selectedBatchId && (
        <div className="space-y-6">
          
          {/* Hospital + Medicine Header Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-800 border border-primary-200">
                    <Building2 className="w-3 h-3 text-primary-600" />
                    <span>HOSPITAL BATCHES LEVEL 3</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-medium">• {currentSelectedHospital.hospitalName}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {currentHospitalMedicine.medicineName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  Active Generic: <strong className="text-slate-800">{currentHospitalMedicine.genericName}</strong> • Facility: <strong className="text-primary-700">{currentSelectedHospital.hospitalName}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={currentHospitalMedicine.overallStatus} />
                <span className="px-3.5 py-1.5 rounded-xl bg-teal-50 text-teal-800 font-mono font-bold text-xs border border-teal-200">
                  {currentHospitalMedicine.strength || 'Standard'} • {currentHospitalMedicine.dosageForm}
                </span>
              </div>
            </div>

            {/* Aggregate Metrics for this Medicine in this Hospital */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Quantity</span>
                <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
                  {currentHospitalMedicine.totalUnits.toLocaleString('en-IN')} units
                </div>
                <span className="text-[10px] text-slate-500">In {currentSelectedHospital.hospitalName}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batches Registered</span>
                <div className="text-lg sm:text-xl font-black text-primary-700 font-mono mt-1">
                  {currentHospitalMedicine.batchesCount} {currentHospitalMedicine.batchesCount === 1 ? 'Batch' : 'Batches'}
                </div>
                <span className="text-[10px] text-slate-500">Belonging to this facility</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Earliest Expiry</span>
                <div className="text-lg sm:text-xl font-black text-teal-700 font-mono mt-1">
                  {currentHospitalMedicine.earliestExpiry || 'N/A'}
                </div>
                <span className="text-[10px] text-slate-500">Active shelf life</span>
              </div>
            </div>
          </div>

          {/* Batches Belonging ONLY to this Hospital + Medicine */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary-600" />
                  <span>Batches for {currentHospitalMedicine.medicineName} at {currentSelectedHospital.hospitalName}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any batch to view complete provenance dossier and verify the associated purchase bill.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl shrink-0">
                Total: {currentHospitalMedicine.totalUnits.toLocaleString('en-IN')} units ({currentHospitalMedicine.batches.length} {currentHospitalMedicine.batches.length === 1 ? 'Batch' : 'Batches'})
              </span>
            </div>

            {/* Batch Cards Grid */}
            {currentHospitalMedicine.batches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentHospitalMedicine.batches.map((batch) => {
                  const isTargeted = highlightedBatchId === batch.id;
                  return (
                    <div
                      key={batch.id}
                      id={`batch-card-${batch.id}`}
                      onClick={() => setSelectedBatchId(batch.id)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group bg-white space-y-3.5 ${
                        isTargeted
                          ? 'alert-target-highlight alert-pulse-target shadow-xl ring-2 ring-primary-500'
                          : 'border-slate-200/80 hover:border-primary-300 hover:shadow-md'
                      }`}
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            Batch {batch.batchNumber || batch.batchNo}
                          </span>
                          <StatusBadge status={batch.status} />
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono block">
                          Location: {batch.shelfLocation || 'Rack A - Shelf 3'}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-lg font-black font-mono text-slate-900 block">
                          {Number(batch.quantity || 0).toLocaleString('en-IN')} units
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {batch.availableStock !== undefined ? `${batch.availableStock} avail` : 'Available stock'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mfg Date</span>
                        <span className="font-mono font-semibold text-slate-700">{batch.mfgDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Expiry Date</span>
                        <span className={`font-mono font-bold ${batch.isExpired ? 'text-rose-600' : batch.isNearExpiry ? 'text-amber-600' : 'text-slate-800'}`}>
                          {batch.expiryDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">MRP Rate</span>
                        <span className="font-mono font-bold text-slate-900">₹{Number(batch.mrp || 100).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">MedEx Rate</span>
                        <span className="font-mono font-bold text-primary-700">₹{Number(batch.concessionRate || 95).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Intake: {batch.purchaseDate || batch.dateAdded || '2024-09-01'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBatchId(batch.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 font-bold hover:bg-primary-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Lot Details & Bill</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
              <div className="py-12 text-center p-6">
                <Hash className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700">No batches recorded.</h4>
                <p className="text-xs text-slate-400 mt-1">No batches recorded for this medicine in this hospital facility.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LEVEL 4: COMPLETE MEDICINE LOT DETAILS + BILL                      */}
      {/* ------------------------------------------------------------------ */}
      {selectedMedicineKey && selectedHospitalId && selectedBatchId && currentBatchLot && (
        <div className="space-y-6">
          
          {/* Level 4 Header Banner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-800 border border-primary-200">
                    <Hash className="w-3 h-3 text-primary-600" />
                    <span>BATCH LOT LEVEL 4</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• Complete Provenance Dossier</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {currentMedicineGroup?.medicineName || currentHospitalMedicine?.medicineName || currentBatchLot.medicineName || currentBatchLot.medicine} — Batch {currentBatchLot.batchNumber || currentBatchLot.batchNo}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  Holding Facility: <strong className="text-slate-800">{currentBatchLot.hospitalName}</strong> ({currentBatchLot.hospitalId}) • {currentBatchLot.hospitalCity || 'India'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={currentBatchLot.status} />
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Batch Count</span>
                <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{currentBatchLot.quantity} Units</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Available</span>
                <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">{currentBatchLot.availableStock || currentBatchLot.quantity} Units</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</span>
                <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{currentBatchLot.expiryDate}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">MedEx Rate</span>
                <p className="font-mono font-bold text-primary-800 text-sm mt-0.5">₹{Number(currentBatchLot.concessionRate || 95).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Details Grid: Medicine Info, Lot Info, Hospital Info, Purchase Bill */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Columns: Medicine, Lot, and Hospital Information */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Panel 1: MEDICINE INFORMATION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-primary-700 font-bold uppercase tracking-wider text-xs">
                  <Pill className="w-4 h-4" />
                  <span>MEDICINE INFORMATION</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Medicine Name</span>
                    <span className="font-bold text-slate-900">{currentBatchLot.medicineName || currentBatchLot.medicine || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Generic / Composition</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.genericName || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Therapeutic Category</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.category || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dosage Form</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.dosageForm || currentBatchLot.form || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Strength / Power</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.strength || currentBatchLot.dosage || currentBatchLot.power || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Route / Formulation</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.route || currentBatchLot.dosageForm || 'Oral'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Packaging Structure</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.packing || currentBatchLot.packSize || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dispensing Unit</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.unit || 'Tablet'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Manufacturer</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.manufacturer || 'Approved Pharmaceutical Lab'}</span>
                  </div>
                </div>
              </div>

              {/* Panel 2: LOT INFORMATION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-primary-700 font-bold uppercase tracking-wider text-xs">
                    <Boxes className="w-4 h-4" />
                    <span>LOT INFORMATION</span>
                  </div>
                  <StatusBadge status={currentBatchLot.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Batch Number</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                      {currentBatchLot.batchNumber || currentBatchLot.batchNo || 'Not available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Quantity</span>
                    <span className="font-mono font-bold text-slate-900">{currentBatchLot.quantity} units</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Available Stock</span>
                    <span className="font-mono font-bold text-emerald-700">{currentBatchLot.availableStock || currentBatchLot.quantity} units</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Manufacturing Date</span>
                    <span className="font-mono font-medium text-slate-800">{currentBatchLot.mfgDate || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expiry Date</span>
                    <span className={`font-mono font-bold ${currentBatchLot.isExpired ? 'text-rose-600' : 'text-slate-900'}`}>
                      {currentBatchLot.expiryDate || 'Not available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Unit MRP Price</span>
                    <span className="font-mono font-bold text-slate-900">₹{Number(currentBatchLot.mrp || 100).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">MedEx Concession Rate</span>
                    <span className="font-mono font-bold text-primary-700">₹{Number(currentBatchLot.concessionRate || 95).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Acquisition / Unit Cost</span>
                    <span className="font-mono font-bold text-slate-700">₹{Number(currentBatchLot.costRate || currentBatchLot.acquisitionCost || 90).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Storage Condition</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.storageCondition || currentBatchLot.storageType || 'Room Temperature'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Shelf Location</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.shelfLocation || 'Rack A - Shelf 3'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Listed / Intake Date</span>
                    <span className="font-mono text-slate-800">{currentBatchLot.purchaseDate || currentBatchLot.dateAdded || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reorder Buffer</span>
                    <span className="font-mono text-slate-800">{currentBatchLot.minStockLevel || 20} units</span>
                  </div>
                </div>
              </div>

              {/* Panel 3: HOSPITAL INFORMATION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-primary-700 font-bold uppercase tracking-wider text-xs">
                  <Building2 className="w-4 h-4" />
                  <span>HOSPITAL INFORMATION</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Hospital Name</span>
                    <span className="font-bold text-slate-900">{currentBatchLot.hospitalName || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Registration / Facility ID</span>
                    <span className="font-mono font-bold text-primary-700">{currentBatchLot.hospitalId || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location / Jurisdiction</span>
                    <span className="font-medium text-slate-800">{currentBatchLot.location || `${currentBatchLot.hospitalCity || 'Metro'}, ${currentBatchLot.hospitalState || 'India'}`}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: PURCHASE BILL CARD & ADMINISTRATIVE ACTIONS */}
            <div className="space-y-6">
              
              {/* BILL / PURCHASE DOCUMENT (Section 11, 12, 13) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <FileText className="w-4 h-4 text-primary-600" />
                    <span>PURCHASE BILL</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                    DEMO / SAMPLE DOCUMENT
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Batch:</span>
                    <span className="font-mono font-bold text-slate-900">{currentBatchLot.batchNumber || currentBatchLot.batchNo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Document:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[170px]">Purchase Bill / Invoice</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Supplier:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[170px]">
                      {currentBatchLot.supplier || currentBatchLot.manufacturer || 'Authorized Distributor'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Billed Qty:</span>
                    <span className="font-mono font-bold text-slate-900">{currentBatchLot.quantity} Units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Acquisition Rate:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{Number(currentBatchLot.costRate || currentBatchLot.acquisitionCost || 90).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  <span>[ View Bill ]</span>
                </button>
              </div>

              {/* ADMINISTRATIVE ACTIONS (Add Stock, Transfer Stock, Stock History) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Lot Operations
                </span>

                <div className="space-y-2">
                  <button
                    onClick={handleOpenAddStockFromBatch}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Stock to Batch</span>
                  </button>

                  <button
                    onClick={handleOpenTransferModal}
                    disabled={currentBatchLot.isExpired || Number(currentBatchLot.availableStock || 0) <= 0}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      currentBatchLot.isExpired || Number(currentBatchLot.availableStock || 0) <= 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        : 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm active:scale-95'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer Stock Quota</span>
                  </button>

                  <button
                    onClick={handleOpenStockHistory}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors active:scale-95"
                  >
                    <History className="w-3.5 h-3.5 text-slate-600" />
                    <span>View Audit History</span>
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* BILL PREVIEW MODAL (Section: DEMO / SAMPLE PURCHASE BILL) */}
      {/* ======================================================== */}
      {isBillModalOpen && currentBatchLot && (
        <Modal
          isOpen={isBillModalOpen}
          onClose={() => setIsBillModalOpen(false)}
          title="DEMO / SAMPLE PURCHASE BILL"
          subtitle={`Commercial Procurement Invoice • Batch: ${currentBatchLot.batchNumber || currentBatchLot.batchNo}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 pt-1 text-xs text-slate-800">
            
            {/* Prominent Demo & Compliance Disclaimer */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-black tracking-wide uppercase text-[11px] block">
                  DEMO / SAMPLE DOCUMENT — FOR PROVENANCE INSPECTION ONLY
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  This document is simulated for technical provenance demonstration. It contains no real patient data and does not claim legal or regulatory authority.
                </p>
              </div>
            </div>

            {/* Simulated Invoice Document Paper */}
            <div className="p-6 rounded-2xl bg-white border border-slate-300 shadow-sm space-y-4 font-sans relative overflow-hidden">
              
              {/* Subtle diagonal background watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                <span className="text-4xl font-black font-mono rotate-[-25deg] select-none text-slate-900 border-4 border-dashed border-slate-900 px-8 py-3 text-center">
                  SAMPLE DOCUMENT — NOT LEGALLY BINDING
                </span>
              </div>

              {/* Invoice Top Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    {currentBatchLot.supplier || currentBatchLot.manufacturer || 'Micro Labs Direct Distribution Depot'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Plot 22, MIDC Industrial Area, Maharashtra 411018</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    DL No: <strong className="text-slate-700">MH-WHOLESALE-20B-118492 / 21B-118493</strong> • GSTIN: <strong className="text-slate-700">27AABCS9912F1Z4</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-primary-800 text-xs bg-primary-50 px-2 py-0.5 rounded border border-primary-200 block">
                    DEMO-INV-{(currentBatchLot.batchNumber || currentBatchLot.batchNo || '9901').replace(/[^a-zA-Z0-9]/g, '')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">
                    Invoice Date: {currentBatchLot.purchaseDate || currentBatchLot.mfgDate || '2026-06-01'}
                  </span>
                </div>
              </div>

              {/* Billed To / Receiving Hospital */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To / Receiving Facility</span>
                <p className="font-bold text-slate-900 mt-0.5">{currentBatchLot.hospitalName}</p>
                <p className="text-[11px] text-slate-600">
                  Facility ID: <strong className="font-mono text-slate-800">{currentBatchLot.hospitalId}</strong> • Location: {currentBatchLot.location || `${currentBatchLot.hospitalCity || 'Metro'}, ${currentBatchLot.hospitalState || 'India'}`}
                </p>
              </div>

              {/* Billed Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2">Mfg</th>
                      <th className="px-3 py-2">Expiry</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    <tr>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-slate-900 block">{currentBatchLot.medicineName || currentBatchLot.medicine}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{currentBatchLot.genericName}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{currentBatchLot.batchNumber || currentBatchLot.batchNo}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{currentBatchLot.mfgDate || 'N/A'}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-800">{currentBatchLot.expiryDate}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{currentBatchLot.quantity}</td>
                      <td className="px-3 py-2.5 text-right font-mono">₹{Number(currentBatchLot.costRate || currentBatchLot.acquisitionCost || 90).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                        ₹{(Number(currentBatchLot.quantity) * Number(currentBatchLot.costRate || currentBatchLot.acquisitionCost || 90)).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Taxes & Invoice Summary */}
              {(() => {
                const subtotal = Number(currentBatchLot.quantity) * Number(currentBatchLot.costRate || currentBatchLot.acquisitionCost || 90);
                const cgst = subtotal * 0.06;
                const sgst = subtotal * 0.06;
                const total = subtotal + cgst + sgst;
                return (
                  <div className="flex justify-end pt-1">
                    <div className="w-64 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Taxable Value:</span>
                        <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST (6%):</span>
                        <span className="font-mono">₹{cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST (6%):</span>
                        <span className="font-mono">₹{sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900 text-sm">
                        <span>Invoice Total:</span>
                        <span className="font-mono font-black text-primary-800">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Footer Verification & Signatory */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>CDSCO Form 20B/21B Digitally Sealed (Simulated Prototype)</span>
                </span>
                <span className="font-mono text-slate-400">Payment: 30 Days Inter-Hospital Escrow</span>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => toast.success(`Simulating print / download for invoice DEMO-INV-${(currentBatchLot.batchNumber || currentBatchLot.batchNo || '9901').replace(/[^a-zA-Z0-9]/g, '')}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print / Download</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBillModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>

          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OPERATIONAL MODAL 1: ADD STOCK (Override or from Batch)   */}
      {/* ======================================================== */}
      {isAddStockOpen && (
        <Modal
          isOpen={isAddStockOpen}
          onClose={() => setIsAddStockOpen(false)}
          title={addForm.isFromDetails ? `Add Stock: ${addForm.medicineName}` : 'Add Stock (Admin Override)'}
          subtitle={
            addForm.isFromDetails 
              ? `Adding inventory to ${currentBatchLot?.hospitalName || 'Holding Facility'}`
              : 'Admin override for authorized stock addition or system assistance'
          }
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSubmitAddStock} className="space-y-4 pt-1 text-xs">
            
            {/* Target Hospital */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target Hospital <span className="text-rose-500">*</span>
              </label>
              {addForm.isFromDetails ? (
                <div className="p-2.5 bg-slate-100 rounded-xl font-semibold text-slate-800 border border-slate-200">
                  {currentBatchLot?.hospitalName} ({currentBatchLot?.hospitalId})
                </div>
              ) : (
                <select
                  required
                  value={addForm.hospitalId}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, hospitalId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-medium"
                >
                  <option value="">Select Target Hospital</option>
                  {hospitalList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.city || 'Hospital'})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Medicine Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Medicine Name <span className="text-rose-500">*</span>
              </label>
              {addForm.isFromDetails ? (
                <div className="p-2.5 bg-slate-100 rounded-xl font-bold text-slate-900 border border-slate-200">
                  {addForm.medicineName}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    required
                    list="admin-master-meds-list"
                    value={addForm.medicineName}
                    onChange={(e) => handleSelectMasterMedicine(e.target.value)}
                    placeholder="Type or select from Master Catalogue..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
                  />
                  <datalist id="admin-master-meds-list">
                    {masterMedicines.map((m) => (
                      <option key={m.id} value={m.medicineName || m.brandName}>
                        {m.genericName ? `${m.genericName} • ${m.category}` : m.category}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
            </div>

            {/* Batch Number & Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Batch Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.batchNo}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, batchNo: e.target.value.toUpperCase() }))}
                  placeholder="e.g. PCM001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantity (Units) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Manufacturing Date</label>
                <input
                  type="date"
                  value={addForm.mfgDate}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, mfgDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expiry Date <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={addForm.expiryDate}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">MRP (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.mrp}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, mrp: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concession Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.concessionRate}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, concessionRate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-emerald-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cost Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.costRate}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, costRate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddStockOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
              >
                Save Stock
              </button>
            </div>

          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OPERATIONAL MODAL 2: TRANSFER STOCK                      */}
      {/* ======================================================== */}
      {isTransferOpen && currentBatchLot && (
        <Modal
          isOpen={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          title="Transfer Stock Quota"
          subtitle={`Reallocating from ${currentBatchLot.hospitalName}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleProceedTransferConfirmation} className="space-y-4 pt-1 text-xs">
            
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-1 text-blue-900">
              <div className="flex justify-between items-start">
                <span className="font-bold text-sm">{currentBatchLot.medicineName}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-blue-100 font-bold">
                  Batch: {currentBatchLot.batchNumber || currentBatchLot.batchNo}
                </span>
              </div>
              <div className="text-[11px] text-blue-700">
                Source Facility: <strong>{currentBatchLot.hospitalName}</strong>
              </div>
              <div className="text-[11px] text-blue-800 font-semibold font-mono">
                Available to transfer: {currentBatchLot.availableStock || currentBatchLot.quantity} Units
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target Recipient Hospital <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={transferForm.targetHospitalId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, targetHospitalId: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
              >
                <option value="">Select Recipient Hospital</option>
                {hospitalList
                  .filter((h) => h.id !== currentBatchLot.hospitalId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city || 'Hospital'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Units to Transfer <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={currentBatchLot.availableStock || currentBatchLot.quantity}
                required
                value={transferForm.quantity}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transfer Note</label>
              <input
                type="text"
                value={transferForm.note}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <span>Review Transfer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OPERATIONAL MODAL 3: TRANSFER CONFIRMATION               */}
      {/* ======================================================== */}
      {isTransferConfirmOpen && currentBatchLot && (
        <Modal
          isOpen={isTransferConfirmOpen}
          onClose={() => setIsTransferConfirmOpen(false)}
          title="Confirm Stock Transfer?"
          subtitle="Please verify the logistics consignment details before dispatch"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-1 text-xs text-slate-700">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-center pb-2 border-b border-slate-200">
                <span className="text-lg font-black text-slate-900 font-mono block">
                  {transferForm.quantity} Units
                </span>
                <span className="font-bold text-slate-800 text-sm">{currentBatchLot.medicineName}</span>
                <span className="text-[11px] font-mono text-slate-500 block">Batch: {currentBatchLot.batchNumber || currentBatchLot.batchNo}</span>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">From:</span>
                  <span className="font-bold text-slate-900">{currentBatchLot.hospitalName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">To:</span>
                  <span className="font-bold text-primary-700">{targetHospitalObj?.name || 'Selected Recipient'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Source Remaining:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {Number(currentBatchLot.availableStock || currentBatchLot.quantity) - Number(transferForm.quantity)} Units
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTransferConfirmOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Transfer</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OPERATIONAL MODAL 4: STOCK HISTORY                       */}
      {/* ======================================================== */}
      {isHistoryOpen && currentBatchLot && (
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title={`Stock History: ${currentBatchLot.medicineName}`}
          subtitle={`Batch ${currentBatchLot.batchNumber || currentBatchLot.batchNo} • ${currentBatchLot.hospitalName} (Audit Ledger)`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 pt-1 text-xs">
            {isHistoryLoading ? (
              <div className="py-12">
                <LoadingSpinner text="Retrieving verified stock history ledger..." />
              </div>
            ) : historyLogs.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {historyLogs.map((log) => {
                  const isPositive = Number(log.quantityDelta || 0) >= 0;
                  const deltaStr = isPositive ? `+${log.quantityDelta}` : `${log.quantityDelta}`;
                  const formattedDate = log.date || (log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '10 Sep 2026');

                  return (
                    <div key={log.id} className="py-3 px-2 flex items-start justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {deltaStr} units
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-slate-800">{log.action || log.actionType || 'Stock Movement'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 font-medium">{log.performedBy || 'Admin'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 font-mono text-[11px]">{formattedDate}</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-snug pl-1">
                          {log.reason || 'Authorized centralized stock movement recorded'}
                        </p>
                      </div>

                      {log.resultingStock !== undefined && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Balance</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {log.resultingStock} units
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-bold text-slate-700">No previous adjustments logged for this batch</p>
                <p className="text-xs text-slate-400 mt-1">Stock stands at its initial registered intake balance.</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>View-only statutory audit trail. Historic records cannot be modified or purged.</span>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close History
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default AdminInventory;

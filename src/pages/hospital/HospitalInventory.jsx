import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { 
  PlusCircle, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  Boxes, 
  Filter, 
  Thermometer, 
  Calendar,
  CheckCircle2,
  Download,
  Clock,
  Pill,
  ShieldCheck,
  X,
  ArrowRight,
  Eye,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Package,
  Layers,
  Upload,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { 
  fetchInventory, 
  addMedicineItem, 
  updateMedicineItem, 
  deleteMedicineItem 
} from '../../store/slices/hospitalSlice';
import MedicineModal from '../../components/forms/MedicineModal';
import CSVImportModal from '../../components/hospital/CSVImportModal';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { isHospitalSuspended, getLiveHospitalRecord, isHospitalOperational, getStoredItem, KEYS } from '../../services/storage';
import { calculateMedicineExpiry } from '../../utils/expiryUtils';

export const HospitalInventory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { inventory = [], isLoading } = useSelector((state) => state.hospital);

  const liveHospital = useMemo(() => {
    return getLiveHospitalRecord(user?.id) || user;
  }, [user]);

  const currentStatus = (liveHospital?.status || user?.status || 'verified').toLowerCase();
  const isOperationalLocked = currentStatus !== 'verified';
  const isSuspended = currentStatus === 'suspended';

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedFormFilter, setSelectedFormFilter] = useState('all');
  const [sortBy, setSortBy] = useState('expiry_asc');

  // Modal / Drawer states
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [selectedMedicineForDetails, setSelectedMedicineForDetails] = useState(null);
  const [deleteConfirmMed, setDeleteConfirmMed] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchInventory(user.id));
    }
  }, [dispatch, user?.id]);

  // Alert Deep-Link & Focus Highlighting States
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [highlightedId, setHighlightedId] = useState(null);
  const [highlightFeedback, setHighlightFeedback] = useState(null);
  const processedTargetRef = useRef(null);

  useEffect(() => {
    if (selectedMedicineForDetails) {
      const fresh = inventory.find((m) => m.id === selectedMedicineForDetails.id);
      if (fresh) {
        setSelectedMedicineForDetails((prev) => ({ ...prev, ...fresh }));
      }
    }
  }, [inventory]);

  // Alert Deep-Linking Effect
  useEffect(() => {
    if (isLoading || !inventory || inventory.length === 0) return;

    const targetInvId = searchParams.get('inventoryLotId') || searchParams.get('inventoryId') || searchParams.get('lotId') || location.state?.alertTarget?.inventoryLotId || location.state?.alertTarget?.inventoryId;
    const targetMedId = searchParams.get('medicineId') || searchParams.get('medId') || location.state?.alertTarget?.medicineId || location.state?.alertTarget?.medId;
    const targetBatchNo = searchParams.get('batchNo') || searchParams.get('batchId') || location.state?.alertTarget?.batchNo || location.state?.alertTarget?.batchId;
    const targetMedName = searchParams.get('medicineName') || location.state?.alertTarget?.medicineName;

    if (!targetInvId && !targetMedId && !targetBatchNo && !targetMedName) return;

    const targetSig = `${targetInvId || ''}__${targetMedId || ''}__${targetBatchNo || ''}__${targetMedName || ''}`;
    if (processedTargetRef.current === targetSig) return;
    processedTargetRef.current = targetSig;

    const cleanParams = () => {
      try {
        const next = new URLSearchParams(searchParams);
        next.delete('inventoryLotId');
        next.delete('inventoryId');
        next.delete('lotId');
        next.delete('medicineId');
        next.delete('medId');
        next.delete('batchNo');
        next.delete('batchId');
        next.delete('medicineName');
        setSearchParams(next, { replace: true });
        if (location.state?.alertTarget) {
          navigate(location.pathname + (next.toString() ? `?${next.toString()}` : ''), {
            replace: true,
            state: {},
          });
        }
      } catch (e) {
        console.warn('Failed to clean target search params', e);
      }
    };

    // Priority matching
    let matched = null;
    if (targetInvId) {
      matched = inventory.find((m) => m.id === targetInvId || m.inventoryId === targetInvId);
    }
    if (!matched && targetMedId) {
      matched = inventory.find((m) => m.id === targetMedId || m.medicineId === targetMedId);
    }
    if (!matched && targetBatchNo) {
      matched = inventory.find((m) => m.batchNo === targetBatchNo || m.batchNumber === targetBatchNo || m.id === targetBatchNo);
    }
    if (!matched && targetMedName && targetBatchNo) {
      const norm = targetMedName.trim().toLowerCase();
      matched = inventory.find((m) => 
        ((m.brandName || m.medicineName || '').toLowerCase() === norm ||
         (m.genericName || '').toLowerCase() === norm) &&
        (m.batchNo === targetBatchNo || m.batchNumber === targetBatchNo)
      );
    }
    if (!matched && targetMedName) {
      const norm = targetMedName.trim().toLowerCase();
      matched = inventory.find((m) => 
        (m.brandName || m.medicineName || '').toLowerCase() === norm ||
        (m.genericName || '').toLowerCase() === norm
      );
    }

    if (matched) {
      // Clear filters so item is guaranteed visible
      setSearchTerm('');
      setSelectedStatusFilter('all');
      setSelectedFormFilter('all');

      setHighlightedId(matched.id);
      const feedbackMsg = `Focused on ${matched.brandName || matched.medicineName} — Batch ${matched.batchNo || matched.batchNumber || targetBatchNo || 'N/A'}`;
      setHighlightFeedback(feedbackMsg);
      toast.success(feedbackMsg, { icon: '🎯', id: 'hosp-inspect-toast' });

      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const targetEl = document.getElementById(`hosp-med-row-${matched.id}`) || document.getElementById(`hosp-med-card-${matched.id}`);
        if (targetEl) {
          clearInterval(scrollTimer);
          targetEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        } else if (attempts > 30) {
          clearInterval(scrollTimer);
        }
      }, 75);

      const fadeTimer = setTimeout(() => {
        setHighlightedId(null);
      }, 4200);

      cleanParams();
      return () => {
        clearInterval(scrollTimer);
        clearTimeout(fadeTimer);
      };
    }

    toast.error('Original item is no longer available in inventory.', {
      icon: '⚠️',
      duration: 4000,
      id: 'hosp-missing-toast',
    });
    cleanParams();
  }, [inventory, isLoading, searchParams, location.state]);

  // Helper for medicine form classification
  const getMedicineForm = (med) => {
    if (med.form) return med.form;
    const p = (med.power || '').toLowerCase();
    const b = (med.brandName || '').toLowerCase();
    if (p.includes('tablet') || p.includes('tab') || b.includes('tablet')) return 'Tablet';
    if (p.includes('capsule') || p.includes('cap')) return 'Capsule';
    if (p.includes('syrup') || p.includes('suspension')) return 'Syrup / Suspension';
    if (p.includes('vial') || b.includes('vial') || b.includes('injection') || p.includes('inj')) return 'Injection / Vial';
    if (p.includes('infusion') || p.includes('bottle')) return 'Infusion Bottle';
    if (p.includes('syringe') || p.includes('pen')) return 'Pre-filled Syringe / Pen';
    if (p.includes('ampoule')) return 'Ampoule';
    return 'General Formulation';
  };

  // Summary Metrics across all hospital inventory
  const metrics = useMemo(() => {
    const totalBatches = inventory.length;
    const totalUnits = inventory.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

    let availableUnits = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let lowStockCount = 0;
    let disposedCount = 0;
    let activeAvailableCount = 0;

    inventory.forEach((med) => {
      const isDisposed = med.status === 'disposed';
      const minStock = Number(med.minStockLevel || 20);
      const qty = Number(med.quantity) || 0;
      const exp = calculateMedicineExpiry(med.expiryDate, qty);

      if (isDisposed) {
        disposedCount++;
      } else if (exp.isExpired) {
        expiredCount++;
      } else {
        availableUnits += qty;
        if (exp.isNearExpiry || exp.isCritical) {
          expiringSoonCount++;
        }
        if (qty <= minStock) {
          lowStockCount++;
        }
        if (!exp.isNearExpiry && !exp.isCritical && qty > minStock) {
          activeAvailableCount++;
        }
      }
    });

    return {
      totalBatches,
      totalUnits,
      availableUnits,
      expiringSoonCount,
      expiredCount,
      lowStockCount,
      disposedCount,
      activeAvailableCount,
    };
  }, [inventory]);

  // Evaluated inventory with statuses
  const evaluatedInventory = useMemo(() => {
    return inventory.map((med) => {
      const isDisposed = med.status === 'disposed';
      const isDisposalRequested = med.status === 'pending_disposal' || med.status === 'disposal_requested';
      const minStock = Number(med.minStockLevel || 20);
      const qty = Number(med.quantity) || 0;
      const expiryMeta = calculateMedicineExpiry(med.expiryDate, qty);
      const form = getMedicineForm(med);

      let computedStatus = 'Available';
      if (isDisposed) {
        computedStatus = 'Disposed';
      } else if (isDisposalRequested) {
        computedStatus = 'Disposal Requested';
      } else if (expiryMeta.isExpired) {
        computedStatus = 'Expired';
      } else if (expiryMeta.isNearExpiry || expiryMeta.isCritical) {
        computedStatus = 'Expiring Soon';
      } else if (qty <= minStock) {
        computedStatus = 'Low Stock';
      }

      return {
        ...med,
        form,
        minStock,
        expiryMeta,
        computedStatus,
      };
    });
  }, [inventory]);

  // Filtered & Sorted Inventory List
  const filteredMedicines = useMemo(() => {
    return evaluatedInventory
      .filter((med) => {
        const q = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !q ||
          med.brandName?.toLowerCase().includes(q) ||
          med.genericName?.toLowerCase().includes(q) ||
          med.power?.toLowerCase().includes(q) ||
          med.batchNo?.toLowerCase().includes(q) ||
          med.manufacturer?.toLowerCase().includes(q);

        let matchesStatus = true;
        if (selectedStatusFilter !== 'all') {
          if (selectedStatusFilter === 'available') {
            matchesStatus = med.computedStatus === 'Available';
          } else if (selectedStatusFilter === 'low_stock') {
            matchesStatus = med.computedStatus === 'Low Stock';
          } else if (selectedStatusFilter === 'expiring_soon') {
            matchesStatus = med.computedStatus === 'Expiring Soon';
          } else if (selectedStatusFilter === 'expired') {
            matchesStatus = med.computedStatus === 'Expired';
          } else if (selectedStatusFilter === 'disposal_requested') {
            matchesStatus = med.computedStatus === 'Disposal Requested';
          } else if (selectedStatusFilter === 'disposed') {
            matchesStatus = med.computedStatus === 'Disposed';
          }
        }

        let matchesForm = true;
        if (selectedFormFilter !== 'all') {
          matchesForm = med.form.toLowerCase().includes(selectedFormFilter.toLowerCase());
        }

        return matchesSearch && matchesStatus && matchesForm;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry_asc') {
          return new Date(a.expiryDate || '2099-01-01') - new Date(b.expiryDate || '2099-01-01');
        } else if (sortBy === 'expiry_desc') {
          return new Date(b.expiryDate || '2099-01-01') - new Date(a.expiryDate || '2099-01-01');
        } else if (sortBy === 'stock_high') {
          return b.quantity - a.quantity;
        } else if (sortBy === 'stock_low') {
          return a.quantity - b.quantity;
        } else if (sortBy === 'name') {
          return (a.brandName || '').localeCompare(b.brandName || '');
        } else if (sortBy === 'price_asc') {
          return (a.unitOriginalPrice || 0) - (b.unitOriginalPrice || 0);
        } else if (sortBy === 'price_desc') {
          return (b.unitOriginalPrice || 0) - (a.unitOriginalPrice || 0);
        }
        return 0;
      });
  }, [evaluatedInventory, searchTerm, selectedStatusFilter, selectedFormFilter, sortBy]);

  const medicineStockHistory = useMemo(() => {
    if (!selectedMedicineForDetails) return [];
    const history = getStoredItem(KEYS.STOCK_HISTORY, []);
    const medId = selectedMedicineForDetails.id;
    const batchNo = (selectedMedicineForDetails.batchNo || '').toLowerCase();
    const medName = (selectedMedicineForDetails.brandName || selectedMedicineForDetails.medicineName || '').toLowerCase();

    return history.filter((h) => 
      (batchNo && (h.batchNo || '').toLowerCase() === batchNo) ||
      h.medicineId === medId ||
      (h.medicineName && h.medicineName.toLowerCase() === medName && (!batchNo || (h.batchNo || '').toLowerCase() === batchNo))
    );
  }, [selectedMedicineForDetails]);

  const handleOpenAdd = () => {
    if (isOperationalLocked) {
      if (currentStatus === 'pending' || currentStatus === 'under_review') {
        toast.error('Hospital registration is under review. Inventory additions will be enabled once verified.');
      } else if (currentStatus === 'suspended') {
        toast.error('Your hospital account is currently suspended. Operational activities are locked.');
      } else {
        toast.error('Your hospital registration was rejected. Operational activities are locked.');
      }
      return;
    }
    setEditingMedicine(null);
    setAddEditModalOpen(true);
  };

  const handleOpenEdit = (med) => {
    if (isOperationalLocked) {
      toast.error('Operational activities are restricted for unverified or suspended facilities.');
      return;
    }
    if (med.status === 'disposed') {
      toast.error('Disposed batches are permanently archived under bio-medical waste regulations and cannot be edited.');
      return;
    }
    setEditingMedicine(med);
    setAddEditModalOpen(true);
  };

  const handleSaveMedicine = async (formData) => {
    if (isOperationalLocked) {
      toast.error('Operational activities are restricted for unverified or suspended facilities.');
      return;
    }
    try {
      if (editingMedicine) {
        if (editingMedicine.status === 'disposed') {
          toast.error('Disposed medicine batches cannot be reactivated or edited.');
          return;
        }
        await dispatch(updateMedicineItem({ id: editingMedicine.id, data: formData })).unwrap();
        toast.success(`Updated ${formData.brandName} record in hospital inventory`);
      } else {
        const payload = {
          ...formData,
          hospitalId: user?.id,
          hospitalName: user?.name || 'Apollo Hospital Central Pharmacy',
        };
        await dispatch(addMedicineItem(payload)).unwrap();
        toast.success(`Added ${formData.brandName} to hospital inventory`);
      }
      setAddEditModalOpen(false);
      setEditingMedicine(null);
    } catch (err) {
      toast.error('Failed to save medicine record: ' + (err?.message || err));
    }
  };

  const handleDelete = async () => {
    if (isOperationalLocked) {
      toast.error('Operational activities are restricted for unverified or suspended facilities.');
      return;
    }
    if (!deleteConfirmMed) return;
    try {
      await dispatch(deleteMedicineItem(deleteConfirmMed.id));
      toast.success(`Removed ${deleteConfirmMed.brandName} from hospital inventory`);
      setDeleteConfirmMed(null);
      if (selectedMedicineForDetails?.id === deleteConfirmMed.id) {
        setSelectedMedicineForDetails(null);
      }
    } catch (err) {
      toast.error('Failed to delete medicine: ' + err.message);
    }
  };

  const handleExportCsv = () => {
    if (filteredMedicines.length === 0) {
      toast.error('No medicines available to export');
      return;
    }
    const headers = [
      'Medicine / Brand Name',
      'Generic Name',
      'Dosage / Strength',
      'Dosage Form',
      'Batch Number',
      'Manufacturing Date',
      'Expiry Date',
      'Quantity (Units)',
      'Min Stock Buffer',
      'Unit MRP (INR)',
      'Storage Condition',
      'Status'
    ];
    const rows = filteredMedicines.map((m) => [
      `"${m.brandName}"`,
      `"${m.genericName || ''}"`,
      `"${m.power}"`,
      `"${m.form}"`,
      `"${m.batchNo || 'N/A'}"`,
      `"${m.mfgDate || ''}"`,
      `"${m.expiryDate}"`,
      m.quantity,
      m.minStock,
      m.unitOriginalPrice,
      `"${m.storageType || ''}"`,
      `"${m.computedStatus}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hospital_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredMedicines.length} medicine records to CSV`);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatusFilter('all');
    setSelectedFormFilter('all');
    setSortBy('expiry_asc');
  };

  return (
    <div className="space-y-7 pb-10">

      {/* Compliance Status Operational Notice (Section 11 Requirement) */}
      {isOperationalLocked && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
          currentStatus === 'pending' || currentStatus === 'under_review'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
            : currentStatus === 'suspended'
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-950'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-950'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-current mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                Operational Stock Management Restricted • Status: <span className="capitalize">{currentStatus.replace('_', ' ')}</span>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                {currentStatus === 'pending' || currentStatus === 'under_review' ? (
                  <span>Your hospital registration is currently under review. Stock operations (adding, updating, or importing medicines) will be unlocked once MEDEX Administration validates your regulatory documents.</span>
                ) : currentStatus === 'suspended' ? (
                  <span>Your hospital account is suspended ({liveHospital?.suspensionReason || 'Administrative hold'}). Operational stock modifications are disabled.</span>
                ) : (
                  <span>Your hospital registration was rejected ({liveHospital?.rejectionReason || 'Documentation declined'}). Operational stock modifications are disabled.</span>
                )}
              </p>
            </div>
          </div>
          <Link
            to="/hospital/profile"
            className="px-3.5 py-1.5 rounded-xl font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap self-start sm:self-center"
          >
            Review Profile
          </Link>
        </div>
      )}
      
      {/* 1. Page Header (WHERE AM I? + WHAT CAN I DO NEXT?) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Inventory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-800 text-[11px] font-mono font-bold">
              {metrics.totalBatches} Batches Stored
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Add and manage all medicines stored in your hospital.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isOperationalLocked) {
                toast.error('Operational activities are locked for unverified or suspended facilities.');
                return;
              }
              setImportModalOpen(true);
            }}
            disabled={isOperationalLocked}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-primary-200 bg-primary-50/70 hover:bg-primary-100 text-primary-800 text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={isOperationalLocked ? "Importing locked for unverified facility" : "Import existing hospital inventory from a CSV file"}
          >
            <Upload className="w-4 h-4 text-primary-600" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
            title="Download complete inventory report"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            disabled={isOperationalLocked}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            title={isOperationalLocked ? "Add Medicine locked for unverified facility" : "Register a new medicine batch"}
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Alert Target Inspection Notification Banner */}
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

      {/* 2. Inventory KPI Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Total Inventory */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Inventory
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalUnits.toLocaleString()} <span className="text-xs font-normal text-slate-500">units</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Across {metrics.totalBatches} total batches
          </p>
        </div>

        {/* Card 2: Usable Available Stock */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/20 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Available Stock
          </span>
          <div className="text-2xl font-black text-emerald-800 font-mono">
            {metrics.availableUnits.toLocaleString()} <span className="text-xs font-normal text-emerald-600">units</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">
            Active & valid shelf life
          </p>
        </div>

        {/* Card 3: Expiring Soon */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/90 bg-amber-50/25 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
            Expiring Soon
          </span>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {metrics.expiringSoonCount} <span className="text-xs font-normal text-amber-600">batches</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium">
            Under 90 days shelf life
          </p>
        </div>

        {/* Card 4: Expired Stock */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/90 bg-rose-50/25 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
              Expired Stock
            </span>
            {metrics.expiredCount > 0 && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full font-mono">
                Quarantined
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {metrics.expiredCount} <span className="text-xs font-normal text-rose-500">batches</span>
          </div>
          <p className="text-[11px] text-rose-600 font-medium">
            Quarantined from exchange
          </p>
        </div>

        {/* Card 5: Low Stock */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">
            Low Stock
          </span>
          <div className="text-2xl font-black text-blue-700 font-mono">
            {metrics.lowStockCount} <span className="text-xs font-normal text-blue-500">batches</span>
          </div>
          <p className="text-[11px] text-blue-600 font-medium">
            Below safety buffer level
          </p>
        </div>

      </div>

      {/* 3. Filter, Search & Sort Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search medicine name, generic composition, strength, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium text-slate-800"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="available">✓ Available</option>
              <option value="low_stock">! Low Stock</option>
              <option value="expiring_soon">⚠ Expiring Soon</option>
              <option value="expired">✕ Expired</option>
              <option value="disposal_requested">⌛ Disposal Requested</option>
              <option value="disposed">🗑 Disposed</option>
            </select>
          </div>

          {/* Form Filter */}
          <div className="w-full md:w-40">
            <select
              value={selectedFormFilter}
              onChange={(e) => setSelectedFormFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">All Forms</option>
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
              <option value="syrup">Syrup</option>
              <option value="injection">Injection / Vial</option>
              <option value="infusion">Infusion Bottle</option>
              <option value="syringe">Pre-filled Syringe</option>
              <option value="ampoule">Ampoule</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="w-full md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-none"
            >
              <option value="expiry_asc">Expiry (Soonest First)</option>
              <option value="expiry_desc">Expiry (Latest First)</option>
              <option value="stock_high">Stock Quantity (High to Low)</option>
              <option value="stock_low">Stock Quantity (Low to High)</option>
              <option value="name">Medicine Name (A-Z)</option>
              <option value="price_asc">Price (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchTerm || selectedStatusFilter !== 'all' || selectedFormFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1 flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

        </div>

        {/* Result summary indicator */}
        <div className="text-xs text-slate-500 font-medium px-1 flex items-center justify-between">
          <span>Showing {filteredMedicines.length} of {inventory.length} hospital medicines</span>
          {metrics.expiredCount > 0 && (
            <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{metrics.expiredCount} expired items quarantined from marketplace</span>
            </span>
          )}
        </div>
      </div>

      {/* 4. MAIN INVENTORY TABLE (Desktop) & CARDS (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading && inventory.length === 0 ? (
          <div className="p-12 text-center">
            <LoadingSpinner text="Loading hospital inventory ledger..." />
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              No medicines match your current filter criteria.
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add new medicines to your hospital inventory or reset the active search filters.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Reset Filters
              </button>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Medicine</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3.5 text-left">Medicine / Brand</th>
                    <th className="px-3 py-3.5 text-left">Form / Strength</th>
                    <th className="px-3 py-3.5 text-left">Batch Number</th>
                    <th className="px-3 py-3.5 text-center">Stock Quantity</th>
                    <th className="px-3 py-3.5 text-left">Expiry Date</th>
                    <th className="px-3 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Unit MRP</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredMedicines.map((med) => {
                    const isDisposed = med.status === 'disposed';
                    const isExpired = med.expiryMeta.isExpired && !isDisposed;
                    const isLow = med.quantity <= med.minStock && !isExpired && !isDisposed;

                    return (
                      <tr 
                        key={med.id} 
                        id={`hosp-med-row-${med.id}`}
                        className={`transition-colors cursor-pointer ${
                          highlightedId === med.id
                            ? 'alert-target-highlight alert-pulse-target shadow-lg ring-2 ring-primary-500'
                            : 'hover:bg-slate-50/90'
                        } ${
                          isDisposed ? 'opacity-60 bg-slate-50/50' : ''
                        }`}
                        onClick={() => setSelectedMedicineForDetails(med)}
                      >
                        {/* Medicine / Brand */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold flex-shrink-0">
                              <Pill className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 leading-tight">
                                {med.brandName}
                              </div>
                              <div className="text-[11px] text-slate-500 line-clamp-1">
                                {med.genericName || med.category}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Form / Strength */}
                        <td className="px-3 py-3.5">
                          <span className="font-semibold text-slate-900 block">{med.form}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{med.power}</span>
                        </td>

                        {/* Batch Number */}
                        <td className="px-3 py-3.5 font-mono font-bold text-slate-700">
                          {med.batchNo || 'N/A'}
                        </td>

                        {/* Stock Quantity */}
                        <td className="px-3 py-3.5 text-center">
                          <div className="font-mono font-extrabold text-slate-900 text-sm">
                            {med.quantity}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Min: {med.minStock} units
                          </div>
                        </td>

                        {/* Expiry Date */}
                        <td className="px-3 py-3.5">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {med.expiryDate}
                          </div>
                          <span className={`text-[10px] font-bold ${
                            isExpired ? 'text-rose-600' : 'text-slate-500'
                          }`}>
                            {med.expiryMeta.badge}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-3 py-3.5 text-center">
                          <StatusBadge status={med.computedStatus} />
                        </td>

                        {/* Unit MRP */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          <div className="font-bold text-slate-900 text-sm">
                            ₹{med.unitOriginalPrice}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            per unit
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedMedicineForDetails(med)}
                              className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-primary-700 hover:bg-primary-50 transition-colors text-xs font-bold"
                              title="View full record"
                            >
                              View
                            </button>
                            {!isDisposed && (
                              <button
                                onClick={() => handleOpenEdit(med)}
                                disabled={isOperationalLocked}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isOperationalLocked ? "Editing locked for unverified facility" : "Edit medicine parameters"}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteConfirmMed(med)}
                              disabled={isOperationalLocked}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isOperationalLocked ? "Deletion locked for unverified facility" : "Delete from inventory"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block lg:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredMedicines.map((med) => {
                const isDisposed = med.status === 'disposed';

                return (
                  <div
                    key={med.id}
                    id={`hosp-med-card-${med.id}`}
                    onClick={() => setSelectedMedicineForDetails(med)}
                    className={`p-4 rounded-2xl bg-white border space-y-3 cursor-pointer transition-all ${
                      highlightedId === med.id
                        ? 'alert-target-highlight alert-pulse-target shadow-lg ring-2 ring-primary-500'
                        : 'border-slate-200 hover:border-slate-300'
                    } ${
                      isDisposed ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{med.brandName}</h4>
                        <p className="text-xs text-slate-500 font-medium">{med.form} • {med.power}</p>
                      </div>
                      <StatusBadge status={med.computedStatus} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">BATCH & STOCK</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{med.batchNo}</span>
                        <span className="text-xs text-slate-600 font-bold block">{med.quantity} units</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">UNIT PRICE</span>
                        <span className="text-sm font-bold text-primary-700 font-mono">₹{med.unitOriginalPrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-medium">
                        Expires: <strong className="text-slate-800 font-mono">{med.expiryDate}</strong>
                      </span>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMedicineForDetails(med);
                        }}
                        className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. MEDICINE DETAIL DRAWER */}
      {selectedMedicineForDetails && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedMedicineForDetails(null)} />
          
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-slideLeft">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50 sticky top-0 z-10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 font-mono">
                  Inventory Details
                </span>
                <h2 className="text-xl font-black text-slate-900 leading-tight">
                  {selectedMedicineForDetails.brandName || selectedMedicineForDetails.medicineName} {selectedMedicineForDetails.power || selectedMedicineForDetails.strength || ''}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Holding Facility: {selectedMedicineForDetails.hospitalName || user?.name} • Batch {selectedMedicineForDetails.batchNo || selectedMedicineForDetails.batchNumber}
                </p>
              </div>

              <button
                onClick={() => setSelectedMedicineForDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Organized Sections */}
            <div className="p-6 space-y-6 flex-1 text-xs">
              
              {/* STATUS BANNER */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Inventory Status</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedMedicineForDetails.computedStatus} />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Shelf Life Status</span>
                  <span className="text-sm font-black font-mono text-slate-800">
                    {selectedMedicineForDetails.expiryMeta?.daysRemaining > 0 
                      ? `${selectedMedicineForDetails.expiryMeta?.daysRemaining} days left`
                      : `Expired ${Math.abs(selectedMedicineForDetails.expiryMeta?.daysRemaining || 0)}d ago`}
                  </span>
                </div>
              </div>

              {/* 1. MEDICINE INFORMATION */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  1. Medicine Information
                </h3>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Brand / Trade Name</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.brandName || selectedMedicineForDetails.medicineName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Generic / Composition Name</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.genericName || 'Standard Formulation'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Medicine Code</span>
                    <strong className="font-mono text-cyan-800">{selectedMedicineForDetails.medicineCode || selectedMedicineForDetails.masterMedicineId || selectedMedicineForDetails.medicineId || 'MED-CAT'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Therapeutic Category</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.category || 'Pharmaceuticals'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Dosage Form</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.form || selectedMedicineForDetails.dosageForm || 'Tablet'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Dosage / Strength</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.dosage || selectedMedicineForDetails.power || selectedMedicineForDetails.strength || 'Standard formulation'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 block font-medium">Manufacturer / Pharma</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.manufacturer || 'Approved Pharmaceutical Lab'}</strong>
                  </div>
                </div>
              </div>

              {/* 2. HOSPITAL INFORMATION */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  2. Hospital Information
                </h3>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Hospital Name</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.hospitalName || user?.name || 'Apollo Hospital'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Hospital ID</span>
                    <strong className="font-mono text-primary-700">{selectedMedicineForDetails.hospitalId || user?.id || 'hosp-1'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 block font-medium">Location</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.location || `${user?.city || 'Mumbai'}, ${user?.state || 'Maharashtra'}`}</strong>
                  </div>
                </div>
              </div>

              {/* 3. BATCH & STOCK */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  3. Batch & Stock
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Batch Number</span>
                    <strong className="font-mono text-slate-800">{selectedMedicineForDetails.batchNo || selectedMedicineForDetails.batchNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">MFG Date</span>
                    <strong className="font-mono text-slate-700">{selectedMedicineForDetails.mfgDate || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">EXP Date</span>
                    <strong className="font-mono text-slate-900">{selectedMedicineForDetails.expiryDate}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Expiry Status</span>
                    <strong className={`text-[11px] uppercase font-bold ${
                      selectedMedicineForDetails.expiryMeta?.isExpired 
                        ? 'text-rose-600' 
                        : selectedMedicineForDetails.expiryMeta?.isNearExpiry 
                          ? 'text-amber-600' 
                          : 'text-emerald-600'
                    }`}>
                      {selectedMedicineForDetails.expiryMeta?.isExpired 
                        ? 'Expired' 
                        : selectedMedicineForDetails.expiryMeta?.isNearExpiry 
                          ? 'Expiring Soon' 
                          : 'Valid — Active Stock'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Pack Size</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.packSize || selectedMedicineForDetails.packing || '15 Tablets / Strip'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Unit Type</span>
                    <strong className="text-slate-800">{selectedMedicineForDetails.unit || 'Tablet'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Number of Packs</span>
                    <strong className="font-mono text-slate-900">{selectedMedicineForDetails.numberOfPacks || Math.ceil(Number(selectedMedicineForDetails.quantity || 0) / (selectedMedicineForDetails.unitsPerPack || 15))} Packs</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Total Units</span>
                    <strong className="font-mono text-slate-900">{selectedMedicineForDetails.totalUnits || selectedMedicineForDetails.quantity || 0} Units</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Current Quantity</span>
                    <strong className="font-mono text-base text-slate-900">{selectedMedicineForDetails.totalQuantity || selectedMedicineForDetails.quantity || 0} Units</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 block font-medium">Reserved Quantity</span>
                    <strong className="font-mono text-base text-amber-700">{selectedMedicineForDetails.reservedQuantity || 0} Units</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block font-medium">Available Quantity</span>
                    <strong className="font-mono text-base text-emerald-700">{selectedMedicineForDetails.availableQuantity ?? Math.max(0, (selectedMedicineForDetails.quantity || 0) - (selectedMedicineForDetails.reservedQuantity || 0))} Units</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Minimum Stock Level</span>
                    <strong className="font-mono text-base text-slate-800">{selectedMedicineForDetails.reorderLevel || selectedMedicineForDetails.minStock || selectedMedicineForDetails.minStockLevel || 20} Units</strong>
                  </div>
                </div>
              </div>

              {/* 4. PRICING */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  4. Pricing Structure
                </h3>
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white border border-slate-200 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Unit MRP</span>
                    <div className="text-sm font-black text-slate-800 font-mono">
                      ₹{Number(selectedMedicineForDetails.mrp || selectedMedicineForDetails.unitOriginalPrice || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-primary-600 block font-semibold">Concession Rate</span>
                    <div className="text-sm font-black text-primary-700 font-mono">
                      ₹{Number(selectedMedicineForDetails.concessionRate || selectedMedicineForDetails.unitFinalPrice || Math.round((selectedMedicineForDetails.unitOriginalPrice || 0) * (1 - (selectedMedicineForDetails.concessionPercent || 15) / 100))).toFixed(2)}
                    </div>
                    <span className="text-[9px] text-primary-500">MedEx Rate</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Acquisition / Cost Rate</span>
                    <div className="text-sm font-black text-slate-600 font-mono">
                      ₹{Number(selectedMedicineForDetails.costRate || selectedMedicineForDetails.acquisitionCost || Math.round((selectedMedicineForDetails.unitOriginalPrice || 0) * 0.85)).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Total Lot Value (MRP)</span>
                    <strong className="text-slate-900 font-mono text-sm block">
                      ₹{(Number(selectedMedicineForDetails.mrp || selectedMedicineForDetails.unitOriginalPrice || 0) * Number(selectedMedicineForDetails.quantity || 0)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-600 block font-medium">Total Lot Value (Concession)</span>
                    <strong className="text-emerald-700 font-mono text-sm block">
                      ₹{(Number(selectedMedicineForDetails.concessionRate || selectedMedicineForDetails.unitFinalPrice || 0) * Number(selectedMedicineForDetails.quantity || 0)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 5. STORAGE */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  5. Storage
                </h3>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Storage Condition</span>
                    <strong className="text-slate-800 flex items-center gap-1 mt-0.5">
                      <Thermometer className="w-3.5 h-3.5 text-cyan-600" />
                      {selectedMedicineForDetails.storageCondition || selectedMedicineForDetails.storageType || 'Room Temperature (15°C - 25°C)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Shelf / Storage Location</span>
                    <strong className="text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 block truncate mt-0.5">
                      {selectedMedicineForDetails.shelfLocation || 'Rack A - Shelf 3'}
                    </strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Hospital Staff Maintained</span>
                  </div>
                </div>
              </div>

              {/* 6. STOCK HISTORY */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
                  <span>6. Stock Movement History</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {medicineStockHistory.length > 0 ? `${medicineStockHistory.length} events` : 'Intake record'}
                  </span>
                </h3>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {medicineStockHistory.length > 0 ? (
                    medicineStockHistory.map((log) => {
                      const isPositive = Number(log.quantityDelta || 0) >= 0;
                      return (
                        <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${isPositive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                                {isPositive ? `+${log.quantityDelta}` : log.quantityDelta}
                              </span>
                              <span>{log.action || log.movementType || 'Stock Movement'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {log.date || log.timestamp?.split('T')[0]} • {log.reason || log.source || 'Authorized Transaction'}
                            </div>
                          </div>
                          {log.resultingStock !== undefined && (
                            <div className="text-right font-mono text-[11px] text-slate-600 shrink-0 ml-2">
                              Bal: <strong>{log.resultingStock}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="font-mono px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                            +{selectedMedicineForDetails.totalQuantity || selectedMedicineForDetails.quantity || 0}
                          </span>
                          <span>Purchase / Batch Intake</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {selectedMedicineForDetails.dateAdded || selectedMedicineForDetails.purchaseDate || '2026-06-01'} • Initial Hospital Stock Receipt
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px] text-slate-600 shrink-0 ml-2">
                        Bal: <strong>{selectedMedicineForDetails.totalQuantity || selectedMedicineForDetails.quantity || 0}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: EXPIRED ITEM QUARANTINE NOTICE */}
              {selectedMedicineForDetails.expiryMeta?.isExpired && selectedMedicineForDetails.status !== 'disposed' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Expired Batch Notice</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    This medicine batch is past its expiration date. In accordance with statutory drug safety standards, expired medicines are quarantined and cannot be listed on the marketplace.
                  </p>
                </div>
              )}

            </div>

            {/* Actions Bottom Bar */}
            <div className="p-5 border-t border-slate-200 bg-white sticky bottom-0 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const med = selectedMedicineForDetails;
                  setSelectedMedicineForDetails(null);
                  handleOpenEdit(med);
                }}
                disabled={selectedMedicineForDetails.status === 'disposed' || isOperationalLocked}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs text-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Edit Parameters
              </button>
              <button
                onClick={() => {
                  const med = selectedMedicineForDetails;
                  setSelectedMedicineForDetails(null);
                  setDeleteConfirmMed(med);
                }}
                disabled={isOperationalLocked}
                className="py-2.5 px-4 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete Record
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <MedicineModal
        isOpen={addEditModalOpen}
        onClose={() => setAddEditModalOpen(false)}
        onSubmit={handleSaveMedicine}
        initialData={editingMedicine}
        isEdit={!!editingMedicine}
      />

      {/* CSV Import Wizard Modal */}
      <CSVImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => {
          if (user?.id) {
            dispatch(fetchInventory(user.id));
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmMed}
        onClose={() => setDeleteConfirmMed(null)}
        title="Confirm Removal from Inventory"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-800 leading-relaxed">
              Are you sure you want to remove <strong className="font-bold">{deleteConfirmMed?.brandName}</strong>? It will be removed from your hospital inventory ledger immediately.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmMed(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
            >
              Confirm Removal
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default HospitalInventory;

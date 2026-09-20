import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Search, 
  Truck, 
  MapPin, 
  Thermometer, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Phone, 
  Navigation,
  RefreshCw,
  Boxes,
  RotateCcw,
  Check,
  AlertCircle,
  Package,
  FileCheck2,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Info,
  ArrowRight,
  Eye,
  Filter,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { fetchTrackingByTxn } from '../../store/slices/trackSlice';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { PortalHistoryNavigation } from '../../components/common/PortalHistoryNavigation';
import { getStoredItem, setStoredItem, KEYS } from '../../services/storage';
import { extractCity } from '../../utils/geoUtils';
import IndiaLiveMap from '../../components/tracking/IndiaLiveMap';
import toast from 'react-hot-toast';

export const TrackPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentTracking, isLoading, error } = useSelector((state) => state.track);
  const { user } = useSelector((state) => state.auth);

  const queryTxn = searchParams.get('transferId') || searchParams.get('txn') || searchParams.get('transactionId') || location.state?.alertTarget?.transferId || location.state?.alertTarget?.txn;
  const initialTxn = queryTxn || 'TXN-773120';
  const [txnInput, setTxnInput] = useState(initialTxn);
  const [selectedTxn, setSelectedTxn] = useState(initialTxn);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState('Just now');
  const [showProofModal, setShowProofModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const processedTargetRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (queryTxn && queryTxn !== selectedTxn) {
      setSelectedTxn(queryTxn);
      setTxnInput(queryTxn);
    }
  }, [queryTxn]);

  useEffect(() => {
    if (queryTxn && processedTargetRef.current !== queryTxn) {
      processedTargetRef.current = queryTxn;
      toast.success(`Tracking shipment ${queryTxn}`, { icon: '🚚', id: 'track-inspect-toast' });
    }
  }, [queryTxn]);

  useEffect(() => {
    if (error && queryTxn) {
      toast.error('Original transfer record is no longer available.', {
        icon: '⚠️',
        duration: 4000,
        id: 'track-missing-toast',
      });
    }
  }, [error, queryTxn]);

  useEffect(() => {
    dispatch(fetchTrackingByTxn(selectedTxn));
  }, [dispatch, selectedTxn]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (txnInput.trim()) {
      const q = txnInput.trim();
      setSelectedTxn(q);
      setSearchParams({ txn: q });
      if (mapContainerRef.current) {
        mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleSelectShipment = (txnId) => {
    setSelectedTxn(txnId);
    setTxnInput(txnId);
    setSearchParams({ txn: txnId });
    if (mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    dispatch(fetchTrackingByTxn(selectedTxn));
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshedTime('Just now');
      toast.success('Demo tracking telemetry refreshed');
    }, 600);
  };

  const handleReceiveStock = () => {
    try {
      const trackings = getStoredItem(KEYS.TRACKING, []);
      const updatedTrackings = trackings.map((t) => {
        if (t.transactionId === tracking.transactionId || t.trackingNumber === tracking.trackingNumber) {
          return { ...t, status: 'Delivered', deliveredDate: new Date().toISOString().split('T')[0] };
        }
        return t;
      });
      setStoredItem(KEYS.TRACKING, updatedTrackings);

      // Add to hospital inventory
      const currentMeds = getStoredItem(KEYS.MEDICINES, []);
      const newLot = {
        id: `med-recv-${Date.now()}`,
        hospitalId: user?.hospitalId || user?.id || null,
        hospitalName: user?.hospitalName || user?.name || 'Hospital Pharmacy',
        brandName: tracking.medicineName || 'Received Medicine Lot',
        genericName: 'Verified Transferred Stock',
        batchNo: `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
        quantity: tracking.quantity || 50,
        mfgDate: '01/2026',
        expiryDate: '12/2027',
        unitOriginalPrice: 120,
        discountPercent: 15,
        status: 'Available',
        verified: true,
      };
      setStoredItem(KEYS.MEDICINES, [newLot, ...currentMeds]);

      dispatch(fetchTrackingByTxn(selectedTxn));
      toast.success('Stock received and inventory updated');
      setShowProofModal(true);
    } catch (e) {
      toast.error('Failed to complete stock receipt');
    }
  };

  const storedTrackings = getStoredItem(KEYS.TRACKING, []);

  // Standard active shipments list scoped strictly to authenticated hospital (tenant isolation)
  const availableShipments = useMemo(() => {
    const hospitalId = user?.hospitalId || user?.id;
    const hospitalName = user?.name?.toLowerCase();

    const isHospitalRelated = (t) => {
      if (!hospitalId && !hospitalName) return false;
      if (t.senderHospitalId === hospitalId || t.receiverHospitalId === hospitalId) return true;
      if (t.fromHospitalId === hospitalId || t.toHospitalId === hospitalId) return true;
      if (hospitalName) {
        if (t.senderHospital?.toLowerCase().includes(hospitalName)) return true;
        if (t.receiverHospital?.toLowerCase().includes(hospitalName)) return true;
        if (t.from?.toLowerCase().includes(hospitalName)) return true;
        if (t.to?.toLowerCase().includes(hospitalName)) return true;
      }
      return false;
    };

    if (storedTrackings.length > 0) {
      return storedTrackings.filter(isHospitalRelated).map((t) => ({
        txnId: t.transactionId,
        trackingNo: t.trackingNumber,
        medicine: t.medicineName,
        units: t.quantity,
        from: t.senderHospital,
        to: t.receiverHospital,
        status: t.status,
        temp: t.temperature || '4.0°C',
        eta: t.eta || 'Today, 06:30 PM',
        currentLocation: t.currentLocation || 'In Transit',
        destination: t.destination || 'Hospital Intake Dock',
        courierName: t.courierName || 'MediCold Bio-Express',
        updatedAt: t.updatedAt || 'Recent',
        raw: t
      }));
    }
    return [];
  }, [storedTrackings, user]);

  // Dynamic tracking summary calculated strictly from availableShipments
  const trackingSummary = useMemo(() => {
    let active = 0;
    let inTransit = 0;
    let delivered = 0;
    let pending = 0;

    availableShipments.forEach((s) => {
      const st = (s.status || '').toLowerCase();
      if (st.includes('deliver') || st.includes('received')) {
        delivered++;
      } else if (st.includes('transit')) {
        inTransit++;
        active++;
      } else if (st.includes('order') || st.includes('pending') || st.includes('prepar') || st.includes('dispatch') || st.includes('confirm')) {
        pending++;
        active++;
      } else if (st !== 'cancelled') {
        active++;
      }
    });

    return {
      active,
      inTransit,
      delivered,
      pending,
      total: availableShipments.length
    };
  }, [availableShipments]);

  // Filtered shipments for "Your Tracked Orders" list
  const filteredShipments = useMemo(() => {
    return availableShipments.filter((s) => {
      const st = (s.status || '').toLowerCase();
      if (statusFilter === 'IN_TRANSIT' && !st.includes('transit')) return false;
      if (statusFilter === 'DELIVERED' && !st.includes('deliver') && !st.includes('received')) return false;
      if (statusFilter === 'PENDING' && !st.includes('order') && !st.includes('pending') && !st.includes('prepar') && !st.includes('dispatch') && !st.includes('confirm')) return false;

      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const matchesMedicine = s.medicine?.toLowerCase().includes(q);
        const matchesTxn = s.txnId?.toLowerCase().includes(q);
        const matchesTrackingNo = s.trackingNo?.toLowerCase().includes(q);
        const matchesFrom = s.from?.toLowerCase().includes(q);
        const matchesLocation = s.currentLocation?.toLowerCase().includes(q);
        return matchesMedicine || matchesTxn || matchesTrackingNo || matchesFrom || matchesLocation;
      }
      return true;
    });
  }, [availableShipments, statusFilter, orderSearchQuery]);


  // Active tracking item with standard fallback
  const tracking = currentTracking || {
    transactionId: selectedTxn,
    trackingNumber: 'SMS-EXP-88912',
    senderHospital: 'Max Super Speciality Hospital (Delhi)',
    receiverHospital: 'Apollo Hospital (Mumbai)',
    medicineName: 'Enoxaparin Sodium 40mg Prefilled Syringe',
    quantity: 50,
    status: 'In Transit',
    currentLocation: 'Vadodara Distribution Hub, NH-48',
    destination: 'Apollo Hospital Central Pharmacy Intake Dock',
    eta: 'Today • 6:30 PM',
    courierName: 'MediCold Bio-Express Logistics Ltd.',
    courierContact: '+91 91234 56789 (Driver: Harpreet Singh)',
    vehicleNo: 'MH-04-AZ-4419 (Temp Controlled)',
    temperature: '4.2°C (Compliant 2°C - 8°C)',
    timeline: [
      { step: 'Order Confirmed', date: '25 Aug • 02:15 PM', completed: true, details: 'Verified by MedEx verification engine.' },
      { step: 'Pickup Scheduled', date: '26 Aug • 09:45 AM', completed: true, details: 'Authorized medical courier dispatched to origin.' },
      { step: 'Picked Up', date: '26 Aug • 03:30 PM', completed: true, details: 'Cryo-insulated cold box sealed at seller pharmacy.' },
      { step: 'In Transit', date: '27 Aug • 11:20 AM', completed: true, details: 'Medicine is currently moving toward destination on NH-48.' },
      { step: 'Out for Delivery', date: 'Pending', completed: false, details: 'Last mile transfer to hospital receiving bay.' },
      { step: 'Delivered', date: 'Pending', completed: false, details: 'Pharmacy intake inspection and handoff sign-off.' },
    ],
  };

  const isReceived = (tracking.status || '').toLowerCase() === 'received';
  const isDelivered = (tracking.status || '').toLowerCase() === 'delivered' || isReceived;
  const isInTransit = (tracking.status || '').toLowerCase().includes('transit');
  const isDispatched = isInTransit || isDelivered;
  const isPreparing = (tracking.status || '').toLowerCase() === 'preparing';
  const isOrdered = (tracking.status || '').toLowerCase() === 'ordered' || (tracking.status || '').toLowerCase() === 'pending';

  const sellerCity = extractCity(tracking.senderHospital);
  const buyerCity = extractCity(tracking.receiverHospital);

  // 6 Standard Progress Steps: REQUEST APPROVED -> PREPARING -> DISPATCHED -> IN TRANSIT -> DELIVERED -> RECEIVED
  const progressSteps = [
    { label: 'REQUEST APPROVED', short: 'Approved', time: '25 Aug • 02:15 PM', desc: 'Transfer requisition validated & stock earmarked', completed: true, active: false },
    { label: 'PREPARING', short: 'Preparing', time: '26 Aug • 09:45 AM', desc: 'Cryo-insulated cold box sealed at hospital dock', completed: isDispatched || isPreparing, active: isPreparing },
    { label: 'DISPATCHED', short: 'Dispatched', time: '26 Aug • 03:30 PM', desc: 'Handed over to authorized GPS bio-courier', completed: isDispatched, active: false },
    { label: 'IN TRANSIT', short: 'In Transit', time: 'Today • 12:40 PM', desc: 'Actively moving toward destination on highway corridor', completed: isDelivered, active: isInTransit },
    { label: 'DELIVERED', short: 'Delivered', time: isDelivered ? 'Today • 03:45 PM' : 'Pending', desc: 'Consignment arrived at destination receiving bay', completed: isDelivered, active: isDelivered && !isReceived },
    { label: 'RECEIVED', short: 'Received', time: isReceived ? 'Today • 04:30 PM' : 'Pending', desc: 'Pharmacist dock verification & intake sign-off', completed: isReceived, active: false },
  ];

  return (
    <div className="space-y-7 pb-12">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <PortalHistoryNavigation portal="hospital" />
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Live Tracking
            </h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Track your medicine orders and view the latest shipment status in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* 2. TRACKING SUMMARY (Calculated strictly from real existing tracking data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Active Deliveries */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
              Active Deliveries
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {trackingSummary.active}
            </div>
            <p className="text-[11px] text-slate-500 truncate">Total in-flight shipments</p>
          </div>
        </div>

        {/* In Transit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
              In Transit
            </span>
            <div className="text-2xl font-black text-sky-700 font-mono mt-0.5">
              {trackingSummary.inTransit}
            </div>
            <p className="text-[11px] text-slate-500 truncate">En route on highways</p>
          </div>
        </div>

        {/* Delivered / Received */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
              Delivered
            </span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-0.5">
              {trackingSummary.delivered}
            </div>
            <p className="text-[11px] text-slate-500 truncate">Received at dock</p>
          </div>
        </div>

        {/* Pending / Awaiting Dispatch */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
              Awaiting Dispatch
            </span>
            <div className="text-2xl font-black text-amber-700 font-mono mt-0.5">
              {trackingSummary.pending}
            </div>
            <p className="text-[11px] text-slate-500 truncate">Order confirmed / packing</p>
          </div>
        </div>
      </div>

      {/* 3. CURRENT SELECTED SHIPMENT HERO BANNER */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-xs transition-all relative overflow-hidden ${
        isDelivered 
          ? 'bg-gradient-to-br from-emerald-600 via-teal-700 to-teal-800 text-white border-emerald-600'
          : isInTransit
            ? 'bg-gradient-to-br from-blue-600 via-primary-700 to-indigo-800 text-white border-blue-700'
            : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-800'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider">
              {isDelivered ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>DELIVERED & VERIFIED</span>
                </>
              ) : isInTransit ? (
                <>
                  <Truck className="w-4 h-4 text-white animate-pulse" />
                  <span>IN TRANSIT</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-white" />
                  <span>ORDER CONFIRMED</span>
                </>
              )}
              <span className="opacity-60">•</span>
              <span className="font-mono">{tracking.transactionId}</span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
              {isDelivered
                ? `${tracking.medicineName} successfully delivered to intake dock.`
                : isInTransit
                  ? `${tracking.medicineName} is in transit to destination.`
                  : `${tracking.medicineName} transfer approved. Awaiting pickup dispatch.`}
            </h2>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-white/85 font-medium">
              <span>
                Origin: <strong className="text-white">{sellerCity}</strong>
              </span>
              <span>→</span>
              <span>
                Destination: <strong className="text-white">{buyerCity}</strong>
              </span>
              <span className="hidden sm:inline opacity-60">•</span>
              <span>
                Current Location: <strong className="text-white underline decoration-white/40">{tracking.currentLocation}</strong>
              </span>
            </div>
          </div>

          {/* Large Estimated Delivery Highlight */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left md:text-right shrink-0 min-w-[210px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 block">
              {isDelivered ? 'Delivered Timestamp' : 'Estimated Delivery'}
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-white mt-1">
              {tracking.eta}
            </div>
            <span className="text-[11px] text-white/80 block mt-1 font-mono">
              Temp: {tracking.temperature?.split(' ')[0] || '4.2°C'} (Compliant)
            </span>
          </div>

        </div>
      </div>

      {/* 4. MAP SECTION (LOCKED MAP CONTAINER + SIDEBAR DETAILS) */}
      <div ref={mapContainerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* MAP CONTAINER (LEFT COLUMN) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  GEOGRAPHIC ROUTE & TELEMETRY
                </span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-0.5">
                  <MapPin className="w-4 h-4 text-primary-600 animate-bounce" />
                  <span>Shipment Location</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an order below to view its current shipment location.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{sellerCity} → {buyerCity} Corridor</span>
                </span>
              </div>
            </div>

            {/* EMBEDDED LEAFLET MAP (UNTOUCHED, LOCKED) */}
            <IndiaLiveMap tracking={tracking} />

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <span className="flex items-center gap-1.5 font-mono">
                <Navigation className="w-3.5 h-3.5 text-primary-600" />
                Transit Location: <strong className="text-slate-800">{tracking.currentLocation}</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                Last telemetry update: {lastRefreshedTime}
              </span>
            </div>
          </div>

          {/* ROUTE SUMMARY ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                FROM (SELLER)
              </span>
              <div className="text-sm font-extrabold text-slate-900 leading-snug truncate" title={tracking.senderHospital}>
                {tracking.senderHospital}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">{sellerCity}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                TO (BUYER)
              </span>
              <div className="text-sm font-extrabold text-slate-900 leading-snug truncate" title={tracking.receiverHospital}>
                {tracking.receiverHospital}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">{buyerCity}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                MEDICINE
              </span>
              <div className="text-sm font-extrabold text-slate-900 leading-snug truncate" title={tracking.medicineName}>
                {tracking.medicineName}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Batch verified</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                QUANTITY
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {tracking.quantity}
              </div>
              <p className="text-[11px] text-slate-500">Units reserved</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                TRACKING ID
              </span>
              <div className="text-sm font-black font-mono text-primary-700 truncate" title={tracking.trackingNumber}>
                {tracking.trackingNumber || `MDX-TRK-${tracking.transactionId}`}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Txn: {tracking.transactionId}</p>
            </div>
          </div>

          {/* DELIVERY PROGRESS TIMELINE */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Tracking Timeline</h3>
                <p className="text-xs text-slate-500">Milestone checkpoint tracking from order verification to hospital intake dock</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                Updated: {lastRefreshedTime}
              </span>
            </div>

            {/* Desktop Horizontal Stepper */}
            <div className="hidden md:grid grid-cols-6 gap-3 pt-2">
              {progressSteps.map((step, idx) => (
                <div key={idx} className="space-y-2 text-left relative">
                  {idx !== 5 && (
                    <div className={`absolute top-3.5 left-7 right-0 h-1 z-0 ${
                      step.completed ? 'bg-emerald-500' : 'bg-slate-200'
                    }`} />
                  )}

                  <div className="flex items-center gap-2 relative z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      step.completed 
                        ? 'bg-emerald-600 shadow-xs' 
                        : step.active 
                          ? 'bg-blue-600 ring-4 ring-blue-100 animate-pulse shadow-xs' 
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                      {step.completed ? <Check className="w-4 h-4 stroke-[3]" /> : step.active ? '●' : '○'}
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className={`text-xs font-bold leading-tight ${
                      step.completed ? 'text-slate-900' : step.active ? 'text-blue-700 font-black' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      {step.time}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Vertical Stepper */}
            <div className="block md:hidden space-y-4 pt-1">
              {progressSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3.5 relative">
                  {idx !== 5 && (
                    <div className={`absolute left-3 top-5 w-0.5 h-12 ${
                      step.completed ? 'bg-emerald-500' : 'bg-slate-200'
                    }`} />
                  )}

                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 z-10 ${
                    step.completed 
                      ? 'bg-emerald-600 shadow-xs' 
                      : step.active 
                        ? 'bg-blue-600 ring-4 ring-blue-100 animate-pulse shadow-xs' 
                        : 'bg-slate-200 text-slate-500'
                  }`}>
                    {step.completed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.active ? '●' : '○'}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        step.completed ? 'text-slate-900' : step.active ? 'text-blue-700 font-black' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{step.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* SIDEBAR COLUMN (RIGHT COLUMN) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:sticky lg:top-6">
          
          {/* CURRENT SHIPMENT DETAILS CARD */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-extrabold flex items-center gap-1.5">
                {isDelivered ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>DELIVERED</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>IN TRANSIT</span>
                  </>
                )}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {tracking.trackingNumber || 'MDX-TRK-20481'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Medicine & Quantity
                </span>
                <h4 className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug">
                  {tracking.medicineName}
                </h4>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {tracking.quantity} units
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Expected Delivery (ETA)
                </span>
                <div className="text-base font-black font-mono text-primary-800">
                  {tracking.eta}
                </div>
              </div>

              {/* Corridor Route */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Origin</span>
                  <strong className="text-slate-900 text-xs">{sellerCity}</strong>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Destination</span>
                  <strong className="text-slate-900 text-xs">{buyerCity}</strong>
                </div>
              </div>
            </div>

          </div>

          {/* DELIVERY INFORMATION & COURIER PARTNER */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
              DELIVERY INFORMATION
            </span>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-medium block">Logistics Provider</span>
                <strong className="text-slate-900 text-sm">{tracking.courierName}</strong>
                <p className="text-[11px] text-slate-500 font-mono">Vehicle: {tracking.vehicleNo}</p>
              </div>

              {/* Courier Contact */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2.5 text-slate-700">
                <Phone className="w-4 h-4 text-primary-600 shrink-0" />
                <div className="text-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">Driver / Dispatch Contact</span>
                  <strong className="text-slate-900">{tracking.courierContact}</strong>
                </div>
              </div>

              {/* Temperature IoT Monitoring Card */}
              <div className="p-4 bg-cyan-50/50 rounded-2xl border border-cyan-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Thermometer className="w-5 h-5 text-cyan-600" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-cyan-800 block">Chamber Temperature</span>
                    <strong className="text-sm font-mono text-cyan-950">{tracking.temperature}</strong>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  SAFE (2°C - 8°C)
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {isDelivered ? (
                <button
                  type="button"
                  onClick={() => setShowProofModal(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Delivered • View Delivery Proof</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleReceiveStock}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Receive Stock & Update Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/hospital/my-requests`)}
                    className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>View Transfer Requisition</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* 5. YOUR TRACKED ORDERS (MAIN REQUESTED IMPROVEMENT BELOW THE MAP) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
        
        {/* Section Header with Filter and Search Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Your Tracked Orders
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-50 text-primary-700 border border-primary-200">
                {availableShipments.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select any consignment below to display its live transit position on the map above.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search orders or medicine..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium placeholder:text-slate-400"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold select-none">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({availableShipments.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('IN_TRANSIT')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'IN_TRANSIT'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Transit ({trackingSummary.inTransit})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending ({trackingSummary.pending})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DELIVERED')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'DELIVERED'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Delivered ({trackingSummary.delivered})
              </button>
            </div>
          </div>
        </div>

        {/* SHIPMENT CARDS LIST */}
        {availableShipments.length === 0 ? (
          /* Empty State: Hospital has no shipments */
          <div className="p-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Truck className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">No active shipments</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You don't currently have any orders available for live tracking. Once a medicine request is approved or dispatched, its real-time telematics will appear here.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/hospital/marketplace')}
                className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                Browse Marketplace
              </button>
              <button
                type="button"
                onClick={() => navigate('/hospital/my-requests')}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                View My Requests
              </button>
            </div>
          </div>
        ) : filteredShipments.length === 0 ? (
          /* Filter Empty State */
          <div className="p-8 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-200/80">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">
              No shipments found matching filter <strong className="text-slate-800">"{statusFilter}"</strong>
              {orderSearchQuery ? ` or query "${orderSearchQuery}"` : ''}.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setOrderSearchQuery('');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredShipments.map((shipment) => {
              const isSelected = selectedTxn?.toLowerCase() === shipment.txnId?.toLowerCase();
              const stLower = (shipment.status || '').toLowerCase();
              const isItemDelivered = stLower.includes('deliver') || stLower.includes('received');
              const isItemInTransit = stLower.includes('transit');

              return (
                <div
                  key={shipment.txnId}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50/30 shadow-md ring-2 ring-primary-500/20'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Left Details: IDs, Medicine, Origin/Destination */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      
                      {/* Top Meta Bar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/80">
                          {shipment.txnId}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          Consignment: <strong>{shipment.trackingNo || 'Pending Allocation'}</strong>
                        </span>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isItemDelivered 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isItemInTransit
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isItemDelivered ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isItemInTransit ? (
                            <Truck className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{shipment.status?.toUpperCase() || 'CONFIRMED'}</span>
                        </span>

                        {/* Currently Viewing Indicator */}
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-600 text-white shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>Currently Viewing on Map</span>
                          </span>
                        )}
                      </div>

                      {/* Main Medicine & Route */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                            Medicine & Reserved Stock
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-0.5 truncate" title={shipment.medicine}>
                            {shipment.medicine}
                          </h4>
                          <p className="text-xs font-mono font-bold text-primary-700 mt-0.5">
                            {shipment.units} units
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                            Seller / Origin Facility
                          </span>
                          <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate" title={shipment.from}>
                            {shipment.from}
                          </p>
                          <p className="text-[11px] text-slate-500">To: {shipment.to}</p>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                            Current Location & ETA
                          </span>
                          <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate" title={shipment.currentLocation}>
                            {shipment.currentLocation}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            ETA: <strong className="text-slate-700">{shipment.eta}</strong>
                          </p>
                        </div>
                      </div>

                    </div>

                    {/* Right Action: View on Map */}
                    <div className="flex sm:items-center justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {isSelected ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (mapContainerRef.current) {
                              mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer hover:bg-primary-700 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Active on Map</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectShipment(shipment.txnId)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:border-primary-500 hover:bg-primary-50 text-slate-700 hover:text-primary-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                        >
                          <span>View on Map</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Proof of Delivery Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-5 border border-slate-100">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Proof of Delivery Verified</h3>
              <p className="text-xs text-slate-500">
                Consignment successfully received and checked at receiving hospital dock.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Consignment:</span>
                <span className="font-bold text-slate-800">{tracking.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Received By:</span>
                <span className="font-bold text-slate-800">Hospital Pharmacy Intake Dock</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cold Chain SLA:</span>
                <span className="text-emerald-700 font-bold">100% Compliant (Zero Breaches)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowProofModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TrackPage;

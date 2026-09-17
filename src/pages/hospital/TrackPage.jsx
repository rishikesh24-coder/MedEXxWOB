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
  ArrowRight
} from 'lucide-react';
import { fetchTrackingByTxn } from '../../store/slices/trackSlice';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
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
  const processedTargetRef = useRef(null);

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
    }
  };

  const handleSelectShipment = (txnId) => {
    setSelectedTxn(txnId);
    setTxnInput(txnId);
    setSearchParams({ txn: txnId });
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
        hospitalId: user?.id || 'hosp-1',
        hospitalName: user?.name || 'Apollo Hospital Central Pharmacy',
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

  // Standard active shipments list
  const availableShipments = useMemo(() => {
    if (storedTrackings.length > 0) {
      return storedTrackings.map((t) => ({
        txnId: t.transactionId,
        trackingNo: t.trackingNumber,
        medicine: t.medicineName,
        units: t.quantity,
        from: t.senderHospital,
        to: t.receiverHospital,
        status: t.status,
        temp: t.temperature || '4.0°C',
        eta: t.eta || 'Today, 06:30 PM',
      }));
    }
    return [
      {
        txnId: 'TXN-773120',
        trackingNo: 'SMS-EXP-88912',
        medicine: 'Enoxaparin Sodium 40mg',
        units: 50,
        from: 'Max Super Speciality (Delhi)',
        to: 'Apollo Hospital (Mumbai)',
        status: 'In Transit',
        temp: '4.2°C',
        eta: 'Today, 06:30 PM',
      },
      {
        txnId: 'TXN-770412',
        trackingNo: 'SMS-EXP-77041',
        medicine: 'Rituximab (Ristova) 500mg',
        units: 4,
        from: 'Tata Memorial Centre (Mumbai)',
        to: 'Apollo Hospital (Mumbai)',
        status: 'In Transit',
        temp: '3.8°C',
        eta: 'Today, 04:15 PM',
      },
      {
        txnId: 'TXN-663190',
        trackingNo: 'SMS-EXP-66319',
        medicine: 'Streptokinase 1,500,000 IU',
        units: 12,
        from: 'Lilavati Hospital (Mumbai)',
        to: 'Apollo Hospital (Pune)',
        status: 'In Transit',
        temp: '4.5°C',
        eta: 'Today, 05:00 PM',
      },
      {
        txnId: 'TXN-331902',
        trackingNo: 'SMS-EXP-33190',
        medicine: 'Bevacizumab (Avastin) 400mg',
        units: 3,
        from: 'Tata Memorial Centre (Mumbai)',
        to: 'Fortis Memorial (Gurgaon)',
        status: 'Delivered',
        temp: '4.0°C',
        eta: 'Delivered',
      },
    ];
  }, [storedTrackings]);

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
    <div className="space-y-7 pb-10">
      
      {/* 1. Header (WHERE AM I? + WHAT IS HAPPENING?) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Live Tracking
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Track your medicine transfer with live geographic routing across India.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Tracking</span>
          </button>
        </div>
      </div>

      {/* 2. TOP STATUS HERO PANEL (Requirement 9: Visual Focus — Understand in 3 Seconds) */}
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-sm transition-all relative overflow-hidden ${
        isDelivered 
          ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-emerald-600'
          : isInTransit
            ? 'bg-gradient-to-br from-blue-600 to-primary-700 text-white border-blue-700'
            : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-800'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider">
              {isDelivered ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>✓ DELIVERED</span>
                </>
              ) : isInTransit ? (
                <>
                  <Truck className="w-4 h-4 text-white animate-pulse" />
                  <span>🚚 IN TRANSIT</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-white" />
                  <span>📦 ORDER CONFIRMED</span>
                </>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
              {isDelivered
                ? 'Medicine successfully delivered to hospital intake dock.'
                : isInTransit
                  ? 'Your medicine is on the way.'
                  : 'Transfer approved. Awaiting pickup dispatch.'}
            </h2>

            <p className="text-xs sm:text-sm text-white/80 font-medium">
              Current Location: <strong className="text-white underline decoration-white/40">{tracking.currentLocation}</strong>
            </p>
          </div>

          {/* Large Estimated Delivery Highlight */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left md:text-right flex-shrink-0 min-w-[210px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/75 block">
              {isDelivered ? 'Delivered Timestamp' : 'Estimated Delivery'}
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
              {tracking.eta}
            </div>
            <span className="text-[11px] text-white/80 block mt-1 font-mono">
              Temp: {tracking.temperature?.split(' ')[0] || '4.2°C'} (Compliant)
            </span>
          </div>

        </div>
      </div>

      {/* 3. MAIN SECTION: MAP (LEFT) + SIDEBAR (RIGHT) */}
      {/* On Desktop: Left=Map + Timeline, Right=Shipment Info Card + Courier + Active Consignments */}
      {/* On Mobile: Top Status -> Map -> Route Summary -> Timeline -> Transfer Details (Requirement 11) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / MAIN COLUMN (lg:col-span-7 xl:col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          {/* REAL INTERACTIVE MAP OF INDIA */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  GEOGRAPHIC LIVE ROUTE
                </span>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-4 h-4 text-amber-500 animate-bounce" />
                  <span>{sellerCity} → {buyerCity} Transit Corridor</span>
                </h3>
              </div>

              <div className="text-left sm:text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-block">
                  Demo Live Location • Tracking Simulation
                </span>
              </div>
            </div>

            {/* Embedded Leaflet Map */}
            <IndiaLiveMap tracking={tracking} />

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <span className="flex items-center gap-1 font-mono">
                <Navigation className="w-3.5 h-3.5 text-primary-600" />
                Transit: <strong className="text-slate-800">{tracking.currentLocation}</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                Last telemetry update: {lastRefreshedTime}
              </span>
            </div>
          </div>

          {/* ROUTE SUMMARY ROW (Requirement 9 & 11) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                FROM (SELLER)
              </span>
              <div className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                {tracking.senderHospital}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">{sellerCity}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                TO (BUYER)
              </span>
              <div className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                {tracking.receiverHospital}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">{buyerCity}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                MEDICINE
              </span>
              <div className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                {tracking.medicineName}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Batch verified</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                QUANTITY
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {tracking.quantity}
              </div>
              <p className="text-[11px] text-slate-500">Units reserved</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                TRACKING ID
              </span>
              <div className="text-sm font-black font-mono text-primary-700 truncate">
                {tracking.trackingNumber || `MS-TRK-${tracking.transactionId}`}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Txn: {tracking.transactionId}</p>
            </div>
          </div>

          {/* DELIVERY PROGRESS TIMELINE (Requirement 10: 6 Steps) */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
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
                        ? 'bg-emerald-600 shadow-sm' 
                        : step.active 
                          ? 'bg-blue-600 ring-4 ring-blue-100 animate-pulse shadow-sm' 
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

                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 z-10 ${
                    step.completed 
                      ? 'bg-emerald-600 shadow-sm' 
                      : step.active 
                        ? 'bg-blue-600 ring-4 ring-blue-100 animate-pulse shadow-sm' 
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

        {/* RIGHT / SIDEBAR COLUMN (lg:col-span-5 xl:col-span-4) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:sticky lg:top-6">
          
          {/* 1. CURRENT SHIPMENT INFORMATION (Requirement 11 Sidebar Card) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-extrabold flex items-center gap-1.5">
                {isDelivered ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>DELIVERED ✓</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>IN TRANSIT 🚚</span>
                  </>
                )}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {tracking.trackingNumber || 'MS-TRK-20481'}
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

              {/* Corridor Route Label */}
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

          {/* 2. DELIVERY INFORMATION & COURIER PARTNER */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
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
                <Phone className="w-4 h-4 text-primary-600 flex-shrink-0" />
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
                  SAFE
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {isDelivered ? (
                <button
                  type="button"
                  onClick={() => setShowProofModal(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>✓ Delivered • View Delivery Proof</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleReceiveStock}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Receive Stock & Update Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/hospital/my-requests`)}
                    className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <span>View Transfer Requisition</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Refresh Tracking Data</span>
              </button>
            </div>

          </div>

          {/* 3. ACTIVE CONSIGNMENTS SWITCHER (Allows testing all demo shipments) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
              Active Consignments ({availableShipments.length})
            </span>

            <div className="space-y-2">
              {availableShipments.map((s) => (
                <button
                  key={s.txnId}
                  type="button"
                  onClick={() => handleSelectShipment(s.txnId)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all text-xs flex items-center justify-between ${
                    selectedTxn === s.txnId
                      ? 'border-primary-600 bg-primary-50/50 shadow-sm ring-1 ring-primary-600/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-slate-900">{s.medicine}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {s.units} units • {s.txnId}
                    </div>
                  </div>
                  <StatusBadge status={s.status} className="text-[10px] px-2 py-0.5" />
                </button>
              ))}
            </div>
          </div>

        </div>

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

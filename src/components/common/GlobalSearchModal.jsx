import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  X, 
  Pill, 
  Building2, 
  FileText, 
  Truck, 
  ArrowRight, 
  Boxes, 
  Layers, 
  Calendar,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { getStoredItem, KEYS } from '../../services/storage';

/**
 * GlobalSearchModal
 * 
 * Centralized, multi-entity search supporting:
 * - Medicines (Exact Name > Generic/Composition > Brand > Partial)
 * - Batches
 * - Hospitals
 * - Requests
 * - Transfers
 */
export const GlobalSearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'medicines' | 'batches' | 'hospitals' | 'requests' | 'transfers'
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setActiveCategory('all');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search Results derived from stored data
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return { medicines: [], batches: [], hospitals: [], requests: [], transfers: [] };

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const tracking = getStoredItem(KEYS.TRACKING, []);

    // 1. Medicines ranking
    const matchedMeds = [];
    medicines.forEach((m) => {
      const brand = (m.brandName || '').toLowerCase();
      const generic = (m.genericName || '').toLowerCase();
      const power = (m.power || '').toLowerCase();

      let rank = 0;
      if (brand === q) rank = 100;
      else if (generic === q) rank = 90;
      else if (brand.startsWith(q)) rank = 80;
      else if (generic.startsWith(q)) rank = 70;
      else if (brand.includes(q)) rank = 60;
      else if (generic.includes(q)) rank = 50;
      else if (power.includes(q)) rank = 40;

      if (rank > 0) {
        matchedMeds.push({ ...m, searchRank: rank });
      }
    });
    matchedMeds.sort((a, b) => b.searchRank - a.searchRank);

    // 2. Batches
    const matchedBatches = medicines.filter((m) => 
      m.batchNo && m.batchNo.toLowerCase().includes(q)
    );

    // 3. Hospitals
    const matchedHospitals = hospitals.filter((h) => 
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.city && h.city.toLowerCase().includes(q)) ||
      (h.registrationNo && h.registrationNo.toLowerCase().includes(q))
    );

    // 4. Requests
    const matchedRequests = requests.filter((r) => 
      (r.id && r.id.toLowerCase().includes(q)) ||
      (r.medicineName && r.medicineName.toLowerCase().includes(q)) ||
      (r.transactionId && r.transactionId.toLowerCase().includes(q)) ||
      (r.fromHospitalName && r.fromHospitalName.toLowerCase().includes(q)) ||
      (r.toHospitalName && r.toHospitalName.toLowerCase().includes(q))
    );

    // 5. Transfers
    const matchedTransfers = tracking.filter((t) => 
      (t.transactionId && t.transactionId.toLowerCase().includes(q)) ||
      (t.trackingNumber && t.trackingNumber.toLowerCase().includes(q)) ||
      (t.medicineName && t.medicineName.toLowerCase().includes(q)) ||
      (t.senderHospital && t.senderHospital.toLowerCase().includes(q)) ||
      (t.receiverHospital && t.receiverHospital.toLowerCase().includes(q))
    );

    return {
      medicines: matchedMeds.slice(0, 6),
      batches: matchedBatches.slice(0, 4),
      hospitals: matchedHospitals.slice(0, 4),
      requests: matchedRequests.slice(0, 4),
      transfers: matchedTransfers.slice(0, 4),
    };
  }, [query]);

  const totalResultsCount = 
    results.medicines.length + 
    results.batches.length + 
    results.hospitals.length + 
    results.requests.length + 
    results.transfers.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="fixed inset-0" onClick={onClose} />

      <div 
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col mt-8 sm:mt-14 z-10 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicines, batches, hospitals, requests, transfers..."
            className="flex-1 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            ESC to close
          </span>
        </div>

        {/* Category Filters Strip */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          {[
            { id: 'all', label: 'All Results' },
            { id: 'medicines', label: `Medicines (${results.medicines.length})` },
            { id: 'batches', label: `Batches (${results.batches.length})` },
            { id: 'hospitals', label: `Hospitals (${results.hospitals.length})` },
            { id: 'requests', label: `Requests (${results.requests.length})` },
            { id: 'transfers', label: `Transfers (${results.transfers.length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-primary-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results Area */}
        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {query.trim().length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-400">
              <Search className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-bold text-slate-700">Type to search across the entire MedEx network</p>
              <p className="text-[11px] text-slate-400">
                Supports exact salt matching, batch numbers, hospitals, and transaction IDs.
              </p>
            </div>
          ) : totalResultsCount === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-400">
              <Boxes className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-bold text-slate-700">No matches found for "{query}"</p>
              <p className="text-[11px] text-slate-400">
                Check spelling or try searching by active composition name (e.g. Paracetamol, Amoxicillin).
              </p>
            </div>
          ) : (
            <>
              {/* Category 1: Medicines */}
              {(activeCategory === 'all' || activeCategory === 'medicines') && results.medicines.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    Medicines & Formulations ({results.medicines.length})
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {results.medicines.map((med) => (
                      <div
                        key={med.id}
                        onClick={() => {
                          onClose();
                          navigate(`/hospital/marketplace?search=${encodeURIComponent(med.brandName)}`);
                        }}
                        className="p-3 bg-white hover:bg-primary-50/50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-900 group-hover:text-primary-700">
                                {med.brandName}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
                                {med.power}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block">
                              Composition: {med.genericName} • {med.hospitalName || 'Verified Hospital'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-slate-900">
                            ₹{med.unitOriginalPrice} / unit
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 2: Batches */}
              {(activeCategory === 'all' || activeCategory === 'batches') && results.batches.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    Batch Lots ({results.batches.length})
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {results.batches.map((med) => (
                      <div
                        key={med.id}
                        onClick={() => {
                          onClose();
                          navigate(`/hospital/inventory?search=${encodeURIComponent(med.batchNo)}`);
                        }}
                        className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-700 font-mono">
                              Batch: {med.batchNo}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {med.brandName} ({med.power}) • Expiry: {med.expiryDate || 'Valid'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-emerald-700">
                            {med.quantity} units
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 3: Hospitals */}
              {(activeCategory === 'all' || activeCategory === 'hospitals') && results.hospitals.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    Peer Hospitals ({results.hospitals.length})
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {results.hospitals.map((hosp) => (
                      <div
                        key={hosp.id}
                        onClick={() => {
                          onClose();
                          navigate(`/hospital/marketplace?search=${encodeURIComponent(hosp.name)}`);
                        }}
                        className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-700">
                              {hosp.name}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {hosp.city}, {hosp.state} • Reg: {hosp.registrationNo || 'Verified'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Verified Node
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 4: Requests */}
              {(activeCategory === 'all' || activeCategory === 'requests') && results.requests.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    Requisitions ({results.requests.length})
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {results.requests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => {
                          onClose();
                          navigate('/hospital/incoming-requests');
                        }}
                        className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-700 font-mono">
                              {req.id} • {req.medicineName}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              From: {req.fromHospitalName} • Qty: {req.quantity} units
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold capitalize text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 5: Transfers */}
              {(activeCategory === 'all' || activeCategory === 'transfers') && results.transfers.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    Transfers & Shipments ({results.transfers.length})
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {results.transfers.map((trf) => (
                      <div
                        key={trf.transactionId}
                        onClick={() => {
                          onClose();
                          navigate(`/hospital/track?txn=${encodeURIComponent(trf.transactionId)}`);
                        }}
                        className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-primary-700 font-mono">
                              {trf.transactionId} • {trf.medicineName}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {trf.senderHospital} ➔ {trf.receiverHospital}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {trf.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Search verified CDSCO inter-hospital records</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;

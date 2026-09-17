import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  FileText, 
  Edit3, 
  Save, 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Mail, 
  Eye, 
  Download, 
  CheckCircle2, 
  Clock, 
  Search, 
  ArrowLeft, 
  ShoppingBag, 
  Boxes,
  ArrowLeftRight,
  AlertCircle,
  ExternalLink,
  Ban,
  RotateCcw,
  Check,
  X
} from 'lucide-react';
import { 
  fetchHospitals, 
  updateHospitalDetailsAction,
  suspendHospitalAction, 
  reactivateHospitalAction
} from '../../store/slices/adminSlice';
import StatusBadge from '../../components/common/StatusBadge';
import DocumentViewerModal from '../../components/common/DocumentViewerModal';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getStoredItem, getHospitalDocumentChecklist, MANDATORY_DOCUMENTS, KEYS } from '../../services/storage';
import toast from 'react-hot-toast';

export const AdminHospitalDetails = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { hospitals, isLoading } = useSelector((state) => state.admin);
  const [searchParams] = useSearchParams();

  const [selectedHospId, setSelectedHospId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  // Administrative Suspension Modals
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');

  // Active view tab
  const [activeTab, setActiveTab] = useState('all_sections'); // 'all_sections' | 'info' | 'documents' | 'inventory' | 'trading'

  const [editFormData, setEditFormData] = useState({
    name: '',
    registrationNo: '',
    authorizedPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    dispatch(fetchHospitals());
  }, [dispatch]);

  // DERIVE APPROVED HOSPITALS ONLY (Req: Separate Approved Hospitals from Verification)
  // This directory view must show ONLY hospitals that have already been approved by an Admin.
  const approvedHospitals = useMemo(() => {
    return hospitals.filter((h) => h.status === 'verified' || h.status === 'approved');
  }, [hospitals]);

  useEffect(() => {
    if (approvedHospitals.length === 0) return;
    const requestedHospitalId = searchParams.get('hospitalId');
    if (requestedHospitalId && approvedHospitals.some((hospital) => hospital.id === requestedHospitalId)) {
      setSelectedHospId(requestedHospitalId);
    } else if (!selectedHospId || !approvedHospitals.some((h) => h.id === selectedHospId)) {
      setSelectedHospId(approvedHospitals[0].id);
    }
  }, [approvedHospitals, searchParams, selectedHospId]);

  const selectedHospital = approvedHospitals.find((h) => h.id === selectedHospId) || approvedHospitals[0];
  const filteredHospitals = approvedHospitals.filter((hospital) =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (selectedHospital) {
      setEditFormData({
        name: selectedHospital.name || '',
        registrationNo: selectedHospital.registrationNo || '',
        authorizedPerson: selectedHospital.authorizedPerson || '',
        email: selectedHospital.email || '',
        phone: selectedHospital.phone || '',
        address: selectedHospital.address || '',
        city: selectedHospital.city || '',
        state: selectedHospital.state || '',
        pincode: selectedHospital.pincode || '',
      });
      setIsEditing(false);
    }
  }, [selectedHospital]);

  // Read actual live marketplace inventory & trade requests from storage
  const allRequests = getStoredItem(KEYS.REQUESTS, []);
  const allMedicines = getStoredItem(KEYS.MEDICINES, []);

  // SECTION C: MEDICINES LISTED (Req 4)
  const hospitalMedicines = useMemo(() => {
    if (!selectedHospital?.id) return [];
    return allMedicines.filter((m) => m.hospitalId === selectedHospital.id);
  }, [allMedicines, selectedHospital?.id]);

  const medicineListingsCount = hospitalMedicines.length;
  const totalListedUnits = hospitalMedicines.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);

  // SECTION D: TRADING ACTIVITY (Req 5)
  const hospitalPurchases = useMemo(() => {
    if (!selectedHospital?.id) return [];
    return allRequests.filter((r) => r.fromHospitalId === selectedHospital.id);
  }, [allRequests, selectedHospital?.id]);

  const hospitalSales = useMemo(() => {
    if (!selectedHospital?.id) return [];
    return allRequests.filter((r) => r.toHospitalId === selectedHospital.id);
  }, [allRequests, selectedHospital?.id]);

  const purchasesCount = hospitalPurchases.length;
  const salesCount = hospitalSales.length;
  const totalTradesCount = purchasesCount + salesCount;

  const purchasedUnits = hospitalPurchases.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  const soldUnits = hospitalSales.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);

  const purchasePercent = totalTradesCount > 0 ? Math.round((purchasesCount / totalTradesCount) * 100) : 0;
  const salesPercent = totalTradesCount > 0 ? (100 - purchasePercent) : 0;

  // SECTION B: SUBMITTED DOCUMENTS (Req 3)
  const submittedDocsChecklist = useMemo(() => {
    return getHospitalDocumentChecklist(selectedHospital?.documents || []);
  }, [selectedHospital?.documents]);

  // Handlers
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateHospitalDetailsAction({
        hospitalId: selectedHospital.id,
        data: editFormData
      })).unwrap();
      setIsEditing(false);
      toast.success(`Updated registration details for ${editFormData.name}`);
    } catch (err) {
      toast.error('Failed to update hospital details');
    }
  };

  const handleSuspendConfirm = async (e) => {
    e.preventDefault();
    if (!selectedHospital || !suspensionReason.trim()) return;
    try {
      await dispatch(suspendHospitalAction({
        hospitalId: selectedHospital.id,
        reason: suspensionReason.trim()
      })).unwrap();
      toast.success(`${selectedHospital.name} has been suspended from trading`);
      setShowSuspendModal(false);
      setSuspensionReason('');
    } catch (err) {
      toast.error('Failed to suspend hospital');
    }
  };

  const handleReactivate = async () => {
    if (!selectedHospital) return;
    try {
      await dispatch(reactivateHospitalAction(selectedHospital.id)).unwrap();
      toast.success(`${selectedHospital.name} trading privileges reactivated`);
    } catch (err) {
      toast.error('Failed to reactivate hospital');
    }
  };

  if (isLoading && hospitals.length === 0) {
    return <LoadingSpinner text="Fetching hospital registry dossier..." />;
  }

  if (!selectedHospital) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <Building2 className="w-10 h-10 mx-auto text-slate-400 mb-2" />
        <h3 className="font-bold text-slate-800">No approved hospital selected</h3>
        <p className="text-xs text-slate-500 mt-1">
          This directory lists approved hospitals in the MedEx network. New registrations awaiting verification are managed in Hospital Verification.
        </p>
        <button
          onClick={() => navigate('/admin/hospitals')}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Hospitals Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. TOP NAVIGATION & HOSPITAL SWITCHER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => navigate('/admin/hospitals')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>Back to Hospitals Directory</span>
        </button>

        {/* Quick Hospital Switcher (Approved Hospitals Only) */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find approved hospital..."
              className="w-full sm:w-44 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>
          <select
            value={selectedHospId}
            onChange={(e) => {
              setSelectedHospId(e.target.value);
              navigate(`/admin/hospital-details?hospitalId=${encodeURIComponent(e.target.value)}`);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[220px] truncate"
          >
            {filteredHospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.city || 'India'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. INSTITUTIONAL APPROVED STATUS CONTEXT BANNER */}
      <div className="p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all bg-emerald-50/70 border-emerald-200">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              <span>Approved Hospital</span>
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              Registration ID: <strong className="text-slate-800">{selectedHospital.registrationNo}</strong>
            </span>
            <span className="text-xs text-slate-500">• Approved: <strong className="text-slate-700">{selectedHospital.verifiedDate || selectedHospital.registeredDate || 'Verified'}</strong></span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{selectedHospital.name}</span>
          </h1>

          <p className="text-xs text-emerald-800 font-medium">
            Accredited network facility with verified statutory documentation and active trading access on MedEx.
          </p>
        </div>

        {/* Action Controls: Operational suspension if needed (NO Approve/Reject controls!) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedHospital.status === 'verified' && (
            <button
              onClick={() => setShowSuspendModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200 transition-all"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend Trading</span>
            </button>
          )}

          {selectedHospital.status === 'suspended' && (
            <button
              onClick={handleReactivate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reactivate Facility</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. SECTION NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { key: 'all_sections', label: 'All Sections' },
          { key: 'info', label: 'Hospital Information' },
          { key: 'documents', label: `Submitted Documents (${selectedHospital.documents?.length || 0})` },
          { key: 'inventory', label: `Medicines Listed (${medicineListingsCount})` },
          { key: 'trading', label: `Trading Activity (${totalTradesCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">

        {/* ============================================================ */}
        {/* SECTION A — HOSPITAL INFORMATION (Req 2)                      */}
        {/* ============================================================ */}
        {(activeTab === 'all_sections' || activeTab === 'info') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">SECTION A — HOSPITAL INFORMATION</h3>
                  <p className="text-[11px] text-slate-400">Actual registration details submitted during institutional enrollment</p>
                </div>
              </div>

              <div>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-primary-600" />
                    <span>Edit Information</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveInfo} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hospital Name</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Registration Number / ID</label>
                    <input
                      type="text"
                      value={editFormData.registrationNo}
                      onChange={(e) => setEditFormData({ ...editFormData, registrationNo: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Person (Authorized Signatory)</label>
                    <input
                      type="text"
                      value={editFormData.authorizedPerson}
                      onChange={(e) => setEditFormData({ ...editFormData, authorizedPerson: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={editFormData.state}
                      onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">PIN / ZIP Code</label>
                    <input
                      type="text"
                      value={editFormData.pincode}
                      onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Information</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hospital Name</span>
                  <p className="font-bold text-slate-900 text-sm">{selectedHospital.name}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registration Number / ID</span>
                  <p className="font-mono font-bold text-primary-800 text-sm">{selectedHospital.registrationNo || 'REG-PENDING'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Network Status</span>
                  <div className="pt-0.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>✓ Approved Hospital</span>
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approval Date</span>
                  <p className="font-mono font-semibold text-slate-800 text-xs">
                    {selectedHospital.verifiedDate || selectedHospital.registeredDate || 'Verified'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Person</span>
                  <p className="font-semibold text-slate-800">{selectedHospital.authorizedPerson || 'Not specified'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Email</span>
                  <p className="font-mono text-slate-800">{selectedHospital.email || 'None'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Phone</span>
                  <p className="font-mono text-slate-800">{selectedHospital.phone || 'None'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Address</span>
                  <p className="text-slate-800">{selectedHospital.address || `${selectedHospital.city}, ${selectedHospital.state}`}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">City / State / PIN</span>
                  <p className="font-semibold text-slate-800">
                    {selectedHospital.city || '—'}, {selectedHospital.state || '—'} {selectedHospital.pincode ? `• PIN: ${selectedHospital.pincode}` : ''}
                  </p>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION B — SUBMITTED DOCUMENTS (Req 3)                       */}
        {/* ============================================================ */}
        {(activeTab === 'all_sections' || activeTab === 'documents') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">SECTION B — SUBMITTED DOCUMENTS</h3>
                  <p className="text-[11px] text-slate-400">
                    Exact documents submitted during hospital registration • Preserved registration document metadata
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl shrink-0">
                {submittedDocsChecklist.submittedCount} of {submittedDocsChecklist.totalRequired} Mandatory Documents Submitted
              </span>
            </div>

            {/* Document Checklist Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submittedDocsChecklist.items.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    doc.isSubmitted
                      ? 'bg-white border-slate-200 hover:border-primary-300 shadow-sm'
                      : 'bg-rose-50/30 border-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        {doc.documentType} {doc.required && <span className="text-rose-500 font-bold">*Mandatory</span>}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {doc.label}
                      </h4>
                      {doc.isSubmitted ? (
                        <span className="text-[10px] text-slate-500 font-mono block truncate">
                          File: {doc.documentName || doc.name} • {doc.size || '2.4 MB'} • Submitted: {doc.uploadedAt || selectedHospital.registeredDate || '2024-01-15'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-600 font-medium block">
                          Mandatory registration document was not submitted by hospital
                        </span>
                      )}
                    </div>

                    {/* Status Badge: Submitted vs Not submitted */}
                    <div className="shrink-0">
                      {doc.isSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertCircle className="w-3 h-3" />
                          Not submitted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    {doc.isSubmitted ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewerDoc(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 font-bold hover:bg-primary-100 transition-colors text-[11px]"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview Document</span>
                        </button>
                        <button
                          onClick={() => toast.success(`Simulating download of ${doc.documentName || doc.name}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-rose-600 italic font-medium">
                        Document not provided
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-mono">
                      {doc.isSubmitted ? 'Statutory Filing' : 'Missing'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION C — MEDICINES LISTED (Req 4)                          */}
        {/* ============================================================ */}
        {(activeTab === 'all_sections' || activeTab === 'inventory') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">SECTION C — MEDICINES LISTED</h3>
                  <p className="text-[11px] text-slate-400">Current marketplace inventory listings registered by this hospital</p>
                </div>
              </div>

              {/* Summary Badges Separating Listings Count vs Physical Quantity (Req 4) */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-xl">
                  {medicineListingsCount} {medicineListingsCount === 1 ? 'medicine listing' : 'medicine listings'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl">
                  {totalListedUnits.toLocaleString('en-IN')} total units listed
                </span>
              </div>
            </div>

            {/* Inventory Table */}
            {hospitalMedicines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Medicine Formulation</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Dosage / Form</th>
                      <th className="py-2.5 px-3">Batch No</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3 text-right">Listed Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {hospitalMedicines.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{med.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{med.id}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{med.category || 'Therapeutics'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{med.dosage || med.form || 'Tablet'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">{med.batchNumber || med.batchNo || 'BATCH-2024'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{med.expiryDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {med.quantity} units
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-primary-800">
                          ₹{med.concessionRate || med.unitPrice || med.mrp || 100}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded-xl text-slate-500 text-xs">
                <Boxes className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                <p className="font-bold">0 medicine listings</p>
                <p className="text-[11px] text-slate-400">This hospital has not listed any medicines in the MedEx marketplace yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION D — TRADING ACTIVITY (Req 5)                         */}
        {/* ============================================================ */}
        {(activeTab === 'all_sections' || activeTab === 'trading') && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">SECTION D — TRADING ACTIVITY</h3>
                  <p className="text-[11px] text-slate-400">
                    Trade Volume Distribution: Purchases / Received versus Sales / Sent transactions through MedEx
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                {totalTradesCount} Total Trade Transactions
              </div>
            </div>

            {/* Horizontal Proportional Distribution Bar (Req 5) */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                  Trade Volume Distribution
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Calculated from verified purchase & sales orders
                </span>
              </div>

              {totalTradesCount > 0 ? (
                <div className="space-y-2">
                  {/* Proportional horizontal bar */}
                  <div className="w-full h-5 rounded-full overflow-hidden bg-slate-200 flex shadow-inner">
                    {purchasePercent > 0 && (
                      <div
                        style={{ width: `${purchasePercent}%` }}
                        className="h-full bg-teal-600 transition-all flex items-center justify-center text-[10px] font-mono font-extrabold text-white px-1"
                        title={`Purchases: ${purchasePercent}% (${purchasesCount} orders)`}
                      >
                        {purchasePercent >= 15 ? `${purchasePercent}%` : ''}
                      </div>
                    )}
                    {salesPercent > 0 && (
                      <div
                        style={{ width: `${salesPercent}%` }}
                        className="h-full bg-rose-600 transition-all flex items-center justify-center text-[10px] font-mono font-extrabold text-white px-1"
                        title={`Sales: ${salesPercent}% (${salesCount} orders)`}
                      >
                        {salesPercent >= 15 ? `${salesPercent}%` : ''}
                      </div>
                    )}
                  </div>

                  {/* Legend & Absolute Numbers (Req 5) */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-teal-600 shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">Purchases: </span>
                        <strong className="text-teal-700 font-mono">{purchasePercent}%</strong>
                        <span className="text-slate-500 text-[11px] ml-1.5">
                          ({purchasesCount} {purchasesCount === 1 ? 'transaction' : 'transactions'}{purchasedUnits > 0 ? ` • ${purchasedUnits.toLocaleString('en-IN')} units` : ''})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">Sales: </span>
                        <strong className="text-rose-700 font-mono">{salesPercent}%</strong>
                        <span className="text-slate-500 text-[11px] ml-1.5">
                          ({salesCount} {salesCount === 1 ? 'transaction' : 'transactions'}{soldUnits > 0 ? ` • ${soldUnits.toLocaleString('en-IN')} units` : ''})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs font-medium space-y-2">
                  <div className="w-full max-w-xs mx-auto h-2 rounded-full bg-slate-200/90 overflow-hidden" />
                  <p>No Trading Activity — 0 transactions recorded</p>
                </div>
              )}
            </div>

            {/* Recent Trade Orders List */}
            {totalTradesCount > 0 && (
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">Recent Transactions Ledger</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{totalTradesCount} Recorded Orders</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2.5">Order ID</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Medicine Formulation</th>
                        <th className="px-3 py-2.5">Trading Partner</th>
                        <th className="px-3 py-2.5 text-right">Quantity</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {[...hospitalPurchases, ...hospitalSales]
                        .sort((a, b) => new Date(b.requestDate || 0) - new Date(a.requestDate || 0))
                        .slice(0, 8)
                        .map((ord) => {
                          const isPurchase = ord.fromHospitalId === selectedHospital.id;
                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/70">
                              <td className="px-3 py-2.5 font-mono font-bold text-primary-800">{ord.id}</td>
                              <td className="px-3 py-2.5">
                                {isPurchase ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                    Purchase
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Sale
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-900">{ord.medicineName}</td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {isPurchase ? `From: ${ord.toHospitalName}` : `To: ${ord.fromHospitalName}`}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">{ord.quantity} units</td>
                              <td className="px-3 py-2.5 text-center">
                                <StatusBadge status={ord.status} className="!text-[10px] !px-2 !py-0.5" />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* SUSPEND OPERATIONS MODAL */}
      {showSuspendModal && (
        <Modal
          isOpen={showSuspendModal}
          onClose={() => { setShowSuspendModal(false); setSuspensionReason(''); }}
          title={`Suspend Operations: ${selectedHospital?.name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSuspendConfirm} className="space-y-4 pt-1">
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 leading-relaxed">
              Suspension halts this facility's trading privileges, pauses active listings, and blocks peer order fulfillment.
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Operational Suspension <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                required
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g. Audit inquiry pending, Form 20B permit renewal delay..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowSuspendModal(false); setSuspensionReason(''); }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!suspensionReason.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50"
              >
                Confirm Suspension
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DOCUMENT VIEWER MODAL */}
      {viewerDoc && (
        <DocumentViewerModal
          isOpen={!!viewerDoc}
          onClose={() => setViewerDoc(null)}
          document={viewerDoc}
          hospitalName={selectedHospital?.name}
        />
      )}

    </div>
  );
};

export default AdminHospitalDetails;

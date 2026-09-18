import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  FileCheck2, 
  Check, 
  X, 
  Building2, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Eye,
  Search,
  Clock,
  ExternalLink,
  Download,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  Filter
} from 'lucide-react';
import { 
  fetchHospitals, 
  verifyHospitalAction, 
  rejectHospitalAction,
  setReviewStatusAction,
  updateDocumentReviewStatusAction
} from '../../store/slices/adminSlice';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import DocumentViewerModal from '../../components/common/DocumentViewerModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getStoredItem, getHospitalDocumentChecklist, MANDATORY_DOCUMENTS, KEYS } from '../../services/storage';
import toast from 'react-hot-toast';

/**
 * Normalizes hospital status across case variations and synonyms.
 * Supported: pending, pending_approval, under_review, approved, verified, rejected.
 */
export const normalizeHospitalStatus = (status) => {
  const s = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'pending' || s === 'pending_approval' || s === 'documents_missing') {
    return 'pending';
  }
  if (s === 'under_review') {
    return 'under_review';
  }
  if (s === 'verified' || s === 'approved') {
    return 'verified';
  }
  if (s === 'rejected') {
    return 'rejected';
  }
  return s;
};

export const matchesHospitalTab = (hospital, tab) => {
  if (tab === 'all') return true;
  const norm = normalizeHospitalStatus(hospital?.status);
  const targetTab = (tab === 'approved' || tab === 'verified') ? 'verified' : tab;
  return norm === targetTab;
};

export const getTabFromParam = (param) => {
  if (!param) return null;
  const p = String(param).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (p === 'approved' || p === 'verified') return 'approved';
  if (p === 'pending' || p === 'pending_approval') return 'pending';
  if (p === 'under_review') return 'under_review';
  if (p === 'rejected') return 'rejected';
  if (p === 'all') return 'all';
  return null;
};

export const AdminVerification = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { hospitals, isLoading } = useSelector((state) => state.admin);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const processedRef = useRef(false);
  const queueSectionRef = useRef(null);

  // Tabs: 'pending' (default) | 'under_review' | 'approved' | 'rejected' | 'all'
  const [activeTab, setActiveTab] = useState(() => {
    const fromUrl = getTabFromParam(searchParams.get('tab') || searchParams.get('status'));
    return fromUrl || 'pending';
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Synchronize activeTab if searchParams changes externally
  useEffect(() => {
    const fromUrl = getTabFromParam(searchParams.get('tab') || searchParams.get('status'));
    if (fromUrl && fromUrl !== activeTab) {
      setActiveTab(fromUrl);
    }
  }, [searchParams]);

  // Unified tab selection handler for both summary cards and queue filter dropdown
  const handleSelectTab = (newTab, shouldScroll = false) => {
    let targetTab = newTab;
    if (newTab === 'verified' || newTab === 'approved') targetTab = 'approved';
    if (newTab === 'pending_approval') targetTab = 'pending';
    setActiveTab(targetTab);

    try {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', targetTab);
      nextParams.delete('status');
      setSearchParams(nextParams, { replace: true });
    } catch (e) {
      console.warn('Failed to update URL tab param', e);
    }

    if (shouldScroll && queueSectionRef.current) {
      queueSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Review Modal State (Req 8)
  const [activeReviewHospital, setActiveReviewHospital] = useState(null);
  const [reviewNoteInput, setReviewNoteInput] = useState('');

  // Document Viewer Preview Modal (Req 9, 21)
  const [viewerDoc, setViewerDoc] = useState(null);

  // Approve Confirmation Modal State (Req 10)
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Reject Confirmation Modal State (Req 11)
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState(false);
  const [rejectReasonSelect, setRejectReasonSelect] = useState('Required document missing');
  const [otherExplanation, setOtherExplanation] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    dispatch(fetchHospitals());
  }, [dispatch]);

  // Keep activeReviewHospital synchronized with updated Redux state
  useEffect(() => {
    if (activeReviewHospital) {
      const refreshed = hospitals.find((h) => h.id === activeReviewHospital.id);
      if (refreshed) {
        setActiveReviewHospital(refreshed);
      }
    }
  }, [hospitals]);

  // Deep-link from alerts to exact hospital verification dossier
  useEffect(() => {
    const targetHospId = searchParams.get('hospitalId') || location.state?.alertTarget?.hospitalId;
    if (!targetHospId || hospitals.length === 0 || processedRef.current) return;

    const found = hospitals.find((h) => h.id === targetHospId);
    if (found) {
      processedRef.current = true;
      handleSelectTab('all');
      setActiveReviewHospital(found);
      toast.success(`Opening verification dossier for ${found.name}`, { icon: '📋' });

      try {
        const next = new URLSearchParams(searchParams);
        next.delete('hospitalId');
        setSearchParams(next, { replace: true });
      } catch (e) {
        console.warn(e);
      }
    }
  }, [hospitals, searchParams, location.state]);

  // Summary Metrics (Req 18: Prioritize Pending Reviews) using unified matcher
  const pendingCount = useMemo(() => {
    return hospitals.filter((h) => matchesHospitalTab(h, 'pending')).length;
  }, [hospitals]);

  const underReviewCount = useMemo(() => {
    return hospitals.filter((h) => matchesHospitalTab(h, 'under_review')).length;
  }, [hospitals]);

  const approvedCount = useMemo(() => {
    return hospitals.filter((h) => matchesHospitalTab(h, 'verified')).length;
  }, [hospitals]);

  const rejectedCount = useMemo(() => {
    return hospitals.filter((h) => matchesHospitalTab(h, 'rejected')).length;
  }, [hospitals]);

  // Filtered Hospitals for Current Queue using identical matching logic
  const tabHospitals = useMemo(() => {
    return hospitals.filter((h) => matchesHospitalTab(h, activeTab));
  }, [hospitals, activeTab]);

  const filteredHospitals = useMemo(() => {
    return tabHospitals.filter((h) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        h.name?.toLowerCase().includes(q) ||
        h.city?.toLowerCase().includes(q) ||
        h.state?.toLowerCase().includes(q) ||
        (h.registrationNo && h.registrationNo.toLowerCase().includes(q)) ||
        (h.email && h.email.toLowerCase().includes(q)) ||
        (h.authorizedPerson && h.authorizedPerson.toLowerCase().includes(q))
      );
    });
  }, [tabHospitals, searchTerm]);

  // Open Detailed Review Modal (Req 8)
  const handleOpenReview = (hospital) => {
    setActiveReviewHospital(hospital);
    setReviewNoteInput(hospital.reviewNote || '');
  };

  // Document Status Toggle / Update Handler (Req 9)
  const handleUpdateDocState = async (docId, newState) => {
    if (!activeReviewHospital) return;
    try {
      await dispatch(updateDocumentReviewStatusAction({
        hospitalId: activeReviewHospital.id,
        documentId: docId,
        status: newState,
        note: reviewNoteInput || ''
      })).unwrap();
      toast.success(`Document marked as ${newState.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to update document status');
    }
  };

  // Confirm Approval Flow (Req 10, Req 12)
  const handleConfirmApproval = async () => {
    if (!activeReviewHospital) return;
    setIsApproving(true);
    try {
      if (reviewNoteInput?.trim()) {
        await dispatch(setReviewStatusAction({
          hospitalId: activeReviewHospital.id,
          status: 'verified',
          note: reviewNoteInput.trim()
        })).unwrap();
      }
      await dispatch(verifyHospitalAction(activeReviewHospital.id)).unwrap();
      toast.success(`${activeReviewHospital.name} approved. Portal access and trading credentials activated.`);
      setShowApproveConfirmModal(false);
      setActiveReviewHospital(null);
      setReviewNoteInput('');
    } catch (err) {
      toast.error('Approval failed. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  // Confirm Rejection Flow (Req 11, Req 13)
  const handleConfirmRejection = async (e) => {
    if (e) e.preventDefault();
    if (!activeReviewHospital) return;

    const finalReason = rejectReasonSelect === 'Other'
      ? (otherExplanation?.trim() || 'Registration requirements not satisfied.')
      : rejectReasonSelect;

    setIsRejecting(true);
    try {
      await dispatch(rejectHospitalAction({
        hospitalId: activeReviewHospital.id,
        reason: finalReason
      })).unwrap();
      toast.success(`Application rejected for ${activeReviewHospital.name}`);
      setShowRejectConfirmModal(false);
      setActiveReviewHospital(null);
      setOtherExplanation('');
      setReviewNoteInput('');
    } catch (err) {
      toast.error('Failed to record rejection');
    } finally {
      setIsRejecting(false);
    }
  };

  // Active hospital document checklist calculation
  const reviewDocChecklist = useMemo(() => {
    if (!activeReviewHospital) return null;
    return getHospitalDocumentChecklist(activeReviewHospital.documents || []);
  }, [activeReviewHospital]);

  return (
    <div className="space-y-6">
      
      {/* 1. PAGE HEADER (Req 16: Obvious Purpose & Headings) */}
      <div className="bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <FileCheck2 className="w-3.5 h-3.5 text-teal-400" />
              ADMIN REVIEW WORKFLOW
            </span>
            <span className="text-xs text-slate-400 font-mono">Decision & Accreditation Queue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Review Hospital Registrations</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed">
            Review submitted registration information and documents before approving or rejecting hospital access.
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/30 backdrop-blur-md text-right">
            <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Awaiting Decision</div>
            <div className="text-xl font-black text-white font-mono flex items-center justify-end gap-1.5">
              <span>{pendingCount} Pending</span>
              {pendingCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY METRIC CARDS (Interactive filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Card 1: Pending Reviews */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => handleSelectTab('pending', true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectTab('pending', true);
            }
          }}
          aria-label="Filter by Pending Reviews"
          aria-pressed={activeTab === 'pending'}
          className={`p-5 rounded-2xl relative overflow-hidden cursor-pointer select-none text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/40 ${
            activeTab === 'pending'
              ? 'bg-gradient-to-br from-amber-50 via-white to-white border-2 border-amber-400 shadow-md ring-2 ring-amber-400/30'
              : 'bg-white border-2 border-amber-300 bg-gradient-to-br from-amber-50/40 via-white to-white shadow-sm hover:border-amber-400'
          }`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Reviews</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-200 text-amber-950 uppercase tracking-wider animate-pulse">
                Action Needed
              </span>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              <Clock className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-700 font-mono mt-2">{pendingCount}</div>
          <div className="flex items-center justify-between mt-0.5 gap-2">
            <p className="text-[11px] text-amber-800 font-semibold">
              Applications waiting for admin approval or rejection
            </p>
            {activeTab === 'pending' && (
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider shrink-0 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                Active
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Approved */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => handleSelectTab('approved', true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectTab('approved', true);
            }
          }}
          aria-label="Filter by Approved"
          aria-pressed={activeTab === 'approved' || activeTab === 'verified'}
          className={`p-5 rounded-2xl relative overflow-hidden cursor-pointer select-none text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40 ${
            activeTab === 'approved' || activeTab === 'verified'
              ? 'bg-emerald-50/50 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white border border-slate-200/80 shadow-sm hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              activeTab === 'approved' || activeTab === 'verified' ? 'text-emerald-800' : 'text-slate-400'
            }`}>Approved</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
              activeTab === 'approved' || activeTab === 'verified'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-2">{approvedCount}</div>
          <div className="flex items-center justify-between mt-0.5 gap-2">
            <p className="text-[11px] text-slate-500">Accredited with portal trading privileges</p>
            {(activeTab === 'approved' || activeTab === 'verified') && (
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider shrink-0 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                Active
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Rejected */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => handleSelectTab('rejected', true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectTab('rejected', true);
            }
          }}
          aria-label="Filter by Rejected"
          aria-pressed={activeTab === 'rejected'}
          className={`p-5 rounded-2xl relative overflow-hidden cursor-pointer select-none text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-400/40 ${
            activeTab === 'rejected'
              ? 'bg-rose-50/50 border-2 border-rose-500 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white border border-slate-200/80 shadow-sm hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              activeTab === 'rejected' ? 'text-rose-800' : 'text-slate-400'
            }`}>Rejected</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
              activeTab === 'rejected'
                ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                : 'bg-rose-50 text-rose-700 border-rose-100'
            }`}>
              <X className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono mt-2">{rejectedCount}</div>
          <div className="flex items-center justify-between mt-0.5 gap-2">
            <p className="text-[11px] text-slate-500">Declined access with recorded compliance reason</p>
            {activeTab === 'rejected' && (
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider shrink-0 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                Active
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 3. QUEUE CONTROLS: Status Dropdown Filter & Search */}
      <div 
        ref={queueSectionRef}
        id="verification-queue"
        className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 scroll-mt-6"
      >
        
        {/* Status Dropdown Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <label 
              htmlFor="status-filter-select" 
              className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none"
            >
              <Filter className="w-3.5 h-3.5 text-primary-600" />
              <span>Status:</span>
            </label>
            <div className="relative flex-1 sm:w-64">
              <select
                id="status-filter-select"
                name="status"
                aria-label="Filter applications by status"
                value={activeTab === 'verified' ? 'approved' : activeTab}
                onChange={(e) => handleSelectTab(e.target.value)}
                className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 cursor-pointer transition-all"
              >
                <option value="pending">Pending Approval ({pendingCount})</option>
                <option value="under_review">Under Review ({underReviewCount})</option>
                <option value="approved">Approved ({approvedCount})</option>
                <option value="rejected">Rejected ({rejectedCount})</option>
                <option value="all">All ({hospitals.length})</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Active Status Badge indicator */}
          <div className="hidden lg:flex items-center">
            {activeTab === 'pending' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>{pendingCount} Awaiting Review</span>
              </span>
            )}
            {activeTab === 'under_review' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                <FileText className="w-3 h-3 text-cyan-600" />
                <span>{underReviewCount} Under Review</span>
              </span>
            )}
            {(activeTab === 'approved' || activeTab === 'verified') && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{approvedCount} Approved</span>
              </span>
            )}
            {activeTab === 'rejected' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                <X className="w-3 h-3 text-rose-600" />
                <span>{rejectedCount} Rejected</span>
              </span>
            )}
            {activeTab === 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <span>{hospitals.length} Total Registrations</span>
              </span>
            )}
          </div>
        </div>

        {/* Search Bar for Verification Queue */}
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="hospital-queue-search"
            aria-label="Search applications"
            placeholder="Search applications, hospital, city, reg ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 font-medium transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* 4. VERIFICATION QUEUE LIST (Req 7, Req 20) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading && hospitals.length === 0 ? (
          <div className="py-16">
            <LoadingSpinner text="Loading verification audit queue..." />
          </div>
        ) : filteredHospitals.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredHospitals.map((hosp) => {
              const checklist = getHospitalDocumentChecklist(hosp.documents || []);
              const submittedCount = checklist.submittedCount || (hosp.documents?.length || 0);
              const isHospPending = matchesHospitalTab(hosp, 'pending');

              return (
                <div
                  key={hosp.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-primary-700 transition-colors">
                        {hosp.name}
                      </h3>
                      <StatusBadge status={hosp.status} className="!text-[10px] !px-2.5 !py-0.5" />
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                      <span className="font-mono font-bold text-primary-800 bg-primary-50 px-2 py-0.5 rounded border border-primary-200/60 text-[11px]">
                        Registration: {hosp.registrationNo || 'REG-PENDING'}
                      </span>
                      <span>
                        Submitted: <strong className="text-slate-700 font-mono">{hosp.registeredDate || hosp.registrationDate || '2024-01-15'}</strong>
                      </span>
                      <span>
                        Location: <strong className="text-slate-700">{hosp.city || 'India'}, {hosp.state || ''}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        <span>Documents: <strong>{submittedCount} submitted</strong></span>
                      </span>

                      {!checklist.isComplete && isHospPending && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Missing: {checklist.missingItems.map((m) => m.label).join(', ')}
                        </span>
                      )}

                      {hosp.reviewNote && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded">
                          Note: {hosp.reviewNote}
                        </span>
                      )}

                      {hosp.rejectionReason && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Rejection: {hosp.rejectionReason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Review Action Button (Req 7) */}
                  <div className="shrink-0 w-full sm:w-auto flex items-center justify-end">
                    <button
                      onClick={() => handleOpenReview(hosp)}
                      className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${
                        isHospPending
                          ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-14 text-center text-slate-400">
            <FileCheck2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-slate-700 text-sm">
              No applications in the {activeTab === 'verified' || activeTab === 'approved' ? 'approved' : activeTab.replace('_', ' ')} queue
            </p>
            <p className="text-xs text-slate-400 mt-1">Select a different status filter or clear your search query.</p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. VERIFICATION REVIEW SCREEN / MODAL (Req 8, Req 9, Req 10)  */}
      {/* ============================================================ */}
      {activeReviewHospital && (
        <Modal
          isOpen={!!activeReviewHospital}
          onClose={() => {
            setActiveReviewHospital(null);
            setReviewNoteInput('');
          }}
          title={`Hospital Verification Review: ${activeReviewHospital.name}`}
          subtitle={`Registration ID: ${activeReviewHospital.registrationNo || 'REG-PENDING'} • Submitted: ${activeReviewHospital.registeredDate || '2024-01-15'}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 pt-1 max-h-[75vh] overflow-y-auto pr-1">
            
            {/* Context Header */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{activeReviewHospital.name}</span>
                  <StatusBadge status={activeReviewHospital.status} />
                </div>
                <p className="text-slate-500">
                  {activeReviewHospital.city || '—'}, {activeReviewHospital.state || '—'} {activeReviewHospital.pincode ? `(${activeReviewHospital.pincode})` : ''}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Dossier Status</span>
                <span className="font-mono font-bold text-slate-800">
                  {reviewDocChecklist?.submittedCount || 0} of {reviewDocChecklist?.totalRequired || 4} Mandatory Filings
                </span>
              </div>
            </div>

            {/* A. Hospital Registration Information (Req 8A) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary-600" />
                <span>A. Hospital Registration Information</span>
              </h4>

              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Hospital Name</span>
                  <strong className="text-slate-900">{activeReviewHospital.name}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Registration ID</span>
                  <strong className="text-primary-800 font-mono">{activeReviewHospital.registrationNo || 'REG-PENDING'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Authorized Person</span>
                  <span className="text-slate-800 font-medium">{activeReviewHospital.authorizedPerson || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Official Email</span>
                  <span className="text-slate-800 font-mono">{activeReviewHospital.email || 'None'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Phone Number</span>
                  <span className="text-slate-800 font-mono">{activeReviewHospital.phone || 'None'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Registration Date</span>
                  <span className="text-slate-800 font-mono">{activeReviewHospital.registeredDate || '2024-01-15'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Physical Address</span>
                  <span className="text-slate-800">{activeReviewHospital.address || `${activeReviewHospital.city}, ${activeReviewHospital.state}`}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Region / PIN</span>
                  <span className="text-slate-800">{activeReviewHospital.city}, {activeReviewHospital.state} {activeReviewHospital.pincode || ''}</span>
                </div>
              </div>
            </div>

            {/* B & C. EXACT Submitted Documents & Document Review (Req 8B, Req 9) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>B. Submitted Statutory Documents Dossier</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Inspect exact files submitted during signup
                </span>
              </div>

              {/* Dossier Alert */}
              {reviewDocChecklist && !reviewDocChecklist.isComplete && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Missing required document(s): <strong>{reviewDocChecklist.missingItems.map((m) => m.label).join(', ')}</strong>. Review carefully before granting approval.
                  </span>
                </div>
              )}

              {/* Document Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {reviewDocChecklist?.items.map((doc) => {
                  const docStatus = (doc.documentStatus || doc.status || 'submitted').toUpperCase();

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        doc.isSubmitted
                          ? 'bg-white border-slate-200 shadow-sm'
                          : 'bg-rose-50/30 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            {doc.documentType} {doc.required && <span className="text-rose-500">*Compulsory</span>}
                          </span>
                          <h5 className="text-xs font-bold text-slate-900 leading-tight">
                            {doc.label}
                          </h5>
                          {doc.isSubmitted ? (
                            <span className="text-[10px] text-slate-500 font-mono block truncate">
                              File: {doc.documentName || doc.name} • {doc.size || '2.4 MB'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-600 font-medium block">
                              Required document not submitted by hospital
                            </span>
                          )}
                        </div>

                        {/* Document State Badge (Req 9: SUBMITTED, UNDER REVIEW, ACCEPTED, REQUIRES ATTENTION) */}
                        <div className="shrink-0">
                          {doc.isSubmitted ? (
                            docStatus.includes('ACCEPT') || docStatus.includes('VERIFIED') ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                ACCEPTED
                              </span>
                            ) : docStatus.includes('ATTENTION') || docStatus.includes('REJECT') ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertTriangle className="w-3 h-3" />
                                REQUIRES ATTENTION
                              </span>
                            ) : docStatus.includes('REVIEW') ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Clock className="w-3 h-3" />
                                UNDER REVIEW
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                SUBMITTED
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3" />
                              NOT SUBMITTED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Document Actions & Review State Controls (Req 9) */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        {doc.isSubmitted ? (
                          <>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setViewerDoc(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold transition-colors text-[11px]"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview Document</span>
                              </button>
                              <button
                                onClick={() => toast.success(`Simulating download: ${doc.documentName || doc.name}`)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold transition-colors text-[11px]"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            </div>

                            {/* State Selection Dropdown for Individual Document */}
                            <select
                              value={doc.documentStatus || 'submitted'}
                              onChange={(e) => handleUpdateDocState(doc.id, e.target.value)}
                              className="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              title="Update document audit state"
                            >
                              <option value="submitted">SUBMITTED</option>
                              <option value="under_review">UNDER REVIEW</option>
                              <option value="accepted">ACCEPTED</option>
                              <option value="requires_attention">REQUIRES ATTENTION</option>
                            </select>
                          </>
                        ) : (
                          <span className="text-[11px] text-rose-600 italic font-medium">
                            Compulsory document missing from registration filing
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* D. Verification Notes & Audit Remarks (Req 8E) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
                <span>C. Auditor Review Notes & Compliance Remarks</span>
              </h4>

              <textarea
                rows="2"
                placeholder="Enter auditor verification notes or compliance observations (optional)..."
                value={reviewNoteInput}
                onChange={(e) => setReviewNoteInput(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            {/* E. Distinct Approve / Reject Actions (Req 10, Req 11) */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Decision for: <strong className="text-slate-800">{activeReviewHospital.name}</strong>
              </div>

              <div className="flex items-center gap-3">
                {/* Distinct REJECT HOSPITAL Button (Req 10, 11) */}
                <button
                  type="button"
                  onClick={() => setShowRejectConfirmModal(true)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-rose-600 text-rose-700 hover:bg-rose-50 font-bold text-xs shadow-sm transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>REJECT HOSPITAL</span>
                </button>

                {/* Distinct APPROVE HOSPITAL Button (Req 10) */}
                <button
                  type="button"
                  onClick={() => setShowApproveConfirmModal(true)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>APPROVE HOSPITAL</span>
                </button>
              </div>
            </div>

          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* 6. APPROVAL CONFIRMATION MODAL (Req 10)                      */}
      {/* ============================================================ */}
      {showApproveConfirmModal && activeReviewHospital && (
        <Modal
          isOpen={showApproveConfirmModal}
          onClose={() => setShowApproveConfirmModal(false)}
          title="Approve Hospital?"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2 text-emerald-950">
              <p className="font-medium text-slate-700">You are approving:</p>
              <div className="font-extrabold text-base text-slate-900">
                {activeReviewHospital.name}
              </div>
              <div className="font-mono text-xs text-emerald-800">
                Registration ID: <strong className="text-slate-900">{activeReviewHospital.registrationNo}</strong>
              </div>
              <p className="text-[11px] text-emerald-900 pt-1 leading-relaxed border-t border-emerald-200/80">
                The hospital will be allowed to access the hospital portal after approval.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isApproving}
                onClick={() => setShowApproveConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleConfirmApproval}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isApproving ? 'Approving...' : 'Confirm Approval'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* 7. REJECTION CONFIRMATION MODAL (Req 11)                     */}
      {/* ============================================================ */}
      {showRejectConfirmModal && activeReviewHospital && (
        <Modal
          isOpen={showRejectConfirmModal}
          onClose={() => {
            setShowRejectConfirmModal(false);
            setOtherExplanation('');
          }}
          title="Reject Hospital Registration?"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmRejection} className="space-y-4 pt-1 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hospital</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{activeReviewHospital.name}</strong>
              <span className="text-[11px] font-mono text-slate-500">Reg ID: {activeReviewHospital.registrationNo}</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Reason for rejection: <span className="text-rose-500">*</span>
              </label>
              <select
                value={rejectReasonSelect}
                onChange={(e) => setRejectReasonSelect(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-rose-500"
              >
                <option value="Required document missing">Required document missing</option>
                <option value="Invalid/incomplete registration information">Invalid/incomplete registration information</option>
                <option value="Document requires clarification">Document requires clarification</option>
                <option value="Verification requirements not met">Verification requirements not met</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {rejectReasonSelect === 'Other' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Explanation: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Provide brief explanation for rejection..."
                  value={otherExplanation}
                  onChange={(e) => setOtherExplanation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => {
                  setShowRejectConfirmModal(false);
                  setOtherExplanation('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRejecting || (rejectReasonSelect === 'Other' && !otherExplanation.trim())}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* 8. SAMPLE / PROTOTYPE DOCUMENT VIEWER MODAL (Req 9, Req 21) */}
      {/* ============================================================ */}
      {viewerDoc && (
        <DocumentViewerModal
          isOpen={!!viewerDoc}
          onClose={() => setViewerDoc(null)}
          document={viewerDoc}
          hospitalName={activeReviewHospital?.name}
        />
      )}

    </div>
  );
};

export default AdminVerification;

import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  MessageSquare, 
  Star, 
  Search, 
  Building2, 
  Send,
  CheckCircle2,
  Award,
  ShieldCheck,
  Eye,
  Clock,
  Filter,
  Check,
  RotateCcw,
  Tag,
  X
} from 'lucide-react';
import { fetchAdminFeedbacks, replyAdminFeedback } from '../../store/slices/adminSlice';
import { adminService } from '../../services/adminService';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const FEEDBACK_CATEGORIES = [
  'Medicine Availability',
  'Order / Delivery',
  'Inventory',
  'Website / System',
  'Support',
  'Other'
];

export const AdminFeedback = () => {
  const dispatch = useDispatch();
  const { feedbacks, isLoading } = useSelector((state) => state.admin);

  // Filters state
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'new' | 'under_review' | 'resolved'
  const [ratingFilter, setRatingFilter] = useState('all'); // 'all' | '5' | '4' | '3' | '2' | '1'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Feedback Detail View Modal
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  useEffect(() => {
    dispatch(fetchAdminFeedbacks('all'));
  }, [dispatch]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = feedbacks.length;
    const newCount = feedbacks.filter((f) => !f.status || f.status === 'new').length;
    const underReviewCount = feedbacks.filter((f) => f.status === 'under_review').length;
    const resolvedCount = feedbacks.filter((f) => f.status === 'resolved').length;
    const avgRating = total > 0
      ? (feedbacks.reduce((acc, f) => acc + Number(f.rating || 5), 0) / total).toFixed(1)
      : '4.8';

    return {
      total,
      new: newCount,
      underReview: underReviewCount,
      resolved: resolvedCount,
      averageRating: avgRating,
    };
  }, [feedbacks]);

  // Filtered feedbacks
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      // 1. Status Filter
      const fbStatus = fb.status || 'new';
      const matchesStatus = statusFilter === 'all' || fbStatus.toLowerCase() === statusFilter.toLowerCase();

      // 2. Rating Filter
      const matchesRating = ratingFilter === 'all' || Number(fb.rating) === Number(ratingFilter);

      // 3. Category Filter
      const matchesCategory = categoryFilter === 'all' || fb.category === categoryFilter;

      // 4. Search Filter
      const hosp = (fb.hospitalName || '').toLowerCase();
      const text = (fb.feedbackText || fb.comment || '').toLowerCase();
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || hosp.includes(q) || text.includes(q);

      return matchesStatus && matchesRating && matchesCategory && matchesSearch;
    });
  }, [feedbacks, statusFilter, ratingFilter, categoryFilter, searchTerm]);

  // Open detail view
  const handleOpenDetails = (fb) => {
    setSelectedFeedback(fb);
    setReplyText(fb.adminReply || '');
  };

  // Status transitions
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedFeedback) return;
    try {
      await adminService.updateFeedbackStatus(selectedFeedback.id, newStatus);
      toast.success(`Feedback status updated to ${newStatus.replace('_', ' ')}`);
      
      // Update local state
      setSelectedFeedback((prev) => ({ ...prev, status: newStatus }));
      dispatch(fetchAdminFeedbacks('all'));
    } catch (err) {
      toast.error(err?.message || err || 'Failed to update feedback status');
    }
  };

  // Send admin reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedFeedback || !replyText.trim()) return;

    setIsSubmittingReply(true);
    try {
      await dispatch(replyAdminFeedback({ id: selectedFeedback.id, replyText })).unwrap();
      setIsSubmittingReply(false);
      toast.success(`Official response dispatched to ${selectedFeedback.hospitalName}`);
      
      setSelectedFeedback((prev) => ({
        ...prev,
        adminReply: replyText,
        status: prev.status === 'new' ? 'under_review' : prev.status,
      }));
      dispatch(fetchAdminFeedbacks('all'));
    } catch (err) {
      setIsSubmittingReply(false);
      toast.error(err?.message || err || 'Failed to dispatch reply');
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || 'new').toLowerCase();
    if (s === 'resolved') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Resolved</span>;
    }
    if (s === 'under_review') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Under Review</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">New</span>;
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-secondary-950 via-secondary-900 to-primary-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-primary-500/20 text-cyan-300 border border-primary-500/30">
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              Institutional B2B Feedback Authority
            </span>
            <span className="text-xs text-slate-400 font-mono">Hospital CSAT Oversight</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Hospital Feedback & Quality Moderation</h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal">
            Direct operational and clinical feedback received from member hospitals regarding medicine availability, transit reliability, and platform performance.
          </p>
        </div>

        <div className="relative z-10">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-right">
            <div className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider">Average CSAT Score</div>
            <div className="text-xl font-black text-white font-mono flex items-center justify-end gap-1.5">
              <span>{stats.averageRating}</span>
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5 FEEDBACK STATISTICS CARDS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Card 1: Total Feedback */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Feedback</span>
            <MessageSquare className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{stats.total}</div>
          <span className="text-[11px] text-slate-500">All submissions</span>
        </div>

        {/* Card 2: New Feedback */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">{stats.new}</div>
          <span className="text-[11px] text-amber-700 font-semibold">Awaiting review</span>
        </div>

        {/* Card 3: Under Review */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Under Review</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">{stats.underReview}</div>
          <span className="text-[11px] text-blue-700 font-semibold">Active investigation</span>
        </div>

        {/* Card 4: Resolved */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{stats.resolved}</div>
          <span className="text-[11px] text-emerald-700 font-semibold">Official closure sent</span>
        </div>

        {/* Card 5: Average Rating */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Rating</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono flex items-center gap-1">
            <span>{stats.averageRating}</span>
            <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
          </div>
          <span className="text-[11px] text-slate-500">CSAT benchmark</span>
        </div>

      </div>

      {/* ============================================================ */}
      {/* FILTERS & SEARCH BAR */}
      {/* ============================================================ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `All (${stats.total})` },
              { id: 'new', label: `New (${stats.new})` },
              { id: 'under_review', label: `Under Review (${stats.underReview})` },
              { id: 'resolved', label: `Resolved (${stats.resolved})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Rating & Category Dropdowns */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by hospital name or feedback content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end text-xs">
            
            {/* Rating Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Rating:</span>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Ratings</option>
                <option value="5">★★★★★ (5 Stars)</option>
                <option value="4">★★★★☆ (4 Stars)</option>
                <option value="3">★★★☆☆ (3 Stars)</option>
                <option value="2">★★☆☆☆ (2 Stars)</option>
                <option value="1">★☆☆☆☆ (1 Star)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Categories</option>
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {(searchTerm || ratingFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRatingFilter('all');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold ml-1 flex items-center gap-0.5"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* FEEDBACK LIST TABLE */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading && feedbacks.length === 0 ? (
          <div className="py-20">
            <LoadingSpinner text="Fetching hospital feedback records..." />
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No hospital feedback found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no hospital feedback entries matching the selected filters.
            </p>
          </div>
        ) : (
          <div className="w-full">
            {/* Desktop & Tablet Table: 100% width, no horizontal scrollbar */}
            <div className="hidden md:block w-full overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed text-xs">
                <colgroup>
                  <col style={{ width: '20%' }} /> {/* Hospital Name */}
                  <col style={{ width: '13%' }} /> {/* Rating */}
                  <col style={{ width: '15%' }} /> {/* Feedback Category */}
                  <col style={{ width: '27%' }} /> {/* Feedback / Comment */}
                  <col style={{ width: '10%' }} /> {/* Submitted Date */}
                  <col style={{ width: '8%' }} />  {/* Status */}
                  <col style={{ width: '7%' }} />  {/* Action */}
                </colgroup>
                <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3 text-left">Hospital Name</th>
                    <th className="py-3 px-2 text-center">Rating</th>
                    <th className="py-3 px-2 text-left">Feedback Category</th>
                    <th className="py-3 px-2 text-left">Feedback / Comment</th>
                    <th className="py-3 px-2 text-center">Submitted Date</th>
                    <th className="py-3 px-1.5 text-center">Status</th>
                    <th className="py-3 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredFeedbacks.map((fb) => (
                    <tr key={fb.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Hospital Name */}
                      <td className="py-3 px-3 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 truncate text-xs" title={fb.hospitalName}>{fb.hospitalName}</div>
                            <div className="text-[10px] text-slate-400 truncate" title={fb.location}>{fb.location || 'Accredited Facility'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="py-3 px-2 text-center overflow-hidden">
                        <div className="inline-flex items-center gap-0.5 text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-3 h-3 ${i < Number(fb.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                            />
                          ))}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-2 overflow-hidden">
                        <span className="inline-block max-w-full truncate px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200" title={fb.category}>
                          {fb.category || 'Order / Delivery'}
                        </span>
                      </td>

                      {/* Feedback / Comment */}
                      <td className="py-3 px-2 overflow-hidden text-slate-600 text-xs">
                        <p className="truncate" title={fb.feedbackText || fb.comment}>
                          "{fb.feedbackText || fb.comment}"
                        </p>
                        {fb.adminReply && (
                          <div className="mt-0.5 text-[10px] text-teal-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                            <span className="truncate">Admin Replied</span>
                          </div>
                        )}
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3 px-2 text-center font-mono text-slate-500 text-[11px] overflow-hidden">
                        <span className="truncate block">{fb.date || '2024-08-25'}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-1.5 text-center overflow-hidden">
                        {getStatusBadge(fb.status)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-2 text-center overflow-hidden">
                        <button
                          onClick={() => handleOpenDetails(fb)}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredFeedbacks.map((fb) => (
                <div key={fb.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{fb.hospitalName}</h4>
                      <p className="text-[10px] text-slate-400">{fb.location || 'Facility'}</p>
                    </div>
                    {getStatusBadge(fb.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-0.5 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-3 h-3 ${i < Number(fb.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                        />
                      ))}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {fb.category || 'Feedback'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">
                    "{fb.feedbackText || fb.comment}"
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <span>{fb.date || '2024-08-25'}</span>
                    <button
                      onClick={() => handleOpenDetails(fb)}
                      className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* DETAILED FEEDBACK VIEW & MODERATION MODAL */}
      {/* ============================================================ */}
      {selectedFeedback && (
        <Modal
          isOpen={Boolean(selectedFeedback)}
          onClose={() => setSelectedFeedback(null)}
          title="Hospital Feedback Dossier & Moderation"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs">
            
            {/* Hospital details card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/40 border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">HOSPITAL FACILITY</span>
                  <h3 className="text-base font-black text-slate-900">{selectedFeedback.hospitalName}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">CURRENT STATUS</span>
                  <div className="mt-0.5">{getStatusBadge(selectedFeedback.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">RATING</span>
                  <div className="flex items-center gap-1 text-amber-400 mt-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < Number(selectedFeedback.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                      />
                    ))}
                    <span className="font-mono font-bold text-slate-700 ml-1">({selectedFeedback.rating} / 5)</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">CATEGORY</span>
                  <span className="font-bold text-slate-800">{selectedFeedback.category || 'Order / Delivery'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">SUBMITTED DATE & TIME</span>
                  <span className="font-mono text-slate-600">{selectedFeedback.date || '2024-08-25 14:30 IST'}</span>
                </div>
              </div>
            </div>

            {/* Original Feedback Commentary */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Institutional Commentary
              </span>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed font-normal">
                "{selectedFeedback.feedbackText || selectedFeedback.comment}"
              </div>
            </div>

            {/* Quick Status Modifiers */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200">
              <span className="text-xs font-bold text-slate-600">Quick Status Transition:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('under_review')}
                  disabled={selectedFeedback.status === 'under_review'}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 transition-all"
                >
                  Mark Under Review
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('resolved')}
                  disabled={selectedFeedback.status === 'resolved'}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 transition-all"
                >
                  Mark Resolved
                </button>
              </div>
            </div>

            {/* Admin Official Reply Area */}
            <form onSubmit={handleSendReply} className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Official Administrative Reply
              </label>
              <textarea
                rows={3}
                required
                placeholder="Type regulatory response, logistics clarification, or issue resolution notes to the hospital..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary-500 bg-white"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReply}
                  className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-600/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingReply ? 'Dispatching...' : 'Dispatch Reply'}</span>
                </button>
              </div>
            </form>

          </div>
        </Modal>
      )}

    </div>
  );
};

export default AdminFeedback;

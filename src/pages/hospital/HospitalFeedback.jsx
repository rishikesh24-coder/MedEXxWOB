import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Star, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Sparkles, 
  Building2, 
  CornerDownRight,
  ShieldCheck,
  Award,
  ThumbsUp,
  MessageCircle,
  HelpCircle
} from 'lucide-react';
import { submitHospitalFeedback, fetchHospitalFeedbacks } from '../../store/slices/hospitalSlice';
import toast from 'react-hot-toast';

export const HospitalFeedback = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { feedbacks, isLoading } = useSelector((state) => state.hospital);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState('Logistics & Cold-Chain');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchHospitalFeedbacks(user.id));
    }
  }, [dispatch, user?.id]);

  const ratingDescriptions = {
    1: 'Substandard - Failed Logistics or Cold-Chain SLA',
    2: 'Needs Improvement - Minor Packaging/Transit Delay',
    3: 'Satisfactory - Standard Exchange Completed',
    4: 'High Quality - Smooth Nodal Handover & Packaging',
    5: 'Exceptional - Zero Temperature Deviation, Rapid Escrow'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      toast.error('Please enter your feedback comments');
      return;
    }
    if (!user?.id) {
      toast.error('Hospital authentication session required');
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(submitHospitalFeedback({
        hospitalId: user.id,
        hospitalName: user.name || 'Partner Hospital',
        rating,
        category,
        feedbackText,
      }));
      setIsSubmitting(false);
      setFeedbackText('');
      toast.success('Thank you! Your feedback has been recorded for platform moderation.');
    } catch (err) {
      setIsSubmitting(false);
      toast.error('Failed to submit feedback');
    }
  };

  const avgRating = useMemo(() => {
    if (!feedbacks.length) return '4.9';
    const sum = feedbacks.reduce((acc, f) => acc + (Number(f.rating) || 5), 0);
    return (sum / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Award className="w-3 h-3 text-teal-400" />
              SLA Quality & Governance Assurance
            </span>
            <span className="text-xs text-slate-400 font-mono">Continuous Quality Monitoring</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Hospital Feedback & Support</h1>
          <p className="text-xs text-slate-300 max-w-2xl font-normal leading-relaxed">
            Institutional peer feedback loop for inter-hospital exchanges, IoT cold-chain transit performance, and regulatory dispatch verification.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-center">
            <div className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Network CSAT</div>
            <div className="text-lg font-black text-white font-mono flex items-center justify-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{avgRating}</span>
              <span className="text-xs text-slate-400 font-normal">/5.0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Feedback Form */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Submit Verification Review</h3>
                <p className="text-[10px] text-slate-400">Moderated by MedEx Regulatory Cell</p>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-teal-600" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Star Rating */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Service Experience Rating
                </label>
                <span className="text-[11px] font-mono font-bold text-teal-700">
                  {hoverRating || rating} / 5
                </span>
              </div>
              
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1.5 rounded-lg text-amber-400 hover:scale-115 hover:bg-white transition-all"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          (hoverRating || rating) >= star
                            ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 font-medium italic border-t border-slate-200/60 pt-1.5">
                  {ratingDescriptions[hoverRating || rating]}
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audit Category / Focus Area
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold text-slate-700"
              >
                <option value="Logistics & Cold-Chain">Logistics & Cold-Chain SLA (2°C - 8°C)</option>
                <option value="Inventory Concession Calculator">Inventory Concession Calculator & Pricing</option>
                <option value="Platform Verification & Security">Institutional Verification & Security</option>
                <option value="Razorpay Settlement">Razorpay Escrow & Financial Settlement</option>
                <option value="General Service Quality">General Platform SLA & Regulatory</option>
              </select>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Detailed Review & Operational Feedback <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="4"
                required
                placeholder="Detail vehicle temperature accuracy, driver handover protocol, tamper seals, or dispute resolution..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording Feedback...' : 'Submit Institutional Review'}</span>
            </button>
          </form>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500">
            <HelpCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p>
              Feedback submitted through this portal is reviewed by the State Drug Administration liaison and MedEx operations team within 24 hours.
            </p>
          </div>
        </div>

        {/* Right Column: Historical Feedback Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Institutional Feedback & Administrative Responses</h3>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                Live Feed
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono font-medium">{feedbacks.length} Verified Entries</span>
          </div>

          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div
                key={fb.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        {fb.hospitalName}
                      </span>
                      <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        {fb.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">{fb.date}</span>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center gap-0.5 bg-amber-50/70 border border-amber-200/60 px-2 py-1 rounded-lg">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          fb.rating >= s ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                    <span className="text-[11px] font-bold text-amber-700 ml-1 font-mono">{fb.rating}.0</span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                  "{fb.feedbackText}"
                </div>

                {/* Admin Reply */}
                {fb.adminReply && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-ocean-50 to-teal-50/50 border border-teal-100 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-ocean-900 font-bold">
                      <CornerDownRight className="w-3.5 h-3.5 text-teal-600" />
                      <span>MedEx Administration Response:</span>
                      <span className="text-[10px] text-slate-400 font-normal font-mono">({fb.repliedDate})</span>
                    </div>
                    <p className="text-slate-600 text-[11px] pl-5 leading-relaxed">
                      {fb.adminReply}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default HospitalFeedback;

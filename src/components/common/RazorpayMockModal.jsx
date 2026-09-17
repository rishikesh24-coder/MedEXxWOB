import React, { useState } from 'react';
import Modal from './Modal';
import { 
  ShieldCheck, 
  CreditCard, 
  Smartphone, 
  Building, 
  CheckCircle2, 
  Loader2, 
  Lock,
  ArrowRight,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateOrderPricing } from '../../utils/pricingUtils';
import toast from 'react-hot-toast';

export const RazorpayMockModal = ({ isOpen, onClose, request, onPaymentSuccess, onPaymentFailure }) => {
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [upiId, setUpiId] = useState('hospital.pharmacy@okaxis');
  const [cardNumber, setCardNumber] = useState('4532 8901 2345 6789');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('884');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank Corporate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  if (!request) return null;

  const pricing = calculateOrderPricing({
    unitOriginalPrice: request.unitOriginalPrice || request.unitFinalPrice || 500,
    concessionPercent: request.concessionPercent || 0,
    quantity: request.quantity || 1,
    storageType: request.storageType || 'Cold Storage'
  });

  const totalPayable = request.totalAmount ? Number(request.totalAmount) : pricing.totalPayable;
  const gstAmount = pricing.gstAmount;

  const handlePay = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate Razorpay Gateway handshake & OTP verification
      await new Promise((r) => setTimeout(r, 1200));

      const result = await onPaymentSuccess({
        requestId: request.id,
        paymentMethod: selectedMethod === 'upi' ? `Razorpay UPI (${upiId})` : selectedMethod === 'card' ? 'Corporate Visa Card' : `NetBanking (${selectedBank})`,
      });

      setIsProcessing(false);
      setPaymentDone(true);
      setPaymentResult(result);

      // Trigger Celebration Confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // ignore confetti errors in non-standard canvas environments
      }

      toast.success('Payment verified & Escrow released!');
    } catch (err) {
      setIsProcessing(false);
      toast.error(err.message || 'Payment processing failed');
    }
  };

  const handleSimulateFailure = async () => {
    setIsProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      if (onPaymentFailure) {
        await onPaymentFailure({
          requestId: request.id,
          reason: 'Simulated Gateway Failure: Transaction declined by acquiring bank',
        });
      }
      setIsProcessing(false);
      toast.error('Payment Failed: Transaction declined by bank. You can retry payment.');
      onClose();
    } catch (err) {
      setIsProcessing(false);
      toast.error(err.message || 'Payment failure simulation error');
    }
  };

  const handleFinish = () => {
    setPaymentDone(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? () => {} : onClose}
      maxWidth="max-w-xl"
    >
      {/* Razorpay Brand Header */}
      <div className="-mt-5 -mx-6 p-4 bg-gradient-to-r from-[#0C2340] to-[#1A3A4A] text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center font-black text-blue-400 border border-blue-400/30 text-sm">
            R
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wide">Razorpay</span>
              <span className="text-[9px] font-mono font-bold bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded uppercase">
                Demo Simulator
              </span>
            </div>
            <span className="text-[10px] text-blue-300 font-medium">B2B Healthcare Escrow Gateway</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-white/10 px-2.5 py-1 rounded-full border border-white/10 font-mono">
          <Lock className="w-3 h-3 text-amber-400" />
          <span>Simulated Gateway Sandbox</span>
        </div>
      </div>

      {!paymentDone ? (
        <div className="pt-4 space-y-4">
          
          {/* Mandatory Demo Simulator Notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-center space-y-0.5">
            <span className="text-xs font-black uppercase tracking-widest text-amber-900 font-mono block">
              DEMO / SAMPLE SIMULATOR - NO REAL PAYMENT GATEWAY
            </span>
            <p className="text-[10px] text-amber-800">
              This sandbox interface demonstrates B2B escrow workflow. No real banking accounts, UPI VPAs, or credit cards are charged.
            </p>
          </div>
          
          {/* Order Summary Card with Itemized Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-mono text-slate-500">
                  Order/TXN ID: <strong className="text-slate-800 font-mono">#{request.transactionId || request.id}</strong>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Providing Hospital:</p>
                <h4 className="text-sm font-bold text-slate-800">{request.toHospitalName}</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Medicine: <span className="font-semibold text-slate-900">{request.medicineName}</span>
                </p>
                <p className="text-xs text-slate-600">
                  Quantity: <span className="font-mono font-bold text-slate-900">{request.quantity} units</span>
                </p>
              </div>
              <div className="text-right space-y-1">
                <span className="text-xs text-slate-400 block">Total Settlement</span>
                <p className="text-lg font-extrabold text-primary-700 font-mono leading-tight">₹{totalPayable.toLocaleString()}</p>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Payment Status</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold ${
                    request.paymentStatus === 'failed' ? 'text-rose-600' : 'text-amber-700'
                  }`}>
                    {request.paymentStatus === 'failed' ? 'Payment Failed (Retry)' : 'Payment Pending'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 text-[11px] font-mono text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Base Subtotal ({request.quantity} × ₹{pricing.unitOriginalPrice}):</span>
                <span>₹{pricing.subtotal.toLocaleString()}</span>
              </div>
              {pricing.concessionSavings > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Automated Near-Expiry Concession:</span>
                  <span>-₹{pricing.concessionSavings.toLocaleString()}</span>
                </div>
              )}
              {pricing.logisticsFee > 0 && (
                <div className="flex justify-between text-cyan-700 font-semibold">
                  <span>Cold-Chain Telemetry & Transit Fee:</span>
                  <span>+₹{pricing.logisticsFee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (12% Central/State Pharma):</span>
                <span>+₹{gstAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('upi')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                selectedMethod === 'upi'
                  ? 'border-primary-500 bg-primary-50/60 text-primary-800 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Smartphone className="w-4 h-4 text-primary-600" />
              <span>UPI / QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('card')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                selectedMethod === 'card'
                  ? 'border-primary-500 bg-primary-50/60 text-primary-800 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <CreditCard className="w-4 h-4 text-primary-600" />
              <span>Corporate Card</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('netbanking')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                selectedMethod === 'netbanking'
                  ? 'border-primary-500 bg-primary-50/60 text-primary-800 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Building className="w-4 h-4 text-primary-600" />
              <span>NetBanking</span>
            </button>
          </div>

          {/* Tab Form Details */}
          <form onSubmit={handlePay} className="space-y-3 pt-1">
            {selectedMethod === 'upi' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Virtual Payment Address (VPA / UPI ID)</label>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="hospital@okhdfcbank"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                <div className="flex gap-2 pt-1">
                  {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((app) => (
                    <span key={app} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {app}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedMethod === 'card' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Card Number</label>
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      required
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono text-center focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">CVV</label>
                    <input
                      type="password"
                      maxLength="4"
                      required
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono text-center focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'netbanking' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Select Scheduled Commercial Bank</label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none bg-white font-medium"
                >
                  <option value="HDFC Bank Corporate">HDFC Bank Corporate</option>
                  <option value="ICICI Bank Commercial">ICICI Bank Commercial</option>
                  <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                  <option value="Axis Bank Enterprise">Axis Bank Enterprise</option>
                  <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                </select>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  disabled={isProcessing}
                  className="text-[11px] font-mono font-medium text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  title="Simulate bank gateway failure to test payment retry behavior"
                >
                  [Simulate Payment Failure]
                </button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-xs font-bold shadow-md shadow-primary-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-75 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Pay Now / Proceed to Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

        </div>
      ) : (
        /* Success Screen */
        <div className="pt-6 pb-2 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Payment Successful!</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Escrow payment holds funds until cold-chain dispatch delivery verification.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Razorpay Payment ID:</span>
              <span className="font-bold text-slate-800">{paymentResult?.payment?.razorpayPaymentId || 'pay_demo_success'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction Ref:</span>
              <span className="font-bold text-slate-800">{request.transactionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Settled:</span>
              <span className="font-bold text-emerald-600">₹{totalPayable.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Logistics Tracking No:</span>
              <span className="font-bold text-primary-700">{paymentResult?.tracking?.trackingNumber || 'SMS-EXP-9941'}</span>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span>Done / View My Requests</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default RazorpayMockModal;

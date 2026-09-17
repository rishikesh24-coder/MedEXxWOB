import React from 'react';
import Modal from './Modal';
import { Printer, Download, Pill, ShieldCheck, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const ReceiptModal = ({ isOpen, onClose, payment }) => {
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    toast.success('Downloading official Tax Invoice PDF...');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="B2B Medicine Exchange Tax Invoice & Receipt"
      subtitle="Generated under Rule 65 of Drugs and Cosmetics Rules, 1945"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pt-1">
        
        {/* Printable Invoice Container */}
        <div id="invoice-printable" className="p-6 border border-slate-200 rounded-2xl bg-white space-y-6 shadow-sm relative">
          
          {/* Mandatory Demo / Sample Document Disclaimer */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-center space-y-0.5">
            <span className="text-xs font-black uppercase tracking-widest text-amber-900 font-mono block">
              DEMO / SAMPLE DOCUMENT - NO REAL PATIENT DATA
            </span>
            <p className="text-[10px] text-amber-800">
              Inter-hospital transfer receipt simulated for technical demonstration. Contains zero real patient or confidential hospital clinical records.
            </p>
          </div>

          {/* Top Brand & Title */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold">
                <Pill className="w-6 h-6 rotate-45" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-secondary-700">MedEx Platform</h3>
                <p className="text-[11px] text-slate-500">Official Inter-Hospital Transfer Invoice</p>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                PAYMENT COMPLETED
              </span>
              <p className="text-xs font-mono text-slate-500 mt-1">Invoice: {payment.transactionId}</p>
            </div>
          </div>

          {/* Parties Meta */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Buyer Institution</p>
              <h5 className="font-bold text-slate-900 mt-0.5">{payment.buyerHospital || 'Apollo Hospital'}</h5>
              <p className="text-slate-500 text-[11px]">GSTIN: 27AAACA1234F1Z5</p>
              <p className="text-slate-500 text-[11px]">License No: MH-MZ1-88412</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Seller / Provider Institution</p>
              <h5 className="font-bold text-slate-900 mt-0.5">{payment.sellerHospital || 'Fortis Healthcare'}</h5>
              <p className="text-slate-500 text-[11px]">GSTIN: 06AAACF9921B1Z2</p>
              <p className="text-slate-500 text-[11px]">License No: HR-GUR-44129</p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Payment ID</span>
              <p className="font-mono font-bold text-slate-800 text-[11px] truncate">{payment.razorpayPaymentId || 'pay_verified'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Settlement Date</span>
              <p className="font-medium text-slate-800 text-[11px]">{payment.date}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Gateway Channel</span>
              <p className="font-medium text-slate-800 text-[11px]">{payment.paymentMethod || 'Razorpay Escrow'}</p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-center">Qty</th>
                  <th className="px-3 py-2.5 text-right">Taxable Value</th>
                  <th className="px-3 py-2.5 text-right">GST (12%)</th>
                  <th className="px-4 py-2.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                <tr>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{payment.medicineName}</p>
                    <p className="text-[10px] text-slate-500">Verified Cold-Chain Packaging Included</p>
                  </td>
                  <td className="px-3 py-3 text-center">{payment.quantity}</td>
                  <td className="px-3 py-3 text-right">₹{Number(payment.amount || 0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">₹{Number(payment.gstAmount || Math.round((payment.amount || 0) * 0.12)).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary-700">₹{Number(payment.totalPaid || Math.round((payment.amount || 0) * 1.12)).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CDSCO Seal Notice */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Digitally verified via MedEx Escrow Protocol</span>
            </div>
            <span>E.&O.E.</span>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default ReceiptModal;

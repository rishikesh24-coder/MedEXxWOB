import React, { useState } from 'react';
import { 
  FileText, 
  Maximize2, 
  X, 
  Download, 
  Printer, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  Hash, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

/**
 * PurchaseInvoiceViewer
 * 
 * Demonstrates pharmaceutical medicine lot provenance by rendering a professional
 * B2B purchase invoice with CDSCO/GST compliance seals and sample document watermarks.
 */
export const PurchaseInvoiceViewer = ({ medicine }) => {
  const [isFullSizeOpen, setIsFullSizeOpen] = useState(false);

  if (!medicine) return null;

  // Derive or use provided invoice data
  const rawBatch = String(medicine.batchNo || medicine.batchNumber || '9901');
  const invoice = medicine.invoice || {
    invoiceNumber: `DEMO-INV-${rawBatch.replace(/[^a-zA-Z0-9]/g, '')}`,
    invoiceDate: medicine.mfgDate || '12 Apr 2026',
    supplier: medicine.manufacturer || 'Sun Pharmaceutical Industries Ltd.',
    supplierAddress: 'Plot 22, MIDC Industrial Area, Maharashtra 411018',
    supplierDlNo: 'MH-WHOLESALE-20B-118492 / 21B-118493',
    supplierGstin: '27AABCS9912F1Z4',
    buyerHospital: medicine.hospitalName || 'Verified Buyer Hospital',
    buyerAddress: medicine.location || 'Central Pharmacy Stores',
    medicineName: medicine.brandName,
    composition: medicine.genericName,
    dosageForm: medicine.dosageForm || 'Tablet',
    hsnCode: '30049099',
    batchNumber: rawBatch,
    mfgDate: medicine.mfgDate || '04/2024',
    expiryDate: medicine.expiryDate || '04/2027',
    quantity: medicine.quantity ? Math.min(Number(medicine.quantity) || 1000, 1000) : 1000,
    rate: medicine.unitOriginalPrice ? Number((Number(medicine.unitOriginalPrice) * 0.8).toFixed(2)) : 1.20,
    amount: 1200.00,
    taxableAmount: 1200.00,
    cgstPercent: 6,
    cgstAmount: 72.00,
    sgstPercent: 6,
    sgstAmount: 72.00,
    totalTax: 144.00,
    total: 1344.00,
    paymentTerms: 'Net 30 Days Inter-Hospital Escrow',
    signatory: 'Authorized Pharmacist (Quality Control)',
  };

  const numRate = Number(invoice.rate) || 0;
  const numQty = Number(invoice.quantity) || 0;
  const invoiceAmount = Number(invoice.amount || (numQty * numRate) || 0).toFixed(2);
  const totalTax = Number(invoice.totalTax || (Number(invoiceAmount) * 0.12) || 0).toFixed(2);
  const totalAmount = Number(invoice.total || (Number(invoiceAmount) + Number(totalTax)) || 0).toFixed(2);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-2">
      {/* INVOICE CARD HEADER & VIEW FULL TRIGGER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
          <FileText className="w-4 h-4 text-primary-600" />
          <span>Purchase Bill / Provenance Invoice</span>
        </div>

        <button
          type="button"
          onClick={() => setIsFullSizeOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 hover:text-primary-800 hover:underline cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>[View Full Size]</span>
        </button>
      </div>

      {/* COMPACT INLINE PREVIEW DOCUMENT */}
      <div 
        onClick={() => setIsFullSizeOpen(true)}
        className="relative p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer group overflow-hidden font-sans"
      >
        {/* DEMO / SAMPLE DOCUMENT WATERMARK */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <span className="text-3xl sm:text-4xl font-extrabold font-mono rotate-[-25deg] select-none text-slate-900 border-4 border-dashed border-slate-900 px-6 py-2 text-center">
            DEMO / SAMPLE DOCUMENT - NO REAL PATIENT DATA
          </span>
        </div>

        {/* Invoice Top Strip */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-xs truncate max-w-[200px]">
                {invoice.supplier}
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                DEMO / SAMPLE DOCUMENT - NO REAL PATIENT DATA
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Inv: <strong className="text-slate-700">{invoice.invoiceNumber}</strong> • Date: {invoice.invoiceDate}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">Invoice Total</span>
            <span className="text-sm font-mono font-extrabold text-primary-800">₹{totalAmount}</span>
          </div>
        </div>

        {/* Invoice Item Summary */}
        <div className="py-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">Billed Item:</span>
            <span className="font-bold text-slate-900">{invoice.medicineName} ({invoice.composition})</span>
          </div>

          <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-center font-mono text-[11px]">
            <div>
              <span className="text-[9px] text-slate-400 block">Batch</span>
              <span className="font-bold text-slate-800">{invoice.batchNumber}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block">Expiry</span>
              <span className="font-bold text-amber-700">{invoice.expiryDate}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block">Billed Qty</span>
              <span className="font-bold text-slate-900">{invoice.quantity} units</span>
            </div>
          </div>
        </div>

        {/* Document Footer Verification */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>CDSCO Form 20B/21B Digitally Signed</span>
          </span>
          <span className="text-primary-600 font-bold group-hover:underline flex items-center gap-1">
            <span>Expand Invoice</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* FULL-SIZE INVOICE MODAL VIEWER */}
      {isFullSizeOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
          onClick={() => setIsFullSizeOpen(false)}
        >
          <div 
            className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL CONTROL HEADER */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Pharmaceutical B2B Purchase Invoice
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Provenance Record for Batch {invoice.batchNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                  title="Print Invoice"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullSizeOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
                  title="Close Invoice"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE REALISTIC INVOICE SHEET */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white text-slate-900 font-sans relative">
              
              {/* DEMO / SAMPLE WATERMARK BADGE */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-center space-y-0.5">
                <span className="text-xs font-black uppercase tracking-widest text-amber-900 font-mono block">
                  DEMO / SAMPLE DOCUMENT - NO REAL PATIENT DATA
                </span>
                <p className="text-[10px] text-amber-800">
                  Simulated B2B pharmaceutical lot provenance invoice for technical demonstration only. Contains zero real patient or hospital clinical data.
                </p>
              </div>

              {/* INVOICE HEADER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-300 pb-5">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                    Manufacturer / Supplier
                  </span>
                  <h4 className="text-base font-black text-slate-900 leading-tight">
                    {invoice.supplier}
                  </h4>
                  <p className="text-xs text-slate-600 leading-snug">
                    {invoice.supplierAddress}
                  </p>
                  <div className="pt-1 text-[11px] font-mono text-slate-600 space-y-0.5">
                    <div>DL No: <strong>{invoice.supplierDlNo}</strong></div>
                    <div>GSTIN: <strong>{invoice.supplierGstin}</strong></div>
                  </div>
                </div>

                <div className="sm:text-right space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                    Tax Invoice Details
                  </span>
                  <div className="text-xl font-mono font-black text-primary-800">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    Date of Issue: <strong>{invoice.invoiceDate}</strong>
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    Payment Terms: <strong>{invoice.paymentTerms}</strong>
                  </div>
                  <div className="inline-block px-2.5 py-0.5 mt-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                    PAID / ESCROW SECURED
                  </div>
                </div>
              </div>

              {/* BUYER / CONSIGNEE SECTION */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider block">
                  Billed To / Receiving Hospital
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {invoice.buyerHospital}
                    </div>
                    <div className="text-xs text-slate-600">
                      {invoice.buyerAddress}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-500 sm:text-right">
                    <span>CDSCO Form 20B Endorsement: <strong>MH-PUN-FORM20B-9912</strong></span>
                  </div>
                </div>
              </div>

              {/* ITEM TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="p-3">Item Description</th>
                      <th className="p-3">HSN Code</th>
                      <th className="p-3">Batch</th>
                      <th className="p-3">Expiry</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Rate (₹)</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    <tr>
                      <td className="p-3 font-sans font-bold text-slate-900">
                        <div>{invoice.medicineName}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{invoice.composition}</div>
                      </td>
                      <td className="p-3 text-slate-600">{invoice.hsnCode}</td>
                      <td className="p-3 text-slate-800 font-bold">{invoice.batchNumber}</td>
                      <td className="p-3 text-amber-700 font-bold">{invoice.expiryDate}</td>
                      <td className="p-3 text-right text-slate-900">{invoice.quantity}</td>
                      <td className="p-3 text-right text-slate-900">₹{Number(invoice.rate).toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{invoiceAmount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TAX SUMMARY AND TOTALS */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                <div className="space-y-2 text-xs text-slate-600 max-w-sm">
                  <div className="font-bold text-slate-800">Statutory Tax Declarations:</div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Pharmaceutical supplies classified under HSN 30049099 attracted to 12% GST (6% CGST + 6% SGST) pursuant to Central Board of Indirect Taxes and Customs.
                  </p>
                </div>

                <div className="w-full sm:w-72 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Value:</span>
                    <span>₹{invoiceAmount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (6%):</span>
                    <span>₹{(totalTax / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (6%):</span>
                    <span>₹{(totalTax / 2).toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-primary-800 font-extrabold text-base">₹{totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* SIGNATURE & LEGAL FOOTER */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Digitally Signed By</span>
                  <div className="font-bold text-slate-800 mt-1">{invoice.signatory}</div>
                  <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>PKI Token Verified: SHA-256</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-mono block">Authenticity Verification</span>
                  <div className="font-mono text-[10px] text-slate-600 mt-1">
                    Doc Ref: {invoice.invoiceNumber}-STK-2026
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    MedEx Inter-Hospital Provenance Archive
                  </div>
                </div>
              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-slate-500 font-mono text-[11px]">
                Preserve for CDSCO Rule 65 Audit Trail
              </span>

              <button
                type="button"
                onClick={() => setIsFullSizeOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors"
              >
                Close Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseInvoiceViewer;

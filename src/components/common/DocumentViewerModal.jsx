import React from 'react';
import Modal from './Modal';
import { FileText, Download, CheckCircle2, AlertCircle, Eye, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export const DocumentViewerModal = ({ isOpen, onClose, document: doc, hospitalName }) => {
  if (!doc) return null;

  const handleDownload = () => {
    toast.success(`Downloading verified document: ${doc.name}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={doc.type || 'Compliance Document Preview'}
      subtitle={`Submitted by ${hospitalName || 'Registered Hospital'}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        
        {/* Document Header Meta */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{doc.name}</p>
              <p className="text-[11px] text-slate-500">Size: {doc.size || '2.4 MB'} • Format: Adobe PDF (Encrypted)</p>
            </div>
          </div>
          <div>
            {doc.verified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                Pending Verification
              </span>
            )}
          </div>
        </div>

        {/* Document Render Area (Clearly marked as Demo Prototype Representation) */}
        <div className="border border-slate-200 rounded-xl p-6 bg-slate-100/60 flex flex-col items-center justify-center min-h-[260px] text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-primary-600">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider mb-1.5">
              Prototype Demo Document
            </div>
            <h4 className="text-sm font-bold text-slate-800">{doc.type || doc.documentType}</h4>
            <p className="text-xs text-slate-600 font-mono mt-0.5">{doc.name || doc.documentName}</p>
            <p className="text-xs text-slate-500 max-w-md mt-2 leading-relaxed">
              Demonstration sample representation of the statutory filing submitted during registration. In this frontend prototype, this document is simulated for administrative review workflows.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary-600" />
              <span>Simulate PDF Viewer</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-400 font-mono">Sample Document Dossier • Frontend Prototype</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download
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

export default DocumentViewerModal;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Download,
  RefreshCw,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Package,
  Layers,
  Flame,
  Eye,
  Info,
  ChevronDown,
  Trash2
} from 'lucide-react';
import {
  parseCsvString,
  guessColumnMappings,
  normalizeQuantity,
  normalizePrice,
  normalizeMedicineType,
  parseAndNormalizeDate,
  detectSensitiveHeaders,
  MEDEX_FIELDS,
  downloadSampleCsvFile
} from '../../utils/csvParser';
import { calculateMedicineExpiry } from '../../utils/expiryUtils';
import { importHospitalInventory, fetchInventory } from '../../store/slices/hospitalSlice';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, name: 'Upload', label: 'Upload CSV' },
  { id: 2, name: 'Map', label: 'Map Columns' },
  { id: 3, name: 'Validate', label: 'Validate & Resolve' },
  { id: 4, name: 'Preview', label: 'Preview Data' },
  { id: 5, name: 'Complete', label: 'Import Complete' },
];

export const CSVImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { inventory = [] } = useSelector((state) => state.hospital);

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Step 1: Upload State
  const [rawFile, setRawFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showHelpDrawer, setShowHelpDrawer] = useState(false);
  const fileInputRef = useRef(null);

  // Step 2: Mapping State
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRawRows, setCsvRawRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [dateFormatPreference, setDateFormatPreference] = useState('AUTO'); // 'AUTO' | 'DMY' | 'MDY'
  const [sensitiveColumnsDetected, setSensitiveColumnsDetected] = useState([]);

  // Step 3: Conflict & Duplicate Resolution Options
  const [existingBatchResolution, setExistingBatchResolution] = useState('update'); // 'update' | 'skip'
  const [csvInternalDuplicateResolution, setCsvInternalDuplicateResolution] = useState('merge'); // 'merge' | 'first'

  // Step 4: Preview pagination and filter
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'valid' | 'attention' | 'errors'
  const [previewPage, setPreviewPage] = useState(1);
  const rowsPerPage = 20;

  // Step 5: Final Result State
  const [importResult, setImportResult] = useState(null);

  // Reset wizard on open/close
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setRawFile(null);
      setFileError('');
      setCsvHeaders([]);
      setCsvRawRows([]);
      setColumnMappings({});
      setDateFormatPreference('AUTO');
      setSensitiveColumnsDetected([]);
      setExistingBatchResolution('update');
      setCsvInternalDuplicateResolution('merge');
      setPreviewFilter('all');
      setPreviewPage(1);
      setImportResult(null);
      setImportProgress(0);
      setIsProcessingImport(false);
    }
  }, [isOpen]);

  // ==========================================
  // STEP 1: FILE SELECTION & VALIDATION
  // ==========================================
  const handleFile = (file) => {
    setFileError('');
    if (!file) return;

    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setFileError('Please upload a CSV file (.csv). Other file formats (.pdf, .xlsx, images) are not supported.');
      return;
    }

    // Check size limit (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setFileError('The selected file exceeds the 5 MB recommended limit for browser parsing.');
      return;
    }

    setRawFile(file);

    // Read and parse file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCsvString(text);

        if (parsed.error) {
          setFileError(parsed.error);
          return;
        }

        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          setFileError('We couldn\'t find any data rows in this CSV file. Please check that it contains headers and records.');
          return;
        }

        setCsvHeaders(parsed.headers);
        setCsvRawRows(parsed.rows);

        // Check for sensitive headers
        const sensitive = detectSensitiveHeaders(parsed.headers);
        setSensitiveColumnsDetected(sensitive);

        // Auto-guess initial mappings
        const suggested = guessColumnMappings(parsed.headers);
        setColumnMappings(suggested);

        // Advance to Step 2
        setCurrentStep(2);
      } catch (err) {
        setFileError('We couldn\'t read this file. Please check that it is a valid CSV formatted document.');
      }
    };

    reader.onerror = () => {
      setFileError('Unable to read the selected file. Please try again.');
    };

    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // ==========================================
  // STEP 2: COLUMN MAPPING LOGIC
  // ==========================================
  const handleMapChange = (header, targetField) => {
    setColumnMappings((prev) => {
      const next = { ...prev };
      if (!targetField) {
        delete next[header];
      } else {
        // If targetField was already mapped elsewhere, remove it from other header
        Object.keys(next).forEach((k) => {
          if (next[k] === targetField) delete next[k];
        });
        next[header] = targetField;
      }
      return next;
    });
  };

  // Check required fields mapped
  const missingRequiredFields = useMemo(() => {
    const mappedValues = Object.values(columnMappings);
    const requiredFields = MEDEX_FIELDS.filter((f) => f.required);
    return requiredFields.filter((f) => !mappedValues.includes(f.key));
  }, [columnMappings]);

  // ==========================================
  // STEP 3 & 4: VALIDATION & DATA ENGINE
  // ==========================================
  const validatedDataset = useMemo(() => {
    if (csvRawRows.length === 0 || missingRequiredFields.length > 0) {
      return {
        rows: [],
        metrics: {
          totalRows: 0,
          validRows: 0,
          attentionRows: 0,
          errorRows: 0,
          newMedicines: 0,
          existingBatches: 0,
          expiredCount: 0,
          nearExpiryCount: 0,
          lowStockCount: 0,
          internalDuplicates: 0,
        },
        itemsToCreate: [],
        itemsToUpdate: [],
        skippedItems: [],
        hasBlockingErrors: true,
      };
    }

    // Invert mapping for quick row lookup: fieldKey -> csvHeader
    const fieldToHeader = {};
    Object.entries(columnMappings).forEach(([header, field]) => {
      fieldToHeader[field] = header;
    });

    const rows = [];
    const internalBatchOccurrences = new Map(); // key -> count
    let validCount = 0;
    let attentionCount = 0;
    let errorCount = 0;
    let newCount = 0;
    let existingCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let lowStockCount = 0;
    let duplicateCount = 0;

    // Process every raw CSV row
    csvRawRows.forEach((rawRow, index) => {
      const rawMedicineName = rawRow[fieldToHeader['brandName']] || '';
      const rawCategory = rawRow[fieldToHeader['category']] || '';
      const rawBatchNo = rawRow[fieldToHeader['batchNo']] || '';
      const rawQuantity = rawRow[fieldToHeader['quantity']] || '';
      const rawExpiryDate = rawRow[fieldToHeader['expiryDate']] || '';
      const rawMfgDate = rawRow[fieldToHeader['mfgDate']] || '';
      const rawPrice = rawRow[fieldToHeader['unitOriginalPrice']] || '';
      const rawConcession = rawRow[fieldToHeader['concessionPercent']] || '';
      const rawManufacturer = rawRow[fieldToHeader['manufacturer']] || '';
      const rawMinStock = rawRow[fieldToHeader['minStockThreshold']] || '';
      const rawUnit = rawRow[fieldToHeader['unit']] || '';
      const rawNotes = rawRow[fieldToHeader['notes']] || '';

      const errors = [];
      const warnings = [];

      // 1. Medicine Name Validation
      const medicineName = String(rawMedicineName).trim();
      if (!medicineName) {
        errors.push('Medicine name cannot be empty');
      }

      // 2. Batch Number Validation
      const batchNo = String(rawBatchNo).trim();
      if (!batchNo) {
        errors.push('Batch number cannot be empty');
      }

      // 3. Quantity Validation & Normalization
      const qty = normalizeQuantity(rawQuantity);
      if (qty <= 0) {
        errors.push('Quantity must be a positive number greater than 0');
      }

      // 4. Medicine Type Normalization
      const normalizedType = normalizeMedicineType(rawCategory);
      if (normalizedType === 'Unknown' || normalizedType === 'General Formulation') {
        warnings.push(`Medicine type "${rawCategory || 'unspecified'}" set to General Formulation`);
      }

      // 5. Expiry Date Validation & Normalization
      const expParsed = parseAndNormalizeDate(rawExpiryDate, dateFormatPreference);
      let expiryDate = expParsed.dateStr;
      if (!expParsed.dateStr) {
        errors.push(`Expiry date is invalid: "${rawExpiryDate}"`);
      } else if (expParsed.isAmbiguous) {
        warnings.push(`Ambiguous date interpreted as ${expParsed.dateStr}`);
      }

      // 6. Mfg Date Validation
      let mfgDate = null;
      if (rawMfgDate) {
        const mfgParsed = parseAndNormalizeDate(rawMfgDate, dateFormatPreference);
        if (mfgParsed.dateStr) {
          mfgDate = mfgParsed.dateStr;
          if (expiryDate && mfgDate > expiryDate) {
            errors.push('Manufacturing date cannot be after expiry date');
          }
        }
      }

      // 7. Pricing
      const unitOriginalPrice = normalizePrice(rawPrice) || 60;
      const concessionPercent = Math.max(0, Math.min(90, normalizePrice(rawConcession) || 10));
      const minStockThreshold = normalizeQuantity(rawMinStock) || 25;

      // 8. Expiry status & calculations using centralized utility
      let expiryMeta = { isExpired: false, isNearExpiry: false, isLowStock: false, status: 'healthy', label: 'ACTIVE' };
      if (expiryDate) {
        expiryMeta = calculateMedicineExpiry(expiryDate, mfgDate, qty, minStockThreshold);
        if (expiryMeta.isExpired) {
          expiredCount++;
          warnings.push('Medicine is expired (statutory quarantine - excluded from exchange)');
        } else if (expiryMeta.isNearExpiry) {
          nearExpiryCount++;
          warnings.push(`Near expiry (${expiryMeta.daysRemaining} days remaining)`);
        }
      }

      if (qty <= minStockThreshold) {
        lowStockCount++;
      }

      // 9. Existing Inventory Batch Match Check
      const batchKey = `${medicineName.toLowerCase()}__${batchNo.toLowerCase()}`;
      const existingMatch = inventory.find((m) => 
        m.hospitalId === user?.id &&
        m.brandName?.toLowerCase().trim() === medicineName.toLowerCase() &&
        m.batchNo?.toLowerCase().trim() === batchNo.toLowerCase()
      );

      // 10. Internal CSV Duplicates Check
      const occurrences = (internalBatchOccurrences.get(batchKey) || 0) + 1;
      internalBatchOccurrences.set(batchKey, occurrences);
      const isInternalDuplicate = occurrences > 1;

      if (isInternalDuplicate) {
        duplicateCount++;
        warnings.push(`Duplicate batch found in CSV (row ${index + 1})`);
      }

      let action = 'create';
      if (errors.length > 0) {
        action = 'error';
        errorCount++;
      } else if (existingMatch) {
        existingCount++;
        action = existingBatchResolution === 'update' ? 'update' : 'skip';
        warnings.push(`Existing inventory batch found (Current: ${existingMatch.quantity} units)`);
        attentionCount++;
      } else {
        newCount++;
        if (warnings.length > 0) {
          attentionCount++;
        } else {
          validCount++;
        }
      }

      rows.push({
        id: `row-${index + 1}`,
        rowIndex: index + 1,
        brandName: medicineName,
        category: normalizedType,
        batchNo: batchNo,
        quantity: qty,
        expiryDate: expiryDate,
        mfgDate: mfgDate,
        manufacturer: String(rawManufacturer).trim() || 'Standard Pharma Corp',
        unitOriginalPrice: unitOriginalPrice,
        concessionPercent: concessionPercent,
        minStockThreshold: minStockThreshold,
        unit: String(rawUnit).trim() || 'Units',
        notes: String(rawNotes).trim(),
        errors,
        warnings,
        status: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'attention' : 'valid'),
        action,
        expiryMeta,
        existingMatch,
        isInternalDuplicate,
        batchKey,
      });
    });

    // Handle CSV internal duplicates resolution
    const processedMap = new Map();
    const itemsToCreate = [];
    const itemsToUpdate = [];
    const skippedItems = [];

    rows.forEach((row) => {
      if (row.errors.length > 0) {
        skippedItems.push(row);
        return;
      }

      if (row.isInternalDuplicate) {
        if (csvInternalDuplicateResolution === 'merge') {
          // Merge quantity into previously registered entry
          const prev = processedMap.get(row.batchKey);
          if (prev) {
            prev.quantity += row.quantity;
            prev.notes += ` | Merged ${row.quantity} units from row ${row.rowIndex}`;
            return;
          }
        } else {
          // Skip subsequent duplicates
          skippedItems.push({ ...row, action: 'skip', skipReason: 'CSV duplicate batch skipped' });
          return;
        }
      }

      processedMap.set(row.batchKey, row);

      if (row.action === 'update') {
        itemsToUpdate.push({
          id: row.existingMatch?.id,
          brandName: row.brandName,
          category: row.category,
          batchNo: row.batchNo,
          quantity: row.quantity,
          expiryDate: row.expiryDate,
          mfgDate: row.mfgDate,
          manufacturer: row.manufacturer,
          unitOriginalPrice: row.unitOriginalPrice,
          concessionPercent: row.concessionPercent,
          minStockThreshold: row.minStockThreshold,
          unit: row.unit,
          notes: row.notes,
        });
      } else if (row.action === 'create') {
        itemsToCreate.push(row);
      } else if (row.action === 'skip') {
        skippedItems.push(row);
      }
    });

    return {
      rows,
      metrics: {
        totalRows: rows.length,
        validRows: validCount,
        attentionRows: attentionCount,
        errorRows: errorCount,
        newMedicines: newCount,
        existingBatches: existingCount,
        expiredCount,
        nearExpiryCount,
        lowStockCount,
        internalDuplicates: duplicateCount,
      },
      itemsToCreate,
      itemsToUpdate,
      skippedItems,
      hasBlockingErrors: errorCount > 0,
    };
  }, [csvRawRows, columnMappings, missingRequiredFields, dateFormatPreference, existingBatchResolution, csvInternalDuplicateResolution, inventory, user?.id]);

  // Filtered preview rows
  const filteredPreviewRows = useMemo(() => {
    if (!validatedDataset.rows) return [];
    if (previewFilter === 'valid') {
      return validatedDataset.rows.filter((r) => r.status === 'valid');
    }
    if (previewFilter === 'attention') {
      return validatedDataset.rows.filter((r) => r.status === 'attention');
    }
    if (previewFilter === 'errors') {
      return validatedDataset.rows.filter((r) => r.status === 'error');
    }
    return validatedDataset.rows;
  }, [validatedDataset.rows, previewFilter]);

  const paginatedRows = useMemo(() => {
    const start = (previewPage - 1) * rowsPerPage;
    return filteredPreviewRows.slice(start, start + rowsPerPage);
  }, [filteredPreviewRows, previewPage]);

  const totalPages = Math.max(1, Math.ceil(filteredPreviewRows.length / rowsPerPage));

  // ==========================================
  // STEP 5: ATOMIC COMMIT EXECUTION
  // ==========================================
  const handleExecuteImport = async () => {
    if (validatedDataset.itemsToCreate.length === 0 && validatedDataset.itemsToUpdate.length === 0) {
      toast.error('No valid records available to import');
      return;
    }

    setIsProcessingImport(true);
    setImportProgress(15);

    try {
      // Simulate progressive feedback for large imports
      await new Promise((r) => setTimeout(r, 400));
      setImportProgress(45);

      await new Promise((r) => setTimeout(r, 400));
      setImportProgress(75);

      const result = await dispatch(
        importHospitalInventory({
          hospitalId: user?.id,
          itemsToCreate: validatedDataset.itemsToCreate,
          itemsToUpdate: validatedDataset.itemsToUpdate,
          skippedCount: validatedDataset.skippedItems.length,
          stats: validatedDataset.metrics,
        })
      ).unwrap();

      setImportProgress(100);
      setImportResult({
        added: validatedDataset.itemsToCreate.length,
        updated: validatedDataset.itemsToUpdate.length,
        skipped: validatedDataset.skippedItems.length,
        expired: validatedDataset.metrics.expiredCount,
        nearExpiry: validatedDataset.metrics.nearExpiryCount,
      });

      setCurrentStep(5);
      toast.success('Hospital inventory imported successfully');
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      toast.error(err || 'Import could not be completed. Please try again.');
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleFinish = () => {
    if (onImportSuccess) {
      onImportSuccess();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header with Title & Stepper */}
        <div className="px-6 py-5 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200/80 flex items-center justify-center text-primary-600 shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Import Hospital Inventory
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-100 text-primary-800 border border-primary-200">
                    CSV Wizard
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Easily ingest medicine stock into MedEx without manual entry.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessingImport}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-40"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 pt-2 border-t border-slate-200/60">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isPassed = currentStep > step.id;
              return (
                <div key={step.id} className="flex-1 flex flex-col items-center text-center">
                  <div className="flex items-center w-full">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm mx-auto ${
                        isActive
                          ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                  </div>
                  <span
                    className={`mt-1.5 text-[10px] sm:text-[11px] font-bold truncate max-w-full ${
                      isActive
                        ? 'text-primary-700'
                        : isPassed
                        ? 'text-emerald-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">

          {/* ========================================================================= */}
          {/* STEP 1: UPLOAD CSV                                                        */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Upload Medicine Inventory File
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Upload the CSV file you currently use to maintain your medicine stock.
                  Files are processed securely right inside your browser.
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/70 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 rounded-2xl bg-primary-100/70 border border-primary-200 flex items-center justify-center text-primary-600 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    <span className="text-primary-600 underline decoration-primary-300">
                      Browse your device
                    </span>{' '}
                    or drag & drop your CSV here
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Accepts standardized <span className="font-mono text-slate-600">.csv</span> files (Max 5 MB recommended)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all"
                >
                  Browse Files
                </button>
              </div>

              {/* Error Message */}
              {fileError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">File Error</span>
                    {fileError}
                  </div>
                </div>
              )}

              {/* Sample CSV Card & Guidance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800">
                      Need a template?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Download our pre-formatted demo CSV with realistic medicines.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadSampleCsvFile}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download Sample</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800">
                      What should my CSV contain?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Review required medicine fields and formatting standards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelpDrawer(!showHelpDrawer)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-sm transition-all"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showHelpDrawer ? 'Hide Guide' : 'View Guide'}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Format Guidance */}
              {showHelpDrawer && (
                <div className="p-4 rounded-2xl border border-primary-200 bg-primary-50/30 space-y-3 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center gap-2 text-primary-900 font-bold">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                    <span>Hospital CSV Structure Standards</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                    <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider text-primary-700">
                        Mandatory Columns (Required):
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        <li><span className="font-semibold text-slate-800">Medicine Name:</span> Brand or trade name</li>
                        <li><span className="font-semibold text-slate-800">Medicine Type:</span> Tablet, Capsule, Injection, etc.</li>
                        <li><span className="font-semibold text-slate-800">Batch Number:</span> Lot number for tracking</li>
                        <li><span className="font-semibold text-slate-800">Quantity:</span> Pack or unit count (&gt; 0)</li>
                        <li><span className="font-semibold text-slate-800">Expiry Date:</span> YYYY-MM-DD or DD/MM/YYYY</li>
                      </ul>
                    </div>
                    <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider text-slate-600">
                        Optional Helpful Columns:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        <li><span className="font-semibold text-slate-800">Manufacturer:</span> Pharma producer</li>
                        <li><span className="font-semibold text-slate-800">Mfg Date:</span> Production date</li>
                        <li><span className="font-semibold text-slate-800">Initial Price:</span> MRP / Unit cost (₹)</li>
                        <li><span className="font-semibold text-slate-800">Selling Discount:</span> Concession %</li>
                        <li><span className="font-semibold text-slate-800">Minimum Stock:</span> Reorder threshold buffer</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: COLUMN MAPPING                                                    */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Map CSV Columns to MedEx Fields
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    We automatically suggested mappings based on your headers. Please verify each column.
                  </p>
                </div>

                {/* Date format preference dropdown */}
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-slate-500 font-medium whitespace-nowrap">Date Format:</span>
                  <select
                    value={dateFormatPreference}
                    onChange={(e) => setDateFormatPreference(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="AUTO">Auto-Detect (DD/MM or YYYY-MM-DD)</option>
                    <option value="DMY">DD/MM/YYYY (Indian Standard)</option>
                    <option value="MDY">MM/DD/YYYY (US Standard)</option>
                  </select>
                </div>
              </div>

              {/* Sensitive Column Warning if triggered */}
              {sensitiveColumnsDetected.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Non-Inventory Fields Detected</span>
                    This file contains columns that appear to be patient or confidential data ({sensitiveColumnsDetected.join(', ')}). 
                    To protect privacy, these columns will be excluded and will not be imported into MedEx.
                  </div>
                </div>
              )}

              {/* Missing Mandatory Fields Banner */}
              {missingRequiredFields.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Required field missing</span>
                    Please map: {missingRequiredFields.map((f) => f.label).join(', ')} to continue.
                  </div>
                </div>
              )}

              {/* Mapping Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4 w-5/12">Your CSV Column</th>
                      <th className="py-3 px-2 w-1/12 text-center text-slate-400">➔</th>
                      <th className="py-3 px-4 w-6/12">MedEx Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {csvHeaders.map((header) => {
                      const currentField = columnMappings[header] || '';
                      const fieldDef = MEDEX_FIELDS.find((f) => f.key === currentField);
                      const sampleVal = csvRawRows[0]?.[header] || '';

                      return (
                        <tr key={header} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{header}</div>
                            {sampleVal && (
                              <span className="text-[11px] text-slate-400 truncate max-w-xs block font-mono">
                                Sample: "{sampleVal}"
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-300 font-bold">
                            ➔
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={currentField}
                                onChange={(e) => handleMapChange(header, e.target.value)}
                                className={`w-full max-w-sm rounded-xl text-xs py-2 px-3 border transition-all font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                                  fieldDef?.required
                                    ? 'border-primary-300 bg-primary-50/20 text-primary-900 font-bold'
                                    : currentField
                                    ? 'border-slate-300 bg-white text-slate-800'
                                    : 'border-dashed border-slate-300 text-slate-400 bg-slate-50'
                                }`}
                              >
                                <option value="">-- Ignore this column --</option>
                                <optgroup label="Required Fields">
                                  {MEDEX_FIELDS.filter((f) => f.required).map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label} *
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Optional Fields">
                                  {MEDEX_FIELDS.filter((f) => !f.required).map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>

                              {fieldDef?.required && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                                  <Check className="w-3 h-3" /> Mapped
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: VALIDATION & CONFLICT RESOLUTION                                 */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  CSV Analysis & Conflict Resolution
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Review validation findings and choose how existing inventory batches should be handled.
                </p>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Rows</span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {validatedDataset.metrics.totalRows}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Read from file</span>
                </div>

                <div className="bg-emerald-50/30 p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Ready to Import</span>
                  <span className="text-xl font-black text-emerald-800 font-mono">
                    {validatedDataset.itemsToCreate.length + validatedDataset.itemsToUpdate.length}
                  </span>
                  <span className="text-[10px] text-emerald-600 block">Valid entries</span>
                </div>

                <div className="bg-amber-50/30 p-3.5 rounded-2xl border border-amber-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Needs Attention</span>
                  <span className="text-xl font-black text-amber-800 font-mono">
                    {validatedDataset.metrics.attentionRows}
                  </span>
                  <span className="text-[10px] text-amber-600 block">Warnings / Expired</span>
                </div>

                <div className="bg-rose-50/30 p-3.5 rounded-2xl border border-rose-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Invalid Rows</span>
                  <span className="text-xl font-black text-rose-800 font-mono">
                    {validatedDataset.metrics.errorRows}
                  </span>
                  <span className="text-[10px] text-rose-600 block">Will be skipped</span>
                </div>
              </div>

              {/* Categorical Breakdown Chips */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">
                  Detailed Batch Categorization:
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                    ✦ New Medicines: <strong>{validatedDataset.metrics.newMedicines}</strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                    🔄 Existing Batches Found: <strong>{validatedDataset.metrics.existingBatches}</strong>
                  </span>
                  {validatedDataset.metrics.expiredCount > 0 && (
                    <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                      ⚠ Expired (Disposal Eligible): <strong>{validatedDataset.metrics.expiredCount}</strong>
                    </span>
                  )}
                  {validatedDataset.metrics.nearExpiryCount > 0 && (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                      ⏳ Near Expiry (&lt;90d): <strong>{validatedDataset.metrics.nearExpiryCount}</strong>
                    </span>
                  )}
                  {validatedDataset.metrics.internalDuplicates > 0 && (
                    <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200">
                      👥 Duplicate Batches in CSV: <strong>{validatedDataset.metrics.internalDuplicates}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Conflict Resolution Controls */}
              {validatedDataset.metrics.existingBatches > 0 && (
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/20 space-y-3">
                  <div className="flex items-start gap-2 text-blue-950 font-bold text-xs">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>Existing Hospital Inventory Found ({validatedDataset.metrics.existingBatches} matching batches)</span>
                      <p className="font-normal text-[11px] text-blue-800 mt-0.5">
                        Some rows in your CSV match medicines and batch numbers currently active in your hospital stock.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        existingBatchResolution === 'update'
                          ? 'border-blue-500 bg-white ring-2 ring-blue-100 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="existingResolution"
                        value="update"
                        checked={existingBatchResolution === 'update'}
                        onChange={() => setExistingBatchResolution('update')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">Update Existing Batches</span>
                        <span className="text-[11px] text-slate-500 block">
                          Refresh current inventory quantities and prices with the imported values.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        existingBatchResolution === 'skip'
                          ? 'border-blue-500 bg-white ring-2 ring-blue-100 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="existingResolution"
                        value="skip"
                        checked={existingBatchResolution === 'skip'}
                        onChange={() => setExistingBatchResolution('skip')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">Skip Existing Batches</span>
                        <span className="text-[11px] text-slate-500 block">
                          Keep your current inventory untouched; only import brand-new medicines.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* CSV Internal Duplicates Resolution Controls */}
              {validatedDataset.metrics.internalDuplicates > 0 && (
                <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/20 space-y-3">
                  <div className="flex items-start gap-2 text-purple-950 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>Multiple duplicate rows found within the CSV file</span>
                      <p className="font-normal text-[11px] text-purple-800 mt-0.5">
                        Multiple lines have identical medicine names and batch numbers.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        csvInternalDuplicateResolution === 'merge'
                          ? 'border-purple-500 bg-white ring-2 ring-purple-100 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="internalDuplicateResolution"
                        value="merge"
                        checked={csvInternalDuplicateResolution === 'merge'}
                        onChange={() => setCsvInternalDuplicateResolution('merge')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">Merge Quantities (Recommended)</span>
                        <span className="text-[11px] text-slate-500 block">
                          Sum the stock counts together into a single verified inventory batch.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        csvInternalDuplicateResolution === 'first'
                          ? 'border-purple-500 bg-white ring-2 ring-purple-100 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="internalDuplicateResolution"
                        value="first"
                        checked={csvInternalDuplicateResolution === 'first'}
                        onChange={() => setCsvInternalDuplicateResolution('first')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">Keep First Row Only</span>
                        <span className="text-[11px] text-slate-500 block">
                          Import the first occurrence and discard subsequent duplicate lines.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Problematic Rows Review (First 5 errors or warnings) */}
              {validatedDataset.rows.some((r) => r.errors.length > 0 || r.warnings.length > 0) && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Rows Requiring Attention ({validatedDataset.metrics.attentionRows + validatedDataset.metrics.errorRows}):
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {validatedDataset.rows
                      .filter((r) => r.errors.length > 0 || r.warnings.length > 0)
                      .slice(0, 10)
                      .map((r) => (
                        <div
                          key={r.id}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                            r.errors.length > 0
                              ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                              : 'bg-amber-50/40 border-amber-200 text-amber-900'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold">
                              Row #{r.rowIndex}: {r.brandName || 'Unnamed Item'} (Batch: {r.batchNo || 'None'})
                            </span>
                            <div className="text-[11px] opacity-90">
                              {r.errors.length > 0
                                ? `✕ ${r.errors.join('; ')}`
                                : `⚠ ${r.warnings.join('; ')}`}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              r.errors.length > 0
                                ? 'bg-rose-200 text-rose-800'
                                : 'bg-amber-200 text-amber-800'
                            }`}
                          >
                            {r.errors.length > 0 ? 'Invalid' : 'Warning'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: PREVIEW TABLE                                                     */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Preview Data Before Final Import
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Review and verify normalized items before writing to your hospital inventory.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => { setPreviewFilter('all'); setPreviewPage(1); }}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      previewFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({validatedDataset.rows.length})
                  </button>
                  <button
                    onClick={() => { setPreviewFilter('valid'); setPreviewPage(1); }}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      previewFilter === 'valid' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Valid ({validatedDataset.metrics.validRows})
                  </button>
                  <button
                    onClick={() => { setPreviewFilter('attention'); setPreviewPage(1); }}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      previewFilter === 'attention' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Warnings ({validatedDataset.metrics.attentionRows})
                  </button>
                  {validatedDataset.metrics.errorRows > 0 && (
                    <button
                      onClick={() => { setPreviewFilter('errors'); setPreviewPage(1); }}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        previewFilter === 'errors' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Errors ({validatedDataset.metrics.errorRows})
                    </button>
                  )}
                </div>
              </div>

              {/* Ready to Import Summary Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-emerald-950 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    <strong>Ready to import:</strong> {validatedDataset.itemsToCreate.length} new medicines will be added,{' '}
                    {validatedDataset.itemsToUpdate.length} existing batches updated,{' '}
                    {validatedDataset.metrics.expiredCount} expired items quarantined for waste disposal,{' '}
                    {validatedDataset.skippedItems.length} invalid/skipped rows excluded.
                  </span>
                </div>
              </div>

              {/* Paginated Table Container */}
              <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Medicine Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Batch No</th>
                      <th className="py-2.5 px-3 text-right">Units</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          No rows found matching current filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => {
                        const isExpired = row.expiryMeta?.isExpired;
                        const isNearExpiry = row.expiryMeta?.isNearExpiry;

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {row.rowIndex}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div>{row.brandName}</div>
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                {row.manufacturer}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {row.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 font-medium">
                              {row.batchNo}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {row.quantity.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`font-mono text-xs ${isExpired ? 'text-rose-700 font-bold' : isNearExpiry ? 'text-amber-700 font-bold' : 'text-slate-700'}`}>
                                {row.expiryDate || 'N/A'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {row.errors.length > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                  ✕ Invalid
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                  ⚠ Expired
                                </span>
                              ) : isNearExpiry ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  ⏳ Near Expiry
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  ✓ Active
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {row.action === 'create' && (
                                <span className="text-[11px] font-bold text-emerald-600">
                                  New Batch
                                </span>
                              )}
                              {row.action === 'update' && (
                                <span className="text-[11px] font-bold text-blue-600">
                                  Update Qty
                                </span>
                              )}
                              {row.action === 'skip' && (
                                <span className="text-[11px] font-bold text-slate-400">
                                  Skip
                                </span>
                              )}
                              {row.action === 'error' && (
                                <span className="text-[11px] font-bold text-rose-500">
                                  Discarded
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Showing {(previewPage - 1) * rowsPerPage + 1} to{' '}
                  {Math.min(previewPage * rowsPerPage, filteredPreviewRows.length)} of{' '}
                  {filteredPreviewRows.length} rows
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-slate-700 px-1">
                    {previewPage} / {totalPages}
                  </span>
                  <button
                    disabled={previewPage >= totalPages}
                    onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: IMPORT COMPLETE                                                   */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Inventory Imported Successfully!
                </h3>
                <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                  Your medicine stock has been successfully ingested into MedEx.
                  Expiry statuses, low-stock warnings, and peer concessions have been calculated.
                </p>
              </div>

              {/* Import Results Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Added</span>
                  <div className="text-2xl font-black text-emerald-800 font-mono">
                    {importResult?.added || 0}
                  </div>
                  <span className="text-[11px] text-emerald-600 block">New Batches</span>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Updated</span>
                  <div className="text-2xl font-black text-blue-800 font-mono">
                    {importResult?.updated || 0}
                  </div>
                  <span className="text-[11px] text-blue-600 block">Existing Batches</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Skipped</span>
                  <div className="text-2xl font-black text-slate-700 font-mono">
                    {importResult?.skipped || 0}
                  </div>
                  <span className="text-[11px] text-slate-500 block">Excluded Rows</span>
                </div>

                <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Quarantined</span>
                  <div className="text-2xl font-black text-rose-700 font-mono">
                    {importResult?.expired || 0}
                  </div>
                  <span className="text-[11px] text-rose-600 block">Expired Medicines</span>
                </div>
              </div>

              {/* Quarantine Notice if expired items imported */}
              {importResult?.expired > 0 && (
                <div className="max-w-xl mx-auto p-4 rounded-2xl border border-rose-200 bg-rose-50/40 text-left text-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-bold">
                    <Flame className="w-4 h-4 text-rose-600" />
                    <span>{importResult.expired} Expired Medicines Quarantined</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    These items have been automatically excluded from marketplace peer requests in accordance with statutory drug safety standards.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200/90 bg-slate-50 flex items-center justify-between flex-shrink-0">
          {currentStep < 5 ? (
            <>
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s - 1)}
                    disabled={isProcessingImport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-sm transition-all disabled:opacity-40"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessingImport}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold transition-all disabled:opacity-40"
                >
                  Cancel
                </button>

                {currentStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={missingRequiredFields.length > 0}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span>Continue to Validation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {currentStep === 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all"
                  >
                    <span>Proceed to Preview</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {currentStep === 4 && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isProcessingImport || (validatedDataset.itemsToCreate.length === 0 && validatedDataset.itemsToUpdate.length === 0)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isProcessingImport ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Importing ({importProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Import Inventory</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all"
              >
                <span>View Inventory</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CSVImportModal;

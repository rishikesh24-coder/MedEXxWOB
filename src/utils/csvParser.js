/**
 * CSV Parser and Normalization Utilities for MedEx
 * RFC 4180 Compliant parser without external dependencies.
 * Handles quoted values, commas inside quotes, multi-line quoted strings,
 * escaped double-quotes (""), trimmed whitespace, and BOM removal.
 */

// MedEx Standard Fields Definition
export const MEDEX_FIELDS = [
  { key: 'brandName', label: 'Medicine Name', required: true, description: 'Brand or commercial name of the drug' },
  { key: 'category', label: 'Medicine Type', required: true, description: 'Dosage formulation (Tablet, Capsule, Injection, etc.)' },
  { key: 'batchNo', label: 'Batch Number', required: true, description: 'Manufacturer lot or batch number' },
  { key: 'quantity', label: 'Quantity', required: true, description: 'Total units or packs in stock (> 0)' },
  { key: 'expiryDate', label: 'Expiry Date', required: true, description: 'Shelf-life expiration date' },
  { key: 'manufacturer', label: 'Manufacturer', required: false, description: 'Pharma manufacturing company' },
  { key: 'mfgDate', label: 'Manufacturing Date', required: false, description: 'Date of production' },
  { key: 'unitOriginalPrice', label: 'Initial Price (₹)', required: false, description: 'MRP or original base cost per unit' },
  { key: 'concessionPercent', label: 'Selling Discount / Concession (%)', required: false, description: 'Concession percentage (0-90%)' },
  { key: 'minStockThreshold', label: 'Minimum Stock', required: false, description: 'Reorder threshold buffer level' },
  { key: 'unit', label: 'Unit of Measure', required: false, description: 'e.g. Tablets, Vials, Strips, Bottles' },
  { key: 'notes', label: 'Description / Notes', required: false, description: 'Storage conditions or clinical notes' },
];
export const MEDISTOCK_FIELDS = MEDEX_FIELDS;

/**
 * Standardizes medicine formulation types into recognized MedEx categories
 */
export const normalizeMedicineType = (val) => {
  if (!val || typeof val !== 'string') return 'Unknown';
  const clean = val.trim().toLowerCase();

  if (clean.includes('tab') || clean.includes('strip') || clean.includes('pill') || clean.includes('caplet')) {
    return 'Tablet';
  }
  if (clean.includes('cap') || clean.includes('softgel')) {
    return 'Capsule';
  }
  if (clean.includes('inj') || clean.includes('vial') || clean.includes('amp') || clean.includes('syringe')) {
    return 'Injection';
  }
  if (clean.includes('syrup') || clean.includes('susp') || clean.includes('oral solution') || clean.includes('liquid') || clean.includes('elixir')) {
    return 'Syrup';
  }
  if (clean.includes('infusion') || clean.includes('iv') || clean.includes('drip') || clean.includes('perfusion')) {
    return 'Infusion';
  }
  if (clean.includes('ointment') || clean.includes('cream') || clean.includes('gel') || clean.includes('lotion')) {
    return 'Ointment';
  }
  if (clean.includes('drop') || clean.includes('eye') || clean.includes('ear') || clean.includes('nasal')) {
    return 'Drops';
  }
  if (clean.includes('inhaler') || clean.includes('resp') || clean.includes('aerosol') || clean.includes('rotacap')) {
    return 'Inhaler';
  }
  return 'General Formulation';
};

/**
 * Normalizes numeric quantity strings
 * "500", "500 units", " 1,200 ", "120 tabs" -> 500 / 1200
 */
export const normalizeQuantity = (val) => {
  if (typeof val === 'number') return Math.floor(Math.max(0, val));
  if (!val || typeof val !== 'string') return 0;
  const cleaned = val.replace(/,/g, '').replace(/[^0-9.-]/g, ' ').trim();
  const firstNum = cleaned.split(/\s+/)[0];
  const parsed = parseInt(firstNum, 10);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
};

/**
 * Normalizes price values
 * "₹240", "$50.00", " 1,250.50 " -> 240 / 1250.50
 */
export const normalizePrice = (val) => {
  if (typeof val === 'number') return Math.max(0, val);
  if (!val || typeof val !== 'string') return 0;
  const cleaned = val.replace(/[₹$,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100);
};

/**
 * Parses and normalizes dates with format preference and ambiguity detection.
 * Returns { dateStr: 'YYYY-MM-DD' | null, isAmbiguous: boolean, error: string | null }
 */
export const parseAndNormalizeDate = (val, preferredFormat = 'AUTO') => {
  if (!val) return { dateStr: null, isAmbiguous: false, error: 'Empty date' };
  const raw = String(val).trim();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { dateStr: formatted, isAmbiguous: false, error: null };
    }
  }

  // 2. DMY or MDY match: DD-MM-YYYY or MM-DD-YYYY
  const slashMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashMatch) {
    let p1 = parseInt(slashMatch[1], 10);
    let p2 = parseInt(slashMatch[2], 10);
    let y = parseInt(slashMatch[3], 10);
    if (y < 100) y += 2000; // 2-digit year conversion

    // Determine if ambiguous (both p1 and p2 are <= 12)
    const isAmbiguous = p1 <= 12 && p2 <= 12 && p1 !== p2;

    let day = p1;
    let month = p2;

    if (preferredFormat === 'MDY') {
      month = p1;
      day = p2;
    } else if (preferredFormat === 'DMY') {
      day = p1;
      month = p2;
    } else {
      // Auto heuristic:
      if (p1 > 12) {
        // Must be DD/MM/YYYY
        day = p1;
        month = p2;
      } else if (p2 > 12) {
        // Must be MM/DD/YYYY
        month = p1;
        day = p2;
      } else {
        // Default Indian healthcare standard: DD/MM/YYYY
        day = p1;
        month = p2;
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formatted = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { dateStr: formatted, isAmbiguous, error: null };
    }
  }

  // 3. Native Date fallback
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return {
      dateStr: d.toISOString().split('T')[0],
      isAmbiguous: false,
      error: null,
    };
  }

  return { dateStr: null, isAmbiguous: false, error: `Invalid date format: ${raw}` };
};

/**
 * Checks if raw headers or rows appear to contain protected patient health info
 */
export const detectSensitiveHeaders = (headers = []) => {
  const sensitiveKeywords = [
    'patient', 'patient_name', 'patientname', 'patient_id', 'mrn', 'uhid',
    'aadhaar', 'ssn', 'diagnosis', 'doctor_notes', 'dob', 'gender',
    'phone_number', 'patient_phone', 'address'
  ];

  return headers.filter((h) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sensitiveKeywords.some((k) => clean.includes(k));
  });
};

/**
 * Suggests best MedEx field matches for CSV headers
 */
export const guessColumnMappings = (csvHeaders = []) => {
  const mappings = {};
  const usedFields = new Set();

  const rules = [
    {
      field: 'brandName',
      patterns: ['medicine name', 'drug name', 'brand name', 'item name', 'medicine', 'product', 'drug', 'name', 'item'],
    },
    {
      field: 'category',
      patterns: ['medicine type', 'dosage form', 'formulation', 'type', 'form', 'dosage', 'category', 'route'],
    },
    {
      field: 'batchNo',
      patterns: ['batch number', 'batch no', 'batch', 'lot number', 'lot no', 'lot', 'batch_id', 'bno'],
    },
    {
      field: 'quantity',
      patterns: ['quantity', 'available qty', 'available units', 'stock', 'qty', 'units', 'current stock', 'count'],
    },
    {
      field: 'expiryDate',
      patterns: ['expiry date', 'exp date', 'expiry', 'exp', 'expiration date', 'exp_dt', 'use by'],
    },
    {
      field: 'manufacturer',
      patterns: ['manufacturer', 'mfr', 'company', 'make', 'pharma', 'brand', 'supplier'],
    },
    {
      field: 'mfgDate',
      patterns: ['manufacturing date', 'mfg date', 'mfg', 'production date', 'mfg_dt'],
    },
    {
      field: 'unitOriginalPrice',
      patterns: ['initial price', 'unit price', 'mrp', 'price', 'rate', 'cost', 'unit cost'],
    },
    {
      field: 'concessionPercent',
      patterns: ['selling discount', 'concession', 'discount', 'concession %', 'disc %', 'discount %'],
    },
    {
      field: 'minStockThreshold',
      patterns: ['minimum stock', 'min stock', 'reorder level', 'threshold', 'buffer', 'min qty'],
    },
    {
      field: 'unit',
      patterns: ['unit of measure', 'uom', 'unit', 'pack unit', 'packaging'],
    },
    {
      field: 'notes',
      patterns: ['description', 'notes', 'remarks', 'storage condition', 'storage', 'comments'],
    },
  ];

  csvHeaders.forEach((rawHeader) => {
    const cleanHeader = rawHeader.toLowerCase().trim().replace(/[_\-.]/g, ' ');
    
    // Look for best pattern match
    for (const rule of rules) {
      if (usedFields.has(rule.field)) continue;
      const isMatch = rule.patterns.some((pattern) => {
        return cleanHeader === pattern || cleanHeader.includes(pattern);
      });

      if (isMatch) {
        mappings[rawHeader] = rule.field;
        usedFields.add(rule.field);
        break;
      }
    }
  });

  return mappings;
};

/**
 * RFC 4180 Compliant CSV Parser
 * @param {string} csvText - Raw CSV text from file reader
 * @returns {{ headers: string[], rows: Array<Record<string, string>>, rowCount: number, error: string | null }}
 */
export const parseCsvString = (csvText) => {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], rowCount: 0, error: 'Empty file provided' };
  }

  // 1. Remove UTF-8 BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  // 2. Parse text into 2D array of tokens
  const records = [];
  let currentRecord = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++; // Skip the next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRecord.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Carriage return: handle \r\n or standalone \r
        if (nextChar === '\n') {
          i++;
        }
        currentRecord.push(currentField.trim());
        if (currentRecord.some((cell) => cell.length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
        currentField = '';
      } else if (char === '\n') {
        currentRecord.push(currentField.trim());
        if (currentRecord.some((cell) => cell.length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Final record if text did not end with newline
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    if (currentRecord.some((cell) => cell.length > 0)) {
      records.push(currentRecord);
    }
  }

  if (records.length === 0) {
    return { headers: [], rows: [], rowCount: 0, error: 'CSV file contains no readable records' };
  }

  // First row is headers
  const rawHeaders = records[0];
  if (!rawHeaders || rawHeaders.length === 0 || rawHeaders.every((h) => !h)) {
    return { headers: [], rows: [], rowCount: 0, error: 'CSV header row is missing or empty' };
  }

  // Clean and ensure unique headers
  const headerCounts = {};
  const headers = rawHeaders.map((h, idx) => {
    const cleaned = (h || `Column_${idx + 1}`).trim();
    if (headerCounts[cleaned]) {
      headerCounts[cleaned]++;
      return `${cleaned}_${headerCounts[cleaned]}`;
    }
    headerCounts[cleaned] = 1;
    return cleaned;
  });

  // Map remaining records to key-value row objects
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const rawRow = records[r];
    // Skip empty lines
    if (rawRow.length === 1 && !rawRow[0]) continue;

    const rowObj = { _rowIndex: r };
    headers.forEach((header, hIdx) => {
      rowObj[header] = rawRow[hIdx] !== undefined ? rawRow[hIdx] : '';
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
    error: null,
  };
};

/**
 * Generates a realistic sample CSV with varied medicine types, shelf-life, and batches.
 * Contains no patient info.
 */
export const generateSampleCsv = () => {
  const headers = [
    'Medicine Name',
    'Medicine Type',
    'Batch Number',
    'Quantity',
    'Expiry Date',
    'Manufacturer',
    'Manufacturing Date',
    'Initial Price',
    'Selling Discount %',
    'Minimum Stock',
    'Unit',
    'Notes'
  ];

  const today = new Date();
  const formatDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const sampleRows = [
    // 1. Normal active medicine (Tablet)
    ['Paracetamol 500mg', 'Tablet', 'PCM-24001', '500', formatDate(365), 'Cipla Pharmaceuticals', formatDate(-120), '35.00', '15', '50', 'Tablets', 'Store at room temperature <25°C'],
    // 2. Normal active medicine (Capsule)
    ['Amoxicillin + Clavulanate 625mg', 'Capsule', 'AMX-24008', '120', formatDate(240), 'GlaxoSmithKline Pharma', formatDate(-60), '210.00', '10', '25', 'Capsules', 'Broad-spectrum antibiotic'],
    // 3. Near Expiry medicine (<90 days) - Injection
    ['Ceftriaxone 1g Sterile Vial', 'Injection', 'CTX-23091', '40', formatDate(45), 'Sun Pharma Industries', formatDate(-300), '115.00', '40', '15', 'Vials', 'Critical shelf-life, suitable for immediate emergency transfer'],
    // 4. Low stock medicine (<25 units)
    ['Metformin Hydrochloride 500mg', 'Tablet', 'MET-24012', '18', formatDate(420), 'Torrent Pharmaceuticals', formatDate(-90), '45.00', '5', '30', 'Tablets', 'Low stock buffer reached'],
    // 5. Expired medicine (past expiry) - Quarantined
    ['Pantoprazole IV 40mg Infusion', 'Injection', 'PAN-22019', '25', formatDate(-35), 'Alkem Laboratories', formatDate(-500), '65.00', '0', '10', 'Vials', 'Statutory quarantine: Expired. Quarantined from exchange.'],
    // 6. Oral Syrup
    ['Azithromycin Oral Suspension 200mg/5ml', 'Syrup', 'AZI-24033', '85', formatDate(180), 'Lupin Pharmaceuticals', formatDate(-45), '125.00', '20', '20', 'Bottles', 'Shake well before administration'],
    // 7. Infusion / IV Fluid
    ['Normal Saline 0.9% IV Infusion 500ml', 'Infusion', 'NS-24099', '200', formatDate(540), 'Baxter Healthcare', formatDate(-30), '42.00', '10', '40', 'Bottles', 'Sterile pyrogen-free infusion bottle'],
    // 8. Ointment / Topical
    ['Silver Sulfadiazine 1% Burn Cream', 'Ointment', 'SSD-24050', '35', formatDate(210), 'Cadila Pharmaceuticals', formatDate(-150), '85.00', '15', '15', 'Tubes', 'Topical antibacterial for burn dressing'],
    // 9. Eye Drops
    ['Moxifloxacin 0.5% Ophthalmic Drops', 'Drops', 'MOX-24017', '60', formatDate(300), 'FDC Limited', formatDate(-80), '110.00', '15', '20', 'Vials', 'Sterile ophthalmic formulation'],
    // 10. Critical near-expiry (<30 days)
    ['Atorvastatin 20mg Tablets', 'Tablet', 'ATV-23110', '150', formatDate(22), 'Zydus Lifesciences', formatDate(-340), '140.00', '50', '30', 'Tablets', 'Expiring within 30 days - high peer concession active'],
    // 11. Another expired medicine
    ['Insulin Glargine 100 IU/ml Pen', 'Injection', 'INS-22088', '12', formatDate(-60), 'Sanofi India', formatDate(-450), '480.00', '0', '10', 'Pens', 'Cold chain product past expiration date'],
    // 12. Pediatric Syrup
    ['Paracetamol Pediatric Drops 100mg/ml', 'Drops', 'PCD-24015', '95', formatDate(330), 'Mankind Pharma', formatDate(-60), '48.00', '10', '25', 'Bottles', 'Pediatric formulation with calibrated dropper'],
  ];

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...sampleRows.map((row) => row.map(escapeCell).join(','))
  ];

  return csvLines.join('\r\n');
};

/**
 * Triggers browser download of sample CSV template
 */
export const downloadSampleCsvFile = () => {
  const content = generateSampleCsv();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `MedEx_Hospital_Inventory_Sample_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

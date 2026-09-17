/**
 * MedEx Inventory & Clinical Formulary Utilities
 * Provides centralized deterministic logic for:
 * 1. Inventory Lot Status Calculation (AVAILABLE, LOW_STOCK, EXPIRING_SOON, EXPIRED, OUT_OF_STOCK)
 * 2. Active Composition Key Extraction & Normalization
 */

const EXPIRING_SOON_THRESHOLD_DAYS = 90;

// Standard Active Ingredient Synonyms
const INGREDIENT_SYNONYMS = {
  'acetaminophen': 'paracetamol',
  'pcm': 'paracetamol',
  'apap': 'paracetamol',
  'clavulanate potassium': 'clavulanic acid',
  'potassium clavulanate': 'clavulanic acid',
  'clavulanate': 'clavulanic acid',
  'amoxicillin trihydrate': 'amoxicillin',
  'amoxycillin': 'amoxicillin',
  'pantoprazole sodium': 'pantoprazole',
  'cetirizine hydrochloride': 'cetirizine',
  'cetirizine hcl': 'cetirizine',
  'meropenem trihydrate': 'meropenem',
  'atorvastatin calcium': 'atorvastatin',
  'metformin hydrochloride': 'metformin',
  'metformin hcl': 'metformin',
  'azithromycin dihydrate': 'azithromycin',
};

// Dosage Form Standardization Dictionary
const DOSAGE_FORM_MAP = {
  'tablet': 'Tablet',
  'tablets': 'Tablet',
  'tab': 'Tablet',
  'tabs': 'Tablet',
  'caplet': 'Tablet',
  'capsule': 'Capsule',
  'capsules': 'Capsule',
  'cap': 'Capsule',
  'caps': 'Capsule',
  'softgel': 'Capsule',
  'injection': 'Injection',
  'injectable': 'Injection',
  'inj': 'Injection',
  'vial': 'Injection',
  'ampoule': 'Injection',
  'syringe': 'Injection',
  'infusion': 'Infusion',
  'iv infusion': 'Infusion',
  'perfusion': 'Infusion',
  'syrup': 'Syrup',
  'suspension': 'Syrup',
  'oral liquid': 'Syrup',
  'elixir': 'Syrup',
  'drops': 'Drops',
  'ophthalmic drops': 'Drops',
  'eye drops': 'Drops',
  'ear drops': 'Drops',
  'pediatric drops': 'Drops',
  'ointment': 'Ointment',
  'cream': 'Ointment',
  'gel': 'Ointment',
  'topical': 'Ointment',
  'inhaler': 'Inhaler',
  'rotacap': 'Inhaler',
  'respules': 'Inhaler',
};

// Administration Route Standardization Dictionary
const ROUTE_MAP = {
  'oral': 'Oral',
  'po': 'Oral',
  'by mouth': 'Oral',
  'intravenous': 'Intravenous',
  'iv': 'Intravenous',
  'intramuscular': 'Intramuscular',
  'im': 'Intramuscular',
  'subcutaneous': 'Subcutaneous',
  'sc': 'Subcutaneous',
  'topical': 'Topical',
  'ophthalmic': 'Ophthalmic',
  'ocular': 'Ophthalmic',
  'inhalation': 'Inhalation',
  'nasal': 'Nasal',
};

/**
 * Normalizes an active ingredient name
 */
function normalizeIngredientName(name) {
  if (!name || typeof name !== 'string') return '';
  let clean = name.toLowerCase().trim();
  clean = clean.replace(/\b(ip|bp|usp|ep|trihydrate|sodium|calcium|hydrochloride|hcl|dihydrate)\b/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ');
  return INGREDIENT_SYNONYMS[clean] || clean;
}

/**
 * Normalizes strength value and unit into standard metric representation
 */
function normalizeStrength(strengthVal, unitVal = 'mg') {
  let num = 0;
  let unit = (unitVal || 'mg').toLowerCase().trim();

  if (typeof strengthVal === 'number') {
    num = strengthVal;
  } else if (typeof strengthVal === 'string') {
    const match = strengthVal.match(/([\d.]+)\s*([a-zA-Z/%]*)/);
    if (match) {
      num = parseFloat(match[1]) || 0;
      if (match[2]) unit = match[2].toLowerCase().trim();
    }
  }

  if (unit === 'g' || unit === 'gm' || unit === 'gram') {
    num = num * 1000;
    unit = 'mg';
  } else if (unit === 'mcg' || unit === 'μg') {
    num = num / 1000;
    unit = 'mg';
  } else if (unit === 'iu' || unit === 'units') {
    unit = 'IU';
  } else if (unit === '%' || unit === 'percent') {
    unit = '%';
  }

  num = Math.round(num * 1000) / 1000;
  return { strength: num, unit };
}

/**
 * Normalizes dosage formulation
 */
function normalizeDosageForm(form) {
  if (!form || typeof form !== 'string') return 'Tablet';
  const clean = form.toLowerCase().trim();
  for (const [key, mapped] of Object.entries(DOSAGE_FORM_MAP)) {
    if (clean.includes(key)) return mapped;
  }
  return 'Tablet';
}

/**
 * Normalizes route of administration
 */
function normalizeRoute(route, dosageForm = '') {
  if (route && typeof route === 'string') {
    const clean = route.toLowerCase().trim();
    for (const [key, mapped] of Object.entries(ROUTE_MAP)) {
      if (clean.includes(key)) return mapped;
    }
  }

  const form = normalizeDosageForm(dosageForm);
  if (form === 'Tablet' || form === 'Capsule' || form === 'Syrup') return 'Oral';
  if (form === 'Injection' || form === 'Infusion') return 'Intravenous';
  if (form === 'Ointment') return 'Topical';
  if (form === 'Drops') return 'Ophthalmic';
  if (form === 'Inhaler') return 'Inhalation';
  return 'Oral';
}

/**
 * Extracts and computes canonical composition key
 * Format: `ing1:str1:unit1+ing2:str2:unit2|form|route`
 * Ingredients are sorted alphabetically to ensure order invariance.
 */
function computeCanonicalCompositionKey(medicine) {
  if (!medicine) return '';

  if (medicine.canonical_composition_key) {
    return medicine.canonical_composition_key;
  }
  if (medicine.canonicalCompositionKey) {
    return medicine.canonicalCompositionKey;
  }

  const rawGeneric = (medicine.generic_name || medicine.genericName || medicine.composition || medicine.name || '').trim();
  const rawPower = (medicine.strength || medicine.dosage || medicine.power || '').trim();
  const rawForm = medicine.dosage_form || medicine.dosageForm || medicine.form || 'Tablet';
  const rawRoute = medicine.route || '';

  const normForm = normalizeDosageForm(rawForm);
  const normRoute = normalizeRoute(rawRoute, normForm);

  let ingredients = [];

  // If structured active ingredients exist
  if (Array.isArray(medicine.activeIngredients) && medicine.activeIngredients.length > 0) {
    ingredients = medicine.activeIngredients.map((item) => {
      const normName = normalizeIngredientName(item.name);
      const normStr = normalizeStrength(item.strength, item.unit);
      return { name: normName, strength: normStr.strength, unit: normStr.unit };
    });
  } else if (rawGeneric.includes('+') || rawGeneric.includes('/') || rawPower.includes('+')) {
    const parts = rawGeneric.includes('+') ? rawGeneric.split('+') : rawGeneric.split('/');
    const powerMatches = [...rawPower.matchAll(/([\d.]+)\s*(mg|g|mcg|ml)?/gi)];

    if (parts.length === 2 && powerMatches.length >= 2) {
      const s1 = normalizeStrength(powerMatches[0][1], powerMatches[0][2]);
      const s2 = normalizeStrength(powerMatches[1][1], powerMatches[1][2]);
      ingredients = [
        { name: normalizeIngredientName(parts[0]), strength: s1.strength, unit: s1.unit },
        { name: normalizeIngredientName(parts[1]), strength: s2.strength, unit: s2.unit }
      ];
    } else if (rawGeneric.toLowerCase().includes('augmentin') || rawGeneric.toLowerCase().includes('clav') || rawPower.includes('625')) {
      ingredients = [
        { name: 'amoxicillin', strength: 500, unit: 'mg' },
        { name: 'clavulanic acid', strength: 125, unit: 'mg' }
      ];
    } else {
      ingredients = parts.map((p, idx) => {
        const s = powerMatches[idx] ? normalizeStrength(powerMatches[idx][1], powerMatches[idx][2]) : { strength: 0, unit: 'mg' };
        return { name: normalizeIngredientName(p), strength: s.strength, unit: s.unit };
      });
    }
  } else {
    const singleMatch = rawPower.match(/([\d.]+)\s*([a-zA-Z/%]*)/);
    const strObj = singleMatch ? normalizeStrength(singleMatch[1], singleMatch[2]) : { strength: 0, unit: 'mg' };
    ingredients = [
      {
        name: normalizeIngredientName(rawGeneric),
        strength: strObj.strength,
        unit: strObj.unit,
      }
    ];
  }

  // Sort alphabetically by ingredient name for order invariance
  ingredients.sort((a, b) => a.name.localeCompare(b.name));

  const ingsStr = ingredients
    .map((ing) => `${ing.name}:${ing.strength}:${ing.unit}`)
    .join('+');

  return `${ingsStr}|${normForm}|${normRoute}`;
}

/**
 * Calculates deterministic inventory status based on available stock, minimum stock, and expiry date
 */
function calculateLotStatus(lot) {
  const expiryDate = lot.expiry_date || lot.expiryDate;
  const availableQty = Number(lot.available_quantity !== undefined ? lot.available_quantity : (lot.availableQuantity !== undefined ? lot.availableQuantity : (lot.quantity || 0)));
  const minStock = Number(lot.minimum_stock !== undefined ? lot.minimum_stock : (lot.min_stock_level !== undefined ? lot.min_stock_level : (lot.minStockLevel || 20)));

  if (!expiryDate) {
    if (availableQty <= 0) return 'OUT_OF_STOCK';
    if (availableQty <= minStock) return 'LOW_STOCK';
    return 'AVAILABLE';
  }

  const expDateObj = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expDateObj.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry <= 0) {
    return 'EXPIRED';
  }

  if (daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return 'EXPIRING_SOON';
  }

  if (availableQty <= 0) {
    return 'OUT_OF_STOCK';
  }

  if (availableQty <= minStock) {
    return 'LOW_STOCK';
  }

  return 'AVAILABLE';
}

/**
 * Checks if a lot is expired
 */
function isLotExpired(expiryDate) {
  if (!expiryDate) return false;
  const expDateObj = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expDateObj.getTime() < today.getTime();
}

/**
 * Calculates days remaining until expiration
 */
function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return 999;
  const expDateObj = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expDateObj.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  EXPIRING_SOON_THRESHOLD_DAYS,
  normalizeIngredientName,
  normalizeStrength,
  normalizeDosageForm,
  normalizeRoute,
  computeCanonicalCompositionKey,
  calculateLotStatus,
  isLotExpired,
  getDaysUntilExpiry,
};

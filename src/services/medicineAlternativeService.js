/**
 * Medicine Alternative Service (Composition-Based Alternatives)
 * MedEx Marketplace
 * 
 * Provides deterministic, clinical-grade rule-based composition matching.
 * Compares active pharmaceutical ingredients, strengths, dosage formulations, and administration routes.
 * 
 * Designed to be modular so the rule-based engine can interface with or be augmented
 * by machine learning / embedding recommendation models in future phases.
 */

import { calculateMedicineExpiry } from '../utils/expiryUtils.js';
import { API_BASE_URL } from '../config/api.js';
import { getSellingPrice, isExpiryAcceptable } from '../config/nearExpiryPolicy.js';

// Standard Synonym & Ingredient Normalization Dictionary
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

// Route Standardization
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
 * e.g. "Acetaminophen", "Paracetamol IP", "Clavulanate Potassium"
 */
export const normalizeIngredientName = (name) => {
  if (!name || typeof name !== 'string') return '';
  let clean = name.toLowerCase().trim();
  // Remove common pharmacopeia suffixes like IP, BP, USP, EP
  clean = clean.replace(/\b(ip|bp|usp|ep|trihydrate|sodium|calcium|hydrochloride|hcl|dihydrate)\b/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ');
  return INGREDIENT_SYNONYMS[clean] || clean;
};

/**
 * Normalizes strength value and unit into standard metric representation
 * e.g. "500 mg", "500mg", "0.5 g", "1000 mcg"
 */
export const normalizeStrength = (strengthVal, unitVal = 'mg') => {
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

  // Unit standardizations
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
  } else if (unit === 'mg/ml' || unit === 'mg/5ml') {
    // Keep concentration units intact
    unit = unit;
  } else {
    unit = 'mg';
  }

  // Round to 3 decimal places to prevent floating point discrepancies
  num = Math.round(num * 1000) / 1000;
  return { strength: num, unit };
};

/**
 * Normalizes dosage formulation
 */
export const normalizeDosageForm = (form) => {
  if (!form || typeof form !== 'string') return 'Unknown';
  const clean = form.toLowerCase().trim();
  for (const [key, mapped] of Object.entries(DOSAGE_FORM_MAP)) {
    if (clean.includes(key)) return mapped;
  }
  return 'General Formulation';
};

/**
 * Normalizes route of administration
 */
export const normalizeRoute = (route, dosageForm = '') => {
  if (route && typeof route === 'string') {
    const clean = route.toLowerCase().trim();
    for (const [key, mapped] of Object.entries(ROUTE_MAP)) {
      if (clean.includes(key)) return mapped;
    }
  }

  // Infer route from dosage form if not explicitly provided
  const form = normalizeDosageForm(dosageForm);
  if (form === 'Tablet' || form === 'Capsule' || form === 'Syrup') return 'Oral';
  if (form === 'Injection' || form === 'Infusion') return 'Intravenous';
  if (form === 'Ointment') return 'Topical';
  if (form === 'Drops') return 'Ophthalmic';
  if (form === 'Inhaler') return 'Inhalation';
  return 'Oral';
};

const compositionCache = new Map();

export const clearCompositionCache = () => {
  compositionCache.clear();
};

/**
 * Extracts structured composition from a medicine record.
 * Handles both medicines with pre-structured `activeIngredients`
 * and legacy/CSV medicines where composition is inferred from `power` / `genericName`.
 */
export const extractMedicineComposition = (medicine) => {
  if (!medicine) {
    return {
      activeIngredients: [],
      dosageForm: 'Unknown',
      route: 'Unknown',
      canonicalKey: '',
    };
  }

  const cacheKey = medicine.id || `${medicine.brandName || ''}_${medicine.genericName || ''}_${medicine.power || ''}_${medicine.dosageForm || ''}`;
  if (cacheKey && compositionCache.has(cacheKey)) {
    return compositionCache.get(cacheKey);
  }

  let ingredients = [];
  let dosageForm = medicine.dosageForm ? normalizeDosageForm(medicine.dosageForm) : null;
  let route = medicine.route ? normalizeRoute(medicine.route, dosageForm) : null;

  // 1. If activeIngredients array already exists
  if (Array.isArray(medicine.activeIngredients) && medicine.activeIngredients.length > 0) {
    ingredients = medicine.activeIngredients.map((item) => {
      const normName = normalizeIngredientName(item.name);
      const normStr = normalizeStrength(item.strength, item.unit);
      return {
        name: normName,
        strength: normStr.strength,
        unit: normStr.unit,
      };
    });
  } else {
    // 2. Derive ingredients from genericName and power
    const generic = (medicine.genericName || medicine.brandName || '').trim();
    const power = (medicine.power || '').trim();

    // Check for multi-ingredient patterns e.g. "Amoxicillin + Clavulanic Acid" or "Amoxicillin 500mg + Clavulanate 125mg"
    if (generic.includes('+') || generic.includes('/') || power.includes('+')) {
      const parts = generic.includes('+') ? generic.split('+') : generic.split('/');
      
      // Check if power has multiple numbers e.g. "500mg/125mg" or "625mg"
      const powerMatches = [...power.matchAll(/([\d.]+)\s*(mg|g|mcg|ml)?/gi)];
      
      if (generic.toLowerCase().includes('augmentin') || generic.toLowerCase().includes('clavulan') || power.includes('625')) {
        // Standard Augmentin / Clavam 625 formulation: 500mg Amox + 125mg Clav
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
      // Single ingredient pattern
      const singleMatch = power.match(/([\d.]+)\s*([a-zA-Z/%]*)/);
      const strObj = singleMatch ? normalizeStrength(singleMatch[1], singleMatch[2]) : { strength: 0, unit: 'mg' };
      ingredients = [
        {
          name: normalizeIngredientName(generic),
          strength: strObj.strength,
          unit: strObj.unit,
        }
      ];
    }
  }

  // Derive dosageForm and route if missing
  if (!dosageForm) {
    dosageForm = normalizeDosageForm(medicine.power + ' ' + medicine.category);
  }
  if (!route) {
    route = normalizeRoute(medicine.route, dosageForm);
  }

  // Sort ingredients alphabetically by name to make key order-insensitive (A + B == B + A)
  ingredients.sort((a, b) => a.name.localeCompare(b.name));

  const canonicalKey = getCompositionKey({ activeIngredients: ingredients, dosageForm, route });

  const result = {
    activeIngredients: ingredients,
    dosageForm,
    route,
    canonicalKey,
  };

  if (cacheKey) {
    compositionCache.set(cacheKey, result);
  }

  return result;
};

/**
 * Computes canonical deterministic composition key
 * Format: `ing1:str1:unit1+ing2:str2:unit2|form|route`
 * Example: `amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral`
 */
export const getCompositionKey = (medicineOrComposition) => {
  let ingredients = medicineOrComposition.activeIngredients || [];
  let form = medicineOrComposition.dosageForm || '';
  let route = medicineOrComposition.route || '';

  if (ingredients.length === 0 && (medicineOrComposition.power || medicineOrComposition.genericName)) {
    const extracted = extractMedicineComposition(medicineOrComposition);
    ingredients = extracted.activeIngredients;
    form = extracted.dosageForm;
    route = extracted.route;
  }

  // Normalize ingredients
  const normalizedIngs = ingredients
    .map((ing) => {
      const name = normalizeIngredientName(ing.name);
      const str = normalizeStrength(ing.strength, ing.unit);
      return `${name}:${str.strength}:${str.unit}`;
    })
    .sort()
    .join('+');

  const normalizedForm = normalizeDosageForm(form);
  const normalizedRoute = normalizeRoute(route, normalizedForm);

  return `${normalizedIngs}|${normalizedForm}|${normalizedRoute}`;
};

/**
 * Checks if two medicines have an EXACT active composition, strength, dosage form, and route match
 */
export const isExactCompositionMatch = (medA, medB) => {
  if (!medA || !medB) return false;
  const keyA = getCompositionKey(medA);
  const keyB = getCompositionKey(medB);
  return Boolean(keyA && keyB && keyA === keyB);
};

/**
 * Finds all alternative medicines from marketplace inventory that share the exact composition.
 * 
 * @param {object} targetMedicine - The medicine requested or inspected
 * @param {Array} marketplaceInventory - All available marketplace medicine lots
 * @param {object} [options]
 * @param {string} [options.currentHospitalId] - Exclude caller's own hospital
 * @param {string} [options.sortBy='savings_desc'] - 'savings_desc' | 'expiry_desc' | 'distance_asc' | 'stock_desc'
 * @returns {{ targetComposition: object, alternatives: Array, count: number }}
 */
export const findAlternatives = (targetMedicine, marketplaceInventory = [], options = {}) => {
  if (!targetMedicine || !Array.isArray(marketplaceInventory)) {
    const empty = [];
    empty.targetComposition = null;
    empty.alternatives = empty;
    empty.count = 0;
    return empty;
  }

  const currentHospitalId = options.currentHospitalId || targetMedicine.hospitalId;
  const targetComposition = extractMedicineComposition(targetMedicine);
  const targetKey = targetComposition.canonicalKey;

  if (!targetKey || targetComposition.activeIngredients.length === 0) {
    const empty = [];
    empty.targetComposition = targetComposition;
    empty.alternatives = empty;
    empty.count = 0;
    return empty;
  }

  const targetDiscountedPrice = getSellingPrice(targetMedicine.unitOriginalPrice || targetMedicine.mrp, targetMedicine.expiryDate);

  // Filter valid candidate medicines
  const matches = [];

  marketplaceInventory.forEach((med) => {
    // 1. Exclude the exact same medicine record
    if (med.id === targetMedicine.id) return;

    // 2. Exclude the hospital's own inventory
    if (currentHospitalId && med.hospitalId === currentHospitalId) return;

    // 3. Exclude zero quantity or disposed inventory
    if (Number(med.quantity) <= 0) return;
    if (med.status === 'pending_disposal' || med.status === 'disposed') return;

    // 4. Exclude expired or <= 1 month inventory per policy
    if (!isExpiryAcceptable(med.expiryDate)) return;

    // 5. Exclude unverified or suspended hospitals
    if (med.hospitalStatus && med.hospitalStatus !== 'verified') return;

    // 6. Check composition equivalence
    const medComposition = extractMedicineComposition(med);
    if (medComposition.canonicalKey === targetKey) {
      const altDiscountedPrice = getSellingPrice(med.unitOriginalPrice || med.mrp, med.expiryDate);

      const priceDifference = Math.round((targetDiscountedPrice - altDiscountedPrice) * 100) / 100;
      const savingsPercent = targetDiscountedPrice > 0
        ? Math.round((priceDifference / targetDiscountedPrice) * 100)
        : 0;

      const exp = calculateMedicineExpiry(med.expiryDate);
      matches.push({
        ...med,
        extractedComposition: medComposition,
        discountedPrice: altDiscountedPrice,
        priceDifference,
        isCheaper: priceDifference > 0,
        savingsPercent: Math.max(0, savingsPercent),
        expiryMeta: exp,
        matchConfidence: 'EXACT COMPOSITION MATCH',
        reasons: [
          'Same active pharmaceutical ingredient(s)',
          'Identical strength and potency per unit',
          `Same dosage formulation (${medComposition.dosageForm})`,
          `Same administration route (${medComposition.route})`,
          'Available from verified partner hospital pharmacy',
        ],
      });
    }
  });

  // Apply sorting
  const sortBy = options.sortBy || 'savings_desc';
  matches.sort((a, b) => {
    if (sortBy === 'savings_desc') {
      return b.priceDifference - a.priceDifference;
    }
    if (sortBy === 'price_asc') {
      return a.discountedPrice - b.discountedPrice;
    }
    if (sortBy === 'expiry_desc') {
      return new Date(b.expiryDate) - new Date(a.expiryDate);
    }
    if (sortBy === 'distance_asc') {
      return (a.distanceKm || 12) - (b.distanceKm || 12);
    }
    if (sortBy === 'stock_desc') {
      return b.quantity - a.quantity;
    }
    return 0;
  });

  matches.targetMedicine = targetMedicine;
  matches.targetComposition = targetComposition;
  matches.targetDiscountedPrice = targetDiscountedPrice;
  matches.alternatives = matches;
  matches.count = matches.length;

  return matches;
};

/**
 * Searches marketplace for composition alternatives related to a search term.
 * e.g. Searching "Paracetamol 500" will group identical composition lots.
 */
export const findAlternativesForSearchQuery = (query, marketplaceInventory = [], currentHospitalId = null) => {
  if (!query || typeof query !== 'string' || !Array.isArray(marketplaceInventory)) {
    return [];
  }

  const q = query.toLowerCase().trim();
  if (q.length < 3) return [];

  // Find candidate medicines matching query in brand or generic name
  const candidateMatches = marketplaceInventory.filter((m) => {
    if (currentHospitalId && m.hospitalId === currentHospitalId) return false;
    if (Number(m.quantity) <= 0) return false;
    if (!isExpiryAcceptable(m.expiryDate)) return false;

    const brand = (m.brandName || '').toLowerCase();
    const generic = (m.genericName || '').toLowerCase();
    const power = (m.power || '').toLowerCase();
    return brand.includes(q) || generic.includes(q) || power.includes(q);
  });

  if (candidateMatches.length === 0) return [];

  // Group candidates by composition key
  const groups = new Map();
  candidateMatches.forEach((med) => {
    const comp = extractMedicineComposition(med);
    if (!groups.has(comp.canonicalKey)) {
      groups.set(comp.canonicalKey, {
        composition: comp,
        medicines: [],
      });
    }
    groups.get(comp.canonicalKey).medicines.push(med);
  });

  // Keep groups that have 2 or more distinct brands/lots
  const results = [];
  groups.forEach((group, key) => {
    if (group.medicines.length >= 2) {
      results.push({
        compositionKey: key,
        composition: group.composition,
        medicines: group.medicines,
        brandCount: new Set(group.medicines.map((m) => m.brandName.toLowerCase())).size,
      });
    }
  });

  return results;
};

export const fetchAlternatives = async (medicineId, options = {}) => {
  try {
    const q = new URLSearchParams(options).toString();
    const res = await fetch(`${API_BASE_URL}/medicines/${medicineId}/alternatives?${q}`);
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json?.data) {
      return json.data;
    }
  } catch (err) {
    // fallback to local calculation
  }
  return null;
};

export const CLINICAL_SAFETY_DISCLAIMER = 
  "Composition match does not automatically mean clinical interchangeability. Verify the medicine, dosage form, route, and suitability with an authorized healthcare professional before substitution.";

export const medicineAlternativeService = {
  extractMedicineComposition,
  getCompositionKey,
  isExactCompositionMatch,
  findAlternatives,
  findAlternativesForSearchQuery,
  fetchAlternatives,
  CLINICAL_SAFETY_DISCLAIMER,
};

export default medicineAlternativeService;

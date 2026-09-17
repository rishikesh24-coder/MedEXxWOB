import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Building2, 
  Search, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  Layers, 
  ShieldCheck, 
  Filter, 
  Pill, 
  X, 
  Package, 
  FileText,
  Activity,
  Bookmark,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  fetchAdminMedicines, 
  addAdminMedicine, 
  updateAdminMedicine, 
  deleteAdminMedicine 
} from '../../store/slices/adminSlice';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export const AdminMedicineData = () => {
  const dispatch = useDispatch();
  const { medicines, isLoading } = useSelector((state) => state.admin);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dosageFormFilter, setDosageFormFilter] = useState('all');

  // Modals state
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState(null);

  const [detailsMedicine, setDetailsMedicine] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Add / Edit Form State for Master Medicine Catalogue
  const initialFormState = {
    medicineName: '',
    genericName: '',
    brandName: '',
    medicineCode: '',
    category: 'Antibiotics & Anti-Infectives',
    dosageForm: 'Tablet',
    strength: '500 mg',
    unit: 'mg',
    manufacturer: '',
    storageType: 'Room Temperature (15°C - 25°C)',
    description: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    dispatch(fetchAdminMedicines('all'));
  }, [dispatch]);

  // Distinct categories from data
  const categories = useMemo(() => {
    const set = new Set();
    medicines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [medicines]);

  // Distinct dosage forms from data
  const dosageForms = useMemo(() => {
    const set = new Set();
    medicines.forEach((m) => {
      const f = m.dosageForm || m.form;
      if (f) set.add(f);
    });
    return Array.from(set).sort();
  }, [medicines]);

  // Distinct manufacturers
  const manufacturers = useMemo(() => {
    const set = new Set();
    medicines.forEach((m) => {
      if (m.manufacturer) set.add(m.manufacturer);
    });
    return Array.from(set);
  }, [medicines]);

  // Filtered master medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      const name = (med.medicineName || med.brandName || '').toLowerCase();
      const generic = (med.genericName || '').toLowerCase();
      const mfr = (med.manufacturer || '').toLowerCase();
      const code = (med.medicineCode || '').toLowerCase();
      const cat = (med.category || '').toLowerCase();
      const q = searchTerm.toLowerCase().trim();

      // Search match
      const matchesSearch = !q || 
        name.includes(q) || generic.includes(q) || mfr.includes(q) || code.includes(q) || cat.includes(q);

      // Category match
      const matchesCategory = categoryFilter === 'all' || med.category === categoryFilter;

      // Dosage Form match
      const matchesDosageForm = dosageFormFilter === 'all' || (med.dosageForm || med.form) === dosageFormFilter;

      return matchesSearch && matchesCategory && matchesDosageForm;
    });
  }, [medicines, searchTerm, categoryFilter, dosageFormFilter]);

  // Modal Handlers
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingMedicineId(null);
    setFormData({
      ...initialFormState,
      medicineCode: `MED-${Math.floor(100 + Math.random() * 900)}`,
    });
    setAddEditModalOpen(true);
  };

  const handleOpenEdit = (med) => {
    setIsEditMode(true);
    setEditingMedicineId(med.id);
    setFormData({
      medicineName: med.medicineName || med.brandName || '',
      genericName: med.genericName || '',
      brandName: med.brandName || med.medicineName || '',
      medicineCode: med.medicineCode || '',
      category: med.category || 'Antibiotics & Anti-Infectives',
      dosageForm: med.dosageForm || med.form || 'Tablet',
      strength: med.strength || med.power || '500 mg',
      unit: med.unit || 'mg',
      manufacturer: med.manufacturer || '',
      storageType: med.storageType || 'Room Temperature (15°C - 25°C)',
      description: med.description || '',
    });
    setAddEditModalOpen(true);
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    const name = formData.medicineName.trim();
    if (!name) {
      toast.error('Medicine name is required');
      return;
    }

    try {
      const payload = {
        medicineName: name,
        brandName: formData.brandName.trim() || name,
        genericName: formData.genericName.trim(),
        medicineCode: formData.medicineCode.trim(),
        category: formData.category,
        dosageForm: formData.dosageForm,
        form: formData.dosageForm,
        strength: formData.strength.trim(),
        power: formData.strength.trim(),
        unit: formData.unit.trim(),
        manufacturer: formData.manufacturer.trim(),
        storageType: formData.storageType,
        description: formData.description.trim(),
      };

      if (isEditMode && editingMedicineId) {
        await dispatch(updateAdminMedicine({ id: editingMedicineId, data: payload })).unwrap();
        toast.success(`Updated ${name} in master catalogue`);
      } else {
        await dispatch(addAdminMedicine(payload)).unwrap();
        toast.success(`Registered ${name} in master catalogue`);
      }
      setAddEditModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save master medicine');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteAdminMedicine(deleteTarget.id)).unwrap();
      toast.success(`Removed ${deleteTarget.medicineName || deleteTarget.brandName} from master catalogue`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error('Failed to delete medicine record');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-secondary-950 via-secondary-900 to-primary-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-primary-500/20 text-cyan-300 border border-primary-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Master Medicine Catalogue
            </span>
            <span className="text-xs text-slate-400 font-mono">Central Formulary Registry</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Central Medicine Management</h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal">
            Supervise accredited drug specifications, generic formulations, standard strengths, therapeutic categories, and verified pharmaceutical manufacturers.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Master Catalogue</span>
            <span className="text-xl font-black text-slate-900 font-mono">{medicines.length}</span>
            <span className="text-[11px] text-slate-500 block">Registered Medicines</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center">
            <Pill className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Categories</span>
            <span className="text-xl font-black text-slate-900 font-mono">{categories.length}</span>
            <span className="text-[11px] text-slate-500 block">Therapeutic Classes</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center">
            <Bookmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dosage Forms</span>
            <span className="text-xl font-black text-slate-900 font-mono">{dosageForms.length}</span>
            <span className="text-[11px] text-slate-500 block">Delivery Methods</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Manufacturers</span>
            <span className="text-xl font-black text-slate-900 font-mono">{manufacturers.length}</span>
            <span className="text-[11px] text-slate-500 block">Pharma Partners</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        
        {/* Row 1: Search & Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by medicine name, generic name, code, or manufacturer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[200px]"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Dosage Form:</span>
              <select
                value={dosageFormFilter}
                onChange={(e) => setDosageFormFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[180px]"
              >
                <option value="all">All Forms ({dosageForms.length})</option>
                {dosageForms.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || categoryFilter !== 'all' || dosageFormFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setDosageFormFilter('all');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-rose-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden w-full">
        {isLoading && medicines.length === 0 ? (
          <div className="py-20">
            <LoadingSpinner text="Loading central master medicine catalogue..." />
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No master medicines match current filters</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search keyword or clearing the category and dosage form filters.
            </p>
          </div>
        ) : (
          <div className="w-full">
            {/* Desktop Table View: 100% width, fixed layout, master catalogue columns */}
            <div className="hidden md:block w-full overflow-hidden">
              <table className="w-full divide-y divide-slate-200/80 text-xs table-fixed">
                <colgroup>
                  <col style={{ width: '22%' }} /> {/* Medicine Name */}
                  <col style={{ width: '18%' }} /> {/* Generic Name */}
                  <col style={{ width: '15%' }} /> {/* Category */}
                  <col style={{ width: '11%' }} /> {/* Dosage Form */}
                  <col style={{ width: '10%' }} /> {/* Strength */}
                  <col style={{ width: '14%' }} /> {/* Manufacturer */}
                  <col style={{ width: '10%' }} /> {/* Actions */}
                </colgroup>
                <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3 text-left">Medicine Name</th>
                    <th className="py-3 px-2 text-left">Generic Name</th>
                    <th className="py-3 px-2 text-left">Category</th>
                    <th className="py-3 px-2 text-left">Dosage Form</th>
                    <th className="py-3 px-1.5 text-center">Strength</th>
                    <th className="py-3 px-2 text-left">Manufacturer</th>
                    <th className="py-3 px-1.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredMedicines.map((med) => {
                    return (
                      <tr key={med.id} className="hover:bg-teal-50/20 transition-colors group">
                        
                        {/* 1. Medicine Name — Clickable to open Medicine Details! */}
                        <td className="py-3 px-3 overflow-hidden">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                              <Pill className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setDetailsMedicine(med)}
                                className="text-left font-bold text-slate-900 group-hover:text-primary-600 group-hover:underline transition-colors truncate block text-xs cursor-pointer focus:outline-none"
                                title={`View details for ${med.medicineName || med.brandName}`}
                              >
                                {med.medicineName || med.brandName}
                              </button>
                              <span className="text-[10px] text-slate-400 truncate block font-mono" title={med.medicineCode}>
                                {med.medicineCode || 'MED-CAT'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Generic Name */}
                        <td className="py-3 px-2 overflow-hidden">
                          <span className="text-slate-600 font-medium text-xs truncate block" title={med.genericName}>
                            {med.genericName || 'Standard Formulation'}
                          </span>
                        </td>

                        {/* 3. Category */}
                        <td className="py-3 px-2 overflow-hidden">
                          <span className="inline-block max-w-full truncate px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200" title={med.category}>
                            {med.category || 'Therapeutic'}
                          </span>
                        </td>

                        {/* 4. Dosage Form */}
                        <td className="py-3 px-2 overflow-hidden">
                          <span className="text-slate-700 font-medium text-xs truncate block" title={med.dosageForm || med.form}>
                            {med.dosageForm || med.form || 'Tablet'}
                          </span>
                        </td>

                        {/* 5. Strength */}
                        <td className="py-3 px-1.5 text-center overflow-hidden">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block truncate max-w-full" title={med.strength || med.power}>
                            {med.strength || med.power || '—'}
                          </span>
                        </td>

                        {/* 6. Manufacturer */}
                        <td className="py-3 px-2 overflow-hidden">
                          <span className="text-slate-600 font-medium text-xs truncate block" title={med.manufacturer}>
                            {med.manufacturer || 'Pharma Lab'}
                          </span>
                        </td>

                        {/* 7. Actions — Edit and Delete only (NO View Details button, NO Activate/Deactivate) */}
                        <td className="py-3 px-1.5 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(med)}
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              title="Edit Master Medicine"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(med)}
                              className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                              title="Delete Master Medicine"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredMedicines.map((med) => {
                return (
                  <div key={med.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetailsMedicine(med)}
                            className="text-left font-bold text-slate-900 text-xs truncate block hover:text-primary-600 hover:underline"
                          >
                            {med.medicineName || med.brandName}
                          </button>
                          <p className="text-[11px] text-slate-500 font-medium truncate">
                            {med.genericName || 'Standard Formulation'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 shrink-0">
                        {med.medicineCode || 'MED-CAT'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Category</span>
                        <span className="text-slate-700 font-medium truncate block">{med.category || 'Therapeutic'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Dosage Form</span>
                        <span className="text-slate-700 font-medium truncate block">{med.dosageForm || med.form || 'Tablet'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Strength</span>
                        <span className="font-mono font-bold text-slate-900">{med.strength || med.power || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Manufacturer</span>
                        <span className="text-slate-700 font-medium truncate block">{med.manufacturer || 'Pharma Lab'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 pt-1">
                      <button
                        onClick={() => handleOpenEdit(med)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Edit Medicine"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(med)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        title="Delete Medicine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* ADD / EDIT MASTER MEDICINE MODAL */}
      {/* ============================================================ */}
      <Modal
        isOpen={addEditModalOpen}
        onClose={() => setAddEditModalOpen(false)}
        title={isEditMode ? 'Edit Master Medicine Record' : 'Add New Medicine to Master Catalogue'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveMedicine} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            {/* Medicine Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Medicine Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Paracetamol 500 mg"
                value={formData.medicineName}
                onChange={(e) => setFormData({ ...formData, medicineName: e.target.value, brandName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium"
              />
            </div>

            {/* Generic Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Generic Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Paracetamol IP / Acetaminophen"
                value={formData.genericName}
                onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium"
              />
            </div>

            {/* Medicine Code */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Medicine Code (Catalogue ID)
              </label>
              <input
                type="text"
                placeholder="e.g. MED-PAR-500"
                value={formData.medicineCode}
                onChange={(e) => setFormData({ ...formData, medicineCode: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-mono font-bold text-primary-800"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Therapeutic Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-primary-500"
              >
                <option value="Analgesics & Antipyretics">Analgesics & Antipyretics</option>
                <option value="Antibiotics & Anti-Infectives">Antibiotics & Anti-Infectives</option>
                <option value="Critical Care / Antibiotic">Critical Care / Antibiotic</option>
                <option value="Cardiology / Hematology">Cardiology / Hematology</option>
                <option value="Diabetes Care">Diabetes Care</option>
                <option value="Gastroenterology">Gastroenterology</option>
                <option value="Respiratory">Respiratory</option>
                <option value="Oncology">Oncology</option>
                <option value="Steroids / Anti-inflammatory">Steroids / Anti-inflammatory</option>
                <option value="Anesthesia / Critical Care">Anesthesia / Critical Care</option>
                <option value="Emergency / Plasma expander">Emergency / Plasma expander</option>
              </select>
            </div>

            {/* Dosage Form */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Dosage Form *
              </label>
              <select
                value={formData.dosageForm}
                onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-primary-500"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection / Vial">Injection / Vial</option>
                <option value="Infusion Bottle">Infusion Bottle</option>
                <option value="Pre-filled Syringe / Pen">Pre-filled Syringe / Pen</option>
                <option value="Ampoule">Ampoule</option>
                <option value="Suspension">Suspension</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Ointment / Gel">Ointment / Gel</option>
                <option value="Drops">Drops</option>
              </select>
            </div>

            {/* Strength & Unit */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Strength *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 mg, 1g"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. mg, g, ml, IU"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>
            </div>

            {/* Manufacturer */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Manufacturer *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cipla Ltd, Sun Pharma, GSK"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium"
              />
            </div>

            {/* Storage Condition */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Storage Condition
              </label>
              <select
                value={formData.storageType}
                onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-primary-500"
              >
                <option value="Room Temperature (15°C - 25°C)">Room Temperature (15°C - 25°C)</option>
                <option value="Cold Storage (2°C - 8°C)">Cold Storage (2°C - 8°C)</option>
                <option value="Deep Freeze (-20°C)">Deep Freeze (-20°C)</option>
                <option value="Protect from Light (<25°C)">Protect from Light (&lt;25°C)</option>
                <option value="Dry & Cool (<25°C)">Dry & Cool (&lt;25°C)</option>
              </select>
            </div>

          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Therapeutic Description / Indications
            </label>
            <textarea
              rows="2"
              placeholder="Clinical indications, pharmacologic mechanism, and formulary notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-600/20"
            >
              {isEditMode ? 'Update Master Medicine' : 'Register in Master Catalogue'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* VIEW MASTER MEDICINE DETAILS MODAL */}
      {/* ============================================================ */}
      {detailsMedicine && (
        <Modal
          isOpen={Boolean(detailsMedicine)}
          onClose={() => setDetailsMedicine(null)}
          title="Master Medicine Dossier"
          subtitle="Official pharmaceutical formulation specifications and regulatory catalogue data."
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            
            {/* Header Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-primary-50/40 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-700 bg-primary-100/80 px-2 py-0.5 rounded">
                  {detailsMedicine.category || 'Pharmaceutical'}
                </span>
                <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                  {detailsMedicine.medicineCode || 'MED-CAT'}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900">{detailsMedicine.medicineName || detailsMedicine.brandName}</h3>
              <p className="text-slate-500 font-medium">Generic: {detailsMedicine.genericName || 'Active Formulation'}</p>
            </div>

            {/* Basic Information Section */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Basic Information</span>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">MEDICINE NAME</span>
                  <span className="font-semibold text-slate-800">{detailsMedicine.medicineName || detailsMedicine.brandName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">GENERIC NAME</span>
                  <span className="font-semibold text-slate-800">{detailsMedicine.genericName || 'Standard Composition'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">MEDICINE CODE</span>
                  <span className="font-mono font-bold text-cyan-800">{detailsMedicine.medicineCode || 'MED-CAT'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">CATEGORY</span>
                  <span className="font-semibold text-slate-800">{detailsMedicine.category || 'General Therapeutics'}</span>
                </div>
              </div>
            </div>

            {/* Pharmaceutical Information Section */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pharmaceutical Information</span>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">DOSAGE FORM</span>
                  <span className="font-semibold text-slate-800">{detailsMedicine.dosageForm || detailsMedicine.form || 'Tablet'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">STRENGTH / DOSAGE</span>
                  <span className="font-mono font-bold text-slate-800">{detailsMedicine.strength || detailsMedicine.power || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">UNIT</span>
                  <span className="font-semibold text-slate-800">{detailsMedicine.unit || 'mg'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold text-[10px] block">MANUFACTURER</span>
                  <span className="font-semibold text-slate-800">{detailsMedicine.manufacturer || 'Approved Pharmaceutical Lab'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-bold text-[10px] block">STORAGE CONDITION</span>
                  <span className="font-medium text-slate-700">{detailsMedicine.storageType || 'Room Temperature (15°C - 25°C)'}</span>
                </div>
                {detailsMedicine.description && (
                  <div className="col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400 font-bold text-[10px] block">DESCRIPTION & INDICATIONS</span>
                    <span className="text-slate-600 font-normal leading-relaxed">{detailsMedicine.description}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailsMedicine(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Catalogue Medicine Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
            <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Irreversible Action</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Are you sure you want to remove <span className="font-bold">{deleteTarget?.medicineName || deleteTarget?.brandName}</span> ({deleteTarget?.medicineCode}) from the Master Medicine Catalogue?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
            >
              Confirm Deletion
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AdminMedicineData;

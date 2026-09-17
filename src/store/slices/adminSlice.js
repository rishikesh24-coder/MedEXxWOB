import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { adminService } from '../../services/adminService';

export const fetchAdminDashboard = createAsyncThunk('admin/fetchDashboard', async (_, { rejectWithValue }) => {
  try {
    return await adminService.getDashboard();
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchHospitals = createAsyncThunk('admin/fetchHospitals', async (statusFilter, { rejectWithValue }) => {
  try {
    return await adminService.getHospitals(statusFilter);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const verifyHospitalAction = createAsyncThunk('admin/verifyHospital', async (hospitalId, { rejectWithValue }) => {
  try {
    return await adminService.verifyHospital(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const rejectHospitalAction = createAsyncThunk('admin/rejectHospital', async ({ hospitalId, reason }, { rejectWithValue }) => {
  try {
    return await adminService.rejectHospital(hospitalId, reason);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const suspendHospitalAction = createAsyncThunk('admin/suspendHospital', async ({ hospitalId, reason }, { rejectWithValue }) => {
  try {
    return await adminService.suspendHospital(hospitalId, reason);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const reactivateHospitalAction = createAsyncThunk('admin/reactivateHospital', async (hospitalId, { rejectWithValue }) => {
  try {
    return await adminService.reactivateHospital(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const setReviewStatusAction = createAsyncThunk('admin/setReviewStatus', async ({ hospitalId, status, note }, { rejectWithValue }) => {
  try {
    return await adminService.setReviewStatus(hospitalId, status, note);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const verifyHospitalDocumentAction = createAsyncThunk('admin/verifyDocument', async ({ hospitalId, documentId }, { rejectWithValue }) => {
  try {
    return await adminService.verifyHospitalDocument(hospitalId, documentId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const rejectHospitalDocumentAction = createAsyncThunk('admin/rejectDocument', async ({ hospitalId, documentId, reason }, { rejectWithValue }) => {
  try {
    return await adminService.rejectHospitalDocument(hospitalId, documentId, reason);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const updateDocumentReviewStatusAction = createAsyncThunk('admin/updateDocumentReviewStatus', async ({ hospitalId, documentId, status, note }, { rejectWithValue }) => {
  try {
    return await adminService.updateDocumentReviewStatus(hospitalId, documentId, status, note);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchHospitalDetails = createAsyncThunk('admin/fetchHospitalDetails', async (hospitalId, { rejectWithValue }) => {
  try {
    return await adminService.getHospitalDetails(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const updateHospitalDetailsAction = createAsyncThunk('admin/updateHospitalDetails', async ({ hospitalId, data }, { rejectWithValue }) => {
  try {
    return await adminService.updateHospitalDetails(hospitalId, data);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchAdminMedicines = createAsyncThunk('admin/fetchMedicines', async (hospitalId, { rejectWithValue }) => {
  try {
    return await adminService.getMedicineData(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const addAdminMedicine = createAsyncThunk('admin/addMedicine', async (medicineData, { rejectWithValue }) => {
  try {
    return await adminService.addMedicineToHospital(medicineData);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const updateAdminMedicine = createAsyncThunk('admin/updateMedicine', async ({ id, data }, { rejectWithValue }) => {
  try {
    return await adminService.updateMedicineData(id, data);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const deleteAdminMedicine = createAsyncThunk('admin/deleteMedicine', async (id, { rejectWithValue }) => {
  try {
    await adminService.deleteMedicineData(id);
    return id;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchAdminFeedbacks = createAsyncThunk('admin/fetchFeedbacks', async (ratingFilter, { rejectWithValue }) => {
  try {
    return await adminService.getFeedback(ratingFilter);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const replyAdminFeedback = createAsyncThunk('admin/replyFeedback', async ({ id, replyText }, { rejectWithValue }) => {
  try {
    return await adminService.replyFeedback(id, replyText);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    dashboardData: null,
    hospitals: [],
    selectedHospital: null,
    medicines: [],
    feedbacks: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    setSelectedHospital: (state, action) => {
      state.selectedHospital = action.payload;
    },
    clearAdminError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchAdminDashboard.pending, (state) => { state.isLoading = true; })
      .addCase(fetchAdminDashboard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dashboardData = action.payload;
      })
      .addCase(fetchAdminDashboard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Hospitals
      .addCase(fetchHospitals.pending, (state) => { state.isLoading = true; })
      .addCase(fetchHospitals.fulfilled, (state, action) => {
        state.isLoading = false;
        state.hospitals = action.payload;
      })
      .addCase(fetchHospitals.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Verification actions
      .addCase(verifyHospitalAction.fulfilled, (state, action) => {
        const index = state.hospitals.findIndex((h) => h.id === action.payload.id);
        if (index !== -1) state.hospitals[index] = action.payload;
        if (state.selectedHospital?.id === action.payload.id) {
          state.selectedHospital = action.payload;
        }
      })
      .addCase(rejectHospitalAction.fulfilled, (state, action) => {
        const index = state.hospitals.findIndex((h) => h.id === action.payload.id);
        if (index !== -1) state.hospitals[index] = action.payload;
        if (state.selectedHospital?.id === action.payload.id) {
          state.selectedHospital = action.payload;
        }
      })
      .addCase(setReviewStatusAction.fulfilled, (state, action) => {
        const index = state.hospitals.findIndex((h) => h.id === action.payload.id);
        if (index !== -1) state.hospitals[index] = action.payload;
        if (state.selectedHospital?.id === action.payload.id) {
          state.selectedHospital = action.payload;
        }
      })
      .addCase(suspendHospitalAction.fulfilled, (state, action) => {
        const index = state.hospitals.findIndex((h) => h.id === action.payload.id);
        if (index !== -1) state.hospitals[index] = action.payload;
        if (state.selectedHospital?.id === action.payload.id) state.selectedHospital = action.payload;
      })
      .addCase(reactivateHospitalAction.fulfilled, (state, action) => {
        const index = state.hospitals.findIndex((h) => h.id === action.payload.id);
        if (index !== -1) state.hospitals[index] = action.payload;
        if (state.selectedHospital?.id === action.payload.id) state.selectedHospital = action.payload;
      })
      .addCase(verifyHospitalDocumentAction.fulfilled, (state, action) => {
        const updatedHosp = action.payload.hospital;
        const index = state.hospitals.findIndex((h) => h.id === updatedHosp.id);
        if (index !== -1) state.hospitals[index] = updatedHosp;
        if (state.selectedHospital?.id === updatedHosp.id) state.selectedHospital = updatedHosp;
      })
      .addCase(rejectHospitalDocumentAction.fulfilled, (state, action) => {
        const updatedHosp = action.payload.hospital;
        const index = state.hospitals.findIndex((h) => h.id === updatedHosp.id);
        if (index !== -1) state.hospitals[index] = updatedHosp;
        if (state.selectedHospital?.id === updatedHosp.id) state.selectedHospital = updatedHosp;
      })
      .addCase(updateDocumentReviewStatusAction.fulfilled, (state, action) => {
        const updatedHosp = action.payload.hospital;
        const index = state.hospitals.findIndex((h) => h.id === updatedHosp.id);
        if (index !== -1) state.hospitals[index] = updatedHosp;
        if (state.selectedHospital?.id === updatedHosp.id) state.selectedHospital = updatedHosp;
      })

      // Details
      .addCase(fetchHospitalDetails.fulfilled, (state, action) => {
        state.selectedHospital = action.payload;
      })
      .addCase(updateHospitalDetailsAction.fulfilled, (state, action) => {
        state.selectedHospital = action.payload;
        const idx = state.hospitals.findIndex((h) => h.id === action.payload.id);
        if (idx !== -1) state.hospitals[idx] = action.payload;
      })

      // Medicines
      .addCase(fetchAdminMedicines.fulfilled, (state, action) => {
        state.medicines = action.payload;
      })
      .addCase(addAdminMedicine.fulfilled, (state, action) => {
        state.medicines.unshift(action.payload);
      })
      .addCase(updateAdminMedicine.fulfilled, (state, action) => {
        const idx = state.medicines.findIndex((m) => m.id === action.payload.id);
        if (idx !== -1) state.medicines[idx] = action.payload;
      })
      .addCase(deleteAdminMedicine.fulfilled, (state, action) => {
        state.medicines = state.medicines.filter((m) => m.id !== action.payload);
      })

      // Feedbacks
      .addCase(fetchAdminFeedbacks.fulfilled, (state, action) => {
        state.feedbacks = action.payload;
      })
      .addCase(replyAdminFeedback.fulfilled, (state, action) => {
        const idx = state.feedbacks.findIndex((f) => f.id === action.payload.id);
        if (idx !== -1) state.feedbacks[idx] = action.payload;
      });
  }
});

export const { setSelectedHospital, clearAdminError } = adminSlice.actions;
export default adminSlice.reducer;

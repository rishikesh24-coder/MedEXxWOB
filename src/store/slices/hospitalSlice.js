import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { hospitalService } from '../../services/hospitalService';
import { respondToRequest } from './requestSlice';

export const fetchHospitalDashboard = createAsyncThunk('hospital/fetchDashboard', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getDashboard(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchInventory = createAsyncThunk('hospital/fetchInventory', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getInventory(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const addMedicineItem = createAsyncThunk('hospital/addMedicine', async (medicineData, { rejectWithValue }) => {
  try {
    return await hospitalService.addMedicine(medicineData);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const updateMedicineItem = createAsyncThunk('hospital/updateMedicine', async ({ id, data }, { rejectWithValue }) => {
  try {
    return await hospitalService.updateMedicine(id, data);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const deleteMedicineItem = createAsyncThunk('hospital/deleteMedicine', async (id, { rejectWithValue }) => {
  try {
    await hospitalService.deleteMedicine(id);
    return id;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const importHospitalInventory = createAsyncThunk(
  'hospital/importInventory',
  async ({ hospitalId, itemsToCreate, itemsToUpdate, skippedCount, stats }, { rejectWithValue }) => {
    try {
      return await hospitalService.importInventoryBatch(hospitalId, {
        itemsToCreate,
        itemsToUpdate,
        skippedCount,
        stats,
      });
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchMarketplace = createAsyncThunk('hospital/fetchMarketplace', async ({ hospitalId, filters }, { rejectWithValue }) => {
  try {
    return await hospitalService.getMarketplace(hospitalId, filters);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchSalesHistory = createAsyncThunk('hospital/fetchSalesHistory', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getSalesHistory(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchPurchasesHistory = createAsyncThunk('hospital/fetchPurchasesHistory', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getPurchasesHistory(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchPaymentHistory = createAsyncThunk('hospital/fetchPaymentHistory', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getPaymentHistory(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const submitHospitalFeedback = createAsyncThunk('hospital/submitFeedback', async (data, { rejectWithValue }) => {
  try {
    return await hospitalService.submitFeedback(data);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchHospitalFeedbacks = createAsyncThunk('hospital/fetchFeedbacks', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getFeedbacks(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchHospitalDisposals = createAsyncThunk('hospital/fetchDisposals', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getHospitalDisposals(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const createHospitalWasteRequest = createAsyncThunk('hospital/createWasteRequest', async (wasteData, { rejectWithValue }) => {
  try {
    return await hospitalService.createWasteRequest(wasteData);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const disposeMedicineItem = createAsyncThunk('hospital/disposeMedicine', async (payload, { rejectWithValue }) => {
  try {
    return await hospitalService.disposeMedicine(payload);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const hospitalSlice = createSlice({
  name: 'hospital',
  initialState: {
    dashboardData: null,
    inventory: [],
    marketplace: [],
    salesHistory: [],
    purchasesHistory: [],
    payments: [],
    feedbacks: [],
    disposals: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    clearHospitalError: (state) => {
      state.error = null;
    },
    decrementInventoryStock: (state, action) => {
      const { medicineId, quantity } = action.payload;
      const idx = state.inventory.findIndex((m) => m.id === medicineId);
      if (idx !== -1) {
        state.inventory[idx].quantity = Math.max(0, state.inventory[idx].quantity - quantity);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchHospitalDashboard.pending, (state) => { state.isLoading = true; })
      .addCase(fetchHospitalDashboard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dashboardData = action.payload;
      })
      .addCase(fetchHospitalDashboard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Inventory
      .addCase(fetchInventory.pending, (state) => { state.isLoading = true; })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.inventory = action.payload;
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Add Medicine (handles both newly added records and merged duplicate stock)
      .addCase(addMedicineItem.fulfilled, (state, action) => {
        const existingIdx = state.inventory.findIndex((m) => m.id === action.payload.id);
        if (existingIdx !== -1) {
          state.inventory[existingIdx] = action.payload;
        } else {
          state.inventory.unshift(action.payload);
        }
      })

      // Update Medicine
      .addCase(updateMedicineItem.fulfilled, (state, action) => {
        const index = state.inventory.findIndex((m) => m.id === action.payload.id);
        if (index !== -1) state.inventory[index] = action.payload;
      })

      // Delete Medicine
      .addCase(deleteMedicineItem.fulfilled, (state, action) => {
        state.inventory = state.inventory.filter((m) => m.id !== action.payload);
      })

      // Import Hospital Inventory Batch
      .addCase(importHospitalInventory.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(importHospitalInventory.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.totalHospitalInventory) {
          state.inventory = action.payload.totalHospitalInventory;
        }
      })
      .addCase(importHospitalInventory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Marketplace
      .addCase(fetchMarketplace.pending, (state) => { state.isLoading = true; })
      .addCase(fetchMarketplace.fulfilled, (state, action) => {
        state.isLoading = false;
        state.marketplace = action.payload;
      })
      .addCase(fetchMarketplace.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Sales & Purchases
      .addCase(fetchSalesHistory.fulfilled, (state, action) => {
        state.salesHistory = action.payload;
      })
      .addCase(fetchPurchasesHistory.fulfilled, (state, action) => {
        state.purchasesHistory = action.payload;
      })

      // Payments
      .addCase(fetchPaymentHistory.fulfilled, (state, action) => {
        state.payments = action.payload;
      })

      // Disposals
      .addCase(fetchHospitalDisposals.fulfilled, (state, action) => {
        state.disposals = action.payload;
      })
      .addCase(createHospitalWasteRequest.fulfilled, (state, action) => {
        state.disposals.unshift(action.payload);
        if (action.payload.medicineId) {
          const idx = state.inventory.findIndex((m) => m.id === action.payload.medicineId);
          if (idx !== -1) state.inventory[idx].status = 'pending_disposal';
        }
      })
      .addCase(disposeMedicineItem.fulfilled, (state, action) => {
        const { updatedMedicine, newDisposal } = action.payload;
        if (updatedMedicine) {
          const idx = state.inventory.findIndex((m) => m.id === updatedMedicine.id);
          if (idx !== -1) {
            state.inventory[idx] = updatedMedicine;
          }
        }
        if (newDisposal) {
          state.disposals.unshift(newDisposal);
        }
      })

      // Feedback
      .addCase(fetchHospitalFeedbacks.fulfilled, (state, action) => {
        state.feedbacks = action.payload;
      })
      .addCase(submitHospitalFeedback.fulfilled, (state, action) => {
        state.feedbacks.unshift(action.payload);
      })

      // When a request is accepted, automatically sync seller's inventory in Redux!
      .addCase(respondToRequest.fulfilled, (state, action) => {
        const accepted = action.payload?.acceptedRequest || (action.payload?.status === 'accepted' ? action.payload : null);
        if (accepted && accepted.medicineId) {
          const idx = state.inventory.findIndex((m) => m.id === accepted.medicineId);
          if (idx !== -1) {
            state.inventory[idx].quantity = Math.max(0, state.inventory[idx].quantity - accepted.quantity);
          }
        }
      });
  }
});

export const { clearHospitalError, decrementInventoryStock } = hospitalSlice.actions;
export default hospitalSlice.reducer;

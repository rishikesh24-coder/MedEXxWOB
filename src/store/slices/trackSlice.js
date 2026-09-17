import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { hospitalService } from '../../services/hospitalService';
import { adminService } from '../../services/adminService';

export const fetchTrackingByTxn = createAsyncThunk('track/fetchByTxn', async (txnId, { rejectWithValue }) => {
  try {
    return await hospitalService.getTrackingByTxn(txnId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchAllTransfers = createAsyncThunk('track/fetchAllTransfers', async (_, { rejectWithValue }) => {
  try {
    return await adminService.getTransfers();
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const updateTransferMilestone = createAsyncThunk('track/updateMilestone', async ({ txnId, status }, { rejectWithValue }) => {
  try {
    return await adminService.updateTransferStatus(txnId, status);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchDisposals = createAsyncThunk('track/fetchDisposals', async (_, { rejectWithValue }) => {
  try {
    return await adminService.getDisposals();
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const updateDisposalMilestone = createAsyncThunk('track/updateDisposal', async ({ id, status, certNo }, { rejectWithValue }) => {
  try {
    return await adminService.updateDisposalStatus(id, status, certNo);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const trackSlice = createSlice({
  name: 'track',
  initialState: {
    currentTracking: null,
    allTransfers: [],
    disposals: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    clearTrackError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Current tracking
      .addCase(fetchTrackingByTxn.pending, (state) => { state.isLoading = true; })
      .addCase(fetchTrackingByTxn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTracking = action.payload;
      })
      .addCase(fetchTrackingByTxn.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // All transfers
      .addCase(fetchAllTransfers.fulfilled, (state, action) => {
        state.allTransfers = action.payload;
      })
      .addCase(updateTransferMilestone.fulfilled, (state, action) => {
        const idx = state.allTransfers.findIndex((t) => t.transactionId === action.payload.transactionId);
        if (idx !== -1) state.allTransfers[idx] = action.payload;
        if (state.currentTracking?.transactionId === action.payload.transactionId) {
          state.currentTracking = action.payload;
        }
      })

      // Disposals
      .addCase(fetchDisposals.fulfilled, (state, action) => {
        state.disposals = action.payload;
      })
      .addCase(updateDisposalMilestone.fulfilled, (state, action) => {
        const idx = state.disposals.findIndex((d) => d.id === action.payload.id);
        if (idx !== -1) state.disposals[idx] = action.payload;
      });
  }
});

export const { clearTrackError } = trackSlice.actions;
export default trackSlice.reducer;

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { hospitalService } from '../../services/hospitalService';

export const fetchOutgoingRequests = createAsyncThunk('requests/fetchOutgoing', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getOutgoingRequests(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchIncomingRequests = createAsyncThunk('requests/fetchIncoming', async (hospitalId, { rejectWithValue }) => {
  try {
    return await hospitalService.getIncomingRequests(hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const createNewRequest = createAsyncThunk('requests/createRequest', async (reqData, { rejectWithValue }) => {
  try {
    return await hospitalService.createRequest(reqData);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const respondToRequest = createAsyncThunk('requests/respond', async ({ requestId, action, reason, hospitalId }, { rejectWithValue }) => {
  try {
    return await hospitalService.handleRequest(requestId, action, reason, hospitalId);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const payForRequest = createAsyncThunk('requests/pay', async ({ requestId, paymentMethod }, { rejectWithValue }) => {
  try {
    return await hospitalService.processPayment({ requestId, paymentMethod });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const failPaymentForRequest = createAsyncThunk('requests/failPayment', async ({ requestId, reason }, { rejectWithValue }) => {
  try {
    return await hospitalService.failPayment({ requestId, reason });
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const cancelRequisition = createAsyncThunk(
  'requests/cancelRequisition',
  async ({ requestId, reason, note, hospitalId }, { rejectWithValue }) => {
    try {
      return await hospitalService.cancelRequest({ requestId, reason, note, hospitalId });
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const requestSlice = createSlice({
  name: 'requests',
  initialState: {
    outgoingRequests: [],
    incomingRequests: [],
    isProcessingPayment: false,
    isResponding: false,
    isLoading: false,
    error: null,
  },
  reducers: {
    clearRequestError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Outgoing
      .addCase(fetchOutgoingRequests.pending, (state) => { state.isLoading = true; })
      .addCase(fetchOutgoingRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.outgoingRequests = action.payload;
      })
      .addCase(fetchOutgoingRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Incoming
      .addCase(fetchIncomingRequests.pending, (state) => { state.isLoading = true; })
      .addCase(fetchIncomingRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.incomingRequests = action.payload;
      })
      .addCase(fetchIncomingRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Create Request
      .addCase(createNewRequest.fulfilled, (state, action) => {
        state.outgoingRequests.unshift(action.payload);
      })

      // Respond (Accept/Reject) with FIRST ACCEPTANCE WINS batch update
      .addCase(respondToRequest.pending, (state) => {
        state.isResponding = true;
        state.error = null;
      })
      .addCase(respondToRequest.fulfilled, (state, action) => {
        state.isResponding = false;
        const result = action.payload;
        const mainReq = result.acceptedRequest || result.updatedRequest || result;
        const rejectedCompeting = result.rejectedRequests || [];

        // Helper to update a request in an array
        const updateInList = (list, item) => {
          const idx = list.findIndex((r) => r.id === item.id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...item };
          }
        };

        // Update accepted/rejected main request
        if (mainReq && mainReq.id) {
          updateInList(state.incomingRequests, mainReq);
          updateInList(state.outgoingRequests, mainReq);
        }

        // Update all automatically rejected competing requests
        rejectedCompeting.forEach((compReq) => {
          updateInList(state.incomingRequests, compReq);
          updateInList(state.outgoingRequests, compReq);
        });
      })
      .addCase(respondToRequest.rejected, (state, action) => {
        state.isResponding = false;
        state.error = action.payload;
      })

      // Pay
      .addCase(payForRequest.pending, (state) => {
        state.isProcessingPayment = true;
      })
      .addCase(payForRequest.fulfilled, (state, action) => {
        state.isProcessingPayment = false;
        const updatedReq = action.payload.request;
        const idx = state.outgoingRequests.findIndex((r) => r.id === updatedReq.id);
        if (idx !== -1) state.outgoingRequests[idx] = updatedReq;
      })
      .addCase(payForRequest.rejected, (state, action) => {
        state.isProcessingPayment = false;
        state.error = action.payload;
      })

      // Fail Payment (Retry state)
      .addCase(failPaymentForRequest.pending, (state) => {
        state.isProcessingPayment = true;
      })
      .addCase(failPaymentForRequest.fulfilled, (state, action) => {
        state.isProcessingPayment = false;
        const updatedReq = action.payload.request;
        const idx = state.outgoingRequests.findIndex((r) => r.id === updatedReq.id);
        if (idx !== -1) state.outgoingRequests[idx] = updatedReq;
      })
      .addCase(failPaymentForRequest.rejected, (state, action) => {
        state.isProcessingPayment = false;
        state.error = action.payload;
      })

      // Cancel Requisition
      .addCase(cancelRequisition.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelRequisition.fulfilled, (state, action) => {
        state.isLoading = false;
        const cancelledReq = action.payload;
        if (cancelledReq && cancelledReq.id) {
          const outIdx = state.outgoingRequests.findIndex((r) => r.id === cancelledReq.id);
          if (outIdx !== -1) {
            state.outgoingRequests[outIdx] = { ...state.outgoingRequests[outIdx], ...cancelledReq };
          }
          const inIdx = state.incomingRequests.findIndex((r) => r.id === cancelledReq.id);
          if (inIdx !== -1) {
            state.incomingRequests[inIdx] = { ...state.incomingRequests[inIdx], ...cancelledReq };
          }
        }
      })
      .addCase(cancelRequisition.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});

export const { clearRequestError } = requestSlice.actions;
export default requestSlice.reducer;

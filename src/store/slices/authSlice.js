import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';
import { KEYS, getStoredItem } from '../../services/storage';

const initialSession = getStoredItem(KEYS.AUTH, null);

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const data = await authService.login(credentials);
    return data;
  } catch (err) {
    if (err.code === 'PENDING_ADMIN_APPROVAL') {
      return rejectWithValue({
        code: 'PENDING_ADMIN_APPROVAL',
        hospital: err.hospital,
        message: 'Your hospital registration is pending admin approval.',
      });
    }
    if (err.code === 'REGISTRATION_REJECTED') {
      return rejectWithValue({
        code: 'REGISTRATION_REJECTED',
        hospital: err.hospital,
        rejectionReason: err.rejectionReason,
        message: 'Hospital registration requires attention.',
      });
    }
    if (err.code === 'HOSPITAL_SUSPENDED') {
      return rejectWithValue({
        code: 'HOSPITAL_SUSPENDED',
        message: err.message || 'Hospital operational privileges have been suspended.',
      });
    }
    return rejectWithValue(err.message || 'Login failed');
  }
});

export const signupHospitalUser = createAsyncThunk('auth/signupHospital', async (formData, { rejectWithValue }) => {
  try {
    const data = await authService.signupHospital(formData);
    return data;
  } catch (err) {
    return rejectWithValue(err.message || 'Signup failed');
  }
});

export const signupAdminUser = createAsyncThunk('auth/signupAdmin', async (formData, { rejectWithValue }) => {
  try {
    const data = await authService.signupAdmin(formData);
    return data;
  } catch (err) {
    return rejectWithValue(err.message || 'Admin signup failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
  return null;
});

export const switchHospitalAction = createAsyncThunk('auth/switchHospital', async (hospitalId, { rejectWithValue }) => {
  try {
    const data = await authService.switchHospital(hospitalId);
    return data;
  } catch (err) {
    return rejectWithValue(err.message || 'Failed to switch hospital');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialSession?.user || null,
    token: initialSession?.token || null,
    role: initialSession?.user?.role || null,
    isAuthenticated: !!initialSession?.token,
    isLoading: false,
    error: null,
    registeredHospital: null,
  },
  reducers: {
    setUserSession: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = action.payload.user?.role;
      state.isAuthenticated = !!action.payload.token;
    },
    clearAuthError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Switch hospital
    builder.addCase(switchHospitalAction.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = 'hospital';
      state.isAuthenticated = true;
    });
    // Login
    builder.addCase(loginUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = action.payload.user.role;
      state.isAuthenticated = true;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = typeof action.payload === 'object' ? action.payload.message : action.payload;
    });

    // Signup Hospital (Pending Admin Approval - DO NOT authenticate immediately)
    builder.addCase(signupHospitalUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(signupHospitalUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.registeredHospital = action.payload?.hospital || null;
      // Newly registered hospital remains in pending state without active session
      state.user = null;
      state.token = null;
      state.role = null;
      state.isAuthenticated = false;
    });
    builder.addCase(signupHospitalUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // Signup Admin
    builder.addCase(signupAdminUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(signupAdminUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = 'admin';
      state.isAuthenticated = true;
    });
    builder.addCase(signupAdminUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // Logout
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.role = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    });
  }
});

export const { setUserSession, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

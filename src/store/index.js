import { configureStore, combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import hospitalReducer from './slices/hospitalSlice';
import adminReducer from './slices/adminSlice';
import requestReducer from './slices/requestSlice';
import trackReducer from './slices/trackSlice';

const appReducer = combineReducers({
  auth: authReducer,
  hospital: hospitalReducer,
  admin: adminReducer,
  requests: requestReducer,
  track: trackReducer,
});

const rootReducer = (state, action) => {
  if (action.type === 'auth/logout/fulfilled' || action.type === 'auth/logout/pending') {
    // Tenant isolation: Reset tenant-specific states to pristine initial states on logout
    state = {
      ...state,
      hospital: undefined,
      admin: undefined,
      requests: undefined,
      track: undefined,
    };
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import hospitalReducer from './slices/hospitalSlice';
import adminReducer from './slices/adminSlice';
import requestReducer from './slices/requestSlice';
import trackReducer from './slices/trackSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    hospital: hospitalReducer,
    admin: adminReducer,
    requests: requestReducer,
    track: trackReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;

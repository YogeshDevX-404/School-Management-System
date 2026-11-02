import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserRole } from '@/types';

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  theme: 'light' | 'dark';
}

const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) as 'light' | 'dark' | null;
const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const initialTheme = savedTheme ?? (prefersDark ? 'dark' : 'light');

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  theme: initialTheme,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setMobileSidebar: (state, action: PayloadAction<boolean>) => {
      state.mobileSidebarOpen = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', state.theme);
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme', state.theme);
    },
  },
});

export const { toggleSidebar, setMobileSidebar, toggleTheme, setTheme } = uiSlice.actions;
export default uiSlice.reducer;

interface AuthState {
  role: UserRole | null;
  rememberMe: boolean;
}

const initialAuth: AuthState = {
  role: null,
  rememberMe: (typeof localStorage !== 'undefined' && localStorage.getItem('rememberMe') === 'true') || false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuth,
  reducers: {
    setRole: (state, action: PayloadAction<UserRole | null>) => {
      state.role = action.payload;
    },
    setRememberMe: (state, action: PayloadAction<boolean>) => {
      state.rememberMe = action.payload;
      if (typeof localStorage !== 'undefined') localStorage.setItem('rememberMe', String(action.payload));
    },
  },
});

export const { setRole, setRememberMe } = authSlice.actions;

import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer,
    auth: authSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

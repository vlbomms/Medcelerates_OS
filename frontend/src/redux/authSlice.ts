import { jwtDecode } from 'jwt-decode';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  isPaidMember: boolean;
}

interface TokenPayload {
  id: string;
  exp: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{user: User, token: string, refreshToken: string}>) => {
      const { user, token, refreshToken } = action.payload;
      
      try {
        // Validate token
        const decoded = jwtDecode<TokenPayload>(token);
        const currentTime = Date.now() / 1000;
        
        if (decoded.exp < currentTime) {
          // Token is expired
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
        } else {
          state.user = user;
          state.token = token;
          state.refreshToken = refreshToken;
          state.isAuthenticated = true;
        }
      } catch (error) {
        // Invalid token
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    refreshToken: (state, action: PayloadAction<{token: string, refreshToken: string}>) => {
      try {
        const decoded = jwtDecode<TokenPayload>(action.payload.token);
        const currentTime = Date.now() / 1000;
        
        if (decoded.exp > currentTime) {
          state.token = action.payload.token;
          state.refreshToken = action.payload.refreshToken;
        } else {
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
        }
      } catch (error) {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      }
    }
  }
});

export const { login, logout, updateUser, refreshToken } = authSlice.actions;
export default authSlice.reducer;
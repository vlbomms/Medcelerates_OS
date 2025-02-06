import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  isPaidMember: boolean;
  subscriptionType?: string | null;
}

interface TokenPayload {
  id: string;
  email: string;
  exp: number;
}

interface SubscriptionDetails {
  status: 
    | 'ACTIVE_PAID' 
    | 'ACTIVE_TRIAL' 
    | 'EXPIRED_TRIAL' 
    | 'EXPIRED_PAID' 
    | 'NO_SUBSCRIPTION';
  canExtend: boolean;
  canPurchase: boolean;
  subscriptionEndDate?: string | null;
  trialEndDate?: string;
  trialStartDate?: string;
  subscriptionType?: string | null;
  subscriptionStartDate?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  subscriptionDetails?: SubscriptionDetails;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{
      user: User;
      token: string;
      refreshToken: string;
      subscriptionDetails: SubscriptionDetails;
    }>) => {
      const { user, token, refreshToken, subscriptionDetails } = action.payload;
      
      // Minimal logging, only log on first authentication or token change
      if (state.token !== token) {
        console.log('New token authenticated');
      }
      
      try {
        // Simplified token validation
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token format');
        }

        const payloadBase64 = tokenParts[1];
        const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload: TokenPayload = JSON.parse(payloadJson);
        
        if (!payload.id || !payload.email || !payload.exp) {
          throw new Error('Invalid token payload');
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
          throw new Error('Token has expired');
        }
        
        state.user = user;
        state.token = token;
        state.refreshToken = refreshToken;
        state.isAuthenticated = true;
        state.subscriptionDetails = subscriptionDetails;
      } catch (error) {
        console.error('Token validation failed');
        
        // Fallback to a more lenient approach
        state.user = user;
        state.token = token;
        state.refreshToken = refreshToken;
        state.isAuthenticated = !!token;
        state.subscriptionDetails = subscriptionDetails;
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.subscriptionDetails = undefined;
    },
    updateUserSubscription: (state, action: PayloadAction<{
      isPaidMember: boolean;
      subscriptionDetails?: SubscriptionDetails;
    }>) => {
      if (state.user) {
        state.user.isPaidMember = action.payload.isPaidMember;
      }
      state.subscriptionDetails = action.payload.subscriptionDetails;
    },
    refreshToken: (state, action: PayloadAction<{token: string, refreshToken: string}>) => {
      try {
        const tokenParts = action.payload.token.split('.');
        const payloadBase64 = tokenParts[1];
        const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        const decoded: TokenPayload = JSON.parse(payloadJson);
        
        const currentTime = Date.now() / 1000;
        
        if (decoded.exp > currentTime) {
          state.token = action.payload.token;
          state.refreshToken = action.payload.refreshToken;
        } else {
          // Token has expired, trigger logout
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Fallback to logout on refresh failure
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      }
    }
  }
});

export const { 
  login, 
  logout, 
  refreshToken,
  updateUserSubscription 
} = authSlice.actions;

export default authSlice.reducer;
import axios from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/authSlice';
import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}`,
  withCredentials: true,
});

// Token expiration check utility
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded: { exp: number } = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    
    // Consider token expired if it will expire in less than 5 minutes
    return decoded.exp < currentTime + 5 * 60;
  } catch (error) {
    return true; // If token is invalid, consider it expired
  }
};

// Token refresh utility
export const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  try {
    const response = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken }, {
      withCredentials: true
    });
    
    const { accessToken, refreshToken: newRefreshToken } = response.data;
    
    // Update token in Redux store
    store.dispatch({ type: 'refreshToken', payload: { token: accessToken, refreshToken: newRefreshToken } });
    
    return accessToken;
  } catch (error) {
    // If refresh fails, log out the user
    store.dispatch(logout());
    throw error;
  }
};

// Intercept requests to add token and check expiration
api.interceptors.request.use(
  async (config) => {
    const state = store.getState();
    let token = state.auth.token;
    const refreshToken = state.auth.refreshToken;
    
    if (token) {
      // Check if token is expired or about to expire
      if (isTokenExpired(token)) {
        if (refreshToken) {
          try {
            // Attempt to refresh the token
            token = await refreshAccessToken(refreshToken);
          } catch (error) {
            // If refresh fails, log out
            store.dispatch(logout());
            throw new Error('Token refresh failed');
          }
        } else {
          // No refresh token available
          store.dispatch(logout());
          throw new Error('No refresh token');
        }
      }
      
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept responses to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for unauthorized or token-related errors
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const state = store.getState();
      const refreshToken = state.auth.refreshToken;

      // Prevent infinite loops
      if (!originalRequest._retry && refreshToken) {
        originalRequest._retry = true;

        try {
          // Attempt to refresh the token
          const newToken = await refreshAccessToken(refreshToken);
          
          // Retry the original request with the new token
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // If refresh fails, log out
          store.dispatch(logout());
        }
      }

      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

// Authentication Services
export const authService = {
  register: async (
    email: string, 
    password: string, 
    subscriptionLength?: 'ONE_MONTH' | 'THREE_MONTHS',
    subscriptionType: 'ONE_TIME' | 'RECURRING' = 'ONE_TIME'
  ) => {
    try {
      const response = await api.post('/auth/register', { 
        email, 
        password, 
        subscriptionLength,
        subscriptionType
      });
      return response.data;
    } catch (error: any) {
      // Extract detailed error message
      const errorMessage = error.response?.data?.details 
        || error.response?.data?.error 
        || 'Registration failed';
      
      // Throw an error with the detailed message
      throw new Error(errorMessage);
    }
  },
  
  login: async (email: string, password: string) => {
    try {
      console.log('Attempting login with:', { email });
      const response = await api.post('/auth/login', { email, password });
      
      console.log('Login response:', response.data);
      
      const { 
        accessToken, 
        refreshToken, 
        userId, 
        email: userEmail, 
        isPaidMember,
        subscriptionDetails 
      } = response.data;

      console.log('Parsed login data:', {
        userId,
        userEmail,
        isPaidMember,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        subscriptionDetails
      });

      return {
        token: accessToken,
        user: {
          id: userId,
          email: userEmail,
          isPaidMember
        },
        refreshToken,
        subscriptionDetails
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Stripe One-time Payment
  createOneTimePayment: async (
    paymentMethodId: string, 
    subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
  ) => {
    const response = await api.post('/stripe/create-subscription', { 
      paymentMethodId, 
      subscriptionLength 
    });
    return response.data;
  },
  createCheckoutSession: async () => {
    const response = await api.post('/stripe/create-checkout-session');
    return response.data;
  },
  // Subscription Renewal
  renewSubscription: async (
    paymentMethodId: string, 
    subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
  ) => {
    const response = await api.post('/stripe/renew-subscription', { 
      paymentMethodId: paymentMethodId, 
      subscriptionLength: subscriptionLength 
    });
    return response.data;
  },
  // Subscribe to a new subscription
  subscribe: async (
    paymentMethodId: string, 
    subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
  ) => {
    const response = await api.post('/stripe/create-subscription', { 
      paymentMethodId, 
      subscriptionLength 
    });
    return response.data;
  },

  getMembershipStatus: async () => {
    try {
      const response = await api.get('/auth/membership-status');
      return response.data;
    } catch (error) {
      console.error('Error fetching membership status:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      // Call backend logout endpoint
      await api.post('/auth/logout');
    } catch (error) {
      // Silently handle logout errors
      console.warn('Logout backend call failed');
    }
  },

  // Fetch user's subscription status
  fetchSubscriptionStatus: async () => {
    try {
      const response = await api.get('/auth/subscription-status');
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription status', error);
      throw error;
    }
  },

  // Manage subscription (purchase or extend)
  manageSubscription: async (subscriptionType: string) => {
    try {
      const response = await api.post('/auth/manage-subscription', 
        { subscriptionType }
      );
      return response.data;
    } catch (error) {
      console.error('Error managing subscription', error);
      throw error;
    }
  },
};

// Subscription Status
export const getSubscriptionStatus = async () => {
  const response = await api.get('/auth/membership-status');
  return response.data;
};

export default api;
import axios from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/authSlice';
import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
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
    const response = await axios.post(`${API_URL}/api/auth/refresh-token`, { refreshToken }, {
      withCredentials: true
    });
    
    const { token, user } = response.data;
    
    // Update token in Redux store
    store.dispatch({ type: 'refreshToken', payload: { token, refreshToken } });
    
    return token;
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
  register: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { email, password });
      return {
        user: response.data.user,
        token: response.data.token,
        refreshToken: response.data.refreshToken
      };
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
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Stripe One-time Payment
  createOneTimePayment: async (paymentMethodId: string) => {
    const response = await api.post('/stripe/create-subscription', { paymentMethodId });
    return response.data;
  },
  createCheckoutSession: async () => {
    const response = await api.post('/stripe/create-checkout-session');
    return response.data;
  }
};

export default api;
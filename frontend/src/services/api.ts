import axios, { AxiosInstance } from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/authSlice';
import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, ''); // Remove trailing slashes

console.log('Full API Configuration:', {
  API_URL,
  FULL_URL: API_URL,
  ENV_VARS: {
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
  }
});

const api = axios.create({
  baseURL: API_URL, // Base URL without /api
  withCredentials: true,
});

// Extend the AxiosInstance interface to include custom methods
declare module 'axios' {
  interface AxiosInstance {
    register(
      email: string, 
      password: string, 
      subscriptionLength?: 'ONE_MONTH' | 'THREE_MONTHS',
      subscriptionType?: 'ONE_TIME' | 'RECURRING'
    ): Promise<any>;
    
    login(email: string, password: string): Promise<any>;
    
    createOneTimePayment(
      paymentMethodId: string, 
      subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
    ): Promise<any>;
    
    createCheckoutSession(): Promise<any>;
    
    renewSubscription(
      paymentMethodId: string, 
      subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
    ): Promise<any>;
    
    subscribe(
      paymentMethodId: string, 
      subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS',
      membershipStatus?: any
    ): Promise<any>;
    
    getMembershipStatus(): Promise<any>;
    logout(): Promise<any>;
    fetchSubscriptionStatus(): Promise<any>;
    manageSubscription(subscriptionType: string): Promise<any>;
    getSubscriptionStatus(): Promise<any>;
  }
}

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

// Enhanced request interceptor
api.interceptors.request.use(
  (config) => {
    // Prepend /api to the URL if not already present
    const cleanUrl = config.url?.startsWith('/api/') 
      ? config.url 
      : `/api${config.url?.startsWith('/') ? config.url : `/${config.url}`}`;
    
    const fullUrl = `${config.baseURL}${cleanUrl}`;
    
    console.group('API Request Details');
    console.log('Full Request URL:', fullUrl);
    console.log('Base URL:', config.baseURL);
    console.log('Endpoint:', cleanUrl);
    console.log('Method:', config.method);
    console.log('Request Data:', config.data);
    console.groupEnd();

    // Modify the config to use the clean URL
    config.url = cleanUrl;

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.group('API Error Details');
    console.error('Error Response:', error.response?.data);
    console.error('Error Status:', error.response?.status);
    console.error('Error Config:', {
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
    });
    console.groupEnd();

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

// Add method implementations to the api instance
api.register = async function(
  email: string, 
  password: string, 
  subscriptionLength?: 'ONE_MONTH' | 'THREE_MONTHS',
  subscriptionType: 'ONE_TIME' | 'RECURRING' = 'ONE_TIME'
) {
  console.log('Registering user:', { email, subscriptionLength, subscriptionType });
  const response = await this.post('/api/register', { 
    email, 
    password, 
    subscriptionLength, 
    subscriptionType 
  });
  return response.data;
};

api.login = async function(email: string, password: string) {
  const response = await this.post('/api/login', { email, password });
  return response.data;
};

api.createOneTimePayment = async function(
  paymentMethodId: string, 
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
) {
  const response = await this.post('/api/create-one-time-payment', { 
    paymentMethodId, 
    subscriptionLength 
  });
  return response.data;
};

api.createCheckoutSession = async function() {
  const response = await this.get('/api/create-checkout-session');
  return response.data;
};

api.renewSubscription = async function(
  paymentMethodId: string, 
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
) {
  const response = await this.post('/api/renew-subscription', { 
    paymentMethodId, 
    subscriptionLength 
  });
  return response.data;
};

api.subscribe = async function(
  paymentMethodId: string, 
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS',
  membershipStatus?: any
) {
  try {
    // Determine if user is an existing paid member
    const isExistingPaidMember = membershipStatus 
      ? (membershipStatus.status === 'ACTIVE_PAID' && membershipStatus.canExtend)
      : await checkIfExistingPaidMember();

    console.log('Attempting Subscription', {
      paymentMethodId, 
      subscriptionLength, 
      isExistingPaidMember,
      membershipStatus
    });

    const endpoint = isExistingPaidMember 
      ? '/api/stripe/renew-subscription' 
      : '/api/stripe/create-subscription';
    
    const response = await this.post(endpoint, { 
      paymentMethodId, 
      subscriptionLength,
      isExistingPaidMember
    });
    
    console.log('Subscription Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Subscription Error:', error);
    throw error;
  }
};

const checkIfExistingPaidMember = async (): Promise<boolean> => {
  try {
    const membershipStatus = await api.get('/api/auth/membership-status');
    return membershipStatus.data.status === 'ACTIVE_PAID' && membershipStatus.data.canExtend;
  } catch (error) {
    console.error('Error checking existing paid member status', error);
    return false;
  }
};

api.getMembershipStatus = async function() {
  try {
    console.log('Fetching Membership Status');
    
    const response = await this.get('/api/auth/membership-status');
    
    console.log('Membership Status Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch membership status:', error);
    throw error;
  }
};

api.logout = async function() {
  const response = await this.post('/api/logout');
  return response.data;
};

api.fetchSubscriptionStatus = async function() {
  const response = await this.get('/api/auth/membership-status');
  return response.data;
};

api.manageSubscription = async function(subscriptionType: string) {
  const response = await this.post('/api/manage-subscription', { subscriptionType });
  return response.data;
};

api.getSubscriptionStatus = async function() {
  const response = await this.get('/api/get-subscription-status');
  return response.data;
};

// Authentication Services
export const authService = {
  register: async (
    email: string, 
    password: string, 
    subscriptionLength?: 'ONE_MONTH' | 'THREE_MONTHS',
    subscriptionType: 'ONE_TIME' | 'RECURRING' = 'ONE_TIME'
  ) => {
    try {
      const response = await api.post('/api/auth/register', { 
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
      const response = await api.post('/api/auth/login', { email, password });
      
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
    const response = await api.post('/api/stripe/create-subscription', { 
      paymentMethodId, 
      subscriptionLength 
    });
    return response.data;
  },
  createCheckoutSession: async () => {
    const response = await api.post('/api/stripe/create-checkout-session');
    return response.data;
  },
  // Subscription Renewal
  renewSubscription: async (
    paymentMethodId: string, 
    subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
  ) => {
    const response = await api.post('/api/stripe/renew-subscription', { 
      paymentMethodId: paymentMethodId, 
      subscriptionLength: subscriptionLength 
    });
    return response.data;
  },
  // Subscribe to a new subscription
  subscribe: async (
    paymentMethodId: string, 
    subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS',
    membershipStatus?: any
  ) => {
    try {
      // Determine if user is an existing paid member
      const isExistingPaidMember = membershipStatus 
        ? (membershipStatus.status === 'ACTIVE_PAID' && membershipStatus.canExtend)
        : await checkIfExistingPaidMember();

      console.log('Attempting Subscription', {
        paymentMethodId, 
        subscriptionLength, 
        isExistingPaidMember,
        membershipStatus
      });

      const endpoint = isExistingPaidMember 
        ? '/api/stripe/renew-subscription' 
        : '/api/stripe/create-subscription';
      
      const response = await api.post(endpoint, { 
        paymentMethodId, 
        subscriptionLength,
        isExistingPaidMember
      });
      
      console.log('Subscription Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Subscription Error:', error);
      throw error;
    }
  },

  getMembershipStatus: async () => {
    try {
      const response = await api.get('/api/auth/membership-status');
      return response.data;
    } catch (error) {
      console.error('Error fetching membership status:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      // Call backend logout endpoint
      await api.post('/api/auth/logout');
    } catch (error) {
      // Silently handle logout errors
      console.warn('Logout backend call failed');
    }
  },

  // Fetch user's subscription status
  fetchSubscriptionStatus: async () => {
    try {
      const response = await api.get('/api/auth/membership-status');
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription status', error);
      throw error;
    }
  },

  // Manage subscription (purchase or extend)
  manageSubscription: async (subscriptionType: string) => {
    try {
      const response = await api.post('/api/auth/manage-subscription', 
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
  const response = await api.get('/api/auth/membership-status');
  return response.data;
};

export default api;
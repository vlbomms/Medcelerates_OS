import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../redux/authSlice';
import { authService } from '../services/api';
import { RootState } from '../redux/store';
import { isTokenExpired } from '../services/api';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Ensure Stripe key is set in environment
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [wantSubscription, setWantSubscription] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionLength, setSubscriptionLength] = useState<'ONE_MONTH' | 'THREE_MONTHS'>('ONE_MONTH');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  // Get authentication state from Redux
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);

  // Check authentication on component mount
  useEffect(() => {
    // If user is authenticated and token is not expired, redirect to dashboard
    if (isAuthenticated && token && !isTokenExpired(token)) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, token, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Explicitly convert and type subscription length
      const processedSubscriptionLength: SubscriptionLength = 
        subscriptionLength === 'THREE_MONTHS'
          ? 'THREE_MONTHS'
          : 'ONE_MONTH';

      // Validate inputs and card details
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      // Validate Stripe Elements
      let paymentMethodId: string | undefined;
      if (wantSubscription) {
        if (!stripe || !elements) {
          setError('Payment processing is not initialized');
          setIsLoading(false);
          return;
        }

        const cardElement = elements.getElement(CardElement);
        
        if (!cardElement) {
          setError('Please enter your card details');
          setIsLoading(false);
          return;
        }

        // Create payment method before navigation
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: { email }
        });

        if (error) {
          setError(error.message || 'Invalid card details');
          setIsLoading(false);
          return;
        }

        paymentMethodId = paymentMethod?.id;
      }

      // Register user
      const { token, user, refreshToken } = await authService.register(
        email, 
        password, 
        wantSubscription ? processedSubscriptionLength : undefined,
        wantSubscription ? 'ONE_TIME' : undefined
      );
      
      dispatch(login({
        user: {
          id: user.id,
          email: user.email,
          isPaidMember: user.isPaidMember
        },
        token,
        refreshToken,
        subscriptionDetails: {
          status: wantSubscription ? 'ACTIVE_PAID' : 'NO_SUBSCRIPTION',
          canExtend: true,
          canPurchase: true,
          subscriptionEndDate: wantSubscription 
            ? new Date(Date.now() + getSubscriptionDays(processedSubscriptionLength) * 24 * 60 * 60 * 1000).toISOString() 
            : null,
          ...(wantSubscription ? {} : {
            trialStartDate: undefined,
            trialEndDate: undefined
          })
        }
      }));

      // Process subscription if selected
      if (wantSubscription && paymentMethodId) {
        try {
          await authService.createOneTimePayment(
            paymentMethodId, 
            processedSubscriptionLength
          );
        } catch (subscriptionError: any) {
          // Log the detailed error
          console.error('One-time Payment creation error:', subscriptionError);
          
          // Set a user-friendly error message
          const errorMessage = subscriptionError.response?.data?.details 
            || subscriptionError.message 
            || 'Failed to process payment. Please try again.';
          
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
      }

      // Navigate after all async operations
      navigate('/dashboard', { 
        state: { 
          message: wantSubscription 
            ? 'Successfully registered and subscribed!' 
            : 'Successfully registered!' 
        } 
      });
    } catch (registrationError: any) {
      setError(registrationError.message);
      setIsLoading(false);
    }
  };

  // Prevent rendering if already authenticated
  if (isAuthenticated && token && !isTokenExpired(token)) {
    return null;
  }

  // Define a type for subscription length
  type SubscriptionLength = 'ONE_MONTH' | 'THREE_MONTHS';

  // Add a helper function to convert subscription length to days
  const getSubscriptionDays = (length: SubscriptionLength): number => {
    switch (length) {
      case 'ONE_MONTH': return 30;
      case 'THREE_MONTHS': return 90;
      default: return 30;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <form onSubmit={handleRegister} className="mt-8 space-y-6">
          {error && (
            <div className="text-red-500 text-center">
              {error}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="appearance-none rounded-md block w-full px-3 py-2 border border-gray-300"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="appearance-none rounded-md block w-full px-3 py-2 border border-gray-300"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
            className="appearance-none rounded-md block w-full px-3 py-2 border border-gray-300"
          />
          
          {/* Subscription Option */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="subscribe"
              checked={wantSubscription}
              onChange={() => setWantSubscription(!wantSubscription)}
              className="mr-2"
            />
            <label htmlFor="subscribe" className="text-sm">
              I want to subscribe to premium features
            </label>
          </div>

          {/* Subscription Length */}
          {wantSubscription && (
            <div>
              <label>Subscription Length:</label>
              <select 
                value={subscriptionLength}
                onChange={(e) => setSubscriptionLength(e.target.value as 'ONE_MONTH' | 'THREE_MONTHS')}
              >
                <option value="ONE_MONTH">1 Month</option>
                <option value="THREE_MONTHS">3 Months</option>
              </select>
            </div>
          )}

          {/* Stripe Card Element */}
          {wantSubscription && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Payment Details
              </label>
              <CardElement 
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Register: React.FC = () => {
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    const initStripe = async () => {
      try {
        await stripePromise;
        setStripeLoaded(true);
      } catch (error) {
        console.error('Failed to load Stripe:', error);
        setStripeError('Payment processing is currently unavailable');
      }
    };

    initStripe();
  }, []);

  if (stripeError) {
    return <div className="text-red-500">{stripeError}</div>;
  }

  if (!stripeLoaded) {
    return <div>Loading payment processing...</div>;
  }

  return (
    <Elements stripe={stripePromise}>
      <RegisterForm />
    </Elements>
  );
};

export default Register;
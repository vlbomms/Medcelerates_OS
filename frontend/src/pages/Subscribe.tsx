import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import axios from 'axios';

// Ensure Stripe key is set in environment
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const Subscribe: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  const handleSubscribe = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create checkout session
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/stripe/create-checkout-session`, 
        {}, 
        { withCredentials: true }
      );

      const stripe = await stripePromise;
      
      if (!stripe) {
        throw new Error('Stripe failed to initialize');
      }

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId
      });

      if (result.error) {
        throw result.error;
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.message || 'Failed to start subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4 text-center">Subscribe to Premium</h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            {error}
          </div>
        )}
        <button 
          onClick={handleSubscribe}
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
        >
          {isLoading ? 'Processing...' : 'Start Subscription'}
        </button>
        <p className="text-sm text-gray-600 mt-4 text-center">
          Unlock full access to all test prep resources
        </p>
      </div>
    </div>
  );
};

export default Subscribe;
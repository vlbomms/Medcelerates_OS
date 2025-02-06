import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { loadStripe, Stripe, StripeError, PaymentMethod } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

import Sidebar from '../components/Sidebar';
import { RootState } from '../redux/store';
import api from '../services/api';
import { updateUserSubscription } from '../redux/authSlice';

// Stripe configuration with error handling
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY).catch(error => {
  console.error('Failed to load Stripe:', error);
  return null;
});

const Subscribe: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [subscriptionLength, setSubscriptionLength] = useState<'ONE_MONTH' | 'THREE_MONTHS'>('ONE_MONTH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check Stripe initialization
    stripePromise.then(stripe => {
      if (!stripe) {
        setStripeError('Failed to initialize Stripe. Please check your configuration.');
      }
    });
  }, []);

  return (
    <PageLayout>
      <SidebarWrapper>
        <Sidebar />
      </SidebarWrapper>
      <MainContent>
        {stripeError && (
          <ErrorMessage>
            {stripeError}
          </ErrorMessage>
        )}
        <Elements stripe={stripePromise}>
          <SubscriptionForm 
            subscriptionLength={subscriptionLength}
            setSubscriptionLength={setSubscriptionLength}
            setIsProcessing={setIsProcessing}
            setError={setError}
            setSuccessMessage={setSuccessMessage}
            navigate={navigate}
            dispatch={dispatch}
            isProcessing={isProcessing}
            successMessage={successMessage}
          />
        </Elements>
      </MainContent>
    </PageLayout>
  );
};

interface SubscriptionFormProps {
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS';
  setSubscriptionLength: React.Dispatch<React.SetStateAction<'ONE_MONTH' | 'THREE_MONTHS'>>;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string | null>>;
  navigate: ReturnType<typeof useNavigate>;
  dispatch: ReturnType<typeof useDispatch>;
  isProcessing?: boolean;
  successMessage?: string | null;
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ 
  subscriptionLength, 
  setSubscriptionLength, 
  setIsProcessing, 
  setError, 
  setSuccessMessage, 
  navigate, 
  dispatch,
  isProcessing: propIsProcessing,
  successMessage: propSuccessMessage 
}) => {
  const [localIsProcessing, setLocalIsProcessing] = useState(false);
  const isProcessing = propIsProcessing ?? localIsProcessing;

  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccessMessage, setLocalSuccessMessage] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  // Sync error with parent component
  useEffect(() => {
    setError(localError);
  }, [localError, setError]);

  // Sync success message with parent component
  useEffect(() => {
    setSuccessMessage(localSuccessMessage);
  }, [localSuccessMessage, setSuccessMessage]);

  const createPaymentMethod = async (): Promise<{
    paymentMethod?: PaymentMethod;
    paymentMethodError?: StripeError;
  }> => {
    const stripe = await stripePromise;

    if (!stripe || !elements) {
      return { paymentMethodError: { type: 'validation_error', message: 'Stripe not initialized' } as StripeError };
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      return { paymentMethodError: { type: 'validation_error', message: 'Card details not found' } as StripeError };
    }

    try {
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        return { paymentMethodError: error };
      }

      return { paymentMethod: paymentMethod! };
    } catch (err) {
      return { paymentMethodError: { 
        type: 'api_error', 
        message: String(err),
        code: undefined,
        decline_code: undefined,
        param: undefined
      } as StripeError };
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsProcessing(true);
    setLocalIsProcessing(true);
    setLocalError(null);

    try {
      // First, check current membership status
      const membershipStatus = await api.getMembershipStatus();
      const isPaidMember = membershipStatus.isPaidMember;

      // Create payment method
      const { paymentMethod, paymentMethodError } = await createPaymentMethod();
      
      if (paymentMethodError) {
        setLocalError(paymentMethodError.message || 'An unknown error occurred');
        setIsProcessing(false);
        setLocalIsProcessing(false);
        return;
      }

      if (!paymentMethod) {
        setLocalError('Failed to create payment method');
        setIsProcessing(false);
        setLocalIsProcessing(false);
        return;
      }

      // Attempt to subscribe or extend membership
      const subscriptionResponse = await api.subscribe(
        paymentMethod.id, 
        subscriptionLength,
        isPaidMember // Pass current membership status
      );

      // Show success message based on membership status
      const successMessage = isPaidMember 
        ? 'Successfully extended your membership!' 
        : 'Successfully subscribed!';
      
      setLocalSuccessMessage(successMessage);
      
      // Optional: Refresh membership status
      await fetchSubscriptionDetails();
    } catch (error: any) {
      console.error('Comprehensive Subscription Error:', error);
      setLocalError(
        error.response?.data?.message || 
        error.message || 
        'An unexpected error occurred during subscription'
      );
    } finally {
      setIsProcessing(false);
      setLocalIsProcessing(false);
    }
  };

  const fetchSubscriptionDetails = async () => {
    try {
      const subscriptionDetails = await api.fetchSubscriptionStatus();
      dispatch(updateUserSubscription({
        isPaidMember: true,
        subscriptionDetails: subscriptionDetails
      }));
    } catch (error: any) {
      console.error('Error fetching subscription details:', error);
    }
  };

  return (
    <SubscribeCard>
      <CardHeader>
        <h2>Subscribe to Our Service</h2>
      </CardHeader>
      <SubscriptionOptions>
        <OptionButton 
          active={subscriptionLength === 'ONE_MONTH' ? 'true' : 'false'}
          onClick={() => setSubscriptionLength('ONE_MONTH')}
        >
          1 Month - $49.99
        </OptionButton>
        <OptionButton 
          active={subscriptionLength === 'THREE_MONTHS' ? 'true' : 'false'}
          onClick={() => setSubscriptionLength('THREE_MONTHS')}
        >
          3 Months - $69.99
        </OptionButton>
      </SubscriptionOptions>
      <form onSubmit={handleSubmit}>
        <CardElementContainer>
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
        </CardElementContainer>
        {localError && <ErrorMessage>{localError}</ErrorMessage>}
        {localSuccessMessage && <SuccessMessage>{localSuccessMessage}</SuccessMessage>}
        <SubmitButton 
          type="submit" 
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Subscribe Now'}
        </SubmitButton>
      </form>
    </SubscribeCard>
  );
};

// Styled components (keep existing styles from previous implementation)
const PageLayout = styled.div`
  display: flex;
  height: 100vh;
  position: relative;
`;

const SidebarWrapper = styled.div`
  width: 256px;
  background-color: #1f2937;
  position: relative;
  z-index: 1;
`;

const MainContent = styled.div`
  flex-grow: 1;
  background-color: #f4f6f9;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  margin-top: 60px;
`;

const SubscribeCard = styled.div`
  max-width: 600px;
  width: 100%;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  padding: 20px;
`;

const CardHeader = styled.div`
  background: linear-gradient(to right, #4299e1, #3182ce);
  color: white;
  padding: 20px;
  text-align: center;
  margin: -20px -20px 20px;
`;

const SubscriptionOptions = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const OptionButton = styled.button<{ active: string }>`
  flex: 1;
  margin: 0 10px;
  padding: 10px;
  border: 2px solid ${props => props.active === 'true' ? '#4299e1' : '#e2e8f0'};
  background-color: ${props => props.active === 'true' ? '#e6f2ff' : 'white'};
  color: ${props => props.active === 'true' ? '#4299e1' : '#718096'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: ${props => props.active === 'true' ? '#e6f2ff' : '#f7fafc'};
  }
`;

const CardElementContainer = styled.div`
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 15px;
  background-color: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #3182ce;
  }

  &:disabled {
    background-color: #a0aec0;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #e53e3e;
  background-color: #fff5f5;
  border: 1px solid #feb2b2;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 15px;
  text-align: center;
`;

const SuccessMessage = styled.div`
  color: #2ecc71;
  background-color: #f7f7f7;
  border: 1px solid #d6e9c6;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 15px;
  text-align: center;
`;

export default Subscribe;
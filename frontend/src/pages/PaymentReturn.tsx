import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import { handleApiError, getErrorMessage } from '../utils/errorHandler';

const PaymentReturn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const paymentStatus = searchParams.get('payment');

    const handlePaymentStatus = async () => {
      try {
        switch (paymentStatus) {
          case 'success':
            // Refresh membership status
            await authService.getMembershipStatus();
            navigate('/dashboard', { 
              state: { 
                message: 'Payment successful! Your subscription has been updated.' 
              } 
            });
            break;
          case 'processing':
            navigate('/dashboard', { 
              state: { 
                message: 'Payment is processing. Please check your dashboard for updates.' 
              } 
            });
            break;
          case 'failed':
            navigate('/subscribe', { 
              state: { 
                error: 'Payment failed. Please try a different payment method.' 
              } 
            });
            break;
          case 'error':
          default:
            navigate('/subscribe', { 
              state: { 
                error: 'An unexpected error occurred during payment. Please try again.' 
              } 
            });
        }
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        handleApiError(err);
        navigate('/subscribe', { 
          state: { 
            error: errorMessage || 'An error occurred while processing your payment.' 
          } 
        });
      }
    };

    handlePaymentStatus();
  }, [location, navigate]);

  return <div>Processing payment...</div>;
};

export default PaymentReturn;
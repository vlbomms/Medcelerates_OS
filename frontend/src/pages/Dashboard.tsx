import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { logout, login } from '../redux/authSlice';
import { RootState } from '../redux/store';
import styled from 'styled-components';
import { getSubscriptionStatus } from '../services/api';
import { 
  calculateRemainingTrialDays, 
  formatSubscriptionStatus,
  isTrialActive 
} from '../utils/subscriptionUtils';

// Styled components for modern, clean UI
const DashboardContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: #f4f6f9;
`;

const VerticalNavMenu = styled.nav`
  width: 250px;
  background-color: #ffffff;
  border-right: 1px solid #e0e4e8;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const NavButton = styled.button`
  width: 100%;
  padding: 12px 15px;
  margin: 5px 0;
  background-color: #f0f4f8;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  color: #102a43;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: #e2e8f0;
    border-color: #a0aec0;
  }

  &.active {
    background-color: #4299e1;
    color: white;
    border-color: #3182ce;
  }
`;

const TopNavBar = styled.header`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 15px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e4e8;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
`;

const LogoutButton = styled.button`
  background-color: #e53e3e;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #c53030;
  }
`;

const MainContent = styled.main`
  flex-grow: 1;
  padding: 80px 20px 20px;
  overflow-y: auto;
`;

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) 
  : Promise.resolve(null);

const Dashboard: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const subscriptionDetails = useSelector((state: RootState) => state.auth.subscriptionDetails);
  const isPaidMember = useSelector((state: RootState) => state.auth.user?.isPaidMember);

  const subscriptionStatusText = useMemo(() => {
    // Comprehensive logging of subscription details
    console.group('Dashboard - Subscription Status Calculation');
    console.log('Input Parameters:', {
      isPaidMember,
      subscriptionDetails: subscriptionDetails 
        ? JSON.stringify(subscriptionDetails, null, 2) 
        : 'undefined',
      subscriptionDetailsType: typeof subscriptionDetails
    });

    // Detailed type checking and logging
    console.log('Type Checks:', {
      isSubscriptionDetailsUndefined: subscriptionDetails === undefined,
      isSubscriptionDetailsNull: subscriptionDetails === null,
      hasStatus: subscriptionDetails && 'status' in subscriptionDetails,
      hasTrialStartDate: subscriptionDetails && 'trialStartDate' in subscriptionDetails,
      hasTrialEndDate: subscriptionDetails && 'trialEndDate' in subscriptionDetails
    });

    // Use the formatSubscriptionStatus function
    const statusText = formatSubscriptionStatus(
      !!isPaidMember, 
      subscriptionDetails
    );

    console.log('Calculated Status Text:', statusText);
    console.groupEnd();

    return statusText;
  }, [isPaidMember, subscriptionDetails]);

  const trialStatus = useMemo(() => {
    // Only consider trial active if not a paid member and has valid dates
    const trialStartDate = subscriptionDetails?.trialStartDate 
      ? new Date(subscriptionDetails.trialStartDate) 
      : null;
    const trialEndDate = subscriptionDetails?.trialEndDate 
      ? new Date(subscriptionDetails.trialEndDate) 
      : null;

    if (isPaidMember || !trialStartDate || !trialEndDate) {
      return false;
    }

    const remainingDays = calculateRemainingTrialDays(
      trialEndDate, 
      trialStartDate
    );

    // Trial is active only if remaining days is a number greater than 0
    return typeof remainingDays === 'number' && remainingDays > 0;
  }, [isPaidMember, subscriptionDetails]);

  const shouldShowTrialExpiredMessage = useMemo(() => {
    // Show expired message if:
    // 1. Not a paid member
    // 2. No trial dates, OR
    // 3. Remaining days is 0 or null
    if (isPaidMember) return false;

    if (!subscriptionDetails?.trialStartDate || !subscriptionDetails?.trialEndDate) {
      return true;
    }

    const trialStartDate = subscriptionDetails?.trialStartDate 
      ? new Date(subscriptionDetails.trialStartDate) 
      : null;
    const trialEndDate = subscriptionDetails?.trialEndDate 
      ? new Date(subscriptionDetails.trialEndDate) 
      : null;

    const remainingDays = calculateRemainingTrialDays(
      trialEndDate, 
      trialStartDate
    );

    return remainingDays === 0 || remainingDays === null;
  }, [isPaidMember, subscriptionDetails]);

  const handleLogout = async () => {
    try {
      await authService.logout(); // Invalidate tokens on backend
      dispatch(logout()); // Clear Redux state
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
      // Fallback to just clearing local state
      dispatch(logout());
      navigate('/login');
    }
  };

  const fetchMembershipStatus = async () => {
    try {
      // If we need to fetch additional details, do it here
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch membership status');
      setIsLoading(false);
    }
  };

  const handleUpgradeMembership = () => {
    if (subscriptionDetails?.status === 'EXPIRED_TRIAL') {
      // Redirect to purchase for trial users
      navigate('/checkout');
    } else if (subscriptionDetails?.status === 'EXPIRED_PAID') {
      // Redirect to renew for expired paid members
      navigate('/renew-subscription');
    } else {
      // Default behavior
      navigate('/checkout');
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      const status = await getSubscriptionStatus();
      // Only update if user exists
      if (user && token) {
        dispatch(login({
          user: {
            id: user.id,
            email: user.email,
            isPaidMember: user.isPaidMember,
            subscriptionType: user.subscriptionType
          },
          token: token, // Use existing token
          refreshToken: refreshToken || '', // Use existing refresh token
          subscriptionDetails: {
            status: status.status ?? 'INACTIVE',
            canExtend: status.canExtend || false,
            canPurchase: status.canPurchase || true,
            subscriptionEndDate: status.subscriptionEndDate !== null ? status.subscriptionEndDate : ''
          }
        }));
      } else {
        console.warn('Attempted to load subscription status without a logged-in user or valid token');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
      // Handle error (e.g., show error message, logout user)
    }
  };

  const handleSubscriptionAction = () => {
    // if (subscriptionStatus?.canPurchase) {
    //   navigate('/subscription');
    // }
  };

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user || !token) {
      navigate('/login');
      return;
    }

    let isMounted = true;

    const fetchAndUpdateSubscriptionStatus = async () => {
      try {
        // Only fetch status if user is authenticated
        const status = await getSubscriptionStatus();

        // Log only the essential subscription status details
        console.log('Subscription Status from Database:', {
          status: status.status,
          canExtend: status.canExtend,
          canPurchase: status.canPurchase,
          trialStartDate: status.trialStartDate,
          trialEndDate: status.trialEndDate
        });

        dispatch(login({
          user: {
            id: user.id,
            email: user.email,
            isPaidMember: user.isPaidMember,
            subscriptionType: user.subscriptionType
          },
          token: token,
          refreshToken: refreshToken || '',
          subscriptionDetails: {
            status: status.status ?? 'NO_SUBSCRIPTION',
            canExtend: status.canExtend || false,
            canPurchase: status.canPurchase || false,
            subscriptionType: status.subscriptionType,
            trialStartDate: status.trialStartDate,
            trialEndDate: status.trialEndDate,
            subscriptionStartDate: status.subscriptionStartDate,
            subscriptionEndDate: status.subscriptionEndDate
          }
        }));

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch membership status', err);
        setError('Failed to fetch membership status');
        setIsLoading(false);
      }
    };

    fetchAndUpdateSubscriptionStatus();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, [dispatch, user, token, refreshToken, navigate]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <DashboardContainer>
      <TopNavBar>
        <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
      </TopNavBar>

      <VerticalNavMenu>
        <NavButton 
          className="active"
        >
          Dashboard
        </NavButton>
      </VerticalNavMenu>

      <MainContent>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
              <div className="p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Membership</h1>
                
                <div>
                  <h2 className="text-xl font-semibold mb-4">Membership Status</h2>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-700">
                      {subscriptionStatusText}
                    </p>
                    
                    {trialStatus && subscriptionDetails?.trialEndDate && (
                      <p className="text-blue-600 mt-2">
                        {calculateRemainingTrialDays(subscriptionDetails.trialEndDate, subscriptionDetails.trialStartDate)} days remaining in your free trial
                      </p>
                    )}
                    
                    {shouldShowTrialExpiredMessage && (
                      <p className="text-red-600 mt-2">
                        Your trial has expired. Please purchase a membership.
                      </p>
                    )}
                  </div>
                  
                  {(!isPaidMember && subscriptionDetails?.trialEndDate) || (!isPaidMember && !subscriptionDetails?.trialEndDate) ? (
                    <button 
                      onClick={handleUpgradeMembership}
                      className="mt-4 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
                    >
                      Upgrade Now
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainContent>
    </DashboardContainer>
  );
};

export default Dashboard;
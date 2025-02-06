// src/pages/Profile.tsx
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
import Sidebar from '../components/Sidebar';

// Styled components for modern, clean UI
const PageLayout = styled.div`
  display: flex;
  height: 100vh;
  position: relative;
`;

const SidebarWrapper = styled.div`
  width: 256px; // Match the width of the Sidebar
  background-color: #1f2937; // Dark background to match Sidebar
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
  margin-top: 60px; // Add margin to prevent TopNavBar overlay
`;

const TopNavBar = styled.header`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 15px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e4e8;
  position: fixed;
  top: 0;
  left: 256px; // Align with sidebar width
  right: 0;
  z-index: 10;
  height: 60px;
`;

const ProfileCard = styled.div`
  max-width: 600px;
  width: 100%;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const CardHeader = styled.div`
  background: linear-gradient(to right, #4299e1, #3182ce);
  color: white;
  padding: 20px;
  text-align: center;
`;

const CardContent = styled.div`
  padding: 20px;
`;

const SubscriptionStatus = styled.div`
  background-color: #f0f4f8;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
`;

const UpgradeButton = styled.button`
  width: 100%;
  padding: 12px;
  background-color: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  margin-top: 15px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #3182ce;
  }
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

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) 
  : Promise.resolve(null);

const Profile: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    trialStartDate?: string | null;
    trialEndDate?: string | null;
    subscriptionType?: string | null;
    subscriptionEndDate?: string | null;
    status?: 'ACTIVE_PAID' | 'INACTIVE' | 'TRIAL' | 'EXPIRED' | 'PENDING' | 'EXPIRED_TRIAL' | 'EXPIRED_PAID' | undefined;
    canExtend?: boolean;
    canPurchase?: boolean;
  }>({});
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const isPaidMember = useSelector((state: RootState) => state.auth.user?.isPaidMember);

  const mapSubscriptionStatus = (status?: string | null): 'ACTIVE_PAID' | 'ACTIVE_TRIAL' | 'EXPIRED_TRIAL' | 'EXPIRED_PAID' | 'NO_SUBSCRIPTION' => {
    switch (status) {
      case 'ACTIVE_PAID':
      case 'ACTIVE_TRIAL':
      case 'EXPIRED_TRIAL':
      case 'EXPIRED_PAID':
      case 'NO_SUBSCRIPTION':
        return status;
      case 'INACTIVE':
        return 'NO_SUBSCRIPTION';
      case 'PENDING':
        return 'NO_SUBSCRIPTION';
      case 'TRIAL':
        return 'ACTIVE_TRIAL';
      case 'EXPIRED':
        return 'EXPIRED_PAID';
      default:
        return 'NO_SUBSCRIPTION';
    }
  };

  const subscriptionStatusText = useMemo(() => {
    // Use the formatSubscriptionStatus function
    const statusText = formatSubscriptionStatus(
      !!isPaidMember, 
      subscriptionDetails ? {
        ...subscriptionDetails,
        status: mapSubscriptionStatus(subscriptionDetails.status)
      } : {}
    );

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

  useEffect(() => {
    let isMounted = true;
    let fetchedOnce = false;

    const fetchSubscriptionDetails = async () => {
      // Prevent multiple fetches
      if (fetchedOnce) return;

      try {
        // Only fetch if not already fetched
        const status = await getSubscriptionStatus();
        
        if (isMounted) {
          setSubscriptionDetails(status);
          setIsLoading(false);
          fetchedOnce = true;
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch subscription details', err);
          setError('Failed to load subscription details');
          setIsLoading(false);
        }
      }
    };

    // Only fetch if user is authenticated
    if (user && token) {
      fetchSubscriptionDetails();
    }

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array ensures this runs only once

  if (isLoading) return (
    <PageLayout>
      <SidebarWrapper>
        <Sidebar />
      </SidebarWrapper>
      <MainContent>
        <div>Loading...</div>
      </MainContent>
    </PageLayout>
  );

  if (error) return (
    <PageLayout>
      <SidebarWrapper>
        <Sidebar />
      </SidebarWrapper>
      <MainContent>
        <div>Error: {error}</div>
      </MainContent>
    </PageLayout>
  );

  return (
    <PageLayout>
      <SidebarWrapper>
        <Sidebar />
      </SidebarWrapper>
      <MainContent>
        <TopNavBar>
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
        </TopNavBar>
        <ProfileCard>
          <CardHeader>
            <h1 className="text-2xl font-bold">User Profile</h1>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Personal Information</h2>
              <p className="text-gray-600">Email: {user?.email}</p>
              <p className="text-gray-600">User ID: {user?.id}</p>
            </div>

            <SubscriptionStatus>
              <h2 className="text-lg font-semibold mb-3">Subscription Details</h2>
              <p>Status: {subscriptionStatusText}</p>
              
              {subscriptionDetails?.trialEndDate && (
                <p className="text-blue-600 mt-2">
                  Trial End Date: {new Date(subscriptionDetails.trialEndDate).toLocaleDateString()}
                </p>
              )}
              
              {subscriptionDetails?.subscriptionEndDate && (
                <p className="text-blue-600 mt-2">
                  Subscription End Date: {new Date(subscriptionDetails.subscriptionEndDate).toLocaleDateString()}
                </p>
              )}
              
              {!subscriptionDetails?.trialEndDate && !subscriptionDetails?.subscriptionEndDate && (
                <p className="text-red-600 mt-2">No Active Subscription</p>
              )}
            </SubscriptionStatus>

            {shouldShowTrialExpiredMessage && (
              <div>
                <p>Your trial has expired. Please upgrade your membership.</p>
                <UpgradeButton onClick={handleUpgradeMembership}>Upgrade Now</UpgradeButton>
              </div>
            )}
          </CardContent>
        </ProfileCard>
      </MainContent>
    </PageLayout>
  );
};

export default Profile;
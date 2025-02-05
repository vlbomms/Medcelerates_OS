export const calculateRemainingTrialDays = (trialEndDate?: Date | string | null, trialStartDate?: Date | string | null): number | null => {
  // Convert string dates to Date objects if needed
  const endDate = trialEndDate instanceof Date ? trialEndDate : trialEndDate ? new Date(trialEndDate) : null;
  const startDate = trialStartDate instanceof Date ? trialStartDate : trialStartDate ? new Date(trialStartDate) : null;

  console.log({
    trialEndDate: endDate ? endDate.toISOString() : 'undefined/null',
    trialStartDate: startDate ? startDate.toISOString() : 'undefined/null',
    trialEndDateType: typeof endDate,
    trialStartDateType: typeof startDate,
    now: new Date().toISOString()
  });

  // Explicitly check for undefined, null
  if (!endDate || !startDate) {
    console.log({
      trialEndDate: endDate,
      trialStartDate: startDate
    });
    return null;
  }

  const now = new Date();
  
  // Validate date parsing
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.log({
      trialStartDate: startDate,
      trialEndDate: endDate
    });
    return null;
  }

  // If trial hasn't started yet (shouldn't happen, but just in case)
  if (now < startDate) {
    console.log({
      now: now.toISOString(),
      startDate: startDate.toISOString()
    });
    return null;
  }

  // If the end date is in the future, calculate remaining days
  if (endDate > now) {
    const differenceMs = endDate.getTime() - now.getTime();
    const remainingDays = Math.ceil(differenceMs / (24 * 60 * 60 * 1000));
    
    console.log({
      remainingDays,
      now: now.toISOString(),
      endDate: endDate.toISOString(),
      differenceMs
    });
    
    return remainingDays;
  }

  // If end date is in the past, return 0 to indicate trial has just expired
  const daysSinceTrialEnd = Math.ceil((now.getTime() - endDate.getTime()) / (24 * 60 * 60 * 1000));
  
  console.log({
    daysSinceTrialEnd,
    now: now.toISOString(),
    endDate: endDate.toISOString()
  });

  // Return 0 if trial just ended (within 1 day), null if more than a day has passed
  return daysSinceTrialEnd <= 1 ? 0 : null;
};

export const isTrialActive = (trialEndDate?: Date | null, trialStartDate?: Date | null): boolean => {
  if (!trialEndDate || !trialStartDate) return false;

  const startDate = trialStartDate;
  const endDate = trialEndDate;
  const now = new Date();
  
  return now >= startDate && now <= endDate;
};

export const formatSubscriptionStatus = (
  isPaidMember: boolean, 
  subscriptionDetails?: {
    trialStartDate?: string | null;
    trialEndDate?: string | null;
    subscriptionType?: string | null;
    subscriptionEndDate?: string | null;
    status?: 'ACTIVE_PAID' | 'ACTIVE_TRIAL' | 'EXPIRED_TRIAL' | 'EXPIRED_PAID' | 'NO_SUBSCRIPTION';
    canExtend?: boolean;
    canPurchase?: boolean;
  } | undefined
): string => {
  // Comprehensive logging of input parameters
  console.group('formatSubscriptionStatus - Detailed Diagnostic');
  console.log('Input Parameters:', {
    isPaidMember,
    subscriptionDetails: subscriptionDetails ? JSON.stringify(subscriptionDetails, null, 2) : 'undefined',
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

  // If no subscription details, handle accordingly
  if (!subscriptionDetails) {
    console.warn('No Subscription Details Provided');
    console.groupEnd();
    return isPaidMember ? 'Paid Membership Active' : 'No Subscription';
  }

  // If paid member, always return paid membership status
  if (isPaidMember) {
    console.log('User is a Paid Member');
    console.groupEnd();
    return 'Paid Membership Active';
  }

  // If no status in details, return no subscription
  if (!subscriptionDetails.status) {
    console.warn('No Status in Subscription Details');
    console.groupEnd();
    return 'No Subscription';
  }

  // Detailed logging for trial dates
  console.log('Trial Date Details:', {
    trialStartDate: subscriptionDetails.trialStartDate,
    trialEndDate: subscriptionDetails.trialEndDate,
    trialStartDateType: typeof subscriptionDetails.trialStartDate,
    trialEndDateType: typeof subscriptionDetails.trialEndDate
  });

  // Handle different subscription statuses
  switch (subscriptionDetails.status) {
    case 'ACTIVE_TRIAL':
      // If no trial dates are available, but status is ACTIVE_TRIAL
      if (!subscriptionDetails.trialStartDate || !subscriptionDetails.trialEndDate) {
        console.error('Active Trial Status Without Dates', {
          canExtend: subscriptionDetails.canExtend,
          canPurchase: subscriptionDetails.canPurchase
        });
        console.groupEnd();
        return 'Free Trial (Limited)';
      }

      // Convert string dates to Date objects
      const trialStartDate = new Date(subscriptionDetails.trialStartDate);
      const trialEndDate = new Date(subscriptionDetails.trialEndDate);

      console.log('Converted Trial Dates:', {
        trialStartDate: trialStartDate.toISOString(),
        trialEndDate: trialEndDate.toISOString()
      });

      const remainingDays = calculateRemainingTrialDays(trialEndDate.toISOString(), trialStartDate.toISOString());
      
      console.log('Remaining Days Calculation:', {
        remainingDays,
        trialEndDate: trialEndDate.toISOString(),
        trialStartDate: trialStartDate.toISOString()
      });
      
      const result = remainingDays !== null && remainingDays > 0 
        ? `Free Trial (${remainingDays} days remaining)` 
        : 'Trial Expired';

      console.log('Final Result:', result);
      console.groupEnd();
      return result;

    case 'EXPIRED_TRIAL':
      console.log('Expired Trial Status');
      console.groupEnd();
      return 'Trial Expired';
    case 'EXPIRED_PAID':
      console.log('Expired Paid Membership Status');
      console.groupEnd();
      return 'Subscription Expired';
    case 'NO_SUBSCRIPTION':
      console.log('No Subscription Status');
      console.groupEnd();
      return 'No Subscription';
    default:
      console.warn('Unknown Subscription Status');
      console.groupEnd();
      return 'Unknown Status';
  }
};
import { AxiosError } from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/authSlice';

export const handleApiError = (error: any) => {
  // Check if error is an Axios error
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message || error.message;

    console.error('API Error Details', {
      status,
      message: errorMessage,
      fullError: error
    });

    // Handle specific error scenarios
    switch (status) {
      case 401: // Unauthorized
        // Dispatch logout action
        store.dispatch(logout());
        window.location.href = '/login';
        break;
      case 403: // Forbidden
        // Redirect to unauthorized page or show error
        window.location.href = '/unauthorized';
        break;
      case 404: // Not Found
        console.warn('Requested resource not found');
        break;
      case 500: // Server Error
        console.error('Internal Server Error');
        break;
      default:
        // Generic error handling
        console.error('An unexpected error occurred');
    }
  } else {
    // Handle non-Axios errors
    console.error('Unexpected Error', error);
  }

  // Optional: You can add toast notifications or error tracking here
  // For example:
  // toast.error(errorMessage || 'An unexpected error occurred');
};

// Helper function to extract error message
export const getErrorMessage = (error: any): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message;
  }
  return error instanceof Error ? error.message : String(error);
};
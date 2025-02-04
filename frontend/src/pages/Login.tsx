import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../redux/authSlice';
import { authService } from '../services/api';
import { RootState } from '../redux/store';
import { isTokenExpired } from '../services/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Get authentication state from Redux
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);

  // Check authentication on component mount
  useEffect(() => {
    // If user is authenticated and token is not expired, redirect to dashboard
    if (isAuthenticated && token && !isTokenExpired(token)) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, token, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { token, user } = await authService.login(email, password);
      
      dispatch(login({
        user: {
          id: user.id,
          email: user.email,
          isPaidMember: user.isPaidMember
        },
        token,
        refreshToken: user.refreshToken
      }));

      navigate('/dashboard');
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      console.error(err);
    }
  };

  // If already authenticated, don't render login form
  if (isAuthenticated && token && !isTokenExpired(token)) {
    return null; // Prevents rendering of login form
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <form onSubmit={handleLogin} className="mt-8 space-y-6">
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
          <button
            type="submit"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
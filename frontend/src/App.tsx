import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './redux/store';
import ProtectedRoute from './components/ProtectedRoute';

// Authentication and Subscription
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Subscribe from './pages/Subscribe';
import Login from './pages/Login';
import Register from './pages/Register';
import PaymentReturn from './pages/PaymentReturn';

// Test-related Components
import CreateTest from './pages/CreateTest';
import TestView from './pages/TestView';
import ViewTests from './pages/ViewTests';
import TestInterface from './pages/TestInterface';
import TestResults from './pages/TestResults';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Router>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Subscription Routes */}
            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/payment/return" element={<PaymentReturn />} />

            {/* Test Management Routes */}
            <Route path="/create-test" element={<CreateTest />} />
            <Route 
              path="/test/:testId" 
              element={
                <ProtectedRoute>
                  <TestView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/view-tests" 
              element={
                <ProtectedRoute>
                  <ViewTests />
                </ProtectedRoute>
              } 
            />

            {/* New Test Interface and Results Routes */}
            <Route 
              path="/test/:testId/interface" 
              element={
                <ProtectedRoute>
                  <TestInterface />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/test/:testId/results" 
              element={
                <ProtectedRoute>
                  <TestResults />
                </ProtectedRoute>
              } 
            />

            {/* Protected Dashboard Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </PersistGate>
    </Provider>
  );
};

export default App;
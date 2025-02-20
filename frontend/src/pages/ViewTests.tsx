import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../redux/store';

interface Test {
  id: string;
  testId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  _count: {
    testQuestions: number;
  };
}

const ViewTests: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const token = useSelector((state: RootState) => state.auth.token);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTests = async () => {
      try {
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get('http://localhost:8000/api/tests', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        setTests(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch tests', error);
        setError('Failed to load tests. Please try again.');
        setIsLoading(false);
      }
    };

    fetchTests();
  }, [token]);

  const handleTestClick = (testId: string) => {
    // Navigate to the new test interface
    navigate(`/test/${testId}/interface`);
  };

  if (isLoading) return <div>Loading tests...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="view-tests-container">
      <h1>Your Tests</h1>
      {tests.length === 0 ? (
        <p>No tests found. Create a test to get started!</p>
      ) : (
        <div className="tests-list">
          {tests.map(test => (
            <div 
              key={test.id} 
              className="test-item"
              onClick={() => handleTestClick(test.id)}
            >
              <div>Test ID: {test.testId}</div>
              <div>Status: {test.status}</div>
              <div>Created: {new Date(test.createdAt).toLocaleString()}</div>
              <div>Questions: {test._count.testQuestions}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewTests;
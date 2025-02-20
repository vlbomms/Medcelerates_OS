import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

interface TestQuestion {
    id: string;
    questionId: string;
    userAnswer: string | null;
    isCorrect: boolean;
    question: {
      id: string;
      questionHtml: string;
      answerChoicesHtml: string;
      explanationHtml?: string;
      passage?: {
        passageHtml: string;
      };
      correctAnswer: string; // Add this field
    };
}
  
interface TestResultData {
    id: string;
    testId: string;
    status: string;
    score: number;
    totalQuestions: number;
    correctQuestions: number;
    testQuestions: TestQuestion[];
}  

const TestResults: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [testResults, setTestResults] = useState<TestResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTestResults = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/tests/${testId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        setTestResults(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch test results:', err);
        setError('Failed to load test results');
        setLoading(false);
      }
    };

    if (testId && token) {
      fetchTestResults();
    }
  }, [testId, token]);

  if (loading) return <div className="text-center mt-10">Loading results...</div>;
  if (error) return <div className="text-center text-red-500 mt-10">Error: {error}</div>;
  if (!testResults) return <div className="text-center mt-10">No test results available</div>;

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Overall Test Performance */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Test Results</h1>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold">Total Questions</p>
            <p className="text-2xl">{testResults.totalQuestions}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">Correct Answers</p>
            <p className="text-2xl text-green-600">{testResults.correctQuestions}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">Score</p>
            <p className="text-2xl text-blue-600">
              {((testResults.correctQuestions / testResults.totalQuestions) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Question Results */}
      <div className="space-y-4">
        {testResults.testQuestions.map((testQuestion, index) => (
          <div 
            key={testQuestion.id} 
            className={`
              border rounded-lg p-4 
              ${testQuestion.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}
            `}
          >
            {/* Question */}
            <div 
              className="mb-3 font-semibold" 
              dangerouslySetInnerHTML={{ __html: testQuestion.question.questionHtml }} 
            />
            
            {/* User's Answer */}
            <div className="mb-2">
              <span className="font-medium">Your Answer: </span>
              <span 
                className={
                  testQuestion.isCorrect 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }
              >
                {testQuestion.userAnswer}
              </span>
            </div>

            {/* Correct Answer */}
            {!testQuestion.isCorrect && (
              <div className="mb-2">
                <span className="font-medium">Correct Answer: </span>
                <span className="text-green-600">
                  {testQuestion.question.correctAnswer}
                </span>
              </div>
            )}

            {/* Explanation */}
            {testQuestion.question.explanationHtml && (
              <div 
                className="mt-3 p-3 bg-gray-100 rounded text-sm"
                dangerouslySetInnerHTML={{ __html: testQuestion.question.explanationHtml }} 
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestResults;
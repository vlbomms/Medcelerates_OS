// src/pages/TestInterface.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { 
  FaClock, 
  FaCog, 
  FaCommentDots, 
  FaFlag, 
  FaArrowLeft, 
  FaArrowRight 
} from 'react-icons/fa';

// Define a type for the test question
interface TestQuestion {
  id: string;
  questionId: string;
  userAnswer: string | null;
  question: {
    id: string;
    questionHtml: string;
    answerChoicesHtml: string;
    explanationHtml?: string;
    passage?: {
      passageHtml: string;
    };
  };
}

const TestInterface: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);

  // State for test data
  const [test, setTest] = useState<{
    id: string;
    testId: string;
    status: string;
    totalTestDuration: number;
    startTime: string;
    remainingSeconds: number;
    testQuestions: TestQuestion[];
  } | null>(null);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Question navigation
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Fetch test data
  useEffect(() => {
    const fetchTestData = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/tests/${testId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        setTest(response.data);
        setTimeRemaining(response.data.remainingSeconds);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch test:', err);
        setError('Failed to load test');
        setLoading(false);
      }
    };

    if (testId && token) {
      fetchTestData();
    }
  }, [testId, token]);

  // Timer logic
  useEffect(() => {
    if (test) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit test when time runs out
            handleCompleteTest();
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [test]);

  // Utility functions
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions(prev => 
      prev.includes(questionId)
        ? prev.filter(q => q !== questionId)
        : [...prev, questionId]
    );
  };

  // Answer selection handler
  const handleAnswerSelection = async (answer: string) => {
    if (!test) return;

    try {
      const currentQuestion = test.testQuestions[currentQuestionIndex];
      
      await axios.patch(
        `http://localhost:8000/api/tests/questions/${currentQuestion.id}`, 
        { userAnswer: answer },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update local state
      const updatedTestQuestions = [...test.testQuestions];
      updatedTestQuestions[currentQuestionIndex] = {
        ...updatedTestQuestions[currentQuestionIndex],
        userAnswer: answer
      };

      setTest(prev => prev ? { ...prev, testQuestions: updatedTestQuestions } : null);
      setSelectedAnswer(answer);
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  };

  // Complete test handler
  const handleCompleteTest = async () => {
    try {
      await axios.post(
        `http://localhost:8000/api/tests/${testId}/complete`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Redirect to test results
      navigate(`/test/${testId}/results`);
    } catch (err) {
      console.error('Failed to complete test:', err);
    }
  };

  // Navigation handlers
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Reset selected answer for the previous question
      const previousQuestion = test?.testQuestions[currentQuestionIndex - 1];
      setSelectedAnswer(previousQuestion?.userAnswer || null);
    }
  };

  const handleNextQuestion = () => {
    if (test && currentQuestionIndex < test.testQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      // Reset selected answer for the next question
      const nextQuestion = test.testQuestions[currentQuestionIndex + 1];
      setSelectedAnswer(nextQuestion.userAnswer || null);
    }
  };

  // Loading and error states
  if (loading) return <div>Loading test...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!test) return <div>No test data available</div>;

  const currentQuestion = test.testQuestions[currentQuestionIndex];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 h-[50px] bg-white shadow-sm flex items-center justify-between px-4 z-10">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-lg">Medical Entrance Exam</span>
          <span className="text-test-gray">Test ID: {test.testId}</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <FaClock className="text-test-gray" />
            <span className="font-bold">{formatTime(timeRemaining)}</span>
          </div>
          <button className="hover:bg-test-gray-light p-2 rounded-full">
            <FaCog />
          </button>
          <button className="hover:bg-test-gray-light p-2 rounded-full">
            <FaCommentDots />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 mt-[50px]">
        {/* Left Pane: Passage */}
        {currentQuestion.question.passage && (
          <div className="w-1/2 p-4 bg-test-gray-light overflow-y-auto">
            <div 
              className="text-base"
              dangerouslySetInnerHTML={{ __html: currentQuestion.question.passage.passageHtml }} 
            />
          </div>
        )}

        {/* Right Pane: Question */}
        <div className="w-1/2 p-4 relative">
          {/* Flag Question */}
          <button 
            onClick={() => toggleFlag(currentQuestion.id)}
            className={`absolute top-4 right-4 p-2 rounded-full ${
              flaggedQuestions.includes(currentQuestion.id) 
                ? 'bg-red-500 text-white' 
                : 'bg-test-gray-light text-test-gray'
            }`}
          >
            <FaFlag />
          </button>

          {/* Question Content */}
          <div>
            <h3 className="text-lg font-bold mb-4">
              Question {currentQuestionIndex + 1} of {test.testQuestions.length}
            </h3>
            <div 
              className="mb-4"
              dangerouslySetInnerHTML={{ __html: currentQuestion.question.questionHtml }} 
            />

            {/* Answer Choices */}
            <div 
              className="space-y-3"
              dangerouslySetInnerHTML={{ __html: currentQuestion.question.answerChoicesHtml }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                const choiceElement = target.closest('[data-choice]');
                if (choiceElement) {
                  const choice = choiceElement.getAttribute('data-choice');
                  if (choice) handleAnswerSelection(choice);
                }
              }}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button 
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center space-x-2 bg-test-blue text-white px-4 py-2 rounded-lg hover:bg-test-blue-hover disabled:opacity-50"
            >
              <FaArrowLeft />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2">
              <span>{currentQuestionIndex + 1} / {test.testQuestions.length}</span>
            </div>

            <button 
              onClick={currentQuestionIndex === test.testQuestions.length - 1 
                ? handleCompleteTest 
                : handleNextQuestion
              }
              className="flex items-center space-x-2 bg-test-blue text-white px-4 py-2 rounded-lg hover:bg-test-blue-hover"
            >
              <span>
                {currentQuestionIndex === test.testQuestions.length - 1 
                  ? 'Submit Test' 
                  : 'Next'}
              </span>
              {currentQuestionIndex < test.testQuestions.length - 1 && <FaArrowRight />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestInterface;
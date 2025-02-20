// In /Users/vikasbommineni/test-prep-platform/frontend/src/pages/TestView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { RootState } from '../redux/store';

// Comprehensive type definitions
interface Passage {
  id: string;
  passageHtml: string;
  title?: string;
}

interface Question {
  id: string;
  questionHtml: string;
  answerChoicesHtml: string;
  passageId?: string;
  passage?: Passage;
  explanation?: string;
}

interface TestQuestion {
  id: string;
  questionId: string;
  userAnswer: string | null;
  question: Question;
}

interface Test {
  id: string;
  testId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startTime?: string;
  remainingSeconds?: number;
  totalTestDuration?: number;
  testQuestions: TestQuestion[];
}

const TestView: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);

  // State management
  const [test, setTest] = useState<Test | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [testStarted, setTestStarted] = useState(false);

  // Fetch test details
  const fetchTestDetails = useCallback(async () => {
    try {
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Fetching test with ID:', testId);
      console.log('Using token:', token.substring(0, 10) + '...');

      const testResponse = await axios.get(`http://localhost:8000/api/tests/${testId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const test: Test = testResponse.data;
      setTest(test);
      setRemainingSeconds(test.remainingSeconds || test.totalTestDuration || 3600);
      setIsLoading(false);
    } catch (error) {
      console.error('Detailed error fetching test details:', error);
      
      // More detailed error logging
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);
      }
      
      setError('Failed to load test. Please try again.');
      setIsLoading(false);
    }
  }, [testId, token]);

  // Start or resume test
  const startTest = useCallback(async () => {
    try {
      const response = await axios.post(
        `http://localhost:8000/api/tests/${testId}/start`, 
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setTestStarted(true);
    } catch (error) {
      console.error('Failed to start test', error);
      setError('Failed to start test. Please try again.');
    }
  }, [testId, token]);

  // Timer effect
  useEffect(() => {
    if (!test || test.status === 'COMPLETED' || remainingSeconds === null) return;

    const timerId = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev === null) return null;
        
        const newRemaining = prev - 1;
        
        // Auto-complete if time runs out
        if (newRemaining <= 0) {
          handleCompleteTest();
          clearInterval(timerId);
          return 0;
        }
        
        return newRemaining;
      });
    }, 1000);

    // Pause test when user navigates away
    const pauseTest = async () => {
      try {
        await axios.post(
          `http://localhost:8000/api/tests/${testId}/pause`, 
          { remainingSeconds },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        console.error('Failed to pause test', error);
      }
    };

    // Add event listeners for page visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseTest();
        clearInterval(timerId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [test, testId, token, remainingSeconds]);

  // Initial fetch and test start
  useEffect(() => {
    fetchTestDetails();
  }, [fetchTestDetails]);

  useEffect(() => {
    if (test && !testStarted && test.status === 'IN_PROGRESS') {
      startTest();
    }
  }, [test, testStarted, startTest]);

  // Handle answer submission
  const handleAnswerSubmit = async (answer: string) => {
    try {
      const currentQuestion = test?.testQuestions[currentQuestionIndex];
      
      if (!currentQuestion) return;

      // Optimistically update local state
      setSelectedAnswer(answer);

      // Send answer to backend
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
    } catch (error) {
      console.error('Failed to submit answer', error);
      setError('Failed to submit answer. Please try again.');
    }
  };

  // Navigation between questions
  const handleNextQuestion = () => {
    if (currentQuestionIndex < (test?.testQuestions.length ?? 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(test?.testQuestions[currentQuestionIndex + 1].userAnswer ?? null);
    } else {
      // Show submission confirmation on last question
      handleCompleteTest();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer(test?.testQuestions[currentQuestionIndex - 1].userAnswer ?? null);
    }
  };

  // Complete test
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

      navigate('/view-tests');
    } catch (error) {
      console.error('Failed to complete test', error);
      setError('Failed to complete test. Please try again.');
    }
  };

  // Render loading or error states
  if (isLoading) return <div>Loading test...</div>;
  if (error) return <div>{error}</div>;
  if (!test) return <div>No test found</div>;

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const currentQuestion = test.testQuestions[currentQuestionIndex];

  return (
    <div className="test-interface">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="test-id">Test ID: {test.testId}</div>
        <div className="timer">
          {remainingSeconds !== null ? formatTime(remainingSeconds) : 'Loading...'}
        </div>
        <div className="question-progress">
          Question {currentQuestionIndex + 1} of {test.testQuestions.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="test-content">
        {/* Left Pane: Passage */}
        <div className="passage-pane">
          {currentQuestion.question.passage ? (
            <div 
              className="passage-content" 
              dangerouslySetInnerHTML={{ __html: currentQuestion.question.passage.passageHtml }}
            />
          ) : (
            <div className="no-passage">No passage for this question</div>
          )}
        </div>

        {/* Right Pane: Question */}
        <div className="question-pane">
          {/* Question Stem */}
          <div 
            className="question-stem"
            dangerouslySetInnerHTML={{ __html: currentQuestion.question.questionHtml }}
          />

          {/* Answer Choices */}
          <div 
            className="answer-choices"
            dangerouslySetInnerHTML={{ __html: currentQuestion.question.answerChoicesHtml }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              const choiceElement = target.closest('[data-choice]');
              if (choiceElement) {
                const choice = choiceElement.getAttribute('data-choice');
                if (choice) {
                  handleAnswerSubmit(choice);
                }
              }
            }}
          />

          {/* Selected Answer Indicator */}
          {selectedAnswer && (
            <div className="selected-answer">
              Selected Answer: {selectedAnswer}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        {/* Navigation Buttons */}
        <div className="navigation-buttons">
          <button 
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </button>
          <button 
            onClick={handleNextQuestion}
          >
            {currentQuestionIndex === test.testQuestions.length - 1 ? 'Submit Test' : 'Next'}
          </button>
        </div>

        {/* Question Navigation Popup */}
        <div className="question-nav-popup">
          <button onClick={() => setIsNavOpen(!isNavOpen)}>
            Questions
          </button>
          {isNavOpen && (
            <div className="question-nav-list">
              {test.testQuestions.map((_, index) => (
                <button 
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`
                    ${index === currentQuestionIndex ? 'current' : ''} 
                    ${test.testQuestions[index].userAnswer ? 'answered' : 'unanswered'}
                  `}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestView;
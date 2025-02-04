import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateTest: React.FC = () => {
  const [testName, setTestName] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleAddQuestion = () => {
    setQuestions([...questions, '']);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement test creation logic
    console.log('Test created', { testName, questions });
    navigate('/dashboard');
  };

  return (
    <div className="create-test-container">
      <h2>Create New Test</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="testName">Test Name</label>
          <input
            type="text"
            id="testName"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            required
          />
        </div>
        <div>
          <h3>Questions</h3>
          {questions.map((question, index) => (
            <div key={index}>
              <label htmlFor={`question-${index}`}>Question {index + 1}</label>
              <textarea
                id={`question-${index}`}
                value={question}
                onChange={(e) => handleQuestionChange(index, e.target.value)}
                required
              />
            </div>
          ))}
          <button type="button" onClick={handleAddQuestion}>
            Add Question
          </button>
        </div>
        <button type="submit">Create Test</button>
      </form>
    </div>
  );
};

export default CreateTest;

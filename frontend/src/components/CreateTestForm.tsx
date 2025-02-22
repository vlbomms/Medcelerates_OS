import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { RootState } from '../redux/store';
import { SubjectCount } from '../types/questionTypes';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button 
} from '@mui/material';

// Define the error interface to match backend
interface InsufficientQuestionsError {
  name: string;
  message: string;
  availableQuestions: number;
  passageGroups: any[];
}

// Styled Components
const FormContainer = styled.div`
  width: 100%;
`;

const FormSection = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 8px;
`;

const SubjectWrapper = styled.div`
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 16px;
`;

const SubjectHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const SubjectLabel = styled.label`
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #1f2937;
`;

const UnitList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
`;

const UnitCheckbox = styled.div`
  display: flex;
  align-items: center;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px;
  transition: all 0.3s ease;

  &:hover {
    background-color: #f3f4f6;
    border-color: #6366f1;
  }

  input {
    margin-right: 8px;
  }

  label {
    flex-grow: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
`;

const QuestionCount = styled.span`
  font-size: 0.8em;
  color: #6b7280;
`;

const CreateButton = styled.button`
  width: 100%;
  padding: 14px;
  background-color: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #4f46e5;
  }

  &:disabled {
    background-color: #a5b4fc;
    cursor: not-allowed;
  }
`;

interface CreateTestFormProps {
  onTestCreated?: (testId: string) => void;
}

const formatDisplayText = (text: string | null | undefined): string => {
  // If text is null or undefined, return a default value
  if (!text) return 'Unknown';
  
  // Otherwise, replace underscores with spaces
  return text.replace(/_/g, ' ');
};

const CreateTestForm: React.FC<CreateTestFormProps> = ({ onTestCreated }) => {
  const token = useSelector((state: RootState) => state.auth.token);
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<SubjectCount[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setIsLoading(true);
        
        if (!token) {
          throw new Error('No authentication token found. Please log in.');
        }

        const response = await axios.get<SubjectCount[]>('http://localhost:8000/api/question-counts', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        });

        // Validate and clean the response data
        const validSubjects = response.data.map(subject => ({
          ...subject,
          units: subject.units.map(unit => ({
            name: unit.name || 'Unknown Unit',
            questionCount: unit.questionCount || 0
          }))
        }));

        setSubjects(validSubjects);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch subjects', error);
        setError('Failed to load subjects. Please try again.');
        setSubjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchSubjects();
    }
  }, [token]);

  // Calculate total questions for a subject
  const getSubjectTotalQuestions = (subjectName: string | null | undefined): number => {
    // If subjectName is null or undefined, return 0
    if (!subjectName) return 0;
  
    // Find the subject, ensuring type safety
    const subject = subjects.find(s => s.subject === subjectName);
  
    // If no subject found, return 0
    if (!subject) return 0;
  
    // Calculate total question count for the subject
    return subject.units.reduce((total, unit) => total + (unit.questionCount || 0), 0);
  };

  // Calculate total questions for a unit
  const getUnitTotalQuestions = (unitName: string) => {
    let total = 0;
    subjects.forEach(subject => {
      const unit = subject.units.find(u => u.name === unitName);
      if (unit) total += unit.questionCount;
    });
    return total;
  };

  // Handle subject selection
  const handleSubjectSelect = (subjectName: string) => {
    const subject = subjects.find(s => s.subject === subjectName);
    if (!subject) return;

    if (selectedSubjects.includes(subjectName)) {
      // Deselect subject and its units
      setSelectedSubjects(prev => prev.filter(s => s !== subjectName));
      setSelectedUnits(prev => 
        prev.filter(unit => 
          !subject.units.some(u => u.name === unit)
        )
      );
    } else {
      // Select subject and all its units
      setSelectedSubjects(prev => {
        // Ensure no duplicates and no null values
        return Array.from(new Set([...prev, subjectName]));
      });

      const subjectUnits = subject.units
        .map(u => u.name)
        .filter((unit): unit is string => unit != null); // Type guard to ensure string

      setSelectedUnits(prev => {
        // Combine previous units with new units, removing duplicates
        return Array.from(new Set([...prev, ...subjectUnits]));
      });
    }
  };

  // Handle unit selection
  const handleUnitSelect = (unitName: string, subjectName: string) => {
    const subject = subjects.find(s => s.subject === subjectName);
    if (!subject) return;

    if (selectedUnits.includes(unitName)) {
      // Deselect unit
      setSelectedUnits(prev => prev.filter(u => u !== unitName));
      
      // Check if all subject's units are deselected
      const remainingUnits = subject.units
        .filter(u => u.name !== unitName)
        .map(u => u.name);
      
      const stillSelectedUnits = selectedUnits.filter(u => 
        remainingUnits.includes(u)
      );
      
      // If no units left for this subject, deselect the subject
      if (stillSelectedUnits.length === 0) {
        setSelectedSubjects(prev => 
          prev.filter(s => s !== subjectName)
        );
      }
    } else {
      // Select unit
      setSelectedUnits(prev => [...prev, unitName]);
      
      // Ensure subject is selected if all its units are now selected
      const allSubjectUnits = subject.units.map(u => u.name);
      const newSelectedUnits = [...selectedUnits, unitName];
      
      const allSubjectUnitsSelected = allSubjectUnits.every(u => 
        newSelectedUnits.includes(u)
      );
      
      if (allSubjectUnitsSelected && !selectedSubjects.includes(subjectName)) {
        setSelectedSubjects(prev => [...prev, subjectName]);
      }
    }
  };

  // Compute total selected questions
  const getTotalSelectedQuestions = () => {
    return selectedUnits.reduce((total, unitName) => {
      return total + getUnitTotalQuestions(unitName);
    }, 0);
  };

  // Handle test creation
  const handleCreateTest = async () => {
    try {
      if (!token) {
        setError('You must be logged in to create a test');
        return;
      }

      const response = await axios.post<{ id: string }>(
        'http://localhost:8000/api/tests', 
        {
          subjects: selectedSubjects.length ? selectedSubjects : undefined,
          units: selectedUnits.length ? selectedUnits : undefined,
          questionCount
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Test Creation Response:', response.data);
      
      const testId = response.data?.id;
      if (onTestCreated && testId) {
        onTestCreated(testId as string);
      }
      
    } catch (error) {
      console.error('Failed to create test', error);
      setError('Failed to create test. Please try again.');
    }
  };

  const [insufficientQuestionsDialog, setInsufficientQuestionsDialog] = useState<{
    open: boolean;
    availableQuestions?: number;
    passageGroups?: any[];
  }>({
    open: false
  });

  const createTest = async () => {
    try {
      // Reset any previous error states
      setError(null);
      setInsufficientQuestionsDialog({ open: false });

      // Prepare test creation parameters
      const testParams = {
        subjects: selectedSubjects,
        units: selectedUnits,
        numQuestions: questionCount
      };

      // Create test API call
      const response = await axios.post('/api/tests', testParams, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Handle successful test creation
      if (response.data.id) {
        // Navigate to test or perform other actions
        navigate(`/test/${response.data.id}`);
      }
    } catch (error) {
      // Check if it's an insufficient questions error
      if (axios.isAxiosError(error) && error.response?.data.name === 'InsufficientQuestionsError') {
        const insufficientError = error.response.data as InsufficientQuestionsError;
        
        // Open dialog to confirm reduced test
        setInsufficientQuestionsDialog({
          open: true,
          availableQuestions: insufficientError.availableQuestions,
          passageGroups: insufficientError.passageGroups
        });
      } else {
        // Handle other errors
        setError('An unexpected error occurred');
      }
    }
  };

  const handleConfirmReducedTest = async () => {
    try {
      // Create test with available questions
      const testParams = {
        subjects: selectedSubjects,
        units: selectedUnits,
        numQuestions: insufficientQuestionsDialog.availableQuestions
      };

      const response = await axios.post('/api/tests', testParams, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Navigate to test or perform other actions
      navigate(`/test/${response.data.id}`);

      // Close the dialog
      setInsufficientQuestionsDialog({ open: false });
    } catch (error) {
      // Handle any additional errors
      setError('Failed to create test');
    }
  };

  const handleCloseInsufficientQuestionsDialog = () => {
    setInsufficientQuestionsDialog({ open: false });
  };

  if (isLoading) {
    return <div>Loading subjects...</div>;
  }

  return (
    <FormContainer>
      <FormSection>
        <SectionTitle>Select Subjects and Units</SectionTitle>
        {subjects.map(subject => (
          <SubjectWrapper key={subject.subject}>
            <SubjectHeader>
              <SubjectLabel>
                <input 
                  type="checkbox"
                  checked={selectedSubjects.includes(subject.subject)}
                  onChange={() => handleSubjectSelect(subject.subject)}
                />
                <span style={{ marginLeft: '8px' }}>
                  {subject.subject} 
                  <QuestionCount> ({subject.totalQuestionCount} questions)</QuestionCount>
                </span>
              </SubjectLabel>
            </SubjectHeader>
            <UnitList>
              {subject.units.map(unit => (
                <UnitCheckbox key={unit.name}>
                  <input 
                    type="checkbox"
                    checked={selectedUnits.includes(unit.name)}
                    onChange={() => handleUnitSelect(unit.name, subject.subject)}
                  />
                  <label>
                    {unit.name}
                    <QuestionCount>({unit.questionCount} questions)</QuestionCount>
                  </label>
                </UnitCheckbox>
              ))}
            </UnitList>
          </SubjectWrapper>
        ))}
      </FormSection>

      <FormSection>
        <SectionTitle>Number of Questions</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <input 
            type="number" 
            min={1} 
            max={59} 
            value={questionCount} 
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            style={{ 
              flexGrow: 1, 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid #e5e7eb' 
            }}
            placeholder="Enter number of questions (1-59)"
          />
          <div style={{ color: '#6b7280' }}>
            Selected Questions: {getTotalSelectedQuestions()}
          </div>
        </div>
      </FormSection>

      <CreateButton 
        onClick={handleCreateTest} 
        disabled={selectedUnits.length === 0 || questionCount < 1 || questionCount > 59}
      >
        Create Test
      </CreateButton>

      {error && <div style={{ color: 'red', marginTop: '16px' }}>{error}</div>}

      <Dialog
        open={insufficientQuestionsDialog.open}
        onClose={handleCloseInsufficientQuestionsDialog}
      >
        <DialogTitle>Insufficient Questions</DialogTitle>
        <DialogContent>
          <DialogContentText>
            We could only find {insufficientQuestionsDialog.availableQuestions} 
            {' '}questions that match your current selection. 
            Would you like to create a test with this number of questions?
          </DialogContentText>
          <DialogContentText>
            Note: This may affect the test's comprehensiveness.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseInsufficientQuestionsDialog} 
            color="primary"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmReducedTest} 
            color="primary" 
            autoFocus
          >
            Create Test
          </Button>
        </DialogActions>
      </Dialog>
    </FormContainer>
  );
};

export default CreateTestForm;
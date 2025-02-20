import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { RootState } from '../redux/store';

import CreateTestForm from '../components/CreateTestForm';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../components/ProtectedRoute';

const PageLayout = styled.div`
  display: flex;
  height: 100vh;
`;

const SidebarWrapper = styled.div`
  width: 256px;
  background-color: #1f2937;
`;

const MainContent = styled.div`
  flex-grow: 1;
  background-color: #f4f6f9;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px;
  overflow-y: auto;
`;

const ContentContainer = styled.div`
  width: 100%;
  max-width: 800px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 40px;
`;

const PageTitle = styled.h1`
  color: #1f2937;
  margin-bottom: 30px;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
`;

const CreateTest: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user || !token) {
      navigate('/login');
    }
  }, [user, token, navigate]);

  const handleTestCreated = (testId: string) => {
    // Navigate to the new test interface
    navigate(`/test/${testId}/interface`);
  };

  return (
    <ProtectedRoute>
      <PageLayout>
        <SidebarWrapper>
          <Sidebar />
        </SidebarWrapper>
        <MainContent>
          <ContentContainer>
            <PageTitle>Create a New Test</PageTitle>
            <CreateTestForm onTestCreated={handleTestCreated} />
          </ContentContainer>
        </MainContent>
      </PageLayout>
    </ProtectedRoute>
  );
};

export default CreateTest;
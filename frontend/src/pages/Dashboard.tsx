import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../redux/store';
import styled from 'styled-components';
import Sidebar from '../components/Sidebar';

const PageLayout = styled.div`
  display: flex;
  height: 100vh;
`;

const SidebarWrapper = styled.div`
  width: 256px; // Match the width of the Sidebar
  background-color: #1f2937; // Dark background to match Sidebar
`;

const MainContent = styled.div`
  flex-grow: 1;
  background-color: #f4f6f9;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  overflow-y: auto;
`;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user || !token) {
      navigate('/login');
    }
  }, [user, token, navigate]);

  return (
    <PageLayout>
      <SidebarWrapper>
        <Sidebar />
      </SidebarWrapper>
      <MainContent>
        <h1>Welcome to Your Dashboard</h1>
      </MainContent>
    </PageLayout>
  );
};

export default Dashboard;
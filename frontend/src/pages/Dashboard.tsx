import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Tests Created</h2>
          <p className="text-3xl font-bold text-blue-600">12</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Average Score</h2>
          <p className="text-3xl font-bold text-green-600">85%</p>
        </div>
        {/* Add more dashboard cards */}
      </div>
    </div>
  );
};

export default Dashboard;
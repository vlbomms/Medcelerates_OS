import React from 'react';
import { Link } from 'react-router-dom';
import { 
  HomeIcon, 
  PlusCircleIcon, 
  DocumentTextIcon, 
  CreditCardIcon, 
  ArrowRightStartOnRectangleIcon 
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-gray-800 text-white p-4">
      <nav>
        <ul className="space-y-2">
          <li>
            <Link to="/" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
              <HomeIcon className="h-6 w-6" />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link to="/create-test" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
              <PlusCircleIcon className="h-6 w-6" />
              <span>Create Test</span>
            </Link>
          </li>
          <li>
            <Link to="/view-tests" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
              <DocumentTextIcon className="h-6 w-6" />
              <span>View Tests</span>
            </Link>
          </li>
          <li>
            <Link to="/subscribe" className="flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
              <CreditCardIcon className="h-6 w-6" />
              <span>Subscribe</span>
            </Link>
          </li>
          <li>
            <button className="w-full flex items-center space-x-2 hover:bg-gray-700 p-2 rounded">
              <ArrowRightStartOnRectangleIcon className="h-6 w-6" />
              <span>Logout</span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  PlusCircleIcon, 
  DocumentTextIcon, 
  CreditCardIcon, 
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon 
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-gray-800 text-white p-4">
      <nav>
        <ul className="space-y-2">
          <li>
            <Link 
              to="/dashboard" 
              className={`flex items-center space-x-2 hover:bg-gray-700 p-2 rounded ${
                location.pathname === '/dashboard' ? 'bg-gray-700' : ''
              }`}
            >
              <HomeIcon className="h-6 w-6" />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/profile" 
              className={`flex items-center space-x-2 hover:bg-gray-700 p-2 rounded ${
                location.pathname === '/profile' ? 'bg-gray-700' : ''
              }`}
            >
              <UserCircleIcon className="h-6 w-6" />
              <span>Profile</span>
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
          {/* Removed logout button */}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
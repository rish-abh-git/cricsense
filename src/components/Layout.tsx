import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Home, BarChart2, ArrowLeft, Settings as SettingsIcon, Medal } from 'lucide-react';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-16">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          {!isHome && (
             <button 
               onClick={() => navigate(-1)} 
               className="p-2 -ml-2 mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors active:bg-gray-200">
               <ArrowLeft size={20} />
             </button>
          )}
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent flex items-center gap-2">
            <Trophy size={20} className="text-primary-500" />
            CricSense
          </h1>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mt-14 overflow-x-hidden safe-area-bottom">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-40 flex items-center justify-around px-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavItem 
          icon={<Home size={24} />} 
          label="Home" 
          path="/" 
          isActive={isHome}
          onClick={() => navigate('/')} 
        />
        <NavItem 
          icon={<Trophy size={24} />} 
          label="New Match" 
          path="/setup" 
          isActive={location.pathname === '/setup'}
          onClick={() => navigate('/setup')} 
        />
        <NavItem 
          icon={<BarChart2 size={24} />} 
          label="Analytics" 
          path="/analytics" 
          isActive={location.pathname === '/analytics'}
          onClick={() => navigate('/analytics')} 
        />
        <NavItem 
          icon={<Medal size={24} />} 
          label="Leaders" 
          path="/leaderboard" 
          isActive={location.pathname === '/leaderboard'}
          onClick={() => navigate('/leaderboard')} 
        />
        <NavItem 
          icon={<SettingsIcon size={24} />} 
          label="Settings" 
          path="/settings" 
          isActive={location.pathname === '/settings'}
          onClick={() => navigate('/settings')} 
        />
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, path: string, isActive: boolean, onClick: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-900 active:bg-gray-100 rounded-xl'}`}
    >
      <div className={`mb-1 transition-transform ${isActive ? 'scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
};

export default Layout;

import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Home, BarChart2, ArrowLeft, Settings as SettingsIcon, Medal, Sun, Moon, Users, ArrowRightLeft, LogOut, ShieldAlert } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTheme, isDark } = useTheme();
  const { isAdmin, logout } = useAuth();

  const isHome = location.pathname === '/';
  const isViewOnly = location.search.includes('view=true');
  
  return (
    <div className={`flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 ${isViewOnly ? '' : 'pb-16'}`}>
      {/* Top Navigation */}
      {!isViewOnly && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          {!isHome && (
             <button 
               onClick={() => navigate(-1)} 
               className="p-2 -ml-2 mr-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 rounded-full transition-colors active:bg-gray-200 dark:bg-gray-700">
               <ArrowLeft size={20} />
             </button>
          )}
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent flex items-center gap-2">
            <Trophy size={20} className="text-primary-500" />
            CricSense
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors active:bg-gray-200 dark:active:bg-gray-600"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <button
            onClick={() => isAdmin ? logout() : navigate('/login')}
            className={`p-2 rounded-full transition-colors active:bg-gray-200 dark:active:bg-gray-600 ${isAdmin ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}
            title={isAdmin ? 'Logout Admin' : 'Admin Login'}
          >
            {isAdmin ? <LogOut size={20} /> : <ShieldAlert size={20} />}
          </button>
        </div>
      </header>
    )}

      {/* Main Content Area */}
      <main className={`flex-1 ${isViewOnly ? 'mt-0' : 'mt-14'} overflow-x-hidden safe-area-bottom`}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      {!isViewOnly && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 flex items-center justify-around px-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavItem 
          icon={<Home size={24} />} 
          label="Home" 
          isActive={isHome}
          onClick={() => navigate('/')} 
        />
        {isAdmin && (
          <NavItem 
            icon={<Trophy size={24} />} 
            label="New Match" 
            isActive={location.pathname === '/setup'}
            onClick={() => navigate('/setup')} 
          />
        )}
        <NavItem 
          icon={<BarChart2 size={24} />} 
          label="Analytics" 
          isActive={location.pathname === '/analytics'}
          onClick={() => navigate('/analytics')} 
        />
        <NavItem 
          icon={<Medal size={24} />} 
          label="Leaders" 
          isActive={location.pathname === '/leaderboard'}
          onClick={() => navigate('/leaderboard')} 
        />
        {isAdmin && (
          <NavItem 
            icon={<Users size={24} />} 
            label="Attendance" 
            isActive={location.pathname === '/attendance'}
            onClick={() => navigate('/attendance')} 
          />
        )}
        <NavItem 
          icon={<ArrowRightLeft size={24} />} 
          label="Compare" 
          isActive={location.pathname === '/compare'}
          onClick={() => navigate('/compare')} 
        />
        {isAdmin && (
          <NavItem 
            icon={<SettingsIcon size={24} />} 
            label="Settings" 
            isActive={location.pathname === '/settings'}
            onClick={() => navigate('/settings')} 
          />
        )}
      </nav>
      )}
    </div>
  );
};

const NavItem = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-50 active:bg-gray-100 dark:bg-gray-800 rounded-xl'}`}
    >
      <div className={`mb-1 transition-transform ${isActive ? 'scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[8px] sm:text-[10px] font-medium leading-none mt-1 text-center">{label}</span>
    </button>
  );
};

export default Layout;

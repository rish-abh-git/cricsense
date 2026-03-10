import React from 'react';
import { db } from '../database/db';
import Card from '../components/Card';
import Button from '../components/Button';
import { AlertTriangle, Database, Moon, Sun, Monitor, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleClearData = async () => {
    const confirmMessage = "⚠️ WARNING: This will permanently delete ALL matches, balls, and players from your device. This cannot be undone.\n\nType 'DELETE' to confirm.";
    if (window.prompt(confirmMessage) === 'DELETE') {
      try {
        await db.transaction('rw', db.matches, db.innings, db.balls, db.players, async () => {
          await db.matches.clear();
          await db.innings.clear();
          await db.balls.clear();
          await db.players.clear();
        });
        alert('All data has been successfully cleared.');
        navigate('/');
      } catch (err) {
        console.error(err);
        alert('Failed to clear data.');
      }
    }
  };

  const handleSeedData = async () => {
    if (window.confirm('This will replace ALL existing data with dummy players and matches. Continue?')) {
      try {
        const { seedDatabase } = await import('../utils/seedData');
        await seedDatabase();
        alert('Dummy data seeded successfully!');
        window.location.href = '/'; // Force a full reload to ensure DB state is fresh
      } catch (err) {
        console.error(err);
        alert('Failed to seed data: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto safe-area-bottom pb-20 fade-in animate-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 flex items-center gap-2">
          <Palette className="text-primary-500" />
          Appearance
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Customize how CricSense looks on your device.</p>
      </div>

      <Card className="p-1 flex bg-gray-100 dark:bg-gray-800 rounded-2xl">
        <button
          onClick={() => setTheme('light')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-semibold transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          <Sun size={18} />
          <span className="hidden sm:inline">Light</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-semibold transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          <Moon size={18} />
          <span className="hidden sm:inline">Dark</span>
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-semibold transition-all ${theme === 'system' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          <Monitor size={18} />
          <span className="hidden sm:inline">System</span>
        </button>
      </Card>

      <div className="pt-2">
        <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 flex items-center gap-2 mb-2">
          <Database className="text-primary-500" />
          Data & Settings
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4">Manage your offline application data.</p>

        <Card className="p-5 mb-4 bg-primary-50 dark:bg-primary-900/10 border-l-4 border-l-primary-500">
          <div className="flex gap-3 mb-4">
             <div className="text-primary-500 mt-0.5">
               <Database size={24} />
             </div>
             <div>
               <h3 className="font-bold text-primary-900 dark:text-primary-100">Starter Data</h3>
               <p className="text-sm text-primary-700 dark:text-primary-300 mt-1 leading-relaxed">
                 Quickly populate the app with legendary players and a sample match to test all features.
               </p>
             </div>
          </div>
          <Button variant="primary" fullWidth onClick={handleSeedData}>
            Seed Dummy Data
          </Button>
        </Card>

        <Card className="p-5 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/10 dark:border-l-red-600">
        <div className="flex gap-3 mb-4">
          <div className="text-red-500 mt-0.5">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-red-900">Danger Zone</h3>
            <p className="text-sm text-red-700 mt-1 leading-relaxed">
              Clearing data will wipe the entire Dexie IndexedDB cache. You will lose all your recorded match history, player profiles, and analytics.
            </p>
          </div>
        </div>
        
        <Button variant="danger" fullWidth onClick={handleClearData}>
          Clear All Data
        </Button>
      </Card>
      
      </div>
    </div>
  );
};

export default Settings;

import React from 'react';
import { db } from '../database/db';
import Card from '../components/Card';
import Button from '../components/Button';
import { AlertTriangle, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
  const navigate = useNavigate();

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

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto safe-area-bottom pb-20 fade-in animate-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Database className="text-primary-500" />
          Data & Settings
        </h2>
        <p className="text-gray-500 mt-1">Manage your offline application data.</p>
      </div>

      <Card className="p-5 border-l-4 border-l-red-500 bg-red-50">
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
  );
};

export default Settings;

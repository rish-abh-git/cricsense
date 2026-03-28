import React from 'react';
import { db } from '../database/db';
import Card from '../components/Card';
import Button from '../components/Button';
import { AlertTriangle, Database, Moon, Sun, Monitor, Palette, Users, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { exportData, importData } from '../utils/dataUtils';
import { Download, Upload } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { APP_VERSION } from '../version';
import { clearCloudData } from '../database/syncService';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [showPlayerManager, setShowPlayerManager] = React.useState(false);
  const allPlayers = useLiveQuery(() => db.players.toArray()) || [];

  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm?: () => void;
    type?: 'danger' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const handleClearData = async () => {
    setModalConfig({
      isOpen: true,
      title: 'Clear All Data?',
      message: 'This will permanently delete all matches, players, and attendance records. This action cannot be undone.',
      confirmLabel: 'Delete Everything',
      type: 'danger',
      onConfirm: async () => {
        try {
          await clearCloudData();
          await db.transaction('rw', [db.matches, db.innings, db.balls, db.players, db.attendance], async () => {
            await db.matches.clear();
            await db.innings.clear();
            await db.balls.clear();
            await db.players.clear();
            await db.attendance.clear();
          });
          showToast('Local and Cloud data cleared', 'success');
          navigate('/');
        } catch (err) {
          console.error(err);
          showToast('Failed to clear data', 'error');
        }
      }
    });
  };

  const handleSeedData = async () => {
    setModalConfig({
      isOpen: true,
      title: 'Seed Dummy Data?',
      message: 'This will replace all existing data with sample players and matches. Continue?',
      confirmLabel: 'Seed Data',
      type: 'info',
      onConfirm: async () => {
        try {
          await clearCloudData();
          const { seedDatabase } = await import('../utils/seedData');
          await seedDatabase();
          showToast('Cloud cleared and dummy data seeded', 'success');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } catch (err) {
          console.error(err);
          showToast('Failed to seed data', 'error');
        }
      }
    });
  };

  const handleExportData = async () => {
    try {
      await exportData();
      showToast('Data exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export data', 'error');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setModalConfig({
        isOpen: true,
        title: 'Import Data?',
        message: 'This will replace ALL existing data with the imported data. Continue?',
        confirmLabel: 'Import Now',
        type: 'info',
        onConfirm: async () => {
          try {
            await importData(content);
            showToast('Data imported successfully', 'success');
            setTimeout(() => {
              window.location.href = '/';
            }, 1500);
          } catch (err) {
            showToast('Import failed. Invalid file format', 'error');
          }
        }
      });
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again if needed
    e.target.value = '';
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

        <Card className="p-5 mb-4 bg-green-50 dark:bg-green-900/10 border-l-4 border-l-green-500">
          <div className="flex gap-3 mb-4">
            <div className="text-green-500 mt-0.5">
              <Download size={24} />
            </div>
            <div>
              <h3 className="font-bold text-green-900 dark:text-green-100">Backup & Restore</h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1 leading-relaxed">
                Export your data to a JSON file or import a previously saved backup to restore your data.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" fullWidth onClick={handleExportData} className="flex-1">
              <Download size={18} className="mr-2 inline" />
              Export
            </Button>
            <div className="flex-1 relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                id="import-input"
              />
              <Button variant="outline" fullWidth className="w-full">
                <Upload size={18} className="mr-2 inline" />
                Import
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5 mb-4 border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/10 dark:border-l-orange-600">
          <div className="flex gap-3 mb-4">
            <div className="text-orange-500 mt-0.5">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 dark:text-orange-100">Manage Players</h3>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1 leading-relaxed">
                Delete individual players and their data permanently from the database.
              </p>
            </div>
          </div>
          <Button variant="outline" fullWidth onClick={() => setShowPlayerManager(true)}>
            View & Delete Players
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

      <div className="pt-6 pb-4 opacity-50 text-center space-y-1">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">CricSense Engine</p>
        <p className="text-sm font-medium text-gray-400">Version {APP_VERSION}</p>
        <p className="text-[10px] text-gray-400">© 2026 Morya Warriors</p>
      </div>

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        onConfirm={modalConfig.onConfirm}
        type={modalConfig.type}
      />

      {showPlayerManager && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-5 max-h-[80vh] flex flex-col animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Manage Players</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 scrollbar-hide">
              {allPlayers.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No players found.</p>
              ) : (
                allPlayers.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{p.name}</span>
                      <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!p.is_morya_warrior}
                          onChange={async (e) => {
                            try {
                              await db.players.update(p.id, { is_morya_warrior: e.target.checked });
                              showToast(`${p.name} status updated.`, 'success');
                            } catch (error) {
                              showToast(`Failed to update ${p.name}.`, 'error');
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-xs text-gray-500 font-medium select-none">Morya Warrior</span>
                      </label>
                    </div>
                    <button 
                      onClick={async () => {
                        if (p.is_morya_warrior) {
                          setModalConfig({
                            isOpen: true,
                            title: 'Delete Morya Warrior?',
                            message: `Are you sure you want to delete ${p.name}? They will be removed from your registry.`,
                            type: 'danger',
                            confirmLabel: 'Delete',
                            onConfirm: async () => {
                              await db.players.delete(p.id);
                              showToast(`${p.name} deleted.`, 'success');
                            }
                          });
                        } else {
                          await db.players.delete(p.id);
                          showToast(`${p.name} deleted.`, 'success');
                        }
                      }}
                      className="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <Button variant="ghost" fullWidth onClick={() => setShowPlayerManager(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

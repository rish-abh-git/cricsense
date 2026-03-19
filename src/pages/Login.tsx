import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import Card from '../components/Card';
import Button from '../components/Button';
import { ShieldAlert, LogIn, ChevronLeft } from 'lucide-react';

const Login: React.FC = () => {
  const [pin, setPin] = useState('');
  const { login, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(pin)) {
      showToast('Logged in successfully', 'success');
      navigate('/');
    } else {
      showToast('Incorrect Admin PIN', 'error');
      setPin('');
    }
  };

  if (isAdmin) {
    return (
      <div className="p-4 flex flex-col items-center justify-center mt-20">
        <ShieldAlert size={48} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">You are an Admin</h2>
        <Button variant="primary" onClick={() => navigate('/')}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-sm mx-auto mt-20 fade-in animate-in zoom-in duration-300">
      <Card className="p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 uppercase tracking-wide">Scorer Login</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
            Viewers do not need to login. Enter the PIN if you are managing matches.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Secret PIN</label>
            <input
              type="password"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-semibold text-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all dark:text-white"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          
          <Button type="submit" variant="primary" fullWidth className="mt-2 flex items-center justify-center gap-2">
            <LogIn size={20} />
            Authenticate
          </Button>
        </form>

        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
          <Button variant="ghost" fullWidth onClick={() => navigate('/')} className="text-gray-500 flex justify-center gap-2">
            <ChevronLeft size={18} /> Back to Live Cricket
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;

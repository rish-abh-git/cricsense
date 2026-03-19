import React, { useEffect } from 'react';
import { useToast } from './Toast';
import { useAuth } from '../contexts/AuthContext';

const SyncFeedback: React.FC = () => {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  useEffect(() => {
    const handleSyncSuccess = (_event: any) => {
      // Only show sync feedback to Admin (scorer) to avoid cluttering viewers' experience
      if (isAdmin) {
        showToast('Match data synced to cloud successfully!', 'success');
      }
    };

    window.addEventListener('sync-success', handleSyncSuccess);
    return () => window.removeEventListener('sync-success', handleSyncSuccess);
  }, [showToast, isAdmin]);

  return null;
};

export default SyncFeedback;

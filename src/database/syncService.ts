import { db } from './db';
import { supabase } from './supabaseClient';
import { reverseMapMatchPayload } from './syncUtils';

export const clearCloudData = async () => {
  console.log('Clearing ALL cloud data...');
  const tables = ['balls', 'innings', 'matches', 'players', 'attendance'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
    if (error) console.error(`Error clearing cloud ${table}:`, error);
  }
};

export const pullAllFromSupabase = async () => {
  console.log('Pulling latest data from Supabase...');
  (window as any).__isRealtimeUpdate = true;
  try {
    const tables = ['players', 'matches', 'innings', 'balls', 'attendance'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.error(`Error pulling ${table}:`, error);
        continue;
      }
      if (data && data.length > 0) {
        const mappedData = data.map(item => {
          if (table === 'matches') {
            return reverseMapMatchPayload(item);
          }
          return item;
        });
        await db.table(table).bulkPut(mappedData);
      }
    }
  } finally {
    (window as any).__isRealtimeUpdate = false;
  }
};

let syncInited = false;
export const initSyncService = () => {
  if (syncInited) return;
  syncInited = true;

  // Cloud-First Boot: Clear local and pull from remote
  if (navigator.onLine) {
    console.log('Online: Performing Cloud-First initialization...');
    (async () => {
      (window as any).__isRealtimeUpdate = true;
      try {
        // 1. Reset all local tables to ensure zero stale conflicts
        const tables = ['players', 'matches', 'innings', 'balls', 'attendance'];
        for (const table of tables) {
          await db.table(table).clear();
        }
        
        // 2. Pull everything fresh from Supabase
        await pullAllFromSupabase();
        console.log('Cloud-First initialization complete.');
      } finally {
        (window as any).__isRealtimeUpdate = false;
      }
    })();
  } else {
    console.log('Offline: Starting with local cache.');
  }
};

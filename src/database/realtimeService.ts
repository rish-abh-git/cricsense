import { supabase } from './supabaseClient';
import { db } from './db';

const reverseMapMatchPayload = (payload: any) => {
  if (!payload) return payload;
  const mapped: any = { ...payload };

  if (payload.team_a !== undefined) { mapped.teamA = payload.team_a; delete mapped.team_a; }
  if (payload.team_b !== undefined) { mapped.teamB = payload.team_b; delete mapped.team_b; }
  if (payload.team_a_players !== undefined) { mapped.teamAPlayers = payload.team_a_players; delete mapped.team_a_players; }
  if (payload.team_b_players !== undefined) { mapped.teamBPlayers = payload.team_b_players; delete mapped.team_b_players; }
  if (payload.toss_winner !== undefined) { mapped.tossWinner = payload.toss_winner; delete mapped.toss_winner; }
  if (payload.opted_to !== undefined) { mapped.optedTo = payload.opted_to; delete mapped.opted_to; }
  if (payload.is_archived !== undefined) { mapped.isArchived = payload.is_archived; delete mapped.is_archived; }
  if (payload.first_innings_total !== undefined) { mapped.firstInningsTotal = payload.first_innings_total; delete mapped.first_innings_total; }
  if (payload.batting_first !== undefined) { mapped.battingFirst = payload.batting_first; delete mapped.batting_first; }
  if (payload.match_attendance !== undefined) { mapped.matchAttendance = payload.match_attendance; delete mapped.match_attendance; }

  return mapped;
};

export const initRealtimeService = () => {
  const channel = supabase
    .channel('db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      async (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        
        // Use a global flag to prevent IndexedDB hooks from re-syncing this back to Supabase
        (window as any).__isRealtimeUpdate = true;
        
        try {
          const tableName = table as string;
          
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            let record = { ...newRecord };
            if (tableName === 'matches') {
              record = reverseMapMatchPayload(record);
            }
            
            await db.table(tableName).put(record);
            console.log(`Realtime: Synchronized ${eventType} on ${tableName}`, record.id);
          } else if (eventType === 'DELETE') {
            await db.table(tableName).delete(oldRecord.id);
            console.log(`Realtime: Processed DELETE on ${tableName}`, oldRecord.id);
          }
        } catch (err) {
          console.error(`Error processing realtime event for ${table}:`, err);
        } finally {
          (window as any).__isRealtimeUpdate = false;
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

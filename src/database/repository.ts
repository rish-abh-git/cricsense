import { db } from './db';
import type { Ball } from './schema';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { mapMatchPayload } from './syncUtils';

export const PlayerRepo = {
  getAll: () => db.players.toArray(),
  add: async (name: string) => {
    const formatName = (n: string) => n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const id = uuidv4();
    const payload = { id, name: formatName(name) };
    await db.players.add(payload);
    supabase.from('players').upsert(payload).then();
    return id;
  },
  addMultiple: async (names: string[]) => {
    const formatName = (n: string) => n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const players = names.map(name => ({ id: uuidv4(), name: formatName(name) }));
    await db.players.bulkAdd(players);
    supabase.from('players').upsert(players).then();
  }
};

export const MatchRepo = {
  getAll: () => db.matches.orderBy('date').reverse().toArray(),
  getById: (id: string) => db.matches.get(id),
  create: async (teamA: string, teamB: string, teamAPlayers: string[], teamBPlayers: string[], overs: number, battingFirst?: string, matchAttendance?: string[], tossWinner?: string, optedTo?: 'bat' | 'bowl') => {
    const mId = uuidv4();
    const payload: any = {
      id: mId,
      date: Date.now(),
      teamA,
      teamB,
      teamAPlayers,
      teamBPlayers,
      overs,
      status: 'ongoing' as const,
      battingFirst,
      matchAttendance,
      tossWinner,
      optedTo
    };
    await db.matches.add(payload);
    supabase.from('matches').upsert(mapMatchPayload(payload)).then();
    return mId;
  },
  updateStatus: async (id: string, status: 'ongoing' | 'completed', winner?: string) => {
    const updateIdx = { status, winner };
    await db.matches.update(id, updateIdx);
    db.matches.get(id).then(full => {
      if (full) supabase.from('matches').upsert(mapMatchPayload(full)).then();
    });
  },
  addPlayerToTeam: async (matchId: string, team: 'A' | 'B', playerId: string) => {
    const match = await db.matches.get(matchId);
    if (!match) return;
    const update: any = {};
    if (team === 'A') {
      update.teamAPlayers = [...match.teamAPlayers, playerId];
    } else {
      update.teamBPlayers = [...(match.teamBPlayers || []), playerId];
    }
    await db.matches.update(matchId, update);
    db.matches.get(matchId).then(full => {
      if (full) supabase.from('matches').upsert(mapMatchPayload(full)).then();
    });
  }
};

export const InningsRepo = {
  getByMatch: (matchId: string) => db.innings.where('match_id').equals(matchId).toArray(),
  create: async (match_id: string, batting_team: string, bowling_team: string, innings_number: 1 | 2) => {
    const iId = uuidv4();
    const payload = {
      id: iId,
      match_id,
      batting_team,
      bowling_team,
      runs: 0,
      wickets: 0,
      overs: 0,
      balls_bowled: 0,
      innings_number
    };
    await db.innings.add(payload);
    supabase.from('innings').upsert(payload).then();
    return iId;
  },
  updateScore: async (id: string, runs: number, extra_type: string, isWicket: boolean, outPlayerId?: string, noStrikeChange: boolean = false) => {
    // IMPORTANT: We use get+put instead of .update() because Dexie's .update()
    // silently ignores undefined values. We need to CLEAR bowler_id/striker_id
    // by deleting the property from the record.
    const record = await db.innings.get(id);
    if (!record) return;
    
    const isLegalDelivery = extra_type !== 'wide' && extra_type !== 'no_ball';
    const extraRuns = (extra_type === 'wide' || extra_type === 'no_ball') ? 1 : 0;
    const totalRuns = runs + extraRuns;

    // Calculate rotation starting from current state
    let newStrikerId: string | undefined = record.striker_id;
    let newNonStrikerId: string | undefined = record.non_striker_id;
    let clearBowler = false;

    // 1. Swap for odd runs (unless noStrikeChange)
    if (runs % 2 !== 0 && !noStrikeChange) {
      const temp = newStrikerId;
      newStrikerId = newNonStrikerId;
      newNonStrikerId = temp;
    }

    // 2. Over end logic
    const nextBallsBowled = record.balls_bowled + (isLegalDelivery ? 1 : 0);
    const isOverEnd = nextBallsBowled % 6 === 0 && isLegalDelivery && nextBallsBowled > 0;
    
    if (isOverEnd) {
      const temp = newStrikerId;
      newStrikerId = newNonStrikerId;
      newNonStrikerId = temp;
      clearBowler = true;
    }

    // 3. Wicket logic — clear the out player's position
    if (isWicket && outPlayerId) {
      if (outPlayerId === newStrikerId) {
        newStrikerId = undefined;
      } else if (outPlayerId === newNonStrikerId) {
        newNonStrikerId = undefined;
      }
    }

    const updateObj: any = {
      runs: record.runs + totalRuns,
      wickets: record.wickets + (isWicket ? 1 : 0),
      balls_bowled: nextBallsBowled,
      overs: Math.floor(nextBallsBowled / 6) + (nextBallsBowled % 6) / 10
    };

    if (newStrikerId !== undefined) updateObj.striker_id = newStrikerId;
    else updateObj.striker_id = null;

    if (newNonStrikerId !== undefined) updateObj.non_striker_id = newNonStrikerId;
    else updateObj.non_striker_id = null;

    if (clearBowler) updateObj.bowler_id = null;

    await db.innings.update(id, updateObj);
    
    // Non-blocking Supabase sync
    db.innings.get(id).then(fullRecord => {
      if (fullRecord) supabase.from('innings').upsert(fullRecord).then();
    });
  },
  updatePlayers: async (id: string, update: { striker_id?: string, non_striker_id?: string, bowler_id?: string }) => {
    const record = await db.innings.get(id);
    if (!record) return;
    if (update.striker_id !== undefined) record.striker_id = update.striker_id;
    if (update.non_striker_id !== undefined) record.non_striker_id = update.non_striker_id;
    if (update.bowler_id !== undefined) record.bowler_id = update.bowler_id;
    await db.innings.put(record);
    supabase.from('innings').upsert(record).then();
  }
};

export const BallRepo = {
  getByInnings: (inningsId: string) => db.balls.where('innings_id').equals(inningsId).toArray(),
  add: async (ball: Omit<Ball, 'id'>, noStrikeChange: boolean = false) => {
    const innings = await db.innings.get(ball.innings_id);
    const id = uuidv4();
    const payload = {
      ...ball,
      id,
      timestamp: Date.now(),
      snapshot_striker_id: innings?.striker_id,
      snapshot_non_striker_id: innings?.non_striker_id,
      snapshot_bowler_id: innings?.bowler_id,
    };
    await db.balls.add(payload);
    
    // Non-blocking Supabase sync
    supabase.from('balls').upsert(payload).then();
    
    await InningsRepo.updateScore(ball.innings_id, ball.runs, ball.extra_type || 'none', ball.is_wicket, ball.player_out_id, noStrikeChange);
    return id;
  },
  undoLastBall: async (inningsId: string) => {
    const balls = await db.balls.where('innings_id').equals(inningsId).toArray();
    if (balls.length === 0) return;
    
    balls.sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });
    
    const lastBall = balls[balls.length - 1];
    
    // Revert innings score
    const innings = await db.innings.get(inningsId);
    if (innings) {
      const isLegal = lastBall.extra_type !== 'wide' && lastBall.extra_type !== 'no_ball';
      const newBallsBowled = Math.max(0, innings.balls_bowled - (isLegal ? 1 : 0));
      
      const update = {
        runs: Math.max(0, innings.runs - (lastBall.runs + lastBall.extra_runs)),
        wickets: Math.max(0, innings.wickets - (lastBall.is_wicket ? 1 : 0)),
        balls_bowled: newBallsBowled,
        overs: Math.floor(newBallsBowled / 6) + (newBallsBowled % 6) / 10,
        striker_id: lastBall.snapshot_striker_id,
        non_striker_id: lastBall.snapshot_non_striker_id,
        bowler_id: lastBall.snapshot_bowler_id,
      };
      await db.innings.update(inningsId, update);
      db.innings.get(inningsId).then(fullInnings => {
        if (fullInnings) supabase.from('innings').upsert(fullInnings).then();
      });
    }
    
    await db.balls.delete(lastBall.id);
    supabase.from('balls').delete().eq('id', lastBall.id).then();
  },
  revertToBall: async (inningsId: string, targetBallId: string) => {
    const balls = await db.balls.where('innings_id').equals(inningsId).toArray();
    if (balls.length === 0) return;

    balls.sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });

    const targetIndex = balls.findIndex(b => b.id === targetBallId);
    if (targetIndex < 0) return;

    const ballsToDelete = balls.slice(targetIndex + 1);
    if (ballsToDelete.length === 0) return;

    let runsToSubtract = 0;
    let wicketsToSubtract = 0;
    let legalBallsToSubtract = 0;

    for (const b of ballsToDelete) {
      runsToSubtract += b.runs + b.extra_runs;
      if (b.is_wicket) wicketsToSubtract++;
      if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') legalBallsToSubtract++;
    }

    const innings = await db.innings.get(inningsId);
    if (innings) {
      const newBallsBowled = Math.max(0, innings.balls_bowled - legalBallsToSubtract);
      const firstDeletedBall = ballsToDelete[0];

      const update = {
        runs: Math.max(0, innings.runs - runsToSubtract),
        wickets: Math.max(0, innings.wickets - wicketsToSubtract),
        balls_bowled: newBallsBowled,
        overs: Math.floor(newBallsBowled / 6) + (newBallsBowled % 6) / 10,
        striker_id: firstDeletedBall.snapshot_striker_id,
        non_striker_id: firstDeletedBall.snapshot_non_striker_id,
        bowler_id: firstDeletedBall.snapshot_bowler_id,
      };
      await db.innings.update(inningsId, update);
      const fullInnings = await db.innings.get(inningsId);
      if (fullInnings) supabase.from('innings').upsert(fullInnings).then();
    }

    await db.balls.bulkDelete(ballsToDelete.map(b => b.id));
    supabase.from('balls').delete().in('id', ballsToDelete.map(b => b.id)).then();
  }
};

export const AttendanceRepo = {
  getAll: () => db.attendance.toArray(),
  getByDate: (date: number) => db.attendance.where('date').equals(date).toArray(),
  toggle: async (date: number, player_id: string) => {
    const existing = await db.attendance.where({ date, player_id }).first();
    if (existing) {
      await db.attendance.delete(existing.id);
      supabase.from('attendance').delete().eq('id', existing.id).then();
    } else {
      const id = uuidv4();
      const payload = { id, date, player_id };
      await db.attendance.add(payload);
      supabase.from('attendance').upsert(payload).then();
    }
  }
};


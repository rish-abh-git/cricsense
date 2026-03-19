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
    await supabase.from('players').upsert(payload);
    return id;
  },
  addMultiple: async (names: string[]) => {
    const formatName = (n: string) => n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const players = names.map(name => ({ id: uuidv4(), name: formatName(name) }));
    await db.players.bulkAdd(players);
    await supabase.from('players').upsert(players);
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
    await supabase.from('matches').upsert(mapMatchPayload(payload));
    return mId;
  },
  updateStatus: async (id: string, status: 'ongoing' | 'completed', winner?: string) => {
    const updateIdx = { status, winner };
    await db.matches.update(id, updateIdx);
    const full = await db.matches.get(id);
    if (full) {
      await supabase.from('matches').upsert(mapMatchPayload(full));
    }
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
    const full = await db.matches.get(matchId);
    if (full) {
      await supabase.from('matches').upsert(mapMatchPayload(full));
    }
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
    await supabase.from('innings').upsert(payload);
    return iId;
  },
  updateScore: async (id: string, runs: number, isWicket: boolean, isLegalDelivery: boolean) => {
    const innings = await db.innings.get(id);
    if (!innings) return;
    
    const update = {
      runs: innings.runs + runs,
      wickets: innings.wickets + (isWicket ? 1 : 0),
      balls_bowled: innings.balls_bowled + (isLegalDelivery ? 1 : 0),
      overs: Math.floor((innings.balls_bowled + (isLegalDelivery ? 1 : 0)) / 6) + ((innings.balls_bowled + (isLegalDelivery ? 1 : 0)) % 6) / 10
    };
    await db.innings.update(id, update);
    const full = await db.innings.get(id);
    if (full) {
      await supabase.from('innings').upsert(full);
    }
  },
  updatePlayers: async (id: string, update: { striker_id?: string, non_striker_id?: string, bowler_id?: string }) => {
    await db.innings.update(id, update);
    const full = await db.innings.get(id);
    if (full) {
      await supabase.from('innings').upsert(full);
    }
  }
};

export const BallRepo = {
  getByInnings: (inningsId: string) => db.balls.where('innings_id').equals(inningsId).toArray(),
  add: async (ball: Omit<Ball, 'id'>) => {
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
    await supabase.from('balls').upsert(payload);
    
    const isLegal = ball.extra_type !== 'wide' && ball.extra_type !== 'no_ball';
    await InningsRepo.updateScore(ball.innings_id, ball.runs + ball.extra_runs, ball.is_wicket, isLegal);
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
      const fullInnings = await db.innings.get(inningsId);
      if (fullInnings) await supabase.from('innings').upsert(fullInnings);
    }
    
    await db.balls.delete(lastBall.id);
    await supabase.from('balls').delete().eq('id', lastBall.id);
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
      if (fullInnings) await supabase.from('innings').upsert(fullInnings);
    }

    await db.balls.bulkDelete(ballsToDelete.map(b => b.id));
    await supabase.from('balls').delete().in('id', ballsToDelete.map(b => b.id));
  }
};

export const AttendanceRepo = {
  getAll: () => db.attendance.toArray(),
  getByDate: (date: number) => db.attendance.where('date').equals(date).toArray(),
  toggle: async (date: number, player_id: string) => {
    const existing = await db.attendance.where({ date, player_id }).first();
    if (existing) {
      await db.attendance.delete(existing.id);
      await supabase.from('attendance').delete().eq('id', existing.id);
    } else {
      const id = uuidv4();
      await db.attendance.add({ id, date, player_id });
      await supabase.from('attendance').upsert({ id, date, player_id });
    }
  }
};


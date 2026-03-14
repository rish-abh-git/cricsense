import { db } from './db';
import type { Ball } from './schema';
import { v4 as uuidv4 } from 'uuid';

export const PlayerRepo = {
  getAll: () => db.players.toArray(),
  add: (name: string) => {
    const formatName = (n: string) => n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const id = uuidv4();
    return db.players.add({ id, name: formatName(name) });
  },
  addMultiple: (names: string[]) => {
    const formatName = (n: string) => n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const players = names.map(name => ({ id: uuidv4(), name: formatName(name) }));
    return db.players.bulkAdd(players);
  }
};

export const MatchRepo = {
  getAll: () => db.matches.orderBy('date').reverse().toArray(),
  getById: (id: string) => db.matches.get(id),
  create: async (teamA: string, teamB: string, teamAPlayers: string[], teamBPlayers: string[], overs: number, battingFirst?: string, matchAttendance?: string[]) => {
    const mId = uuidv4();
    await db.matches.add({
      id: mId,
      date: Date.now(),
      teamA,
      teamB,
      teamAPlayers,
      teamBPlayers,
      overs,
      status: 'ongoing',
      batting_first: battingFirst,
      match_attendance: matchAttendance,
    });
    return mId;
  },
  updateStatus: (id: string, status: 'ongoing' | 'completed', winner?: string) => {
    return db.matches.update(id, { status, winner });
  },
  addPlayerToTeam: async (matchId: string, team: 'A' | 'B', playerId: string) => {
    const match = await db.matches.get(matchId);
    if (!match) return;
    if (team === 'A') {
      await db.matches.update(matchId, { teamAPlayers: [...match.teamAPlayers, playerId] });
    } else {
      await db.matches.update(matchId, { teamBPlayers: [...match.teamBPlayers, playerId] });
    }
  }
};

export const InningsRepo = {
  getByMatch: (matchId: string) => db.innings.where('match_id').equals(matchId).toArray(),
  create: async (match_id: string, batting_team: string, bowling_team: string, innings_number: 1 | 2) => {
    const iId = uuidv4();
    await db.innings.add({
      id: iId,
      match_id,
      batting_team,
      bowling_team,
      runs: 0,
      wickets: 0,
      overs: 0,
      balls_bowled: 0,
      innings_number
    });
    return iId;
  },
  updateScore: async (id: string, runs: number, isWicket: boolean, isLegalDelivery: boolean) => {
    const innings = await db.innings.get(id);
    if (!innings) return;
    
    await db.innings.update(id, {
      runs: innings.runs + runs,
      wickets: innings.wickets + (isWicket ? 1 : 0),
      balls_bowled: innings.balls_bowled + (isLegalDelivery ? 1 : 0),
      overs: Math.floor((innings.balls_bowled + (isLegalDelivery ? 1 : 0)) / 6) + ((innings.balls_bowled + (isLegalDelivery ? 1 : 0)) % 6) / 10
    });
  }
};

export const BallRepo = {
  getByInnings: (inningsId: string) => db.balls.where('innings_id').equals(inningsId).toArray(),
  add: async (ball: Omit<Ball, 'id'>) => {
    // Capture snapshot of current innings state before this ball
    const innings = await db.innings.get(ball.innings_id);
    const id = uuidv4();
    await db.balls.add({
      ...ball,
      id,
      timestamp: Date.now(),
      snapshot_striker_id: innings?.striker_id,
      snapshot_non_striker_id: innings?.non_striker_id,
      snapshot_bowler_id: innings?.bowler_id,
    });
    const isLegal = ball.extra_type !== 'wide' && ball.extra_type !== 'no_ball';
    await InningsRepo.updateScore(ball.innings_id, ball.runs + ball.extra_runs, ball.is_wicket, isLegal);
    return id;
  },
  undoLastBall: async (inningsId: string) => {
    const balls = await db.balls.where('innings_id').equals(inningsId).toArray();
    if (balls.length === 0) return;
    
    // Sort by timestamp (fallback to over/ball number for legacy data)
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
      
      await db.innings.update(inningsId, {
        runs: Math.max(0, innings.runs - (lastBall.runs + lastBall.extra_runs)),
        wickets: Math.max(0, innings.wickets - (lastBall.is_wicket ? 1 : 0)),
        balls_bowled: newBallsBowled,
        overs: Math.floor(newBallsBowled / 6) + (newBallsBowled % 6) / 10,
        // Restore striker/non-striker/bowler from this ball's snapshot
        striker_id: lastBall.snapshot_striker_id,
        non_striker_id: lastBall.snapshot_non_striker_id,
        bowler_id: lastBall.snapshot_bowler_id,
      });
    }
    
    await db.balls.delete(lastBall.id);
  },
  revertToBall: async (inningsId: string, targetBallId: string) => {
    const balls = await db.balls.where('innings_id').equals(inningsId).toArray();
    if (balls.length === 0) return;

    // Sort by timestamp (fallback to over/ball number)
    balls.sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });

    const targetIndex = balls.findIndex(b => b.id === targetBallId);
    if (targetIndex < 0) return;

    // Get all balls AFTER the target ball
    const ballsToDelete = balls.slice(targetIndex + 1);
    if (ballsToDelete.length === 0) return;

    // Calculate runs, wickets, legal balls to subtract
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

      // We need to figure out what the innings state should be AFTER the target ball
      // The target ball's snapshot is the state BEFORE the target ball was bowled.
      // We need the state AFTER the target ball, which is what was set by handleScoreBall.
      // The easiest approach: the ball AFTER the target has the snapshot of state after target ball.
      // But if we're reverting TO the target ball, the first deleted ball's snapshot IS the correct state after the target ball.
      const firstDeletedBall = ballsToDelete[0];

      await db.innings.update(inningsId, {
        runs: Math.max(0, innings.runs - runsToSubtract),
        wickets: Math.max(0, innings.wickets - wicketsToSubtract),
        balls_bowled: newBallsBowled,
        overs: Math.floor(newBallsBowled / 6) + (newBallsBowled % 6) / 10,
        // Use the first deleted ball's snapshot — that's the state right after the target ball
        striker_id: firstDeletedBall.snapshot_striker_id,
        non_striker_id: firstDeletedBall.snapshot_non_striker_id,
        bowler_id: firstDeletedBall.snapshot_bowler_id,
      });
    }

    // Delete all balls after target
    await db.balls.bulkDelete(ballsToDelete.map(b => b.id));
  }
};

export const AttendanceRepo = {
  getAll: () => db.attendance.toArray(),
  getByDate: (date: number) => db.attendance.where('date').equals(date).toArray(),
  toggle: async (date: number, player_id: string) => {
    const existing = await db.attendance.where({ date, player_id }).first();
    if (existing) {
      await db.attendance.delete(existing.id);
    } else {
      await db.attendance.add({ id: uuidv4(), date, player_id });
    }
  }
};


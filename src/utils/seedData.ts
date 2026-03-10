import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import type { Player, Ball } from '../database/schema';

export const seedDatabase = async () => {
    // 1. Clear existing data
    await db.balls.clear();
    await db.innings.clear();
    await db.matches.clear();
    await db.players.clear();
    await db.attendance.clear();

    // 2. Add Players
    const playerDatas = [
        { name: 'Rishabh' }, { name: 'Puru' }, { name: 'Chakli' },
        { name: 'Deep' }, { name: 'Jay' }, { name: 'Atul' },
        { name: 'Sagar' }, { name: 'Shaggy' }, { name: 'Sahil' },
        { name: 'Ani' }, { name: 'Ved' }, { name: 'Bobby' }, { name: 'Dixit' }
    ];

    const players: Player[] = playerDatas.map(p => ({
        id: uuidv4(),
        name: p.name,
        is_morya_warrior: true
    }));
    await db.players.bulkAdd(players);

    // 3. Create a Match
    const teamA = 'Morya Warriors';
    const teamB = 'World Icons';
    const teamAPlayers = players.slice(0, 7).map(p => p.id);
    const teamBPlayers = players.slice(7, 13).map(p => p.id);

    const matchId = uuidv4();
    await db.matches.add({
        id: matchId,
        date: Date.now() - 86400000,
        teamA,
        teamB,
        teamAPlayers,
        teamBPlayers,
        overs: 2, // Short match for seeding
        status: 'completed',
        winner: teamA
    });

    // 4. Innings 1 (World Icons bat)
    const innings1Id = uuidv4();
    await db.innings.add({
        id: innings1Id,
        match_id: matchId,
        batting_team: teamB,
        bowling_team: teamA,
        runs: 18,
        wickets: 2,
        overs: 2,
        balls_bowled: 12,
        innings_number: 1,
        striker_id: teamBPlayers[0],
        non_striker_id: teamBPlayers[1],
        bowler_id: teamAPlayers[0]
    });

    // Dummy Balls for Innings 1
    const i1Balls: Ball[] = [
        // Over 0
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 1, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 4, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 2, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' }, // Dot
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 3, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 4, batsman_id: teamBPlayers[1], bowler_id: teamAPlayers[0], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: true, wicket_type: 'caught', player_out_id: teamBPlayers[1], fielder_id: teamAPlayers[1] }, // Wicket + Fielder Catch
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 5, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[0], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 6, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 6, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        // Over 1 (New Bowler)
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 1, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' }, // Dot
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 2, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 2, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 3, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: true, wicket_type: 'run_out', player_out_id: teamBPlayers[0], fielder_id: teamAPlayers[2] }, // Run out + Fielder
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 4, batsman_id: teamBPlayers[3], bowler_id: teamAPlayers[1], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 5, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 6, batsman_id: teamBPlayers[3], bowler_id: teamAPlayers[1], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
    ];
    await db.balls.bulkAdd(i1Balls);

    // 5. Innings 2 (India Stars bat)
    const innings2Id = uuidv4();
    await db.innings.add({
        id: innings2Id,
        match_id: matchId,
        batting_team: teamA,
        bowling_team: teamB,
        runs: 20,
        wickets: 0,
        overs: 1.1,
        balls_bowled: 7,
        innings_number: 2,
        striker_id: teamAPlayers[0],
        non_striker_id: teamAPlayers[1],
        bowler_id: teamBPlayers[0]
    });

    const i2Balls: Ball[] = [
        { id: uuidv4(), innings_id: innings2Id, over_number: 0, ball_number: 1, batsman_id: teamAPlayers[0], bowler_id: teamBPlayers[0], runs: 6, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings2Id, over_number: 0, ball_number: 2, batsman_id: teamAPlayers[0], bowler_id: teamBPlayers[0], runs: 4, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings2Id, over_number: 0, ball_number: 3, batsman_id: teamAPlayers[0], bowler_id: teamBPlayers[0], runs: 4, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings2Id, over_number: 0, ball_number: 4, batsman_id: teamAPlayers[0], bowler_id: teamBPlayers[0], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings2Id, over_number: 0, ball_number: 5, batsman_id: teamAPlayers[0], bowler_id: teamBPlayers[0], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings2Id, over_number: 0, ball_number: 6, batsman_id: teamAPlayers[1], bowler_id: teamBPlayers[0], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings2Id, over_number: 1, ball_number: 1, batsman_id: teamAPlayers[0], bowler_id: teamBPlayers[1], runs: 4, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
    ];
    await db.balls.bulkAdd(i2Balls);
};

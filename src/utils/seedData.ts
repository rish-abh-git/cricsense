import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import type { Player, Ball } from '../database/schema';
import { supabase } from '../database/supabaseClient';
import { mapMatchPayload } from '../database/syncUtils';

export const seedDatabase = async () => {
    (window as any).__isRealtimeUpdate = true;
    try {
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
    await supabase.from('players').upsert(players);

    // 3. Create a Match
    const teamA = 'Morya Warriors';
    const teamB = 'World Icons';
    const teamAPlayers = players.slice(0, 7).map(p => p.id);
    const teamBPlayers = players.slice(7, 13).map(p => p.id);

    const matchId = uuidv4();
    const matchPayload: any = {
        id: matchId,
        date: Date.now() - 86400000,
        teamA,
        teamB,
        teamAPlayers,
        teamBPlayers,
        overs: 2,
        status: 'completed',
        winner: teamA
    };
    await db.matches.add(matchPayload);
    await supabase.from('matches').upsert(mapMatchPayload(matchPayload));

    // 4. Innings 1 (World Icons bat)
    const innings1Id = uuidv4();
    const i1Payload = {
        id: innings1Id,
        match_id: matchId,
        batting_team: teamB,
        bowling_team: teamA,
        runs: 18,
        wickets: 2,
        overs: 2,
        balls_bowled: 12,
        innings_number: 1 as const,
        striker_id: teamBPlayers[0],
        non_striker_id: teamBPlayers[1],
        bowler_id: teamAPlayers[0]
    };
    await db.innings.add(i1Payload);
    await supabase.from('innings').upsert(i1Payload);

    // Dummy Balls for Innings 1
    const i1Balls: Ball[] = [
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 1, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 4, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 2, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 3, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 4, batsman_id: teamBPlayers[1], bowler_id: teamAPlayers[0], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: true, wicket_type: 'caught', player_out_id: teamBPlayers[1], fielder_id: teamAPlayers[1] } as any,
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 5, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[0], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 0, ball_number: 6, batsman_id: teamBPlayers[0], bowler_id: teamAPlayers[0], runs: 6, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 1, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 2, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 2, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 3, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 0, extra_type: 'none', extra_runs: 0, is_wicket: true, wicket_type: 'run_out', player_out_id: teamBPlayers[0], fielder_id: teamAPlayers[2] } as any,
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 4, batsman_id: teamBPlayers[3], bowler_id: teamAPlayers[1], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 5, batsman_id: teamBPlayers[2], bowler_id: teamAPlayers[1], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
        { id: uuidv4(), innings_id: innings1Id, over_number: 1, ball_number: 6, batsman_id: teamBPlayers[3], bowler_id: teamAPlayers[1], runs: 1, extra_type: 'none', extra_runs: 0, is_wicket: false, wicket_type: 'none' },
    ];
    await db.balls.bulkAdd(i1Balls);
    await supabase.from('balls').upsert(i1Balls);

    // 5. Innings 2 (Morya Warriors bat)
    const innings2Id = uuidv4();
    const i2Payload = {
        id: innings2Id,
        match_id: matchId,
        batting_team: teamA,
        bowling_team: teamB,
        runs: 20,
        wickets: 0,
        overs: 1.1,
        balls_bowled: 7,
        innings_number: 2 as const,
        striker_id: teamAPlayers[0],
        non_striker_id: teamAPlayers[1],
        bowler_id: teamBPlayers[0]
    };
    await db.innings.add(i2Payload);
    await supabase.from('innings').upsert(i2Payload);

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
    await supabase.from('balls').upsert(i2Balls);

    } finally {
        (window as any).__isRealtimeUpdate = false;
    }
};

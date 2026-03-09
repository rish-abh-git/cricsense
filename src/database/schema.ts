export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'none';
export type WicketType = 'bowled' | 'caught' | 'run_out' | 'stumped' | 'lbw' | 'hit_wicket' | 'none';

export interface Player {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  date: number;
  teamA: string;
  teamB: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  overs: number;
  status: 'ongoing' | 'completed';
  winner?: string;
  tossWinner?: string;
  optedTo?: 'bat' | 'bowl';
}

export interface Innings {
  id: string;
  match_id: string;
  batting_team: string;
  bowling_team: string;
  runs: number;
  wickets: number;
  overs: number;
  balls_bowled: number;
  innings_number: 1 | 2;
  striker_id?: string;
  non_striker_id?: string;
  bowler_id?: string;
}

export interface Ball {
  id: string;
  innings_id: string;
  over_number: number;
  ball_number: number;
  batsman_id: string;
  bowler_id: string;
  runs: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: WicketType;
  player_out_id?: string;
}

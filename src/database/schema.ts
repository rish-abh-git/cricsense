export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'none';
export type WicketType = 'bowled' | 'caught' | 'run_out' | 'stumped' | 'lbw' | 'hit_wicket' | 'none';

export interface Player {
  id: string;
  name: string;
  is_morya_warrior?: boolean;
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
  isArchived?: boolean;
  battingFirst?: string;
  firstInningsTotal?: number;
  matchAttendance?: string[]; // player IDs present for this match

  // New fields for sync logic (snake_case versions)
  team_a?: string;
  team_b?: string;
  team_a_players?: string[];
  team_b_players?: string[];
  toss_winner?: string;
  opted_to?: 'bat' | 'bowl';
  is_archived?: boolean;
  batting_first?: string;
  first_innings_total?: number;
  match_attendance?: string[];
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

export interface Attendance {
  id: string;
  date: number;
  player_id: string;
}

export interface Ball {
  id: string;
  innings_id: string;
  over_number: number;
  ball_number: number;
  batsman_id: string;
  bowler_id: string;
  fielder_id?: string;
  runs: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: WicketType;
  player_out_id?: string;
  timestamp?: number;
  // Snapshot of innings state BEFORE this ball was bowled (for undo)
  snapshot_striker_id?: string;
  snapshot_non_striker_id?: string;
  snapshot_bowler_id?: string;
}

export interface SyncOperation {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload?: any;
  timestamp: number;
}

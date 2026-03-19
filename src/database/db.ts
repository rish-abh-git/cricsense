import Dexie, { type Table } from 'dexie';
import type { Player, Match, Innings, Ball, Attendance } from './schema';

export class CricSenseDB extends Dexie {
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  innings!: Table<Innings, string>;
  balls!: Table<Ball, string>;
  attendance!: Table<Attendance, string>;

  constructor() {
    super('CricSenseDatabase');
    this.version(6).stores({
      players: 'id, name, is_morya_warrior',
      matches: 'id, date, status, is_archived',
      innings: 'id, match_id, innings_number',
      balls: 'id, innings_id, [innings_id+over_number+ball_number], batsman_id, bowler_id, timestamp',
      attendance: 'id, date, player_id'
    });
  }
}

export const db = new CricSenseDB();

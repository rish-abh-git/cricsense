import Dexie, { type Table } from 'dexie';
import type { Player, Match, Innings, Ball } from './schema';

export class CricSenseDB extends Dexie {
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  innings!: Table<Innings, string>;
  balls!: Table<Ball, string>;

  constructor() {
    super('CricSenseDatabase');
    this.version(1).stores({
      players: 'id, name',
      matches: 'id, date, status',
      innings: 'id, match_id, innings_number',
      balls: 'id, innings_id, [innings_id+over_number+ball_number], batsman_id, bowler_id'
    });
  }
}

export const db = new CricSenseDB();

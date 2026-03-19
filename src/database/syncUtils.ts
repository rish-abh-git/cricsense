export const mapMatchPayload = (payload: any) => {
  if (!payload) return payload;
  const mapped: any = { ...payload };
  
  // Map camelCase to snake_case for Supabase
  if (payload.teamA !== undefined) { mapped.team_a = payload.teamA; delete mapped.teamA; }
  if (payload.teamB !== undefined) { mapped.team_b = payload.teamB; delete mapped.teamB; }
  if (payload.teamAPlayers !== undefined) { mapped.team_a_players = payload.teamAPlayers; delete mapped.teamAPlayers; }
  if (payload.teamBPlayers !== undefined) { mapped.team_b_players = payload.teamBPlayers; delete mapped.teamBPlayers; }
  if (payload.tossWinner !== undefined) { mapped.toss_winner = payload.tossWinner; delete mapped.tossWinner; }
  if (payload.optedTo !== undefined) { mapped.opted_to = payload.optedTo; delete mapped.optedTo; }
  if (payload.firstInningsTotal !== undefined) { mapped.first_innings_total = payload.firstInningsTotal; delete mapped.firstInningsTotal; }
  if (payload.isArchived !== undefined) { mapped.is_archived = payload.isArchived; delete mapped.is_archived; }
  if (payload.battingFirst !== undefined) { mapped.batting_first = payload.battingFirst; delete mapped.battingFirst; }
  if (payload.matchAttendance !== undefined) { mapped.match_attendance = payload.matchAttendance; delete mapped.matchAttendance; }

  return mapped;
};

export const reverseMapMatchPayload = (payload: any) => {
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

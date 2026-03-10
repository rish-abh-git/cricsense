import { db } from '../database/db';

export const generateDaySummary = async (dateStr: string, matchIds: string[]) => {
  const matches = await db.matches.where('id').anyOf(matchIds).toArray();
  const innings = await db.innings.where('match_id').anyOf(matchIds).toArray();
  const balls = await db.balls.toArray(); // We can filter this in memory
  const players = await db.players.toArray();

  let text = `🏆 Match Summary - ${dateStr}\n\n`;

  for (const match of matches) {
    const mInnings = innings.filter(i => i.match_id === match.id);
    const i1 = mInnings.find(i => i.innings_number === 1);
    const i2 = mInnings.find(i => i.innings_number === 2);

    let winner = 'Draw / Pending';
    if (i1 && i2 && match.status === 'completed') {
      if (i1.runs > i2.runs) winner = `${i1.batting_team} won by ${i1.runs - i2.runs} runs`;
      else if (i2.runs > i1.runs) winner = `${i2.batting_team} won by ${10 - i2.wickets} wickets`;
      else winner = 'Match Tied';
    }

    text += `🔹 ${match.teamA} vs ${match.teamB}\n`;
    if (i1) text += `${i1.batting_team}: ${i1.runs}/${i1.wickets} (${i1.overs.toFixed(1)} ov)\n`;
    if (i2) text += `${i2.batting_team}: ${i2.runs}/${i2.wickets} (${i2.overs.toFixed(1)} ov)\n`;
    text += `Result: ${winner}\n\n`;
  }

  // Aggregate stats across all these matches
  const mBalls = balls.filter(b => mInningsKeys(innings, matchIds).includes(b.innings_id));

  const batsmanStats = new Map<string, { runs: number, balls: number }>();
  const bowlerStats = new Map<string, { wickets: number, runs: number }>();

  mBalls.forEach(b => {
    const bStat = batsmanStats.get(b.batsman_id) || { runs: 0, balls: 0 };
    bStat.runs += b.runs;
    if (b.extra_type !== 'wide') bStat.balls += 1;
    batsmanStats.set(b.batsman_id, bStat);

    const blStat = bowlerStats.get(b.bowler_id) || { wickets: 0, runs: 0 };
    blStat.runs += b.runs + b.extra_runs;
    if (b.is_wicket && b.wicket_type !== 'run_out') blStat.wickets += 1;
    bowlerStats.set(b.bowler_id, blStat);
  });

  let topSm = { id: '', runs: -1, balls: 0 };
  batsmanStats.forEach((stat, id) => {
    if (stat.runs > topSm.runs || (stat.runs === topSm.runs && stat.balls < topSm.balls)) { topSm = { id, ...stat }; }
  });

  let bestBm = { id: '', wickets: -1, runs: 999 };
  bowlerStats.forEach((stat, id) => {
    if (stat.wickets > bestBm.wickets || (stat.wickets === bestBm.wickets && stat.runs < bestBm.runs)) {
      bestBm = { id, ...stat };
    }
  });

  const tsPlayer = players.find(p => p.id === topSm.id);
  const bbPlayer = players.find(p => p.id === bestBm.id);

  if (tsPlayer && topSm.runs > 0) {
    text += `⭐ Star Batsman of the Day:\n${tsPlayer.name} - ${topSm.runs} runs (${topSm.balls} balls)\n\n`;
  }
  if (bbPlayer && bestBm.wickets > 0) {
    text += `🎯 Star Bowler of the Day:\n${bbPlayer.name} - ${bestBm.wickets} wkts for ${bestBm.runs} runs\n`;
  }

  return text;
};

const mInningsKeys = (innings: any[], matchIds: string[]) => {
  return innings.filter(i => matchIds.includes(i.match_id)).map(i => i.id);
};

export const generateBallWiseSummary = async (matchIds: string[]) => {
  const matches = await db.matches.where('id').anyOf(matchIds).toArray();
  const innings = await db.innings.where('match_id').anyOf(matchIds).toArray();
  const balls = await db.balls.toArray();
  const players = await db.players.toArray();

  let text = `📊 Ball-by-Ball Detailed Summary for AI Analysis\n\n`;

  for (const match of matches) {
    text += `Match: ${match.teamA} vs ${match.teamB} (${new Date(match.date).toLocaleDateString()})\n`;
    const mInnings = innings.filter(i => i.match_id === match.id);

    for (const inn of mInnings) {
      text += `\nInnings ${inn.innings_number}: ${inn.batting_team} batting\n`;
      const innBalls = balls.filter(b => b.innings_id === inn.id).sort((a, b) => a.over_number - b.over_number || a.ball_number - b.ball_number);

      innBalls.forEach(b => {
        const batsman = players.find(p => p.id === b.batsman_id)?.name || 'Unknown';
        const bowler = players.find(p => p.id === b.bowler_id)?.name || 'Unknown';
        let detail = `${b.runs} runs`;
        if (b.extra_type !== 'none') detail += ` (${b.extra_type})`;
        if (b.is_wicket) detail += ` [WICKET - ${b.wicket_type}]`;

        text += `${b.over_number}.${b.ball_number} | ${bowler} to ${batsman} | ${detail}\n`;
      });
    }
    text += `\n--------------------------------\n\n`;
  }

  return text;
};

export const shareText = async (text: string, title: string) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
    } catch (err) {
      console.error('Share failed', err);
    }
  } else {
    window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`;
  }
};

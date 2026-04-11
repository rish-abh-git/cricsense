import { db } from '../database/db';

export const formatOvers = (legalBalls: number) => {
    const overs = Math.floor(legalBalls / 6);
    const balls = legalBalls % 6;
    return `${overs}.${balls}`;
};

export const getExportJSON = async () => {
    const players = await db.players.toArray();
    const matches = await db.matches.toArray();
    const innings = await db.innings.toArray();
    const balls = await db.balls.toArray();
    const attendance = await db.attendance.toArray();

    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        players,
        matches,
        innings,
        balls,
        attendance
    };
    return JSON.stringify(data, null, 2);
};

export const exportData = async () => {
    try {
        const jsonStr = await getExportJSON();

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cricsense-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    } catch (error) {
        console.error('Export failed:', error);
        throw error;
    }
};

export const exportDataByMail = async () => {
    try {
        const jsonStr = await getExportJSON();
        const filename = `cricsense-export-${new Date().toISOString().split('T')[0]}.json`;
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const file = new File([blob], filename, { type: 'application/json' });

        const formData = new FormData();
        formData.append("backup_file", file);
        formData.append("_subject", `CricSense Weekly Backup - ${new Date().toLocaleDateString()}`);
        formData.append("_captcha", "false"); // Disable recaptcha
        formData.append("_template", "box"); // Better email template

        // Silently submit to formsubmit.co via AJAX
        const response = await fetch("https://formsubmit.co/ajax/masanirishabh12@gmail.com", {
            method: "POST",
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to send email: ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('Email export failed:', error);
        throw error;
    }
};

export const getSingleMatchExportJSON = async (matchId: string) => {
    const match = await db.matches.get(matchId);
    if (!match) throw new Error("Match not found");
    const innings = await db.innings.where('match_id').equals(matchId).toArray();
    const inningsIds = innings.map(i => i.id);
    
    const mBalls = [];
    for (const iId of inningsIds) {
        const iballs = await db.balls.where('innings_id').equals(iId).toArray();
        mBalls.push(...iballs);
    }
    
    const playerIds = new Set<string>();
    match.teamAPlayers?.forEach(id => playerIds.add(id));
    match.teamBPlayers?.forEach(id => playerIds.add(id));
    mBalls.forEach(b => {
        if (b.batsman_id) playerIds.add(b.batsman_id);
        if (b.bowler_id) playerIds.add(b.bowler_id);
    });
    
    const players = await db.players.where('id').anyOf([...playerIds]).toArray();

    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        players,
        matches: [match],
        innings,
        balls: mBalls,
        attendance: []
    };
    return JSON.stringify(data, null, 2);
};

export const exportSingleMatch = async (matchId: string, matchName: string) => {
    try {
        const jsonStr = await getSingleMatchExportJSON(matchId);
        const filename = `cricsense-${matchName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-export-${new Date().toISOString().split('T')[0]}.json`;
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error('Export failed:', error);
        throw error;
    }
};

export const exportSingleMatchByMail = async (matchId: string, matchName: string) => {
    try {
        const jsonStr = await getSingleMatchExportJSON(matchId);
        const filename = `cricsense-${matchName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-export-${new Date().toISOString().split('T')[0]}.json`;
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const file = new File([blob], filename, { type: 'application/json' });

        const formData = new FormData();
        formData.append("backup_file", file);
        formData.append("_subject", `CricSense Match Backup - ${matchName}`);
        formData.append("_captcha", "false");
        formData.append("_template", "box");

        const response = await fetch("https://formsubmit.co/ajax/masanirishabh12@gmail.com", {
            method: "POST",
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to send email: ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('Email export failed:', error);
        throw error;
    }
};

export const importData = async (jsonData: string) => {
    try {
        const data = JSON.parse(jsonData);

        // Basic validation
        if (!data.players || !data.matches || !data.innings || !data.balls) {
            throw new Error('Invalid data format. Missing required tables.');
        }

        await db.transaction('rw', [db.players, db.matches, db.innings, db.balls, db.attendance], async () => {
            // Clear existing data
            await db.players.clear();
            await db.matches.clear();
            await db.innings.clear();
            await db.balls.clear();
            await db.attendance.clear();

            // Import new data
            if (data.players.length > 0) await db.players.bulkAdd(data.players);
            if (data.matches.length > 0) await db.matches.bulkAdd(data.matches);
            if (data.innings.length > 0) await db.innings.bulkAdd(data.innings);
            if (data.balls.length > 0) await db.balls.bulkAdd(data.balls);
            if (data.attendance && data.attendance.length > 0) await db.attendance.bulkAdd(data.attendance);
        });

        return true;
    } catch (error) {
        console.error('Import failed:', error);
        throw error;
    }
};

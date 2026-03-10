import { db } from '../database/db';

export const exportData = async () => {
    try {
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

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

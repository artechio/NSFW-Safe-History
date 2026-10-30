const STATS_KEY = 'stats';

function emptyStats(now) {
    return {
        removedTotal: 0,
        removedToday: 0,
        day: dayKey(now),
        since: Number(now) || Date.now()
    };
}

function dayKey(now) {
    const date = new Date(Number(now) || Date.now());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function normalizeStats(raw, now) {
    const base = emptyStats(now);
    if (!raw || typeof raw !== 'object') return base;
    const today = dayKey(now);
    return {
        removedTotal: Math.max(0, Number(raw.removedTotal) || 0),
        removedToday: raw.day === today ? Math.max(0, Number(raw.removedToday) || 0) : 0,
        day: today,
        since: Number(raw.since) || base.since
    };
}

function addRemoved(raw, count, now) {
    const stats = normalizeStats(raw, now);
    const amount = Math.max(0, Number(count) || 0);
    stats.removedTotal += amount;
    stats.removedToday += amount;
    return stats;
}

module.exports = {
    STATS_KEY,
    dayKey,
    normalizeStats,
    addRemoved
};

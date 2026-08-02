const COOLDOWN_MS = 90 * 60 * 1000;
const pingCooldowns = new Map(); // key → Date.now() when last sent

// Keys used: 'gping', 'qping', 'market', 'spawner'
module.exports = { COOLDOWN_MS, pingCooldowns };

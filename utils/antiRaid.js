const { readData } = require('./index');
const { sendLog } = require('./logger');

const WINDOW     = 5 * 60 * 1000; // 5 minutes
const THRESHOLDS = { everyone: 5, here: 5, channelDelete: 20, ban: 5, kick: 5, mute: 15 };

// userId → { everyone: [ts, ...], here: [ts, ...], channelDelete: [ts, ...], ban: [ts, ...] }
const tracker = new Map();

function prune(arr, now) {
  return arr.filter(ts => now - ts < WINDOW);
}

// Records one action. Returns true if the threshold is reached.
function recordAction(userId, type) {
  const now = Date.now();
  if (!tracker.has(userId)) tracker.set(userId, { everyone: [], here: [], channelDelete: [], ban: [] });
  const u = tracker.get(userId);
  if (!u[type]) u[type] = [];
  u[type] = prune(u[type], now);
  u[type].push(now);
  return u[type].length >= THRESHOLDS[type];
}

function clearUser(userId) {
  tracker.delete(userId);
}

async function triggerAntiRaid(guild, userId, reason, client) {
  const cfg = readData('antiraid.json');
  if (cfg.enabled === false) return;
  if (Array.isArray(cfg.exemptUsers) && cfg.exemptUsers.includes(userId)) return;

  clearUser(userId);

  // Use cache first to avoid network round-trip delay
  const member = guild.members.cache.get(userId)
    ?? await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  // Exclude @everyone and integration-managed roles (can't be manually removed)
  const rolesToRemove = [...member.roles.cache.values()]
    .filter(r => r.id !== guild.id && !r.managed)
    .map(r => r.id);

  // Remove roles FIRST — Discord won't timeout members who still have Administrator
  if (rolesToRemove.length) {
    await member.roles.remove(rolesToRemove, `AntiRaid: ${reason}`)
      .catch(e => console.error('[AntiRaid] Role removal failed:', e.message));
  }

  // Timeout after roles are stripped (now safe even for ex-admins)
  await member.timeout(28 * 24 * 60 * 60 * 1000, `AntiRaid: ${reason}`)
    .catch(e => console.error('[AntiRaid] Timeout failed:', e.message));

  // Alert and log after action is taken
  if (cfg.channelId) {
    const ch = client.channels.cache.get(cfg.channelId);
    if (ch) {
      for (let i = 0; i < 3; i++) {
        ch.send({
          content: i < 2
            ? `@everyone`
            : `@everyone ⚠️ **RAID DETECTED!** <@${userId}> wurde automatisch gemutet und alle Rollen wurden entfernt.\n**Grund:** ${reason}`,
          allowedMentions: { parse: ['everyone'] },
        }).catch(() => {});
      }
    }
  }

  sendLog(client, {
    action: '🚨 AntiRaid — Automatische Aktion',
    executor: 'AntiRaid',
    target: `<@${userId}>`,
    fields: {
      'Grund': reason,
      'Aktion': 'Alle Rollen entfernt + 28 Tage gemuted',
    },
    color: '#ED4245',
  });
}

module.exports = { recordAction, clearUser, triggerAntiRaid };

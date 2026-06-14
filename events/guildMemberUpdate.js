const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { recordAction, triggerAntiRaid } = require('../utils/antiRaid');

async function fetchEntry(guild, type, targetId, maxAgeMs = 5000) {
  try {
    const audit = await guild.fetchAuditLogs({ type, limit: 5 });
    return audit.entries.find(e =>
      e.target?.id === targetId &&
      Date.now() - e.createdTimestamp < maxAgeMs
    ) ?? null;
  } catch { return null; }
}

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {

    // ── Timeout applied / removed ─────────────────────────────────────────────
    const wasTimedOut = !!oldMember.communicationDisabledUntilTimestamp;
    const isTimedOut  = !!newMember.communicationDisabledUntilTimestamp;

    if (!wasTimedOut && isTimedOut) {
      const entry = await fetchEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const exec  = entry?.executor;

      if (exec && recordAction(exec.id, 'mute')) {
        triggerAntiRaid(newMember.guild, exec.id, '15 Mutes in 5 Minuten', client);
      }

      sendLog(client, {
        action: '🔇 Member Timed Out',
        executor: exec?.tag ?? 'Unknown',
        target: `<@${newMember.id}> (${newMember.user.tag})`,
        fields: {
          '👮 Ausgeführt von': exec ? `<@${exec.id}>` : 'Unknown',
          '⏰ Bis': `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`,
        },
        color: '#FEE75C',
      });

    } else if (wasTimedOut && !isTimedOut) {
      const entry = await fetchEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const exec  = entry?.executor;

      sendLog(client, {
        action: '🔈 Timeout Entfernt',
        executor: exec?.tag ?? 'Unknown',
        target: `<@${newMember.id}> (${newMember.user.tag})`,
        fields: {
          '👮 Ausgeführt von': exec ? `<@${exec.id}>` : 'Unknown',
        },
        color: '#57F287',
      });
    }

    // ── Role added / removed ──────────────────────────────────────────────────
    const addedRoles   = newMember.roles.cache.filter(r => r.id !== newMember.guild.id && !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => r.id !== newMember.guild.id && !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const entry = await fetchEntry(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      const exec  = entry?.executor;

      if (addedRoles.size > 0) {
        sendLog(client, {
          action: '✅ Rolle Hinzugefügt',
          executor: exec?.tag ?? 'Unknown',
          target: `<@${newMember.id}> (${newMember.user.tag})`,
          fields: {
            '🎖️ Rolle(n)': addedRoles.map(r => `<@&${r.id}>`).join(', '),
            '👮 Ausgeführt von': exec ? `<@${exec.id}>` : 'Unknown',
          },
          color: '#57F287',
        });
      }

      if (removedRoles.size > 0) {
        sendLog(client, {
          action: '❌ Rolle Entfernt',
          executor: exec?.tag ?? 'Unknown',
          target: `<@${newMember.id}> (${newMember.user.tag})`,
          fields: {
            '🎖️ Rolle(n)': removedRoles.map(r => `<@&${r.id}>`).join(', '),
            '👮 Ausgeführt von': exec ? `<@${exec.id}>` : 'Unknown',
          },
          color: '#ED4245',
        });
      }
    }

    // ── Nickname changed ──────────────────────────────────────────────────────
    if (oldMember.nickname !== newMember.nickname) {
      const entry = await fetchEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const exec  = entry?.executor;

      sendLog(client, {
        action: '✏️ Nickname Geändert',
        executor: exec?.tag ?? newMember.user.tag,
        target: `<@${newMember.id}> (${newMember.user.tag})`,
        fields: {
          '📝 Alt': oldMember.nickname ?? '*(kein Nickname)*',
          '📝 Neu': newMember.nickname ?? '*(kein Nickname)*',
          '👮 Ausgeführt von': exec ? `<@${exec.id}>` : `<@${newMember.id}>`,
        },
        color: '#5865F2',
      });
    }
  },
};

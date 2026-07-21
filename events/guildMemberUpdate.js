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
        triggerAntiRaid(newMember.guild, exec.id, '15 mutes in 5 minutes', client);
      }

      sendLog(client, {
        action: '🔇 Member Timed Out',
        executor: exec?.tag ?? 'Unknown',
        target: `<@${newMember.id}> (${newMember.user.tag})`,
        fields: {
          'By': exec ? `<@${exec.id}>` : 'Unknown',
          'Until': `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`,
        },
        color: '#FEE75C',
      });

    } else if (wasTimedOut && !isTimedOut) {
      const entry = await fetchEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const exec  = entry?.executor;

      sendLog(client, {
        action: '🔈 Timeout Removed',
        executor: exec?.tag ?? 'Unknown',
        target: `<@${newMember.id}> (${newMember.user.tag})`,
        fields: {
          'By': exec ? `<@${exec.id}>` : 'Unknown',
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

      // Skip logging if the bot itself added/removed the role (e.g. autorole, antiraid)
      if (exec && exec.id === client.user.id) return;

      if (addedRoles.size > 0) {
        sendLog(client, {
          action: '✅ Role Added',
          executor: exec?.tag ?? 'Unknown',
          target: `<@${newMember.id}> (${newMember.user.tag})`,
          fields: {
            'Role(s)': addedRoles.map(r => `<@&${r.id}>`).join(', '),
            'By': exec ? `<@${exec.id}>` : 'Unknown',
          },
          color: '#57F287',
        });
      }

      if (removedRoles.size > 0) {
        sendLog(client, {
          action: '❌ Role Removed',
          executor: exec?.tag ?? 'Unknown',
          target: `<@${newMember.id}> (${newMember.user.tag})`,
          fields: {
            'Role(s)': removedRoles.map(r => `<@&${r.id}>`).join(', '),
            'By': exec ? `<@${exec.id}>` : 'Unknown',
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
        action: '✏️ Nickname Changed',
        executor: exec?.tag ?? newMember.user.tag,
        target: `<@${newMember.id}> (${newMember.user.tag})`,
        fields: {
          'Old': oldMember.nickname ?? '*(none)*',
          'New': newMember.nickname ?? '*(none)*',
          'By': exec ? `<@${exec.id}>` : `<@${newMember.id}>`,
        },
        color: '#5865F2',
      });
    }
  },
};

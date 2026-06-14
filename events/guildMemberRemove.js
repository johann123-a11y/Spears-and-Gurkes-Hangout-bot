const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { recordAction, triggerAntiRaid } = require('../utils/antiRaid');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const guild  = member.guild;
    const roles  = member.roles.cache.filter(r => r.id !== guild.id).map(r => `<@&${r.id}>`).join(', ') || '—';
    const joined = member.joinedAt ? `<t:${Math.floor(member.joinedAt / 1000)}:R>` : '—';

    // Check audit log: was this a kick or a ban?
    let kickEntry = null;
    let banEntry  = null;
    try {
      await new Promise(r => setTimeout(r, 500));
      const [kickAudit, banAudit] = await Promise.all([
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }),
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 }),
      ]);
      kickEntry = kickAudit.entries.find(e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000) ?? null;
      banEntry  = banAudit.entries.find(e =>  e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000) ?? null;
    } catch {}

    // Ban is handled by guildBanAdd — skip logging here to avoid duplicate
    if (banEntry) return;

    if (kickEntry) {
      const exec = kickEntry.executor;

      // Anti-raid kick tracking
      if (exec && recordAction(exec.id, 'kick')) {
        triggerAntiRaid(guild, exec.id, '5 Kicks in 5 Minuten', client);
      }

      sendLog(client, {
        action: '👢 Member Gekickt',
        executor: exec?.tag ?? 'Unknown',
        target: `<@${member.id}> (${member.user.tag})`,
        fields: {
          '👮 Gekickt von': exec ? `<@${exec.id}>` : 'Unknown',
          '📋 Grund': kickEntry.reason ?? '*(kein Grund angegeben)*',
          '📅 Beigetreten': joined,
          '🎖️ Rollen': roles.length > 512 ? roles.substring(0, 509) + '...' : roles,
          '👥 Mitglieder': `${guild.memberCount}`,
        },
        color: '#ED4245',
      });
    } else {
      sendLog(client, {
        action: '👋 Member Hat Server Verlassen',
        executor: member.user.tag,
        target: `<@${member.id}>`,
        fields: {
          '📅 Account': `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          '📥 Beigetreten': joined,
          '🎖️ Rollen': roles.length > 512 ? roles.substring(0, 509) + '...' : roles,
          '👥 Mitglieder': `${guild.memberCount}`,
        },
        color: '#FEE75C',
      });
    }
  },
};

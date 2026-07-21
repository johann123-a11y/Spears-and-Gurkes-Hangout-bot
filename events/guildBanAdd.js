const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { recordAction, triggerAntiRaid } = require('../utils/antiRaid');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban, client) {
    const guild = ban.guild;
    let exec = null;

    try {
      const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
      const entry = audit.entries.find(e =>
        e.target?.id === ban.user.id &&
        Date.now() - e.createdTimestamp < 5000
      );
      if (entry) exec = entry.executor;
    } catch {}

    if (exec && recordAction(exec.id, 'ban')) {
      triggerAntiRaid(guild, exec.id, '5 bans in 5 minutes', client);
    }

    sendLog(client, {
      action: '🔨 Member Banned',
      executor: exec?.tag ?? 'Unknown',
      target: `<@${ban.user.id}> (${ban.user.tag})`,
      fields: {
        'Banned by': exec ? `<@${exec.id}>` : 'Unknown',
        'Reason': ban.reason ?? 'No reason provided',
      },
      color: '#ED4245',
    });
  },
};

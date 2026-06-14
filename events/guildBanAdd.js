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
      triggerAntiRaid(guild, exec.id, '5 Bans in 5 Minuten', client);
    }

    sendLog(client, {
      action: '🔨 Member Gebannt',
      executor: exec?.tag ?? 'Unknown',
      target: `<@${ban.user.id}> (${ban.user.tag})`,
      fields: {
        '👮 Gebannt von': exec ? `<@${exec.id}>` : 'Unknown',
        '📋 Grund': ban.reason ?? '*(kein Grund angegeben)*',
      },
      color: '#ED4245',
    });
  },
};

const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban, client) {
    const guild = ban.guild;
    let exec = null;

    try {
      const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 });
      const entry = audit.entries.find(e =>
        e.target?.id === ban.user.id &&
        Date.now() - e.createdTimestamp < 5000
      );
      if (entry) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '✅ Ban Aufgehoben',
      executor: exec?.tag ?? 'Unknown',
      target: `<@${ban.user.id}> (${ban.user.tag})`,
      fields: {
        '👮 Ungebannt von': exec ? `<@${exec.id}>` : 'Unknown',
      },
      color: '#57F287',
    });
  },
};

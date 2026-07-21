const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleCreate',
  async execute(role, client) {
    let exec = null;
    try {
      const audit = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '🎨 Role Created',
      executor: exec?.tag ?? 'Unknown',
      target: `<@&${role.id}> (${role.name})`,
      fields: {
        'Created by': exec ? `<@${exec.id}>` : 'Unknown',
        'Color': role.hexColor,
        'Hoisted': role.hoist ? 'Yes' : 'No',
        'Mentionable': role.mentionable ? 'Yes' : 'No',
      },
      color: '#57F287',
    });
  },
};

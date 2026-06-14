const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleDelete',
  async execute(role, client) {
    let exec = null;
    try {
      const audit = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '🗑️ Rolle Gelöscht',
      executor: exec?.tag ?? 'Unknown',
      target: role.name,
      fields: {
        '👮 Gelöscht von': exec ? `<@${exec.id}>` : 'Unknown',
        '🆔 Rollen-ID': role.id,
      },
      color: '#ED4245',
    });
  },
};

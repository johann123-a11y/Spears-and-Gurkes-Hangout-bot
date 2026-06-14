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
      action: '🎨 Rolle Erstellt',
      executor: exec?.tag ?? 'Unknown',
      target: `<@&${role.id}> (${role.name})`,
      fields: {
        '👮 Erstellt von': exec ? `<@${exec.id}>` : 'Unknown',
        '🎨 Farbe': role.hexColor,
        '📌 Angeheftet': role.hoist ? 'Ja' : 'Nein',
        '💬 Erwähnbar': role.mentionable ? 'Ja' : 'Nein',
      },
      color: '#57F287',
    });
  },
};

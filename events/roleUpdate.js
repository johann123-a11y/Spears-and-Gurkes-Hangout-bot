const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole, client) {
    const changes = [];
    if (oldRole.name       !== newRole.name)        changes.push(`Name: **${oldRole.name}** → **${newRole.name}**`);
    if (oldRole.hexColor   !== newRole.hexColor)    changes.push(`Farbe: **${oldRole.hexColor}** → **${newRole.hexColor}**`);
    if (oldRole.hoist      !== newRole.hoist)       changes.push(`Angeheftet: **${oldRole.hoist}** → **${newRole.hoist}**`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`Erwähnbar: **${oldRole.mentionable}** → **${newRole.mentionable}**`);
    if (!changes.length) return;

    let exec = null;
    try {
      const audit = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '✏️ Rolle Bearbeitet',
      executor: exec?.tag ?? 'Unknown',
      target: `<@&${newRole.id}> (${newRole.name})`,
      fields: {
        '👮 Bearbeitet von': exec ? `<@${exec.id}>` : 'Unknown',
        '📝 Änderungen': changes.join('\n'),
      },
      color: '#5865F2',
    });
  },
};

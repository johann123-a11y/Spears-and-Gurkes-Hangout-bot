const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole, client) {
    const changes = [];
    if (oldRole.name        !== newRole.name)        changes.push(`Name: **${oldRole.name}** → **${newRole.name}**`);
    if (oldRole.hexColor    !== newRole.hexColor)    changes.push(`Color: **${oldRole.hexColor}** → **${newRole.hexColor}**`);
    if (oldRole.hoist       !== newRole.hoist)       changes.push(`Hoisted: **${oldRole.hoist}** → **${newRole.hoist}**`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: **${oldRole.mentionable}** → **${newRole.mentionable}**`);
    if (!changes.length) return;

    let exec = null;
    try {
      const audit = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '✏️ Role Edited',
      executor: exec?.tag ?? 'Unknown',
      target: `<@&${newRole.id}> (${newRole.name})`,
      fields: {
        'Edited by': exec ? `<@${exec.id}>` : 'Unknown',
        'Changes': changes.join('\n'),
      },
      color: '#5865F2',
    });
  },
};

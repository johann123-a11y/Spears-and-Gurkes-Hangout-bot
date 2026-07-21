const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelCreate',
  async execute(channel, client) {
    if (channel.name.startsWith('ticket-')) return;

    let exec = null;
    try {
      const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '📢 Channel Created',
      executor: exec?.tag ?? 'Unknown',
      target: `<#${channel.id}> (${channel.name})`,
      fields: {
        'Created by': exec ? `<@${exec.id}>` : 'Unknown',
        'Type': channel.type.toString(),
      },
      color: '#57F287',
    });
  },
};

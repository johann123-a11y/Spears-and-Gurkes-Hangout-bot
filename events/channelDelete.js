const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { recordAction, triggerAntiRaid } = require('../utils/antiRaid');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    if (channel.name.startsWith('ticket-')) return;

    let exec = null;
    try {
      const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    if (exec && recordAction(exec.id, 'channelDelete')) {
      triggerAntiRaid(channel.guild, exec.id, '20 channels deleted in 5 minutes', client);
    }

    sendLog(client, {
      action: '🗑️ Channel Deleted',
      executor: exec?.tag ?? 'Unknown',
      target: channel.name,
      fields: {
        'Deleted by': exec ? `<@${exec.id}>` : 'Unknown',
        'Channel ID': channel.id,
        'Type': channel.type.toString(),
      },
      color: '#ED4245',
    });
  },
};

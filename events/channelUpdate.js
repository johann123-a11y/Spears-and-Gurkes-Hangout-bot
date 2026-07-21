const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel, client) {
    if (!newChannel.guild) return;
    if (newChannel.name?.startsWith('ticket-')) return;

    const changes = [];
    if (oldChannel.name  !== newChannel.name)  changes.push(`Name: **${oldChannel.name}** → **${newChannel.name}**`);
    if (oldChannel.topic !== newChannel.topic) changes.push(`Topic: **${oldChannel.topic ?? '—'}** → **${newChannel.topic ?? '—'}**`);
    if (oldChannel.nsfw  !== newChannel.nsfw)  changes.push(`NSFW: **${oldChannel.nsfw}** → **${newChannel.nsfw}**`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser)
      changes.push(`Slowmode: **${oldChannel.rateLimitPerUser}s** → **${newChannel.rateLimitPerUser}s**`);
    if (!changes.length) return;

    let exec = null;
    try {
      const audit = await newChannel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 });
      const entry = audit.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) exec = entry.executor;
    } catch {}

    sendLog(client, {
      action: '✏️ Channel Edited',
      executor: exec?.tag ?? 'Unknown',
      target: `<#${newChannel.id}> (${newChannel.name})`,
      fields: {
        'Edited by': exec ? `<@${exec.id}>` : 'Unknown',
        'Changes': changes.join('\n'),
      },
      color: '#5865F2',
    });
  },
};

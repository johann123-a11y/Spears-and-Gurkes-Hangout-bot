const { AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (!message.guild) return;
    if (message.author?.bot) return;
    if (!message.content && message.attachments.size === 0) return;

    let deletedBy = null;
    try {
      await new Promise(r => setTimeout(r, 500));
      const audit = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 });
      const entry = audit.entries.first();
      if (
        entry &&
        Date.now() - entry.createdTimestamp < 3000 &&
        entry.target?.id === message.author?.id &&
        entry.extra?.channel?.id === message.channelId
      ) {
        deletedBy = entry.executor;
      }
    } catch {}

    const fields = {
      'Author': message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Unknown',
      'Deleted by': deletedBy ? `<@${deletedBy.id}> (${deletedBy.tag})` : message.author ? '*(self-deleted)*' : 'Unknown',
      'Channel': `<#${message.channelId}>`,
    };

    if (message.attachments.size > 0)
      fields['Attachments'] = `${message.attachments.size} file(s)`;

    sendLog(client, {
      action: '🗑️ Message Deleted',
      executor: deletedBy ? deletedBy.tag : (message.author?.tag || 'Unknown'),
      target: message.content
        ? (message.content.length > 512 ? message.content.substring(0, 509) + '...' : message.content)
        : '*(no text)*',
      fields,
      color: '#FEE75C',
    });
  },
};

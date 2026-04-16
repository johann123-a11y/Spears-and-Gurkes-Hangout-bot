const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (!message.guild) return;
    if (message.author?.bot) return;
    // Skip empty messages (e.g. embeds only)
    if (!message.content && message.attachments.size === 0) return;

    const fields = {
      'Channel': `<#${message.channelId}>`,
    };
    if (message.attachments.size > 0) {
      fields['Attachments'] = `${message.attachments.size} file(s)`;
    }

    sendLog(client, {
      action: 'Message Deleted',
      executor: message.author ? `${message.author.tag}` : 'Unknown',
      target: message.content ? (message.content.length > 512 ? message.content.substring(0, 509) + '...' : message.content) : '*(no text)*',
      fields,
      color: '#FEE75C',
    });
  },
};

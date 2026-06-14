const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!oldMessage.content && !newMessage.content) return;

    sendLog(client, {
      action: '✏️ Nachricht Bearbeitet',
      executor: newMessage.author?.tag ?? 'Unknown',
      target: `<@${newMessage.author?.id}>`,
      fields: {
        '👤 Autor': newMessage.author ? `<@${newMessage.author.id}> (${newMessage.author.tag})` : 'Unknown',
        '💬 Channel': `<#${newMessage.channelId}>`,
        '📝 Alt': oldMessage.content ? (oldMessage.content.length > 512 ? oldMessage.content.substring(0, 509) + '...' : oldMessage.content) : '*(leer)*',
        '📝 Neu': newMessage.content ? (newMessage.content.length > 512 ? newMessage.content.substring(0, 509) + '...' : newMessage.content) : '*(leer)*',
        '🔗 Sprung': `[Zur Nachricht](${newMessage.url})`,
      },
      color: '#5865F2',
    });
  },
};

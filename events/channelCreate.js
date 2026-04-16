const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelCreate',
  async execute(channel, client) {
    // Skip ticket channels — they have their own dedicated logging
    if (channel.name.startsWith('ticket-')) return;

    sendLog(client, {
      action: 'Channel Created',
      executor: 'Discord / Manual',
      fields: {
        'Channel Name': channel.name,
        'Channel ID': channel.id,
        'Type': channel.type.toString(),
      },
      color: '#57F287',
    });
  },
};

const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelCreate',
  async execute(channel, client) {
    sendLog(client, {
      action: 'Channel / Ticket Created',
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

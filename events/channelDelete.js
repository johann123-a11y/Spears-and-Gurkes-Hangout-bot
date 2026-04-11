const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    sendLog(client, {
      action: 'Channel Gelöscht',
      executor: 'Discord / Manuell',
      fields: {
        'Channel Name': channel.name,
        'Channel ID': channel.id,
        'Typ': channel.type.toString(),
      },
      color: '#ED4245',
    });
  },
};

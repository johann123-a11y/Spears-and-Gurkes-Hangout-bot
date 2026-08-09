const { readData, writeData } = require('./index');

function recordWin(winnerId, hostId, prize, channelId, guildId, gameName) {
  if (!winnerId || !prize) return;
  const key  = `${gameName}_${Date.now()}_${winnerId}`;
  const data = readData('giveaways.json');
  data[key]  = {
    channelId: channelId || null,
    guildId:   guildId   || null,
    endTime:   Date.now(),
    prize,
    winners:   1,
    description: gameName,
    hostId:    hostId || null,
    ended:     true,
    participants: [winnerId],
    winnerIds: [winnerId],
  };
  writeData('giveaways.json', data);
}

module.exports = { recordWin };

// Fetch all messages from a channel (handles pagination)
async function fetchAllMessages(channel) {
  const messages = [];
  let lastId = null;
  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const fetched = await channel.messages.fetch(opts).catch(() => null);
    if (!fetched || fetched.size === 0) break;
    for (const msg of fetched.values()) {
      messages.push({
        author:      msg.author.username,
        authorId:    msg.author.id,
        bot:         msg.author.bot,
        content:     msg.content || '',
        timestamp:   msg.createdTimestamp,
        attachments: [...msg.attachments.values()].map(a => ({ url: a.url, name: a.name })),
      });
    }
    lastId = fetched.last()?.id;
    if (fetched.size < 100) break;
  }
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

module.exports = { fetchAllMessages };

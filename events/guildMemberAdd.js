const { readData, writeData } = require('../utils');
const { sendLog } = require('../utils/logger');

// Deduplicate: track recently welcomed users to prevent double-firing
const recentlyWelcomed = new Map();

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const key = `${member.guild.id}:${member.id}`;
    const now = Date.now();
    if (recentlyWelcomed.has(key) && now - recentlyWelcomed.get(key) < 10_000) return;
    recentlyWelcomed.set(key, now);
    setTimeout(() => recentlyWelcomed.delete(key), 10_000);

    // Always log join regardless of welcome settings
    sendLog(client, {
      action: 'Member Joined',
      executor: member.user.tag,
      target: `<@${member.id}>`,
      fields: {
        'Account Created': `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        'Members': `${member.guild.memberCount}`,
      },
      color: '#57F287',
    });

    const data = readData('welcome.json');
    if (!data.enabled || !data.channel) return;

    const channel = member.guild.channels.cache.get(data.channel);
    if (!channel) return;

    const text = (data.message || 'Welcome {member} to **{server}**! You are member #{membercount}.')
      .replace('{member}', `<@${member.id}>`)
      .replace('{server}', member.guild.name)
      .replace('{membercount}', member.guild.memberCount.toString());

    channel.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => {});
  },
};

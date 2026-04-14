const { readData } = require('../utils');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
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

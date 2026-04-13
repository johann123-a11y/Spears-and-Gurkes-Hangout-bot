const { EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../utils');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    // Always pre-cache DM channel ID so leave DM works later
    const dm = await member.user.createDM().catch(() => null);
    if (dm) {
      const dmCache = readData('dm_channels.json');
      dmCache[member.user.id] = dm.id;
      writeData('dm_channels.json', dmCache);
    }

    const data = readData('welcome.json');
    if (!data.enabled || !data.channel) return;

    const channel = member.guild.channels.cache.get(data.channel);
    if (!channel) return;

    const text = (data.message || 'Welcome {member} to **{server}**! You are member #{membercount}.')
      .replace('{member}', `<@${member.id}>`)
      .replace('{server}', member.guild.name)
      .replace('{membercount}', member.guild.memberCount.toString());

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('👋 Welcome!')
      .setDescription(text)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  },
};

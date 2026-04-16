const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const roles = member.roles.cache
      .filter(r => r.id !== member.guild.id)
      .map(r => `<@&${r.id}>`)
      .join(', ') || 'None';

    const joinedAt = member.joinedAt
      ? `<t:${Math.floor(member.joinedAt / 1000)}:R>`
      : '—';

    sendLog(client, {
      action: 'Member Left',
      executor: `${member.user.tag}`,
      target: `<@${member.id}>`,
      fields: {
        'Account':  `<t:${Math.floor(member.user.createdAt / 1000)}:R>`,
        'Joined':   joinedAt,
        'Roles':    roles.length > 1024 ? roles.substring(0, 1021) + '...' : roles,
        'Members':  `${member.guild.memberCount}`,
      },
      color: '#ED4245',
    });
  },
};

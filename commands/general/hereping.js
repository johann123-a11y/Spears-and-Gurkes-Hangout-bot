const { SlashCommandBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');

module.exports = {
  name: 'hereping',
  data: new SlashCommandBuilder()
    .setName('hereping')
    .setDescription('Ping @here [Staff Team Only]'),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'hereping'))
      return interaction.reply({ content: '❌ Only **Staff Team** members can use this command.', ephemeral: true });

    await interaction.reply({ content: '✅ Sent!', ephemeral: true });
    await interaction.channel.send({ content: '@here', allowedMentions: { parse: ['everyone'] } });
  },
};

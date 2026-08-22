const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { trackActivity } = require('../../utils');

// /partnerping — simple hardcoded partner ping
module.exports = [{
  name: 'partner',
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Send a partner ping')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async executeSlash(interaction) {
    trackActivity(interaction.user.id, interaction.user.tag, 'partner');
    await interaction.reply({ content: 'Sent!', ephemeral: true });
    await interaction.channel.send({ content: `<@&1459670504960036975>`, allowedMentions: { parse: ['roles'] } });
  },
}];

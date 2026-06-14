const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// /partnerping — simple hardcoded partner ping
module.exports = [{
  name: 'partnerping',
  data: new SlashCommandBuilder()
    .setName('partnerping')
    .setDescription('Send a partner ping')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async executeSlash(interaction) {
    await interaction.reply({ content: 'Sent!', ephemeral: true });
    await interaction.channel.send({ content: `<@&1459670504960036975>`, allowedMentions: { parse: ['roles'] } });
  },
}];

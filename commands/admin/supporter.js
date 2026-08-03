const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'supporter',
  data: new SlashCommandBuilder()
    .setName('supporter')
    .setDescription('[Admin] Exclude or re-include a user from the automatic server-tag role')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('user').setDescription('The user to toggle').setRequired(true)
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const data   = readData('tagExempt.json');

    if (data[target.id]) {
      delete data[target.id];
      writeData('tagExempt.json', data);
      return interaction.reply({ content: `✅ **${target.tag}** is no longer exempt — they will now receive the tag role automatically.`, ephemeral: true });
    } else {
      data[target.id] = true;
      writeData('tagExempt.json', data);
      return interaction.reply({ content: `✅ **${target.tag}** is now exempt from the automatic tag role.`, ephemeral: true });
    }
  },
};

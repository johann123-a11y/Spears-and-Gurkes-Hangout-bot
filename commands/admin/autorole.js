const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'autorole',
  description: 'Set a role that is automatically given to new members. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Automatically give a role to new members [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the auto-role')
        .addRoleOption(o => o.setName('role').setDescription('Role to give to new members').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the auto-role')
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Show the current auto-role')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const data = readData('autorole.json');

    if (sub === 'set') {
      const role = interaction.options.getRole('role');
      data.roleId = role.id;
      writeData('autorole.json', data);
      return interaction.reply({ content: `✅ Auto-role set to <@&${role.id}>. New members will automatically receive this role.`, ephemeral: true });
    }

    if (sub === 'remove') {
      if (!data.roleId) return interaction.reply({ content: 'No auto-role is currently set.', ephemeral: true });
      delete data.roleId;
      writeData('autorole.json', data);
      return interaction.reply({ content: '✅ Auto-role removed.', ephemeral: true });
    }

    if (sub === 'info') {
      if (!data.roleId) return interaction.reply({ content: 'No auto-role is currently set.', ephemeral: true });
      return interaction.reply({ content: `Current auto-role: <@&${data.roleId}>`, ephemeral: true });
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'staff',
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Staff role settings [Admin]')
    .addSubcommandGroup(group =>
      group.setName('role')
        .setDescription('Manage the staff role')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set the staff role that can use all staff commands [Admin]')
            .addRoleOption(o => o.setName('role').setDescription('The staff role').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('info')
            .setDescription('Show the current staff role [Admin]')
        )
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Only **Administrators** can use this.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const data = readData('staffConfig.json');

    if (sub === 'set') {
      const role = interaction.options.getRole('role');
      data.staffRoleId = role.id;
      writeData('staffConfig.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('✅ Staff Role Set')
          .setDescription(`<@&${role.id}> can now use all staff commands.`)
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'info') {
      const roleId = data.staffRoleId;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('👥 Staff Role')
          .addFields({ name: 'Current Staff Role', value: roleId ? `<@&${roleId}>` : '*(not set)*' })
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};

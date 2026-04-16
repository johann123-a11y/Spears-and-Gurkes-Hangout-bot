const { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'activitycheck',
  data: new SlashCommandBuilder()
    .setName('activitycheck')
    .setDescription('Post an activity check for staff [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s
      .setName('start')
      .setDescription('Post an activity check in this channel')
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role whose members must respond (to track who did not)')
        .setRequired(false)
      )
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const role = interaction.options.getRole('role');

    const modal = new ModalBuilder()
      .setCustomId(`activitycheck_modal:${role?.id || ''}`)
      .setTitle('Activity Check')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Activity Check Message')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (e.g. 24h, 48h)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('24h')
        )
      );
    return interaction.showModal(modal);
  },
};

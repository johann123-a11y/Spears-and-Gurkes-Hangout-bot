const {
  SlashCommandBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');

module.exports = {
  name: 'leave',
  description: 'Send a goodbye DM to all server members. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Send a goodbye DM to all server members [Admin Only]'),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId('leave_mass_dm_modal')
      .setTitle('Goodbye DM to all Members')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Überschrift')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('subtitle')
            .setLabel('Unterzeile (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(150)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('content')
            .setLabel('Nachricht')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100)
        ),
      );

    return interaction.showModal(modal);
  },
};

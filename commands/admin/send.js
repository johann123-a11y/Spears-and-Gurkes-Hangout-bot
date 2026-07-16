const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  name: 'send',
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message as the bot [Admin]'),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`send_modal:${interaction.channelId}`)
      .setTitle('Send Message as Bot')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

    return interaction.showModal(modal);
  },
};

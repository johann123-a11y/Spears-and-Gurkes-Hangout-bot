const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const PASSWORD = 'Gurkelovesgooning';

module.exports = {
  name: 'send',
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a message as the bot [Admin]')
    .addStringOption(o =>
      o.setName('password').setDescription('Required password').setRequired(true)
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });

    if (interaction.options.getString('password') !== PASSWORD)
      return interaction.reply({ content: '❌ Wrong password.', ephemeral: true });

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

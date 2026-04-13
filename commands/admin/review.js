const {
  SlashCommandBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle,
  ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

function buildPanelModal(test) {
  return new ModalBuilder()
    .setCustomId(test ? 'review_panel_modal_test' : 'review_panel_modal')
    .setTitle(test ? 'Review Panel — TEST (only you)' : 'Review Panel — Post in Channel')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('footer').setLabel('Footer (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
      ),
    );
}

module.exports = {
  name: 'review',
  description: 'Review system. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Review system [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('panel').setDescription('Post a review panel with button in this channel'))
    .addSubcommand(s => s.setName('send').setDescription('Send a message directly to the review channel'))
    .addSubcommand(s => s.setName('test').setDescription('Test — sends the panel to you as a DM'))
    .addSubcommand(s => s.setName('channel').setDescription('Set the channel for incoming reviews')),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') return interaction.showModal(buildPanelModal(false));
    if (sub === 'test')  return interaction.showModal(buildPanelModal(true));

    if (sub === 'send') {
      const { ModalBuilder: MB2, ActionRowBuilder: AR2, TextInputBuilder: TI2, TextInputStyle: TIS2 } = require('discord.js');
      const modal = new MB2()
        .setCustomId('review_send_modal')
        .setTitle('Send directly to review channel')
        .addComponents(
          new AR2().addComponents(new TI2().setCustomId('title').setLabel('Title').setStyle(TIS2.Short).setRequired(true).setMaxLength(100)),
          new AR2().addComponents(new TI2().setCustomId('content').setLabel('Message').setStyle(TIS2.Paragraph).setRequired(true).setMaxLength(2000)),
        );
      return interaction.showModal(modal);
    }

    if (sub === 'channel') {
      const sel = new ChannelSelectMenuBuilder()
        .setCustomId('review_channel_select')
        .setPlaceholder('Select the channel for reviews...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(sel);
      return interaction.reply({ content: '📋 Select the channel where reviews will be posted:', components: [row], ephemeral: true });
    }
  },
};

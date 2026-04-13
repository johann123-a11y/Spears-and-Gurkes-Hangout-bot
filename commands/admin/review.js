const {
  SlashCommandBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle,
  ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

function buildPanelModal(test) {
  return new ModalBuilder()
    .setCustomId(test ? 'review_panel_modal_test' : 'review_panel_modal')
    .setTitle(test ? 'Review Panel — TEST (nur du)' : 'Review Panel — In Channel posten')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Überschrift').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('description').setLabel('Beschreibung').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
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
    .addSubcommand(s => s.setName('panel').setDescription('Review-Panel mit Button in diesem Channel posten'))
    .addSubcommand(s => s.setName('send').setDescription('Nachricht direkt in den Review-Channel schicken'))
    .addSubcommand(s => s.setName('test').setDescription('Test — schickt dir das Panel als DM'))
    .addSubcommand(s => s.setName('channel').setDescription('Channel für eingehende Reviews setzen')),

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
        .setTitle('Direkt in Review-Channel senden')
        .addComponents(
          new AR2().addComponents(new TI2().setCustomId('title').setLabel('Überschrift').setStyle(TIS2.Short).setRequired(true).setMaxLength(100)),
          new AR2().addComponents(new TI2().setCustomId('content').setLabel('Nachricht').setStyle(TIS2.Paragraph).setRequired(true).setMaxLength(2000)),
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

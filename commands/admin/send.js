const {
  SlashCommandBuilder, ModalBuilder, ActionRowBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');

function buildModal(test) {
  return new ModalBuilder()
    .setCustomId(test ? 'send_dm_modal_test' : 'send_dm_modal')
    .setTitle(test ? 'Send DM — TEST (nur du)' : 'Send DM to all Members')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Überschrift').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('subtitle').setLabel('Unterzeile (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(150)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('content').setLabel('Nachricht').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('footer').setLabel('Footer (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
      ),
    );
}

module.exports = {
  name: 'send',
  description: 'Send a DM to all server members. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send a DM to all server members [Admin Only]')
    .addSubcommand(s => s.setName('all').setDescription('DM an alle Member schicken'))
    .addSubcommand(s => s.setName('test').setDescription('Test — DM nur an dich')),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    return interaction.showModal(buildModal(sub === 'test'));
  },
};

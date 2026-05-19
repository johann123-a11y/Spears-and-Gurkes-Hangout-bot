const {
  SlashCommandBuilder, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');

module.exports = {
  name: 'embed',
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom embed message [Admin]')
    .setDefaultMemberPermissions(0),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'Only **Administrators** can use this command.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId('embed_modal')
      .setTitle('Create Embed');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(4000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_color')
          .setLabel('Color (hex, e.g. #FFD700 — leave empty for blue)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setPlaceholder('#5865F2')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_footer')
          .setLabel('Footer text (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(2048)
      ),
    );

    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const title       = interaction.fields.getTextInputValue('embed_title').trim()       || null;
    const description = interaction.fields.getTextInputValue('embed_description').trim() || null;
    const colorRaw    = interaction.fields.getTextInputValue('embed_color').trim()       || null;
    const footer      = interaction.fields.getTextInputValue('embed_footer').trim()      || null;

    if (!title && !description)
      return interaction.reply({ content: 'Please provide at least a title or description.', ephemeral: true });

    // Validate hex color
    let color = '#5865F2';
    if (colorRaw) {
      if (/^#[0-9A-Fa-f]{6}$/.test(colorRaw)) color = colorRaw;
      else return interaction.reply({ content: 'Invalid color. Use hex format like `#FFD700`.', ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(color).setTimestamp();
    if (title)       embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (footer)      embed.setFooter({ text: footer });

    await interaction.reply({ content: 'Embed sent!', ephemeral: true });
    await interaction.channel.send({ embeds: [embed] });
  },
};

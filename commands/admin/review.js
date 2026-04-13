const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'review',
  description: 'Review system. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Review system [Admin Only]')
    .addSubcommand(s =>
      s.setName('send')
        .setDescription('Post a review panel in this channel')
    )
    .addSubcommand(s =>
      s.setName('channel')
        .setDescription('Set the channel where reviews are posted')
    )
    .addSubcommand(s =>
      s.setName('test')
        .setDescription('Schickt dir eine Test-Review als DM')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'send') {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⭐ Leave a Review')
        .setDescription('Click the button below to submit your review about our server.\nYour feedback helps us improve!')
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('review_submit_btn')
          .setLabel('Submit Review')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐'),
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Review panel posted!', ephemeral: true });
    }

    if (sub === 'test') {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⭐ Leave a Review')
        .setDescription('Click the button below to submit your review about our server.\nYour feedback helps us improve!')
        .setFooter({ text: `${interaction.guild.name} — TEST` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('review_submit_btn')
          .setLabel('Submit Review')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐'),
      );

      try {
        await interaction.user.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: '✅ Test-DM wurde dir geschickt!', ephemeral: true });
      } catch {
        return interaction.reply({ content: '❌ Konnte dir keine DM schicken — prüf ob deine DMs offen sind.', ephemeral: true });
      }
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

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'leave',
  description: 'Configure the leave DM & feedback system. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Configure the leave DM & feedback system [Admin Only]')
    .addSubcommand(s =>
      s.setName('message')
        .setDescription('Set the DM message sent to users who leave (opens a panel)')
    )
    .addSubcommand(s =>
      s.setName('channel')
        .setDescription('Set the channel where leave reasons are posted')
    )
    .addSubcommand(s =>
      s.setName('info')
        .setDescription('Show current leave system configuration')
    )
    .addSubcommand(s =>
      s.setName('test')
        .setDescription('Send yourself a test leave DM to check if it works')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'message') {
      const data = readData('leave.json');
      const modal = new ModalBuilder()
        .setCustomId('leave_message_modal')
        .setTitle('Leave DM Configuration')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('dm_message')
              .setLabel('DM Message (shown when user leaves)')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Hey {user}, sorry to see you go! We hope to see you again soon.')
              .setValue(data.message || '')
              .setRequired(true)
              .setMaxLength(1800)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('invite')
              .setLabel('Server Invite URL (included in every DM)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('https://discord.gg/yourserver')
              .setValue(data.invite || '')
              .setRequired(false)
              .setMaxLength(200)
          ),
        );
      return interaction.showModal(modal);
    }

    if (sub === 'channel') {
      const channelSel = new ChannelSelectMenuBuilder()
        .setCustomId('leave_channel_select')
        .setPlaceholder('Select the channel for leave reasons...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSel);
      return interaction.reply({ content: '📋 Select the channel where leave reasons will be posted:', components: [row], ephemeral: true });
    }

    if (sub === 'test') {
      const data = readData('leave.json');
      const defaultMsg = 'Hey {user}, schade dass du unseren Server verlassen hast. Wir hoffen dich bald wiederzusehen!';
      const messageText = (data.message || defaultMsg).replace('{user}', interaction.user.username);

      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('👋 You left the server')
        .setDescription(messageText)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({ text: `${interaction.guild.name} — TEST` })
        .setTimestamp();

      if (data.invite) embed.addFields({ name: '🔗 Rejoin anytime', value: data.invite });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`leave_reason_btn:${interaction.guild.id}:${interaction.user.id}`)
          .setLabel('Tell us why you left')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💬'),
      );

      try {
        await interaction.user.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: '✅ Test-DM wurde dir geschickt!', ephemeral: true });
      } catch {
        return interaction.reply({ content: '❌ Konnte dir keine DM schicken — prüf ob deine DMs offen sind.', ephemeral: true });
      }
    }

    if (sub === 'info') {
      const data = readData('leave.json');
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🚪 Leave System Configuration')
        .addFields(
          { name: 'DM Message', value: data.message || '*Not set*' },
          { name: 'Server Invite', value: data.invite || '*Not set*' },
          { name: 'Leave Log Channel', value: data.channel ? `<#${data.channel}>` : '*Not set*' },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

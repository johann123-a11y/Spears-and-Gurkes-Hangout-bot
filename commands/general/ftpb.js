const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { checkPerm, parseTime, trackActivity } = require('../../utils');

// Already-claimed message IDs (prevents double-claim race condition)
const claimed = new Set();

module.exports = {
  name: 'ftpb',
  data: new SlashCommandBuilder()
    .setName('ftpb')
    .setDescription('First to Press the Button event [Staff Team]'),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'ftpb'))
      return interaction.reply({ content: 'Only **Staff Team** can use this command.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId('ftpb_modal')
      .setTitle('First to Press the Button');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ftpb_prize')
          .setLabel('Prize (e.g. 10m)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('10m')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ftpb_duration')
          .setLabel('Delay until button activates (0, 10s, 1m)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('10s')
          .setRequired(true)
      ),
    );

    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const prize  = interaction.fields.getTextInputValue('ftpb_prize').trim();
    const durStr = interaction.fields.getTextInputValue('ftpb_duration').trim();

    // Allow "0" / "0s" as immediate (no delay), otherwise parse normally
    const isZero = durStr === '0' || durStr === '0s';
    const ms = isZero ? 0 : parseTime(durStr);
    if (!isZero && !ms)
      return interaction.reply({ content: 'Invalid duration. Use e.g. `0`, `10s`, `30s`, `1m`.', ephemeral: true });

    await interaction.reply({ content: '🏆 First to Press the Button event started!', ephemeral: true });
    trackActivity(interaction.user.id, interaction.user.tag, 'ftpb', { prize });

    const activatesTs = Math.floor((Date.now() + ms) / 1000);

    // Initial embed — button locked if there's a delay
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 First to Press the Button!')
      .setDescription(
        `💰 **Prize:** ${prize}\n\n` +
        (ms > 0
          ? `⏳ Button activates <t:${activatesTs}:R> — get ready!`
          : `🟢 **The button is active NOW — first to press wins!**`)
      )
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp();

    const lockedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ftpb_locked')
        .setLabel('🔒 Not yet...')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    const msg = await interaction.channel.send({
      embeds: [embed],
      components: ms > 0 ? [lockedRow] : [],
    });

    // Activate button (immediately or after delay)
    const activate = async () => {
      const activeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ftpb_claim:${msg.id}`)
          .setLabel('🎯 Press!')
          .setStyle(ButtonStyle.Success),
      );

      const activeEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🏆 First to Press the Button!')
        .setDescription(
          `💰 **Prize:** ${prize}\n\n` +
          `🟢 **GO! First to press wins!**`
        )
        .setFooter({ text: `Hosted by ${interaction.user.tag}` })
        .setTimestamp();

      await msg.edit({ embeds: [activeEmbed], components: [activeRow] }).catch(() => {});
    };

    if (ms > 0) setTimeout(activate, ms);
    else await activate();
  },

  async handleClaim(interaction) {
    const msgId = interaction.customId.split(':')[1];

    // Prevent double-claim
    if (claimed.has(msgId))
      return interaction.reply({ content: 'Someone already pressed the button!', ephemeral: true });
    claimed.add(msgId);
    setTimeout(() => claimed.delete(msgId), 60_000);

    // Disable button immediately
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ftpb_done')
        .setLabel('🎯 Claimed!')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
    );
    await interaction.message.edit({ components: [disabledRow] }).catch(() => {});

    // Extract prize and host from embed
    const prizeMatch = interaction.message.embeds[0]?.description?.match(/\*\*Prize:\*\* (.+)/);
    const prize = prizeMatch ? prizeMatch[1].trim() : 'the prize';
    const existingFooter = interaction.message.embeds[0]?.footer?.text || null;

    const winEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🏆 We have a winner!')
      .setDescription(
        `<@${interaction.user.id}> was the first to press the button!\n\n` +
        `💰 **Prize:** ${prize}`
      )
      .setTimestamp();

    if (existingFooter) winEmbed.setFooter({ text: existingFooter });

    await interaction.reply({ embeds: [winEmbed] });
  },
};

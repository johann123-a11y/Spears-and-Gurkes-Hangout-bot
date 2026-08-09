const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { checkPerm, trackActivity } = require('../../utils');
const { recordWin } = require('../../utils/recordWin');

// Active games: channelId → { number, max }
const activeGames = new Map();

module.exports = {
  name: 'guessthenumber',
  data: new SlashCommandBuilder()
    .setName('guessthenumber')
    .setDescription('Guess the Number game [Staff Team]')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a new Guess the Number game')
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End all active Guess the Number games')
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'guessthenumber'))
      return interaction.reply({ content: 'Only **Staff Team** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    // /guessthenumber start → open modal 
    if (sub === 'start') {
      if (activeGames.has(interaction.channelId))
        return interaction.reply({ content: 'There is already an active game in this channel!', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId('guessthenumber_modal')
        .setTitle('Guess the Number');

      const maxInput = new TextInputBuilder()
        .setCustomId('gtn_max')
        .setLabel('Maximum number (e.g. 100)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('100')
        .setRequired(true);

      const numberInput = new TextInputBuilder()
        .setCustomId('gtn_number')
        .setLabel('Exact number (optional, leave empty = random)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Leave empty for a random number')
        .setRequired(false);

      const prizeInput = new TextInputBuilder()
        .setCustomId('gtn_prize')
        .setLabel('Prize (optional, e.g. 10m)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('10m');

      modal.addComponents(
        new ActionRowBuilder().addComponents(maxInput),
        new ActionRowBuilder().addComponents(numberInput),
        new ActionRowBuilder().addComponents(prizeInput),
      );

      return interaction.showModal(modal);
    }

    // /guessthenumber end 
    if (sub === 'end') {
      const count = activeGames.size;
      activeGames.clear();

      return interaction.reply({
        content: count > 0
          ? `Ended **${count}** active game${count !== 1 ? 's' : ''}.`
          : 'There are no active games to end.',
        ephemeral: true,
      });
    }
  },

  // Called from interactionCreate for modal submit
  async handleModal(interaction) {
    const maxRaw    = interaction.fields.getTextInputValue('gtn_max').trim();
    const numberRaw = interaction.fields.getTextInputValue('gtn_number').trim();
    const prize     = interaction.fields.getTextInputValue('gtn_prize').trim() || null;

    const max = parseInt(maxRaw);
    if (isNaN(max) || max < 2)
      return interaction.reply({ content: 'Maximum must be a number of at least **2**.', ephemeral: true });

    let number;
    if (numberRaw === '') {
      number = Math.floor(Math.random() * max) + 1;
    } else {
      number = parseInt(numberRaw);
      if (isNaN(number) || number < 1 || number > max)
        return interaction.reply({ content: `The number must be between **1** and **${max}**.`, ephemeral: true });
    }

    activeGames.set(interaction.channelId, { number, max, prize, hostId: interaction.user.id, hostTag: interaction.user.tag });
    trackActivity(interaction.user.id, interaction.user.tag, 'gtn', { prize: prize || '—' });

    let desc = `The number is between **1** and **${max}**.\n\nType your guess in the chat!`;
    if (prize) desc += `\n\n💰 **Prize:** ${prize}`;
    desc += `\n👤 **Host:** <@${interaction.user.id}>`;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🔢 Guess the Number!')
      .setDescription(desc)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  // Called from messageCreate
  handleGuess(message) {
    const game = activeGames.get(message.channel.id);
    if (!game) return;

    const guess = parseInt(message.content.trim());
    if (isNaN(guess)) return;

    if (guess === game.number) {
      activeGames.delete(message.channel.id);
      if (game.prize) recordWin(message.author.id, game.hostId, game.prize, message.channelId, message.guildId, 'GTN');
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🎉 Correct!')
        .setDescription(
          `<@${message.author.id}> guessed the number! It was **${game.number}**!` +
          (game.prize ? `\n\n💰 **Prize:** ${game.prize}` : '') +
          (game.hostId ? `\n👤 **Host:** <@${game.hostId}>` : '')
        )
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(() => {});
    }
  },
};

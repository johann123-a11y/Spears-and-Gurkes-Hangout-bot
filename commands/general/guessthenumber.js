const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');

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
        .addIntegerOption(o =>
          o.setName('max')
            .setDescription('Maximum number (e.g. 100)')
            .setRequired(true)
            .setMinValue(2)
        )
        .addIntegerOption(o =>
          o.setName('number')
            .setDescription('Set the exact number to guess (must be between 1 and max)')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End all active Guess the Number games')
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'guessthenumber'))
      return interaction.reply({ content: '❌ Only **Staff Team** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    // ── /guessthenumber start ─────────────────────────────────────────────────
    if (sub === 'start') {
      if (activeGames.has(interaction.channelId))
        return interaction.reply({ content: '❌ There is already an active game in this channel!', ephemeral: true });

      const max         = interaction.options.getInteger('max');
      const fixedNumber = interaction.options.getInteger('number');

      if (fixedNumber !== null && (fixedNumber < 1 || fixedNumber > max))
        return interaction.reply({ content: `❌ The number must be between **1** and **${max}**.`, ephemeral: true });

      const number = fixedNumber ?? Math.floor(Math.random() * max) + 1;
      activeGames.set(interaction.channelId, { number, max });

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔢 Guess the Number!')
        .setDescription(`The number is between **1** and **${max}**.\n\nType your guess in the chat!`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── /guessthenumber end ───────────────────────────────────────────────────
    if (sub === 'end') {
      const count = activeGames.size;
      activeGames.clear();

      return interaction.reply({
        content: count > 0
          ? `🛑 Ended **${count}** active game${count !== 1 ? 's' : ''}.`
          : '❌ There are no active games to end.',
        ephemeral: true,
      });
    }
  },

  // Called from messageCreate
  handleGuess(message) {
    const game = activeGames.get(message.channel.id);
    if (!game) return;

    const guess = parseInt(message.content.trim());
    if (isNaN(guess)) return;

    if (guess === game.number) {
      activeGames.delete(message.channel.id);
      message.channel.send(
        `🎉 <@${message.author.id}> guessed the number! It was **${game.number}**! 🎊`
      ).catch(() => {});
    }
  },
};

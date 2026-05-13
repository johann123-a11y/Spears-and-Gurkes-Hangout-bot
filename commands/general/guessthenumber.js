const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm } = require('../../utils');

// Active games: channelId → { number, max }
const activeGames = new Map();

module.exports = {
  name: 'guessthenumber',
  data: new SlashCommandBuilder()
    .setName('guessthenumber')
    .setDescription('Start a Guess the Number game [Staff Team]')
    .addIntegerOption(o =>
      o.setName('max')
        .setDescription('Maximum number (e.g. 100)')
        .setRequired(true)
        .setMinValue(2)
    ),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'guessthenumber'))
      return interaction.reply({ content: '❌ Only **Staff Team** can start this game.', ephemeral: true });

    if (activeGames.has(interaction.channelId))
      return interaction.reply({ content: '❌ There is already an active game in this channel!', ephemeral: true });

    const max    = interaction.options.getInteger('max');
    const number = Math.floor(Math.random() * max) + 1;

    activeGames.set(interaction.channelId, { number, max });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🔢 Guess the Number!')
      .setDescription(`The number is between **1** and **${max}**.\n\nType your guess in the chat!`)
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
      message.channel.send(
        `🎉 <@${message.author.id}> guessed the number! It was **${game.number}**! 🎊`
      ).catch(() => {});
    }
  },
};

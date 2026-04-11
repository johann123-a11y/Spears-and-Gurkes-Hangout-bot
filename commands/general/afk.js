const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseTime, formatTime, readData, writeData } = require('../../utils');

module.exports = {
  name: 'afk',
  description: 'Sets you as AFK. When pinged, others will be notified.',
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set yourself as AFK')
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for being AFK').setRequired(false)
    )
    .addStringOption(o =>
      o.setName('time').setDescription('AFK duration (e.g. 1h). Leave empty for indefinite.').setRequired(false)
    ),

  async execute(message, args) {
    const time = args[0];
    const ms = parseTime(time);
    const reason = ms ? args.slice(1).join(' ') || 'No reason given.' : args.join(' ') || 'No reason given.';

    setAfk(message.author.id, reason, ms || null, message.channel);
  },

  async executeSlash(interaction) {
    const reason = interaction.options.getString('reason') || 'No reason given.';
    const time = interaction.options.getString('time');
    const ms = time ? parseTime(time) : null;

    setAfk(interaction.user.id, reason, ms || null, null, interaction);
  },
};

function setAfk(userId, reason, ms, channel, interaction) {
  const afk = readData('afk.json');
  afk[userId] = {
    reason,
    since: Date.now(),
    until: ms ? Date.now() + ms : null,
  };
  writeData('afk.json', afk);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('💤 AFK Set')
    .addFields(
      { name: 'Reason', value: reason },
      { name: 'Duration', value: ms ? formatTime(ms) : 'Indefinite' }
    )
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.reply({ embeds: [embed] });
}

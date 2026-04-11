const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../../utils');

module.exports = {
  name: 'strikes',
  description: 'Shows all strikes of a user.',
  data: new SlashCommandBuilder()
    .setName('strikes')
    .setDescription('Shows all strikes of a staff member')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true)),

  async execute(message, args) {
    const target = message.mentions.members.first();
    if (!target) return message.reply('Usage: `?strikes @user`');
    message.channel.send({ embeds: [buildEmbed(target.user, readData('strikes.json'))] });
  },

  async executeSlash(interaction) {
    const user = interaction.options.getUser('user');
    interaction.reply({ embeds: [buildEmbed(user, readData('strikes.json'))] });
  },
};

function buildEmbed(user, strikes) {
  const data = strikes[user.id];
  const count = data?.count ?? 0;
  const entries = data?.entries ?? [];

  const embed = new EmbedBuilder()
    .setColor(count >= 3 ? '#FF0000' : count > 0 ? '#FEE75C' : '#57F287')
    .setTitle(`⚠️ Strikes — ${user.tag}`)
    .addFields({ name: 'Total Strikes', value: `${count}/3`, inline: true })
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  if (entries.length === 0) {
    embed.setDescription('No strikes on record.');
  } else {
    entries.forEach((e, i) => {
      embed.addFields({ name: `Strike #${i + 1} — by ${e.by}`, value: e.reason });
    });
  }

  return embed;
}

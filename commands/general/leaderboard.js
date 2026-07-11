const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

function parseAmount(str) {
  const s = str.trim().toLowerCase();
  if (s.endsWith('b')) {
    const num = parseFloat(s.slice(0, -1));
    if (isNaN(num) || num <= 0) return null;
    return Math.round(num * 1000);
  }
  const num = parseFloat(s);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num);
}

function formatAmount(m) {
  if (m >= 1000) {
    const b = m / 1000;
    const rounded = parseFloat(b.toFixed(3));
    return `${rounded % 1 === 0 ? rounded : rounded.toString().replace(/\.?0+$/, '')}B`;
  }
  return `${m}M`;
}

module.exports = {
  name: 'leaderboard',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Sponsor leaderboard')
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show the sponsor leaderboard')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add sponsored amount to a user [Admin]')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Amount (e.g. 100 = 100M, 1B = 1000M)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove sponsored amount from a user [Admin]')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Amount (e.g. 100 = 100M, 1B = 1000M)').setRequired(true))
    ),

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      const lb = readData('leaderboard.json');
      const entries = Object.entries(lb)
        .filter(([, v]) => v.amount > 0)
        .sort(([, a], [, b]) => b.amount - a.amount);

      if (entries.length === 0)
        return interaction.reply({ content: 'The leaderboard is empty.', ephemeral: true });

      const lines = entries.map(([userId, v], i) =>
        `**${i + 1}.** <@${userId}> — **${formatAmount(v.amount)}**`
      );

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🏆 Sponsor Leaderboard')
          .setDescription(lines.join('\n'))
          .setTimestamp()],
      });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const m    = parseAmount(interaction.options.getString('amount'));
    if (!m)
      return interaction.reply({ content: 'Invalid amount. Use e.g. `100` (= 100M) or `1B` (= 1000M).', ephemeral: true });

    const lb = readData('leaderboard.json');
    if (!lb[user.id]) lb[user.id] = { username: user.tag, amount: 0 };

    if (sub === 'add') {
      lb[user.id].amount += m;
    } else {
      lb[user.id].amount = Math.max(0, lb[user.id].amount - m);
    }
    lb[user.id].username = user.tag;
    writeData('leaderboard.json', lb);

    const verb   = sub === 'add' ? 'Added' : 'Removed';
    const prepos = sub === 'add' ? 'to'    : 'from';
    return interaction.reply({
      content: `✅ ${verb} **${formatAmount(m)}** ${prepos} <@${user.id}>. New total: **${formatAmount(lb[user.id].amount)}**`,
      ephemeral: true,
    });
  },
};

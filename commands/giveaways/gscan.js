const { SlashCommandBuilder } = require('discord.js');
const { checkPerm, readData } = require('../../utils');

module.exports = {
  name: 'gscan',
  description: 'Search giveaway history by winner, prize and host. [Staff Team]',
  data: new SlashCommandBuilder()
    .setName('gscan')
    .setDescription('Scan giveaway history [Staff Team]')
    .addUserOption(o =>
      o.setName('winner').setDescription('The user who won').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('prize').setDescription('Prize name (partial match)').setRequired(true)
    )
    .addUserOption(o =>
      o.setName('host').setDescription('Who hosted the giveaway').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('winners').setDescription('Number of winners slot').setMinValue(1)
    )
    .addIntegerOption(o =>
      o.setName('entries').setDescription('Number of entries').setMinValue(0)
    ),

  async execute(message, args) {
    if (!checkPerm(message.member, 'gscan'))
      return message.reply('Only **Staff Team** members can use this command.');
    return message.reply('Please use `/gscan` (slash command) for this feature.');
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'gscan'))
      return interaction.reply({ content: 'Only **Staff Team** members can use this command.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const targetUser  = interaction.options.getUser('winner');
    const hostUser    = interaction.options.getUser('host');

    if (!targetUser || !hostUser)
      return interaction.editReply('Could not resolve one or more users. Please try again.');

    const prizeQuery  = interaction.options.getString('prize').toLowerCase();
    const filterWinners = interaction.options.getInteger('winners');
    const filterEntries = interaction.options.getInteger('entries');

    const giveaways = readData('giveaways.json');
    const matches = [];

    for (const [msgId, gw] of Object.entries(giveaways)) {
      // Must have ended and have winner data
      if (!gw.ended || !Array.isArray(gw.winnerIds)) continue;

      // Check winner
      if (!gw.winnerIds.includes(targetUser.id)) continue;

      // Check prize (case-insensitive substring)
      if (!gw.prize?.toLowerCase().includes(prizeQuery)) continue;

      // Check host
      if (gw.hostId !== hostUser.id) continue;

      // Optional: winners slot count
      if (filterWinners !== null && gw.winners !== filterWinners) continue;

      // Optional: entries count
      if (filterEntries !== null && (gw.participants?.length ?? 0) !== filterEntries) continue;

      matches.push({ msgId, gw });
    }

    if (matches.length === 0) {
      return interaction.editReply('No giveaway found matching those criteria.');
    }

    const lines = matches.map(({ msgId, gw }) => {
      const jumpUrl = `https://discord.com/channels/${gw.guildId}/${gw.channelId}/${msgId}`;
      const endedAt = gw.endTime ? `<t:${Math.floor(gw.endTime / 1000)}:d>` : 'Unknown';
      const winnerList = gw.winnerIds.map(id => `<@${id}>`).join(', ');
      return `**${gw.prize}** — ended ${endedAt} — winners: ${winnerList} — entries: ${gw.participants?.length ?? '?'}\n${jumpUrl}`;
    });

    const header = `Found **${matches.length}** matching giveaway(s):`;
    const body = lines.join('\n\n');

    // Discord ephemeral messages have a 2000 char limit; chunk if needed
    const full = `${header}\n\n${body}`;
    if (full.length <= 2000) {
      return interaction.editReply(full);
    }

    await interaction.editReply(header);
    for (const line of lines) {
      await interaction.followUp({ content: line, ephemeral: true });
    }
  },
};

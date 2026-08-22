const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

const TYPES = [
  { value: 'giveaways',       label: 'Giveaways & Minigames' },
  { value: 'partners',        label: 'Partners' },
  { value: 'tickets_closed',  label: 'Tickets Closed' },
  { value: 'tickets_renamed', label: 'Tickets Renamed' },
];

function resetType(u, type) {
  switch (type) {
    case 'giveaways':
      u.giveaways = [];
      if (!u.minigames) u.minigames = {};
      for (const k of ['poll', 'rps', 'dok', 'sos', 'ftpb', 'gtn']) u.minigames[k] = [];
      break;
    case 'partners':
      u.partners = [];
      break;
    case 'tickets_closed':
      if (!u.tickets) u.tickets = {};
      u.tickets.closed = [];
      break;
    case 'tickets_renamed':
      if (!u.tickets) u.tickets = {};
      u.tickets.renamed = [];
      break;
  }
}

module.exports = {
  name: 'areset',
  description: 'Reset activity leaderboard for all staff [Admin]',
  data: new SlashCommandBuilder()
    .setName('areset')
    .setDescription('Reset activity leaderboard for all staff [Admin]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Type to reset — leave empty to reset all categories')
        .setRequired(false)
        .addChoices(...TYPES.map(t => ({ name: t.label, value: t.value })))
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can reset activity data.', ephemeral: true });

    const type     = interaction.options.getString('type');
    const activity = readData('activity.json');

    for (const u of Object.values(activity)) {
      if (type) {
        resetType(u, type);
      } else {
        for (const t of TYPES.map(x => x.value)) resetType(u, t);
      }
    }

    writeData('activity.json', activity);

    const label = type ? (TYPES.find(t => t.value === type)?.label ?? type) : 'All Categories';
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Activity Reset')
        .setDescription(`**${label}** has been reset for all staff members.`)
        .setTimestamp()],
      ephemeral: true,
    });
  },
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, isStaffMember } = require('../../utils');

const TYPES = [
  { value: 'giveaways',       label: 'Giveaways & Minigames' },
  { value: 'partners',        label: 'Partners' },
  { value: 'tickets_closed',  label: 'Tickets Closed' },
  { value: 'tickets_renamed', label: 'Tickets Renamed' },
];

function getStaffRoleId() {
  const staffConfig = readData('staffConfig.json');
  if (staffConfig?.staffRoleId) return staffConfig.staffRoleId;
  const config = require('../../config.json');
  const fallback = config.roles?.staffTeam;
  return (fallback && !fallback.endsWith('_ROLE_ID')) ? fallback : null;
}

function getCount(u, type) {
  if (!u) return 0;
  switch (type) {
    case 'giveaways': {
      const g = Array.isArray(u.giveaways) ? u.giveaways.length : 0;
      const m = u.minigames || {};
      const mini = ['poll', 'rps', 'dok', 'sos', 'ftpb', 'gtn']
        .reduce((sum, k) => sum + (Array.isArray(m[k]) ? m[k].length : 0), 0);
      return g + mini;
    }
    case 'partners':
      return Array.isArray(u.partners) ? u.partners.length : 0;
    case 'tickets_closed':
      return Array.isArray(u.tickets?.closed) ? u.tickets.closed.length : 0;
    case 'tickets_renamed':
      return Array.isArray(u.tickets?.renamed) ? u.tickets.renamed.length : 0;
    default:
      return 0;
  }
}

module.exports = {
  name: 'activity',
  description: 'View staff activity leaderboard',
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('View staff activity leaderboard')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Activity type to display')
        .setRequired(true)
        .addChoices(...TYPES.map(t => ({ name: t.label, value: t.value })))
    ),

  async executeSlash(interaction) {
    if (!isStaffMember(interaction.member) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Staff** can use this command.', ephemeral: true });

    const type   = interaction.options.getString('type');
    const label  = TYPES.find(t => t.value === type)?.label ?? type;
    const roleId = getStaffRoleId();

    await interaction.deferReply();
    await interaction.guild.members.fetch().catch(() => {});

    const activity = readData('activity.json');

    const staffMembers = roleId
      ? [...interaction.guild.members.cache.values()].filter(m => !m.user.bot && m.roles.cache.has(roleId))
      : [...interaction.guild.members.cache.values()].filter(m => !m.user.bot && isStaffMember(m));

    if (staffMembers.length === 0) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Activity — ${label}`)
          .setDescription('No staff members found.')
          .setTimestamp()],
      });
    }

    const ranked = staffMembers
      .map(m => ({ member: m, count: getCount(activity[m.id], type) }))
      .sort((a, b) => b.count - a.count);

    const lines = ranked.map((entry, i) =>
      `#${i + 1} <@${entry.member.id}> — **${entry.count}**`
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Activity — ${label}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${staffMembers.length} staff members` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

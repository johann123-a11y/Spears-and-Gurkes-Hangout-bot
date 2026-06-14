const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData, isStaffMember, parseTime } = require('../../utils');
const config = require('../../config.json');

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'tickets_closed',     name: 'Tickets Geschlossen' },
  { value: 'tickets_renamed',    name: 'Tickets Umbenannt' },
  { value: 'tickets_user_added', name: 'User zu Ticket hinzugefügt' },
  { value: 'giveaways',          name: 'Giveaways' },
  { value: 'poll',               name: 'Polls' },
  { value: 'rps',                name: 'RPS' },
  { value: 'dok',                name: 'DoK' },
  { value: 'sos',                name: 'SoS' },
  { value: 'ftpb',               name: 'FtPB' },
  { value: 'gtn',                name: 'GTN' },
];

function getStaffRoleId() {
  const staffConfig = readData('staffConfig.json');
  if (staffConfig?.staffRoleId) return staffConfig.staffRoleId;
  const fallback = config.roles?.staffTeam;
  return (fallback && !fallback.endsWith('_ROLE_ID')) ? fallback : null;
}

// Convert old plain-number fields to timestamped arrays (ts:0 = unknown, excluded from time filters)
function migrateUser(u) {
  if (!u.tickets)   u.tickets   = { closed: [], renamed: [], usersAdded: [] };
  if (!u.giveaways) u.giveaways = [];
  if (!u.minigames) u.minigames = { poll: [], rps: [], dok: [], sos: [], ftpb: [], gtn: [] };
  for (const key of ['closed', 'renamed', 'usersAdded']) {
    if (typeof u.tickets[key] === 'number') {
      u.tickets[key] = Array.from({ length: u.tickets[key] }, () => ({ ts: 0 }));
    } else if (!Array.isArray(u.tickets[key])) {
      u.tickets[key] = [];
    }
  }
  if (typeof u.minigames.poll === 'number') {
    u.minigames.poll = Array.from({ length: u.minigames.poll }, () => ({ ts: 0 }));
  } else if (!Array.isArray(u.minigames.poll)) {
    u.minigames.poll = [];
  }
  for (const key of ['rps', 'dok', 'sos', 'ftpb', 'gtn']) {
    if (!Array.isArray(u.minigames[key])) u.minigames[key] = [];
  }
}

function ensureUser(activity, userId, username) {
  if (!activity[userId]) {
    activity[userId] = {
      username,
      tickets:  { closed: [], renamed: [], usersAdded: [] },
      giveaways: [],
      minigames: { poll: [], rps: [], dok: [], sos: [], ftpb: [], gtn: [] },
    };
  }
  const u = activity[userId];
  u.username = username || u.username;
  migrateUser(u);
  return u;
}

function getCategoryArray(u, cat) {
  switch (cat) {
    case 'tickets_closed':     return u.tickets.closed;
    case 'tickets_renamed':    return u.tickets.renamed;
    case 'tickets_user_added': return u.tickets.usersAdded;
    case 'giveaways':          return u.giveaways;
    case 'poll':               return u.minigames.poll;
    case 'rps':                return u.minigames.rps;
    case 'dok':                return u.minigames.dok;
    case 'sos':                return u.minigames.sos;
    case 'ftpb':               return u.minigames.ftpb;
    case 'gtn':                return u.minigames.gtn;
    default:                   return [];
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────
function countSince(field, since) {
  if (Array.isArray(field)) return since ? field.filter(e => e.ts >= since).length : field.length;
  return typeof field === 'number' ? field : 0;
}

function prizeListSince(arr, since) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  const filtered = since ? arr.filter(e => e.ts >= since) : arr;
  const prizes = filtered.map(e => e.prize).filter(Boolean);
  return prizes.length ? prizes.slice(-5).join(', ') : '—';
}

function buildUserField(member, data, since) {
  const d = data || {};
  const t = d.tickets   || {};
  const g = Array.isArray(d.giveaways) ? d.giveaways : [];
  const m = d.minigames || {};

  const ticketLine = `🎫 Geschlossen: **${countSince(t.closed, since)}** · Umbenannt: **${countSince(t.renamed, since)}** · User hinzugefügt: **${countSince(t.usersAdded, since)}**`;

  const filteredGw = since ? g.filter(e => e.ts >= since) : g;
  const gwPrizes   = filteredGw.map(e => e.prize).filter(Boolean).slice(-5).join(', ');
  const gwLine     = filteredGw.length > 0
    ? `🎉 Giveaways: **${filteredGw.length}** (${gwPrizes})`
    : `🎉 Giveaways: **0**`;

  const rps  = Array.isArray(m.rps)  ? m.rps  : [];
  const dok  = Array.isArray(m.dok)  ? m.dok  : [];
  const sos  = Array.isArray(m.sos)  ? m.sos  : [];
  const ftpb = Array.isArray(m.ftpb) ? m.ftpb : [];
  const gtn  = Array.isArray(m.gtn)  ? m.gtn  : [];

  const parts = [];
  const pollN = countSince(m.poll, since);
  if (pollN)                parts.push(`Poll: **${pollN}**`);
  if (countSince(rps, since))  parts.push(`RPS: **${countSince(rps, since)}** (${prizeListSince(rps, since)})`);
  if (countSince(dok, since))  parts.push(`DoK: **${countSince(dok, since)}** (${prizeListSince(dok, since)})`);
  if (countSince(sos, since))  parts.push(`SoS: **${countSince(sos, since)}** (${prizeListSince(sos, since)})`);
  if (countSince(ftpb, since)) parts.push(`FtPB: **${countSince(ftpb, since)}** (${prizeListSince(ftpb, since)})`);
  if (countSince(gtn, since))  parts.push(`GTN: **${countSince(gtn, since)}** (${prizeListSince(gtn, since)})`);
  const gameLine = parts.length ? `🎮 ${parts.join(' · ')}` : '🎮 Keine Minispiele';

  return {
    name: member.user.tag,
    value: [ticketLine, gwLine, gameLine].join('\n'),
    inline: false,
  };
}

async function showActivity(guild, replyFn, zeitraum) {
  await guild.members.fetch().catch(() => {});

  const roleId   = getStaffRoleId();
  const activity = readData('activity.json');

  const windowMs = zeitraum ? parseTime(zeitraum) : 0;
  const since    = windowMs > 0 ? Date.now() - windowMs : null;

  const staffMembers = roleId
    ? [...guild.members.cache.values()].filter(m => !m.user.bot && m.roles.cache.has(roleId))
    : [...guild.members.cache.values()].filter(m => !m.user.bot && isStaffMember(m));

  if (staffMembers.length === 0) {
    return replyFn({
      embeds: [new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('📊 Staff Activity')
        .setDescription('Keine Staff-Mitglieder gefunden.')
        .setTimestamp()],
    });
  }

  const fields       = staffMembers.map(m => buildUserField(m, activity[m.id], since));
  const periodLabel  = since ? `letzte ${zeitraum}` : 'Alle Zeit';
  const embeds       = [];

  for (let i = 0; i < fields.length; i += 10) {
    embeds.push(
      new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(i === 0
          ? `📊 Staff Activity — ${periodLabel}`
          : `📊 Staff Activity — ${periodLabel} (Fortsetzung)`)
        .addFields(fields.slice(i, i + 10))
        .setFooter({ text: `${staffMembers.length} Staff-Mitglieder gesamt` })
        .setTimestamp()
    );
  }

  return replyFn({ embeds: embeds.slice(0, 10) });
}

async function handleAdd(guild, targetId, category, points, replyFn) {
  const member   = guild.members.cache.get(targetId)
    ?? await guild.members.fetch(targetId).catch(() => null);
  const username = member?.user.tag ?? targetId;

  const activity = readData('activity.json');
  const u        = ensureUser(activity, targetId, username);
  const arr      = getCategoryArray(u, category);
  const now      = Date.now();
  for (let i = 0; i < points; i++) arr.push({ ts: now, manual: true });
  writeData('activity.json', activity);

  const catName = CATEGORIES.find(c => c.value === category)?.name ?? category;
  return replyFn(`✅ **+${points}** zu **${catName}** für <@${targetId}> hinzugefügt.`);
}

async function handleRemove(guild, targetId, category, points, replyFn) {
  const activity = readData('activity.json');
  if (!activity[targetId]) return replyFn('Keine Aktivitätsdaten für diesen User gefunden.');

  const u = activity[targetId];
  migrateUser(u);
  const arr    = getCategoryArray(u, category);
  const before = arr.length;
  if (before === 0) return replyFn('Keine Einträge in dieser Kategorie vorhanden.');

  // Remove manual entries first (newest-first), then oldest non-manual
  let remaining = points;
  for (let i = arr.length - 1; i >= 0 && remaining > 0; i--) {
    if (arr[i].manual) { arr.splice(i, 1); remaining--; }
  }
  if (remaining > 0) arr.splice(0, Math.min(remaining, arr.length));

  writeData('activity.json', activity);

  const removed = before - arr.length;
  const catName = CATEGORIES.find(c => c.value === category)?.name ?? category;
  return replyFn(`✅ **-${removed}** von **${catName}** für <@${targetId}> entfernt.`);
}

// ── Command export ────────────────────────────────────────────────────────────
module.exports = {
  name: 'activity',
  description: 'Zeigt die Aktivitätsstatistiken aller Staff-Mitglieder [Admin]',
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Zeigt die Aktivitätsstatistiken aller Staff-Mitglieder [Admin]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Zeigt die Staff-Aktivitäten')
        .addStringOption(o =>
          o.setName('zeitraum')
            .setDescription('Zeitraum z.B. 1d, 7d, 1w (leer = alle Zeit)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Aktivitätspunkte zu einem User hinzufügen')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o =>
          o.setName('kategorie')
            .setDescription('Kategorie')
            .setRequired(true)
            .addChoices(...CATEGORIES.map(c => ({ name: c.name, value: c.value })))
        )
        .addIntegerOption(o =>
          o.setName('punkte').setDescription('Anzahl der Punkte').setMinValue(1).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Aktivitätspunkte von einem User entfernen')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o =>
          o.setName('kategorie')
            .setDescription('Kategorie')
            .setRequired(true)
            .addChoices(...CATEGORIES.map(c => ({ name: c.name, value: c.value })))
        )
        .addIntegerOption(o =>
          o.setName('punkte').setDescription('Anzahl der Punkte').setMinValue(1).setRequired(true)
        )
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Nur **Administratoren** können das nutzen.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      const zeitraum = interaction.options.getString('zeitraum') ?? null;
      await interaction.deferReply();
      return showActivity(interaction.guild, opts => interaction.editReply(opts), zeitraum);
    }

    if (sub === 'add') {
      const user     = interaction.options.getUser('user');
      const category = interaction.options.getString('kategorie');
      const points   = interaction.options.getInteger('punkte');
      await interaction.deferReply({ ephemeral: true });
      return handleAdd(interaction.guild, user.id, category, points,
        msg => interaction.editReply(msg));
    }

    if (sub === 'remove') {
      const user     = interaction.options.getUser('user');
      const category = interaction.options.getString('kategorie');
      const points   = interaction.options.getInteger('punkte');
      await interaction.deferReply({ ephemeral: true });
      return handleRemove(interaction.guild, user.id, category, points,
        msg => interaction.editReply(msg));
    }
  },

  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
      return message.reply('Nur **Administratoren** können das nutzen.');

    const sub = args[0]?.toLowerCase();

    if (sub === 'add') {
      const targetId = message.mentions.users.first()?.id ?? args[1];
      const category = args[2];
      const points   = parseInt(args[3]);
      if (!targetId || !category || isNaN(points) || points < 1)
        return message.reply('Usage: `?activity add @user <kategorie> <punkte>`\nKategorien: ' + CATEGORIES.map(c => c.value).join(', '));
      if (!CATEGORIES.find(c => c.value === category))
        return message.reply(`Ungültige Kategorie. Gültig: ${CATEGORIES.map(c => c.value).join(', ')}`);
      return handleAdd(message.guild, targetId, category, points, msg => message.reply(msg));
    }

    if (sub === 'remove') {
      const targetId = message.mentions.users.first()?.id ?? args[1];
      const category = args[2];
      const points   = parseInt(args[3]);
      if (!targetId || !category || isNaN(points) || points < 1)
        return message.reply('Usage: `?activity remove @user <kategorie> <punkte>`\nKategorien: ' + CATEGORIES.map(c => c.value).join(', '));
      if (!CATEGORIES.find(c => c.value === category))
        return message.reply(`Ungültige Kategorie. Gültig: ${CATEGORIES.map(c => c.value).join(', ')}`);
      return handleRemove(message.guild, targetId, category, points, msg => message.reply(msg));
    }

    // Default: show (first arg may be a zeitraum like "1d", "7d")
    await showActivity(message.guild, opts => message.channel.send(opts), sub || null);
  },
};

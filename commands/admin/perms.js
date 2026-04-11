const {
  SlashCommandBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { readData, writeData, COMMAND_DEFAULTS, COMMAND_LABELS } = require('../../utils');

const COMMAND_DESCRIPTIONS = {
  mute:           'Timeoutet einen User',
  unmute:         'Entfernt einen Timeout',
  ban:            'Bannt einen User permanent',
  kick:           'Kickt einen User vom Server',
  strike:         'Gibt einem Staff Member einen Strike / entfernt ihn',
  strikes:        'Zeigt alle Strikes eines Users',
  loa:            'Setzt einen User auf Leave of Absence',
  checkloa:       'Zeigt die verbleibende LOA-Zeit',
  demote:         'Demoted einen Staff Member zu einer Rolle',
  promote:        'Promoted einen Staff Member zu einer Rolle',
  staffkick:      'Entfernt alle Staff-Rollen von einem User',
  pingperm:       'Gibt einer Rolle Ping-Rechte',
  setrole:        'Setzt eine Rollen-ID im Bot-Config',
  stick:          'Klebt eine Nachricht ans Ende des Channels',
  welcome:        'Welcome-Nachricht an-/ausschalten',
  welcomechannel: 'Setzt den Welcome-Channel',
  welcomemessage: 'Ändert den Welcome-Nachrichtentext',
  gstart:         'Startet ein Giveaway',
  gend:           'Beendet ein Giveaway frühzeitig',
  greroll:        'Rerollt Giveaway-Winner',
  afk:            'Setzt dich als AFK',
  help:           'Zeigt alle Commands',
  perms:          'Verwaltet Command-Berechtigungen',
};

const LEVEL_CHOICES = [
  { label: '🌍 Everyone — Jeder', value: 'everyone' },
  { label: '🟢 JrHelper+ — JrHelper und höher', value: 'jrHelper' },
  { label: '🟠 SrMod+ — SrMod und höher', value: 'srMod' },
  { label: '🔵 Staff Team — Alle Staff-Mitglieder', value: 'staffTeam' },
  { label: '🔴 Admin Only — Nur Admins', value: 'admin' },
];

module.exports = {
  name: 'perms',
  description: 'Verwaltet welche Rolle welchen Command benutzen kann. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('perms')
    .setDescription('Verwaltet Command-Berechtigungen [Administrator Only]')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Zeigt alle Commands mit ihren aktuellen Berechtigungen (interaktiv änderbar)')
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Ändert die Berechtigung für einen Command')
        .addStringOption(o =>
          o.setName('command')
            .setDescription('Welcher Command')
            .setRequired(true)
            .addChoices(...Object.keys(COMMAND_DEFAULTS).map(k => ({ name: k, value: k })))
        )
        .addStringOption(o =>
          o.setName('level')
            .setDescription('Welche Berechtigung benötigt wird')
            .setRequired(true)
            .addChoices(...LEVEL_CHOICES.map(l => ({ name: l.label, value: l.value })))
        )
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Nur **Administratoren** können diesen Command benutzen.');

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'list') {
      return message.channel.send({ embeds: [buildListEmbed()] });
    }

    if (sub === 'set') {
      const cmd = args[1]?.toLowerCase();
      const level = args[2]?.toLowerCase();
      if (!cmd || !level) return message.reply('Usage: `?perms set {command} {level}`');
      if (!COMMAND_DEFAULTS[cmd]) return message.reply(`❌ Unbekannter Command: \`${cmd}\``);
      if (!LEVEL_CHOICES.find(l => l.value === level)) return message.reply(`❌ Ungültiges Level.`);
      setPerm(cmd, level);
      return message.channel.send({ embeds: [buildSetEmbed(cmd, level)] });
    }

    message.reply('Usage: `?perms list` oder `?perms set {command} {level}`');
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Nur **Administratoren** können diesen Command benutzen.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('perms_select_command')
        .setPlaceholder('Command auswählen zum Bearbeiten...')
        .addOptions(
          Object.keys(COMMAND_DEFAULTS).map(cmd =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cmd)
              .setDescription(COMMAND_DESCRIPTIONS[cmd] ?? '—')
              .setValue(cmd)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({
        embeds: [buildListEmbed()],
        components: [row],
        ephemeral: true,
      });
    }

    if (sub === 'set') {
      const cmd = interaction.options.getString('command');
      const level = interaction.options.getString('level');
      setPerm(cmd, level);
      return interaction.reply({ embeds: [buildSetEmbed(cmd, level)], ephemeral: true });
    }
  },
};

function setPerm(cmd, level) {
  const perms = readData('perms.json');
  perms[cmd] = level;
  writeData('perms.json', perms);
}

function buildSetEmbed(cmd, level) {
  return new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Berechtigung geändert')
    .addFields(
      { name: 'Command', value: `\`${cmd}\``, inline: true },
      { name: 'Neue Berechtigung', value: COMMAND_LABELS[level] ?? level, inline: true },
      { name: 'Beschreibung', value: COMMAND_DESCRIPTIONS[cmd] ?? '—' }
    )
    .setTimestamp();
}

function buildListEmbed() {
  const perms = readData('perms.json');
  const fields = Object.keys(COMMAND_DEFAULTS).map(cmd => {
    const level = perms[cmd] ?? COMMAND_DEFAULTS[cmd];
    return {
      name: `\`${cmd}\``,
      value: `${COMMAND_LABELS[level] ?? level}\n*${COMMAND_DESCRIPTIONS[cmd] ?? '—'}*`,
      inline: true,
    };
  });

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🔐 Command-Berechtigungen')
    .setDescription('Wähle unten einen Command aus um die Berechtigung zu ändern.\n\u200b')
    .addFields(fields)
    .setTimestamp();
}

module.exports.setPerm = setPerm;
module.exports.buildSetEmbed = buildSetEmbed;
module.exports.LEVEL_CHOICES = LEVEL_CHOICES;

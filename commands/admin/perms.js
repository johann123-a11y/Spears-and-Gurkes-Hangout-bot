const {
  SlashCommandBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { readData, writeData, COMMAND_DEFAULTS, COMMAND_LABELS } = require('../../utils');

const COMMAND_DESCRIPTIONS = {
  // Moderation
  mute:           'Timeouts a user for a duration',
  unmute:         'Removes a timeout from a user',
  ban:            'Permanently bans a user',
  kick:           'Kicks a user from the server',
  clear:          'Deletes messages (1–100)',
  purge:          'Deletes messages from a specific user (1–100)',
  // Strikes
  strike:         'Adds or removes a strike from a staff member',
  strikes:        'Shows all strikes + add/remove buttons',
  // Staff management
  loa:            'Puts a user on Leave of Absence',
  checkloa:       'Shows LOA status + manage buttons',
  demote:         'Demotes a staff member to a lower role',
  promote:        'Promotes a staff member to a higher role',
  staffkick:      'Removes all staff roles from a user',
  pingperm:       'Grants a role ping permissions',
  // Setup
  setrole:        'Sets a role ID in the bot config',
  logs:           'Sets or disables the main log channel',
  perms:          'Manages command permission levels',
  stick:          'Sticks a message to the bottom of a channel',
  // Welcome
  welcome:        'Toggle welcome messages on/off',
  welcomechannel: 'Sets the welcome channel',
  welcomemessage: 'Changes the welcome message text',
  // Tickets
  ticket:         'Full ticket system (setup, send, group, close, etc.)',
  tickets:        'List or delete ticket panels',
  // Applications
  application:    'Full application system (setup, results, channels)',
  // Giveaways
  gstart:         'Starts a giveaway',
  gend:           'Ends a giveaway early',
  greroll:        'Rerolls giveaway winners',
  // General
  afk:            'Sets yourself as AFK with optional time limit',
  help:           'Shows all available commands',
};

// Groups for the embed display
const COMMAND_GROUPS = [
  { name: '🔇 Moderation',       cmds: ['mute', 'unmute', 'ban', 'kick', 'clear', 'purge'] },
  { name: '⚠️ Strikes',          cmds: ['strike', 'strikes'] },
  { name: '🛡️ Staff Management', cmds: ['loa', 'checkloa', 'demote', 'promote', 'staffkick', 'pingperm'] },
  { name: '⚙️ Setup',            cmds: ['setrole', 'logs', 'perms', 'stick'] },
  { name: '👋 Welcome',          cmds: ['welcome', 'welcomechannel', 'welcomemessage'] },
  { name: '🎫 Tickets',          cmds: ['ticket', 'tickets'] },
  { name: '📋 Applications',     cmds: ['application'] },
  { name: '🎉 Giveaways',        cmds: ['gstart', 'gend', 'greroll'] },
  { name: '💬 General',          cmds: ['afk', 'help'] },
];

const LEVEL_CHOICES = [
  { label: '🌍 Everyone',    value: 'everyone'  },
  { label: '🟢 JrHelper+',  value: 'jrHelper'  },
  { label: '🟠 SrMod+',     value: 'srMod'     },
  { label: '🔵 Staff Team', value: 'staffTeam' },
  { label: '🔴 Admin Only', value: 'admin'     },
];

const ALL_CMDS = Object.keys(COMMAND_DEFAULTS); // 29 commands

module.exports = {
  name: 'perms',
  description: 'Manages which role can use which command. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('perms')
    .setDescription('Manage command permissions [Administrator Only]')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all commands with their current permissions (interactive)')
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Change the permission level for a command')
        .addStringOption(o =>
          o.setName('command')
            .setDescription('Command name (e.g. mute, ticket, application)')
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('level')
            .setDescription('Permission level')
            .setRequired(true)
            .addChoices(...LEVEL_CHOICES.map(l => ({ name: l.label, value: l.value })))
        )
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Only **Administrators** can use this command.');

    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'list')
      return message.channel.send({ embeds: [buildListEmbed()] });

    if (sub === 'set') {
      const cmd   = args[1]?.toLowerCase();
      const level = args[2]?.toLowerCase();
      if (!cmd || !level) return message.reply('Usage: `?perms set {command} {level}`');
      if (!COMMAND_DEFAULTS[cmd]) return message.reply(`❌ Unknown command: \`${cmd}\``);
      if (!LEVEL_CHOICES.find(l => l.value === level)) return message.reply(`❌ Invalid level.`);
      setPerm(cmd, level);
      return message.channel.send({ embeds: [buildSetEmbed(cmd, level)] });
    }

    message.reply('Usage: `?perms list` or `?perms set {command} {level}`');
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      // Split 29 commands across two select menus (max 25 per menu)
      const firstHalf  = ALL_CMDS.slice(0, 25);
      const secondHalf = ALL_CMDS.slice(25);

      const makeMenu = (cmds, customId, placeholder) =>
        new StringSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder(placeholder)
          .addOptions(cmds.map(cmd =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cmd)
              .setDescription(COMMAND_DESCRIPTIONS[cmd] ?? '—')
              .setValue(cmd)
          ));

      const rows = [
        new ActionRowBuilder().addComponents(makeMenu(firstHalf, 'perms_select_command', 'Select a command to edit... (1–25)')),
      ];
      if (secondHalf.length > 0)
        rows.push(new ActionRowBuilder().addComponents(makeMenu(secondHalf, 'perms_select_command', `Select a command to edit... (26–${ALL_CMDS.length})`)));

      return interaction.reply({
        embeds: [buildListEmbed()],
        components: rows,
        ephemeral: true,
      });
    }

    if (sub === 'set') {
      const cmd   = interaction.options.getString('command');
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
    .setTitle('✅ Permission Updated')
    .addFields(
      { name: 'Command',        value: `\`${cmd}\``,                    inline: true },
      { name: 'New Permission', value: COMMAND_LABELS[level] ?? level,   inline: true },
      { name: 'Description',    value: COMMAND_DESCRIPTIONS[cmd] ?? '—' }
    )
    .setTimestamp();
}

function buildListEmbed() {
  const perms = readData('perms.json');

  const fields = COMMAND_GROUPS.map(group => {
    const lines = group.cmds.map(cmd => {
      const level = perms[cmd] ?? COMMAND_DEFAULTS[cmd];
      const label = COMMAND_LABELS[level] ?? level;
      return `\`${cmd}\` — ${label}`;
    });
    return { name: group.name, value: lines.join('\n') };
  });

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🔐 Command Permissions')
    .setDescription('Select a command below to change its permission level.\n\u200b')
    .addFields(fields)
    .setTimestamp();
}

module.exports.setPerm       = setPerm;
module.exports.buildSetEmbed = buildSetEmbed;
module.exports.LEVEL_CHOICES = LEVEL_CHOICES;

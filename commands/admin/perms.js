const {
  SlashCommandBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { readData, writeData, COMMAND_DEFAULTS, COMMAND_LABELS } = require('../../utils');

const COMMAND_DESCRIPTIONS = {
  mute:           'Timeouts a user for a duration',
  unmute:         'Removes a timeout from a user',
  ban:            'Permanently bans a user',
  kick:           'Kicks a user from the server',
  clear:          'Deletes messages (1–100)',
  purge:          'Deletes messages from a specific user (1–100)',
  strike:         'Adds or removes a strike from a staff member',
  strikes:        'Shows all strikes + add/remove buttons',
  loa:            'Puts a user on Leave of Absence',
  checkloa:       'Shows LOA status + manage buttons',
  demote:         'Demotes a staff member to a lower role',
  promote:        'Promotes a staff member to a higher role',
  staffkick:      'Removes all staff roles from a user',
  pingperm:       'Grants a role ping permissions',
  setrole:        'Sets a role ID in the bot config',
  logs:           'Sets or disables the main log channel',
  perms:          'Manages command permission levels',
  stick:          'Sticks a message to the bottom of a channel',
  welcome:        'Toggle welcome messages on/off',
  welcomechannel: 'Sets the welcome channel',
  welcomemessage: 'Changes the welcome message text',
  ticket:         'Full ticket system (setup, send, group, close, etc.)',
  tickets:        'List or delete ticket panels',
  application:    'Full application system (setup, results, channels)',
  gstart:         'Starts a giveaway',
  gend:           'Ends a giveaway early',
  greroll:        'Rerolls giveaway winners',
  afk:            'Sets yourself as AFK with optional time limit',
  help:           'Shows all available commands',
};

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

const ALL_CMDS = Object.keys(COMMAND_DEFAULTS);

module.exports = {
  name: 'perms',
  description: 'Shows and manages command permissions. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('perms')
    .setDescription('View and edit all command permissions [Administrator Only]'),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Only **Administrators** can use this command.');
    message.channel.send({ embeds: [buildListEmbed()] });
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    // Two select menus since Discord allows max 25 options each
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
      new ActionRowBuilder().addComponents(makeMenu(firstHalf, 'perms_select_command', 'Select a command to edit...')),
    ];
    if (secondHalf.length > 0)
      rows.push(new ActionRowBuilder().addComponents(makeMenu(secondHalf, 'perms_select_command', 'Select a command to edit...')));

    return interaction.reply({
      embeds: [buildListEmbed()],
      components: rows,
      ephemeral: true,
    });
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
      { name: 'Command',        value: `\`${cmd}\``,                   inline: true },
      { name: 'New Permission', value: COMMAND_LABELS[level] ?? level,  inline: true },
      { name: 'Description',    value: COMMAND_DESCRIPTIONS[cmd] ?? '—' },
    )
    .setTimestamp();
}

function buildListEmbed() {
  const perms  = readData('perms.json');
  const fields = COMMAND_GROUPS.map(group => ({
    name:  group.name,
    value: group.cmds.map(cmd => {
      const level = perms[cmd] ?? COMMAND_DEFAULTS[cmd];
      return `\`${cmd}\` — ${COMMAND_LABELS[level] ?? level}`;
    }).join('\n'),
  }));

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

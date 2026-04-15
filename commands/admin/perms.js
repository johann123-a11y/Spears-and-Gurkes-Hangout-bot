const {
  SlashCommandBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { readData, writeData, COMMAND_DEFAULTS, COMMAND_LABELS } = require('../../utils');

// Only configurable commands — all admin/setup commands are hardcoded Administrator
const COMMAND_DESCRIPTIONS = {
  mute:         'Timeouts a user for a duration',
  unmute:       'Removes a timeout from a user',
  clear:        'Deletes messages (1–100)',
  strike:       'Adds or removes a strike from a staff member',
  strikes:      'Shows all strikes + add/remove buttons',
  gstart:       'Starts a giveaway',
  gend:         'Ends a giveaway early',
  greroll:      'Rerolls giveaway winners',
  afk:          'Sets yourself as AFK with optional time limit',
  help:         'Shows all available commands',
  invitefilter: 'Who can bypass the invite link filter (post multiple invites)',
};

const COMMAND_GROUPS = [
  { name: '🔇 Moderation', cmds: ['mute', 'unmute', 'clear'] },
  { name: '⚠️ Strikes',    cmds: ['strike', 'strikes'] },
  { name: '🎉 Giveaways',  cmds: ['gstart', 'gend', 'greroll'] },
  { name: '💬 General',    cmds: ['afk', 'help'] },
  { name: '🛡️ Auto-Mod',   cmds: ['invitefilter'] },
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

    const menu = new StringSelectMenuBuilder()
      .setCustomId('perms_select_command_a')
      .setPlaceholder('Select a command to edit its permission...')
      .addOptions(ALL_CMDS.map(cmd =>
        new StringSelectMenuOptionBuilder()
          .setLabel(cmd)
          .setDescription(COMMAND_DESCRIPTIONS[cmd] ?? '—')
          .setValue(cmd)
      ));

    return interaction.reply({
      embeds: [buildListEmbed()],
      components: [new ActionRowBuilder().addComponents(menu)],
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

const {
  SlashCommandBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { readData, writeData, COMMAND_DEFAULTS, COMMAND_LABELS } = require('../../utils');

const COMMAND_DESCRIPTIONS = {
  mute:           'Timeouts a user',
  unmute:         'Removes a timeout',
  ban:            'Permanently bans a user',
  kick:           'Kicks a user from the server',
  strike:         'Gives or removes a strike from a staff member',
  strikes:        'Shows all strikes of a user',
  loa:            'Puts a user on Leave of Absence',
  checkloa:       'Shows the remaining LOA time',
  demote:         'Demotes a staff member to a role',
  promote:        'Promotes a staff member to a role',
  staffkick:      'Removes all staff roles from a user',
  pingperm:       'Grants a role ping permissions',
  setrole:        'Sets a role ID in the bot config',
  stick:          'Sticks a message to the bottom of a channel',
  welcome:        'Toggle welcome messages on/off',
  welcomechannel: 'Sets the welcome channel',
  welcomemessage: 'Changes the welcome message text',
  gstart:         'Starts a giveaway',
  gend:           'Ends a giveaway early',
  greroll:        'Rerolls giveaway winners',
  afk:            'Sets yourself as AFK',
  help:           'Shows all commands',
  perms:          'Manages command permissions',
};

const LEVEL_CHOICES = [
  { label: '🌍 Everyone', value: 'everyone' },
  { label: '🟢 JrHelper+', value: 'jrHelper' },
  { label: '🟠 SrMod+', value: 'srMod' },
  { label: '🔵 Staff Team', value: 'staffTeam' },
  { label: '🔴 Admin Only', value: 'admin' },
];

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
            .setDescription('Which command to update')
            .setRequired(true)
            .addChoices(...Object.keys(COMMAND_DEFAULTS).map(k => ({ name: k, value: k })))
        )
        .addStringOption(o =>
          o.setName('level')
            .setDescription('Required permission level')
            .setRequired(true)
            .addChoices(...LEVEL_CHOICES.map(l => ({ name: l.label, value: l.value })))
        )
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Only **Administrators** can use this command.');

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'list') {
      return message.channel.send({ embeds: [buildListEmbed()] });
    }

    if (sub === 'set') {
      const cmd = args[1]?.toLowerCase();
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
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('perms_select_command')
        .setPlaceholder('Select a command to edit...')
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
    .setTitle('✅ Permission Updated')
    .addFields(
      { name: 'Command', value: `\`${cmd}\``, inline: true },
      { name: 'New Permission', value: COMMAND_LABELS[level] ?? level, inline: true },
      { name: 'Description', value: COMMAND_DESCRIPTIONS[cmd] ?? '—' }
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
    .setTitle('🔐 Command Permissions')
    .setDescription('Select a command below to change its permission level.\n\u200b')
    .addFields(fields)
    .setTimestamp();
}

module.exports.setPerm = setPerm;
module.exports.buildSetEmbed = buildSetEmbed;
module.exports.LEVEL_CHOICES = LEVEL_CHOICES;

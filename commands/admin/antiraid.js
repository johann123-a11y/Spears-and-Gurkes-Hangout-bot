const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'antiraid',
  description: 'Configure the anti-raid system [Admin]',
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure the anti-raid system [Admin]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the alert channel for raid warnings (also re-enables antiraid)')
        .addChannelOption(o =>
          o.setName('channel').setDescription('Channel for raid alerts').setRequired(true)
        )
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Admins** can use this.', ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const cfg = readData('antiraid.json');
    cfg.channelId = channel.id;
    cfg.enabled   = true;
    writeData('antiraid.json', cfg);
    return interaction.reply({ content: `Anti-raid alert channel set to <#${channel.id}>. AntiRaid is now active.`, ephemeral: true });
  },

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('Only **Admins** can use this.');

    const sub = args[0]?.toLowerCase();
    if (sub === 'channel') {
      const channelId = message.mentions.channels.first()?.id || args[1];
      if (!channelId) return message.reply('Usage: `?antiraid channel #channel`');
      const cfg = readData('antiraid.json');
      cfg.channelId = channelId;
      cfg.enabled   = true;
      writeData('antiraid.json', cfg);
      return message.reply(`Anti-raid alert channel set to <#${channelId}>. AntiRaid is now active.`);
    }

    return message.reply('Usage: `?antiraid channel #channel`');
  },
};

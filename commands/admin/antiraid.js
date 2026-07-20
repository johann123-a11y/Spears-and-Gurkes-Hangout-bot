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
    )
    .addSubcommand(sub =>
      sub.setName('exempt')
        .setDescription('Add or remove a bot/user from the antiraid exemption list')
        .addStringOption(o =>
          o.setName('action').setDescription('add or remove').setRequired(true)
            .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' })
        )
        .addStringOption(o =>
          o.setName('id').setDescription('User or bot ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('exemptlist')
        .setDescription('Show all exempted IDs')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Admins** can use this.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const cfg = readData('antiraid.json');
    if (!Array.isArray(cfg.exemptUsers)) cfg.exemptUsers = [];

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      cfg.channelId = channel.id;
      cfg.enabled   = true;
      writeData('antiraid.json', cfg);
      return interaction.reply({ content: `Anti-raid alert channel set to <#${channel.id}>. AntiRaid is now active.`, ephemeral: true });
    }

    if (sub === 'exempt') {
      const action = interaction.options.getString('action');
      const id     = interaction.options.getString('id').trim();

      if (action === 'add') {
        if (cfg.exemptUsers.includes(id))
          return interaction.reply({ content: `\`${id}\` is already exempted.`, ephemeral: true });
        cfg.exemptUsers.push(id);
        writeData('antiraid.json', cfg);
        return interaction.reply({ content: `✅ \`${id}\` added to the antiraid exemption list.`, ephemeral: true });
      }

      if (action === 'remove') {
        const idx = cfg.exemptUsers.indexOf(id);
        if (idx === -1)
          return interaction.reply({ content: `\`${id}\` is not in the exemption list.`, ephemeral: true });
        cfg.exemptUsers.splice(idx, 1);
        writeData('antiraid.json', cfg);
        return interaction.reply({ content: `✅ \`${id}\` removed from the antiraid exemption list.`, ephemeral: true });
      }
    }

    if (sub === 'exemptlist') {
      const list = cfg.exemptUsers.length
        ? cfg.exemptUsers.map(id => `• \`${id}\``).join('\n')
        : 'No exemptions set.';
      return interaction.reply({ content: `**Antiraid Exemptions:**\n${list}`, ephemeral: true });
    }
  },

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('Only **Admins** can use this.');

    const sub = args[0]?.toLowerCase();
    const cfg = readData('antiraid.json');
    if (!Array.isArray(cfg.exemptUsers)) cfg.exemptUsers = [];

    if (sub === 'channel') {
      const channelId = message.mentions.channels.first()?.id || args[1];
      if (!channelId) return message.reply('Usage: `?antiraid channel #channel`');
      cfg.channelId = channelId;
      cfg.enabled   = true;
      writeData('antiraid.json', cfg);
      return message.reply(`Anti-raid alert channel set to <#${channelId}>. AntiRaid is now active.`);
    }

    if (sub === 'exempt') {
      const action = args[1]?.toLowerCase();
      const id     = args[2];
      if (!action || !id) return message.reply('Usage: `?antiraid exempt add/remove <id>`');

      if (action === 'add') {
        if (cfg.exemptUsers.includes(id)) return message.reply(`\`${id}\` is already exempted.`);
        cfg.exemptUsers.push(id);
        writeData('antiraid.json', cfg);
        return message.reply(`✅ \`${id}\` added to the antiraid exemption list.`);
      }
      if (action === 'remove') {
        const idx = cfg.exemptUsers.indexOf(id);
        if (idx === -1) return message.reply(`\`${id}\` is not in the exemption list.`);
        cfg.exemptUsers.splice(idx, 1);
        writeData('antiraid.json', cfg);
        return message.reply(`✅ \`${id}\` removed from the antiraid exemption list.`);
      }
    }

    if (sub === 'exemptlist') {
      const list = cfg.exemptUsers.length
        ? cfg.exemptUsers.map(id => `• \`${id}\``).join('\n')
        : 'No exemptions set.';
      return message.reply(`**Antiraid Exemptions:**\n${list}`);
    }

    return message.reply('Usage: `?antiraid channel #channel` | `?antiraid exempt add/remove <id>`');
  },
};

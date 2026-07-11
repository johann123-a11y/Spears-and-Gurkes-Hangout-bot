const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const { parseTime, formatTime, readData, writeData, isStaffMember } = require('../../utils');

module.exports = {
  name: 'loa',
  description: 'Manage LOA for staff members.',
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Manage LOA for staff members')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set a staff member on LOA [Admin]')
        .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
        .addStringOption(o => o.setName('time').setDescription('LOA duration e.g. 3d 1w').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for LOA').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Remove a staff member from LOA early [Admin]')
        .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the channel where LOA approvals/denials are posted [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('LOA results channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reqchannel')
        .setDescription('Set the channel where LOA requests are sent [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('LOA request channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('request')
        .setDescription('Submit a LOA request [Staff]')
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('Only **Admins** can use this command.');

    const sub = args[0]?.toLowerCase();

    if (sub === 'clear') {
      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage: `?loa clear @user`');
      return clearLOA(target.user, message.author.tag, message.channel);
    }

    const target = message.mentions.members.first();
    const time = args[1];
    const reason = args.slice(2).join(' ');

    if (!target || !time || !reason)
      return message.reply('Usage: `?loa @user {time} {reason}` or `?loa clear @user`');

    const ms = parseTime(time);
    if (!ms) return message.reply('Invalid time format.');

    setLOA(target, ms, reason, message.author.tag, message.channel);
  },

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      const cfg = readData('loaConfig.json');
      cfg.loaChannelId = channel.id;
      writeData('loaConfig.json', cfg);
      return interaction.reply({ content: `✅ LOA channel set to <#${channel.id}>.`, ephemeral: true });
    }

    if (sub === 'reqchannel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      const cfg = readData('loaConfig.json');
      cfg.reqChannelId = channel.id;
      writeData('loaConfig.json', cfg);
      return interaction.reply({ content: `✅ LOA request channel set to <#${channel.id}>.`, ephemeral: true });
    }

    if (sub === 'request') {
      if (!isStaffMember(interaction.member))
        return interaction.reply({ content: 'Only **Staff** can submit LOA requests.', ephemeral: true });
      const modal = new ModalBuilder()
        .setCustomId('loa_request_modal')
        .setTitle('LOA Request')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for LOA').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('from').setLabel('Leaving from (e.g. 12.07.2026)').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('until').setLabel('Coming back (e.g. 19.07.2026)').setStyle(TextInputStyle.Short).setRequired(true)
          ),
        );
      return interaction.showModal(modal);
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: 'Only **Administrators** can use this command.', ephemeral: true });

    if (sub === 'clear') {
      const user = interaction.options.getUser('user');
      await interaction.deferReply();
      return clearLOA(user, interaction.user.tag, null, interaction);
    }

    const user = interaction.options.getUser('user');
    const time = interaction.options.getString('time');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });

    const ms = parseTime(time);
    if (!ms) return interaction.reply({ content: 'Invalid time format.', ephemeral: true });

    await interaction.deferReply();
    setLOA(member, ms, reason, interaction.user.tag, null, interaction);
  },
};

function setLOA(member, ms, reason, by, channel, interaction) {
  const loa = readData('loa.json');
  loa[member.user.id] = {
    endTime: Date.now() + ms,
    reason,
    by,
    username: member.user.tag,
  };
  writeData('loa.json', loa);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🏖️ Staff Member on LOA')
    .addFields(
      { name: '👤 Staff Member', value: `${member.user.tag}`, inline: true },
      { name: '⏳ Duration',     value: formatTime(ms),       inline: true },
      { name: '🛡️ Set by',       value: by,                   inline: true },
      { name: '📋 Reason',       value: reason },
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.editReply({ embeds: [embed] });
}

function clearLOA(user, by, channel, interaction) {
  const loa = readData('loa.json');

  if (!loa[user.id]) {
    const msg = `${user.tag} is not on LOA.`;
    return channel ? channel.send(msg) : interaction.editReply(msg);
  }

  delete loa[user.id];
  writeData('loa.json', loa);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ LOA Ended')
    .addFields(
      { name: '👤 Staff Member', value: user.tag, inline: true },
      { name: '🛡️ Ended by',    value: by,       inline: true },
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.editReply({ embeds: [embed] });
}

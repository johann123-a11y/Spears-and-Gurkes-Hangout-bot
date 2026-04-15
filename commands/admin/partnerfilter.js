const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

function getData() {
  const d = readData('partnerFilter.json') || {};
  return { enabled: d.enabled ?? false, allowedChannels: d.allowedChannels ?? [] };
}

module.exports = {
  name: 'partner',
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Discord invite filter settings [Admin]')

    .addSubcommand(sub =>
      sub.setName('on').setDescription('Enable Discord invite filter [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('off').setDescription('Disable Discord invite filter [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a channel where Discord invites are allowed [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a channel from the allowed invite list [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('info').setDescription('Show current invite filter settings [Admin]')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Only **Administrators** can use this.', ephemeral: true });

    const sub  = interaction.options.getSubcommand();
    const data = getData();

    if (sub === 'on') {
      data.enabled = true;
      writeData('partnerFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Invite Filter Enabled')
          .setDescription('Discord invites are now **blocked** except in allowed channels and tickets.')
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'off') {
      data.enabled = false;
      writeData('partnerFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('🔴 Invite Filter Disabled')
          .setDescription('Discord invites are now allowed everywhere.')
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'add') {
      const ch = interaction.options.getChannel('channel');
      if (data.allowedChannels.includes(ch.id))
        return interaction.reply({ content: `❌ <#${ch.id}> is already in the list.`, ephemeral: true });
      data.allowedChannels.push(ch.id);
      writeData('partnerFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Channel Added')
          .setDescription(`Discord invites are now allowed in <#${ch.id}>.`).setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const ch = interaction.options.getChannel('channel');
      if (!data.allowedChannels.includes(ch.id))
        return interaction.reply({ content: `❌ <#${ch.id}> is not in the list.`, ephemeral: true });
      data.allowedChannels = data.allowedChannels.filter(id => id !== ch.id);
      writeData('partnerFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('🗑️ Channel Removed')
          .setDescription(`Discord invites are no longer allowed in <#${ch.id}>.`).setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'info') {
      const channels = data.allowedChannels.length
        ? data.allowedChannels.map(id => `<#${id}>`).join('\n')
        : '*(none set)*';
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🤝 Invite Filter Info')
          .addFields(
            { name: 'Status', value: data.enabled ? '✅ Enabled' : '🔴 Disabled', inline: true },
            { name: 'Allowed Channels', value: channels },
            { name: 'Always Allowed', value: '✅ Ticket channels are always exempt' },
          ).setFooter({ text: 'Staff with ManageMessages are always exempt' })
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};

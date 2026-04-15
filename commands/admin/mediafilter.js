const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');

function getData() {
  const d = readData('mediaFilter.json') || {};
  return { enabled: d.enabled ?? false, allowedChannels: d.allowedChannels ?? [] };
}

module.exports = {
  name: 'media',
  data: new SlashCommandBuilder()
    .setName('media')
    .setDescription('Link filter settings [Admin]')

    .addSubcommand(sub =>
      sub.setName('on').setDescription('Enable link filter — links only allowed in set channels [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('off').setDescription('Disable link filter [Admin]')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a channel where links are allowed [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a channel from the allowed list [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('info').setDescription('Show current link filter settings [Admin]')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Only **Administrators** can use this.', ephemeral: true });

    const sub  = interaction.options.getSubcommand();
    const data = getData();

    if (sub === 'on') {
      data.enabled = true;
      writeData('mediaFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Link Filter Enabled')
          .setDescription('Links are now **blocked** everywhere except in allowed channels.')
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'off') {
      data.enabled = false;
      writeData('mediaFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('🔴 Link Filter Disabled')
          .setDescription('Links are now allowed everywhere.')
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'add') {
      const ch = interaction.options.getChannel('channel');
      if (data.allowedChannels.includes(ch.id))
        return interaction.reply({ content: `❌ <#${ch.id}> is already in the list.`, ephemeral: true });
      data.allowedChannels.push(ch.id);
      writeData('mediaFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Channel Added')
          .setDescription(`Links are now allowed in <#${ch.id}>.`).setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const ch = interaction.options.getChannel('channel');
      if (!data.allowedChannels.includes(ch.id))
        return interaction.reply({ content: `❌ <#${ch.id}> is not in the list.`, ephemeral: true });
      data.allowedChannels = data.allowedChannels.filter(id => id !== ch.id);
      writeData('mediaFilter.json', data);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('🗑️ Channel Removed')
          .setDescription(`Links are no longer allowed in <#${ch.id}>.`).setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'info') {
      const channels = data.allowedChannels.length
        ? data.allowedChannels.map(id => `<#${id}>`).join('\n')
        : '*(none set)*';
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔗 Link Filter Info')
          .addFields(
            { name: 'Status', value: data.enabled ? '✅ Enabled' : '🔴 Disabled', inline: true },
            { name: 'Allowed Channels', value: channels },
          ).setFooter({ text: 'Staff with ManageMessages are always exempt' })
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },
};

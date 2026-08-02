const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COOLDOWN_MS, pingCooldowns } = require('../../utils/pingCooldowns');
const { isStaffMember } = require('../../utils');

const TRACKED = ['gping', 'qping', 'market', 'spawner'];

module.exports = {
  name: 'pinginfo',
  data: new SlashCommandBuilder()
    .setName('pinginfo')
    .setDescription('Shows the current cooldown status for all ping commands'),

  async executeSlash(interaction) {
    if (!isStaffMember(interaction.member))
      return interaction.reply({ content: 'Only **Staff** can use this command.', ephemeral: true });

    const now = Date.now();
    const fields = TRACKED.map(cmd => {
      const lastUsed = pingCooldowns.get(cmd);
      if (!lastUsed) return { name: `/${cmd}`, value: '✅ Available', inline: true };
      const expiresAt = lastUsed + COOLDOWN_MS;
      if (now >= expiresAt) return { name: `/${cmd}`, value: '✅ Available', inline: true };
      const unixExpiry = Math.floor(expiresAt / 1000);
      return { name: `/${cmd}`, value: `⏳ <t:${unixExpiry}:R>`, inline: true };
    });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🔔 Ping Cooldown Status')
      .addFields(fields)
      .setFooter({ text: 'Cooldown: 90 minutes per command' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkPerm } = require('../../utils');
const { COOLDOWN_MS, getCooldown, setCooldown } = require('../../utils/pingCooldowns');

module.exports = {
  name: 'here',
  data: new SlashCommandBuilder()
    .setName('here')
    .setDescription('Ping @here [Staff Team Only]'),

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'hereping'))
      return interaction.reply({ content: 'Only **Staff Team** members can use this command.', ephemeral: true });

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) {
      const lastUsed = getCooldown('here');
      if (lastUsed) {
        const expiresAt = lastUsed + COOLDOWN_MS;
        if (Date.now() < expiresAt) {
          const unixExpiry = Math.floor(expiresAt / 1000);
          return interaction.reply({
            content: `❌ **/here** is on cooldown — available <t:${unixExpiry}:R> (at <t:${unixExpiry}:t>).`,
            ephemeral: true,
          });
        }
      }
    }

    await interaction.reply({ content: 'Sent!', ephemeral: true });
    await interaction.channel.send({ content: '@here', allowedMentions: { parse: ['everyone'] } });
    setCooldown('here');
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, readData, writeData } = require('../../utils');

module.exports = {
  name: 'gend',
  description: 'Ends a giveaway early. [Staff Team]',
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway early [Staff Team]')
    .addStringOption(o =>
      o.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)
    ),

  async execute(message, args) {
    if (!checkPerm(message.member, 'gend'))
      return message.reply('❌ Only **Staff Team** members can use this command.');

    const msgId = args[0];
    if (!msgId) return message.reply('Usage: `?gend {message_id}`');

    await endGiveaway(msgId, message.guild, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'gend'))
      return interaction.reply({ content: '❌ Only **Staff Team** members can use this command.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const msgId = interaction.options.getString('message_id');
    await endGiveaway(msgId, interaction.guild, interaction.channel, interaction);
  },
};

async function endGiveaway(msgId, guild, replyChannel, interaction) {
  const giveaways = readData('giveaways.json');
  const gw = giveaways[msgId];

  if (!gw || gw.ended) {
    const msg = '❌ Giveaway not found or already ended.';
    return interaction ? interaction.editReply(msg) : replyChannel.send(msg);
  }

  const channel = await guild.channels.fetch(gw.channelId).catch(() => null);
  if (!channel) {
    const msg = '❌ Could not find the giveaway channel.';
    return interaction ? interaction.editReply(msg) : replyChannel.send(msg);
  }

  const gwMsg = await channel.messages.fetch(msgId).catch(() => null);
  if (!gwMsg) {
    const msg = '❌ Could not find the giveaway message.';
    return interaction ? interaction.editReply(msg) : replyChannel.send(msg);
  }

  const participantIds = gw.participants || [];
  const members = await Promise.all(participantIds.map(id => guild.members.fetch(id).catch(() => null)));
  const userArray = members.filter(Boolean);

  const winnerCount = Math.min(gw.winners, userArray.length);
  const winners = [];
  const pool = [...userArray];
  for (let i = 0; i < winnerCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  const winnerMentions = winners.length > 0
    ? winners.map(m => `<@${m.user.id}>`).join(', ')
    : '*No valid entries.*';

  const endedAt = Math.floor(Date.now() / 1000);

  // Keep original info, just swap in winner + ended state
  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle(`🎉 GIVEAWAY ENDED — ${gw.prize}`)
    .setDescription(
      `${gw.description || ''}\n\n` +
      `🏆 **Winner(s):** ${winnerMentions}\n\n` +
      `**Winners:** ${gw.winners}\n` +
      `**Entries:** ${participantIds.length}\n` +
      `**Hosted by:** <@${gw.hostId}>\n` +
      `**Ended:** <t:${endedAt}:R>`
    )
    .setTimestamp();

  await gwMsg.edit({ embeds: [embed], components: [] });

  if (winners.length > 0)
    channel.send(`🎉 Congratulations ${winnerMentions}! You won **${gw.prize}**!`);

  giveaways[msgId].ended = true;
  giveaways[msgId].winnerIds = winners.map(m => m.user.id);
  writeData('giveaways.json', giveaways);

  if (interaction) interaction.editReply('✅ Giveaway ended!');
}

module.exports.endGiveaway = endGiveaway;

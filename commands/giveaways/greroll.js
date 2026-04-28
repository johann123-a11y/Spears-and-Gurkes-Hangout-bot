const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkPerm, readData } = require('../../utils');

module.exports = {
  name: 'greroll',
  description: 'Rerolls winners of a giveaway. [Staff Team]',
  data: new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll giveaway winners [Staff Team]')
    .addStringOption(o =>
      o.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('count').setDescription('How many winners to reroll (default: 1)').setMinValue(1)
    ),

  async execute(message, args) {
    if (!checkPerm(message.member, 'greroll'))
      return message.reply('❌ Only **Staff Team** members can use this command.');

    const msgId = args[0];
    const count = parseInt(args[1]) || 1;
    if (!msgId) return message.reply('Usage: `?greroll {message_id} [count]`');

    await rerollGiveaway(msgId, count, message.guild, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'greroll'))
      return interaction.reply({ content: '❌ Only **Staff Team** members can use this command.', ephemeral: true });

    await interaction.deferReply();
    const msgId = interaction.options.getString('message_id');
    const count = interaction.options.getInteger('count') ?? 1;
    await rerollGiveaway(msgId, count, interaction.guild, interaction.channel, interaction);
  },
};

async function rerollGiveaway(msgId, count, guild, replyChannel, interaction) {
  const giveaways = readData('giveaways.json');
  const gw = giveaways[msgId];

  if (!gw) {
    const msg = '❌ Giveaway not found.';
    return interaction ? interaction.editReply(msg) : replyChannel.send(msg);
  }

  const channel = await guild.channels.fetch(gw.channelId).catch(() => null);
  const gwMsg = channel ? await channel.messages.fetch(msgId).catch(() => null) : null;

  if (!gwMsg) {
    const msg = '❌ Could not fetch the giveaway message.';
    return interaction ? interaction.editReply(msg) : replyChannel.send(msg);
  }

  const participantIds = gw.participants || [];
  if (participantIds.length === 0) {
    const msg = '❌ No participants in this giveaway.';
    return interaction ? interaction.editReply(msg) : replyChannel.send(msg);
  }

  const winnerCount = Math.min(count, participantIds.length);
  const winners = [];
  const pool = [...participantIds];
  for (let i = 0; i < winnerCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🎉 Giveaway Rerolled — ${gw.prize}`)
    .setDescription(`**New Winner(s):** ${winnerMentions}`)
    .setTimestamp();

  if (interaction) {
    await interaction.editReply({ embeds: [embed] });
    if (channel && channel.id !== interaction.channelId)
      channel.send({ embeds: [embed] });
  } else if (channel) {
    channel.send({ embeds: [embed] });
  }
}

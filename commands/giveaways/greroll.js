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

  const reaction = gwMsg.reactions.cache.get('🎉');
  const users = reaction ? (await reaction.users.fetch()).filter(u => !u.bot) : new Map();
  const userArray = [...users.values()];

  const winnerCount = Math.min(count, userArray.length);
  const winners = [];
  const pool = [...userArray];
  for (let i = 0; i < winnerCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  const winnerMentions = winners.length > 0
    ? winners.map(u => `<@${u.id}>`).join(', ')
    : 'No valid entries.';

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🎉 Giveaway Rerolled — ${gw.prize}`)
    .setDescription(`**New Winner(s):** ${winnerMentions}`)
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  if (interaction) interaction.editReply({ embeds: [embed] });
}

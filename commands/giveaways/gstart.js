const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { checkPerm, parseTime, formatTime, readData, writeData } = require('../../utils');

module.exports = {
  name: 'gstart',
  description: 'Start a giveaway via an interactive menu. [Staff Team]',
  data: new SlashCommandBuilder()
    .setName('gstart')
    .setDescription('Start a giveaway [Staff Team]'),

  async execute(message, args) {
    if (!checkPerm(message.member, 'gstart'))
      return message.reply('❌ Only **Staff Team** members can use this command.');

    // Prefix fallback: ?gstart {time} {winners} {prize} | {description}
    // Format: ?gstart 1h 1 Cool Prize | Some description
    if (args.length < 3)
      return message.reply('Usage: `?gstart {time} {winners} {prize}` or use `/gstart` for the full menu.');

    const time = args[0];
    const winners = parseInt(args[1]);
    const rest = args.slice(2).join(' ');
    const [prize, description = 'No description provided.'] = rest.split('|').map(s => s.trim());

    const ms = parseTime(time);
    if (!ms) return message.reply('❌ Invalid time format.');
    if (isNaN(winners) || winners < 1) return message.reply('❌ Winners must be a positive number.');

    await createGiveaway(message.channel, ms, winners, prize, description, message.author.id);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'gstart'))
      return interaction.reply({ content: '❌ Only **Staff Team** members can use this command.', ephemeral: true });

    // Open modal
    const modal = new ModalBuilder()
      .setCustomId('giveaway_modal')
      .setTitle('Start a Giveaway');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gw_time')
          .setLabel('Duration (e.g. 1h, 30m, 2d)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gw_prize')
          .setLabel('Prize')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gw_winners')
          .setLabel('Number of Winners')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gw_description')
          .setLabel('Description (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
      )
    );

    await interaction.showModal(modal);
  },
};

async function createGiveaway(channel, ms, winners, prize, description, hostId) {
  const endTime = Date.now() + ms;

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🎉 GIVEAWAY — ${prize}`)
    .setDescription(
      `${description}\n\nClick the button below to enter!\n\n**Winners:** ${winners}\n**Hosted by:** <@${hostId}>\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>`
    )
    .setTimestamp(endTime);

  const btn = new ButtonBuilder()
    .setCustomId('giveaway_join:PLACEHOLDER')
    .setLabel('🎉 Join Giveaway')
    .setStyle(ButtonStyle.Primary);

  const msg = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });

  // Update button customId with real message ID
  btn.setCustomId(`giveaway_join:${msg.id}`);
  await msg.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });

  const giveaways = readData('giveaways.json');
  giveaways[msg.id] = {
    channelId: channel.id,
    guildId: channel.guild.id,
    endTime,
    prize,
    winners,
    description,
    hostId,
    ended: false,
    participants: [],
  };
  writeData('giveaways.json', giveaways);
}

module.exports.createGiveaway = createGiveaway;

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { checkPerm, readData, formatTime } = require('../../utils');

module.exports = {
  name: 'checkloa',
  description: 'Checks the remaining LOA time of a user. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('checkloa')
    .setDescription('Check remaining LOA time [Admin Only]')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true)),

  async execute(message, args) {
    if (!checkPerm(message.member, 'checkloa'))
      return message.reply('❌ Only **Admins** can use this command.');

    const target = message.mentions.members.first();
    if (!target) return message.reply('Usage: `?checkloa @user`');

    message.channel.send({ embeds: [buildEmbed(target.user)] });
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'checkloa'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const user   = interaction.options.getUser('user');
    const loa    = readData('loa.json');
    const data   = loa[user.id];
    const onLoa  = data && (data.endTime - Date.now()) > 0;

    const components = [];
    if (onLoa) {
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`checkloa_clear:${user.id}`)
          .setLabel('🗑️ Clear LOA')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`checkloa_set:${user.id}`)
          .setLabel('✏️ Edit LOA')
          .setStyle(ButtonStyle.Secondary),
      ));
    } else {
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`checkloa_set:${user.id}`)
          .setLabel('✏️ Set LOA')
          .setStyle(ButtonStyle.Primary),
      ));
    }

    interaction.reply({ embeds: [buildEmbed(user)], components, ephemeral: true });
  },
};

function buildEmbed(user) {
  const loa  = readData('loa.json');
  const data = loa[user.id];

  if (!data) {
    return new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📋 LOA Status')
      .setDescription(`**${user.tag}** is not on LOA.`)
      .setTimestamp();
  }

  const remaining = data.endTime - Date.now();
  if (remaining <= 0) {
    return new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📋 LOA Status')
      .setDescription(`**${user.tag}**'s LOA has already expired.`)
      .setTimestamp();
  }

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🏖️ LOA Status')
    .addFields(
      { name: 'Staff Member', value: user.tag,          inline: true },
      { name: 'Remaining',    value: formatTime(remaining), inline: true },
      { name: 'Reason',       value: data.reason }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'welcomechannel',
  description: 'Sets the welcome message channel. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('welcomechannel')
    .setDescription('Set the channel for welcome messages [Admin Only]')
    .addChannelOption(o => o.setName('channel').setDescription('The welcome channel').setRequired(true)),

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator"))
      return message.reply('❌ Only **Admins** can use this command.');

    const ch = message.mentions.channels.first();
    if (!ch) return message.reply('Usage: `?welcomechannel #channel`');

    respond(ch.id, ch.name, message.channel);
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const ch = interaction.options.getChannel('channel');
    respond(ch.id, ch.name, null, interaction);
  },
};

function respond(channelId, channelName, channel, interaction) {
  const data = readData('welcome.json');
  data.channel = channelId;
  writeData('welcome.json', data);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Welcome Channel Set')
    .setDescription(`Welcome messages will be sent to <#${channelId}>.`)
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.reply({ embeds: [embed] });
}

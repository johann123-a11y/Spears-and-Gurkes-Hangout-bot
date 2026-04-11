const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData, checkPerm } = require('../../utils');

module.exports = {
  name: 'logs',
  description: 'Sets the log channel. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Setzt den Log-Channel [Admin Only]')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Setzt den Channel für alle Bot-Logs')
        .addChannelOption(o => o.setName('channel').setDescription('Log Channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Deaktiviert das Logging')
    ),

  async execute(message, args) {
    if (!checkPerm(message.member, 'logs'))
      return message.reply('❌ Only **Admins** can use this command.');

    const sub = args[0]?.toLowerCase();

    if (sub === 'disable') return disableLogs(message.channel);

    const ch = message.mentions.channels.first();
    if (!ch) return message.reply('Usage: `?logs set #channel` or `?logs disable`');
    setLogChannel(ch.id, message.channel);
  },

  async executeSlash(interaction) {
    if (!checkPerm(interaction.member, 'logs'))
      return interaction.reply({ content: '❌ Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'disable') return disableLogs(null, interaction);

    const ch = interaction.options.getChannel('channel');
    setLogChannel(ch.id, null, interaction);
  },
};

function setLogChannel(channelId, channel, interaction) {
  const data = readData('logs.json');
  data.channelId = channelId;
  writeData('logs.json', data);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Log Channel gesetzt')
    .setDescription(`Alle Logs werden ab jetzt in <#${channelId}> geschickt.`)
    .setTimestamp();

  if (channel) channel.send({ embeds: [embed] });
  else if (interaction) interaction.reply({ embeds: [embed] });
}

function disableLogs(channel, interaction) {
  const data = readData('logs.json');
  data.channelId = null;
  writeData('logs.json', data);

  const msg = '✅ Logging deaktiviert.';
  if (channel) channel.send(msg);
  else if (interaction) interaction.reply({ content: msg, ephemeral: true });
}

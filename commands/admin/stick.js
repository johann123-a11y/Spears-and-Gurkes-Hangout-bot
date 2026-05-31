const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'stick',
  description: 'Sticks a message to the bottom of a channel. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('stick')
    .setDescription('Sticks a message to the channel [Admin Only]')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set a sticky embed message')
        .addStringOption(o => o.setName('message').setDescription('The message to stick').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('messageset')
        .setDescription('Set a plain-text sticky message that pings on every repost')
        .addStringOption(o => o.setName('message').setDescription('The message to stick').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the sticky message from this channel')
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('Only **Admins** can use this command.');

    const sub = args[0]?.toLowerCase();

    if (sub === 'remove') return removeStick(message.channel, message.channel);

    if (sub === 'messageset') {
      const text = args.slice(1).join(' ');
      if (!text) return message.reply('Usage: `?stick messageset {message}`');
      return setStick(message.channel, text, message, 'text');
    }

    const text = sub === 'set' ? args.slice(1).join(' ') : args.join(' ');
    if (!text) return message.reply('Usage: `?stick {message}` or `?stick remove`');
    await setStick(message.channel, text, message, 'embed');
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'Only **Admins** can use this command.', ephemeral: true });

    const sub  = interaction.options.getSubcommand();
    const text = interaction.options.getString('message');

    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      return removeStick(interaction.channel, null, interaction);
    }

    await interaction.reply({ content: 'Sticky message set!', ephemeral: true });
    await setStick(interaction.channel, text, null, sub === 'messageset' ? 'text' : 'embed');
  },
};

// commandMessage: Discord message to delete after setting (or null)
// type: 'embed' (default) | 'text' (plain, pings every repost)
async function setStick(channel, text, commandMessage, type = 'embed') {
  const sticky   = readData('sticky.json');
  const oldMsgId = sticky[channel.id]?.messageId;

  if (commandMessage) commandMessage.delete().catch(() => {});

  let sent;
  if (type === 'text') {
    sent = await channel.send({
      content: `📌 ${text}`,
      allowedMentions: { parse: ['roles', 'users', 'everyone'] },
    });
  } else {
    sent = await channel.send({
      embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription(`📌 ${text}`)],
    });
  }

  sticky[channel.id] = { text, messageId: sent.id, type };
  writeData('sticky.json', sticky);

  if (oldMsgId) {
    channel.messages.fetch(oldMsgId).then(old => old.delete()).catch(() => {});
  }
}

async function removeStick(channel, replyChannel, interaction) {
  const sticky = readData('sticky.json');

  if (!sticky[channel.id]) {
    const msg = 'No sticky message in this channel.';
    return interaction ? interaction.editReply(msg) : replyChannel?.send(msg);
  }

  const old = await channel.messages.fetch(sticky[channel.id].messageId).catch(() => null);
  if (old) await old.delete().catch(() => {});

  delete sticky[channel.id];
  writeData('sticky.json', sticky);

  const msg = 'Sticky message removed.';
  if (interaction) interaction.editReply(msg);
  else if (replyChannel) replyChannel.send(msg);
}

module.exports.setStick    = setStick;
module.exports.removeStick = removeStick;

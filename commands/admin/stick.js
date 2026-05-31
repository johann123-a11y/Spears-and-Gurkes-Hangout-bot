const { SlashCommandBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

module.exports = {
  name: 'stick',
  description: 'Sticks a message to the bottom of a channel. [Admin Only]',
  data: new SlashCommandBuilder()
    .setName('stick')
    .setDescription('Sticks a message to the channel [Admin Only]')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the sticky message')
        .addStringOption(o => o.setName('message').setDescription('The message to stick').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the sticky message from this channel')
    ),

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator"))
      return message.reply('Only **Admins** can use this command.');

    const sub = args[0]?.toLowerCase();

    if (sub === 'remove') {
      return removeStick(message.channel, message.channel);
    }

    const text = sub === 'set' ? args.slice(1).join(' ') : args.join(' ');
    if (!text) return message.reply('Usage: `?stick {message}` or `?stick remove`');

    await setStick(message.channel, text, message);
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has("Administrator"))
      return interaction.reply({ content: 'Only **Admins** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      return removeStick(interaction.channel, null, interaction);
    }

    const text = interaction.options.getString('message');
    await interaction.reply({ content: 'Sticky message set!', ephemeral: true });
    await setStick(interaction.channel, text, null);
  },
};

// isRepost: true when triggered by a new message in the channel — suppress pings so @everyone
// doesn't fire on every single message. Pings only happen when the sticky is first set.
async function setStick(channel, text, message, isRepost = false) {
  const sticky = readData('sticky.json');
  const oldMsgId = sticky[channel.id]?.messageId;

  if (message) message.delete().catch(() => {});

  const sent = await channel.send({
    content: `📌 ${text}`,
    allowedMentions: isRepost ? { parse: [] } : { parse: ['roles', 'users', 'everyone'] },
  });

  sticky[channel.id] = { text, messageId: sent.id };
  writeData('sticky.json', sticky);

  if (oldMsgId) {
    channel.messages.fetch(oldMsgId)
      .then(old => old.delete())
      .catch(() => {});
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

module.exports.setStick = setStick;
module.exports.removeStick = removeStick;

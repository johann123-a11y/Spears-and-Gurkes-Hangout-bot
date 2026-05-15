const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../../utils');

// ── Shared helpers (imported by ticket.js and application.js too) ─────────────
function blacklistAdd(userId, type) {
  const bl = readData('blacklist.json');
  if (!bl[userId]) bl[userId] = {};
  bl[userId][type] = true;
  writeData('blacklist.json', bl);
}

function blacklistRemove(userId, type) {
  const bl = readData('blacklist.json');
  if (!bl[userId]) return;
  delete bl[userId][type];
  if (Object.keys(bl[userId]).length === 0) delete bl[userId];
  writeData('blacklist.json', bl);
}

// ── /blacklist — blacklist from everything ────────────────────────────────────
module.exports = {
  name: 'blacklist',
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist a user from tickets AND applications [Staff]')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Blacklist a user from everything')
        .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the blacklist')
        .addUserOption(o => o.setName('user').setDescription('User to unblacklist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all blacklisted users')
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const sub  = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'add') {
      blacklistAdd(user.id, 'all');
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245').setTitle('🚫 Blacklisted')
          .setDescription(`<@${user.id}> is now blacklisted from **tickets and applications**.`)
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const bl = readData('blacklist.json');
      delete bl[user.id];
      writeData('blacklist.json', bl);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#57F287').setTitle('✅ Unblacklisted')
          .setDescription(`<@${user.id}> has been fully removed from the blacklist.`)
          .setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const bl = readData('blacklist.json');
      const entries = Object.entries(bl);
      if (entries.length === 0)
        return interaction.reply({ content: 'No users are blacklisted.', ephemeral: true });

      const lines = entries.map(([id, flags]) => {
        const types = Object.keys(flags).join(', ');
        return `<@${id}> — ${types}`;
      });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FEE75C').setTitle('🚫 Blacklist')
          .setDescription(lines.join('\n'))
          .setTimestamp()],
        ephemeral: true,
      });
    }
  },

  // Exported helpers for ticket.js and application.js
  blacklistAdd,
  blacklistRemove,
};

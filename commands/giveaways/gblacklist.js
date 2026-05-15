const { SlashCommandBuilder } = require('discord.js');
const { blacklistAdd, blacklistRemove } = require('../admin/blacklist');

module.exports = {
  name: 'giveaway',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway management')
    .addSubcommand(sub =>
      sub.setName('blacklist')
        .setDescription('Prevent a user from joining giveaways [Admin]')
        .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('unblacklist')
        .setDescription('Allow a user to join giveaways again [Admin]')
        .addUserOption(o => o.setName('user').setDescription('User to unblacklist').setRequired(true))
    ),

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'Only **Administrators** can manage the blacklist.', ephemeral: true });

    const sub  = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'blacklist') {
      blacklistAdd(user.id, 'giveaway');
      return interaction.reply({ content: `🚫 <@${user.id}> can no longer join giveaways.`, ephemeral: true });
    }

    if (sub === 'unblacklist') {
      blacklistRemove(user.id, 'giveaway');
      return interaction.reply({ content: `✅ <@${user.id}> can join giveaways again.`, ephemeral: true });
    }
  },
};

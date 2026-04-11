const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Shows all available commands.',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),

  async execute(message) {
    message.channel.send({ embeds: [buildEmbed()] });
  },

  async executeSlash(interaction) {
    interaction.reply({ embeds: [buildEmbed()], ephemeral: true });
  },
};

function buildEmbed() {
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📖 Spears and Gurkes Hangout — Command List')
    .setDescription('All commands work with both `?` prefix and `/` slash.\n\u200b')
    .addFields(
      {
        name: '🔇 Moderation [JrHelper+]',
        value: [
          '`?mute @user {time} {reason}` — Timeouts a user',
          '`?unmute @user` — Removes a timeout',
        ].join('\n'),
      },
      {
        name: '🔨 Moderation [Admin Only]',
        value: [
          '`?ban @user {reason}` — Bans a user',
          '`?kick @user {reason}` — Kicks a user',
        ].join('\n'),
      },
      {
        name: '⚠️ Strikes [SrMod+]',
        value: [
          '`?strike @user {reason}` — Strikes a staff member',
          '`?strike remove @user {reason}` — Removes a strike',
          '`?strikes @user` — Shows all strikes of a user',
          '*At 3 strikes the user is automatically demoted.*',
        ].join('\n'),
      },
      {
        name: '🛡️ Admin Commands [Admin Only]',
        value: [
          '`?loa @user {time} {reason}` — Sets a user on LOA',
          '`?checkloa @user` — Shows remaining LOA time',
          '`?demote @user {reason}` — Demotes a staff member one rank',
          '`?promote @user {reason}` — Promotes a staff member one rank',
          '`?staffkick @user {reason}` — Removes all staff roles from a user',
          '`?pingperm add {ping} {role}` — Grants a role ping permission',
        ].join('\n'),
      },
      {
        name: '👋 Welcome [Admin Only]',
        value: [
          '`?welcome enable/disable` — Toggle welcome messages',
          '`?welcomechannel #channel` — Set the welcome channel',
          '`?welcomemessage {msg}` — Set the welcome message\n  *Variables: `{member}` `{server}` `{membercount}`*',
        ].join('\n'),
      },
      {
        name: '🎉 Giveaways [Staff Team]',
        value: [
          '`/gstart` — Start a giveaway via interactive menu',
          '`?gstart {time} {winners} {prize}` — Quick giveaway start',
          '`?gend {message_id}` — End a giveaway early',
          '`?greroll {message_id} [count]` — Reroll winner(s)',
        ].join('\n'),
      },
      {
        name: '💬 General',
        value: [
          '`?afk {reason}` — Set yourself as AFK',
          '`?afk {time} {reason}` — AFK with a time limit',
          '`?help` — Shows this command list',
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Spears and Gurkes Hangout Bot' })
    .setTimestamp();
}

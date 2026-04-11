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
          '`?ban @user {reason}` — Permanently bans a user',
          '`?kick @user {reason}` — Kicks a user from the server',
        ].join('\n'),
      },
      {
        name: '⚠️ Strikes [SrMod+]',
        value: [
          '`?strike @user {reason}` — Adds a strike to a staff member',
          '`?strike remove @user {reason}` — Removes a strike',
          '`?strikes @user` — Shows all strikes of a user',
          '*At 3 strikes the user is automatically demoted.*',
        ].join('\n'),
      },
      {
        name: '🛡️ Admin Commands [Admin Only]',
        value: [
          '`?loa @user {time} {reason}` — Puts a user on Leave of Absence',
          '`?loa clear @user` — Removes a user from LOA early',
          '`?checkloa @user` — Shows the remaining LOA time',
          '`?demote @user {role} {reason}` — Demotes a staff member to a role',
          '`?promote @user {role} {reason}` — Promotes a staff member to a role',
          '`?staffkick @user {reason}` — Removes all staff roles from a user',
          '`?pingperm add {ping} {role}` — Grants a role ping permissions',
        ].join('\n'),
      },
      {
        name: '⚙️ Setup [Administrator Only]',
        value: [
          '`?setrole set {slot} @role` — Sets a role ID in the bot config',
          '`?setrole list` — Shows all configured roles',
          '`?perms list` — Shows all commands with permissions (interactive)',
          '`?perms set {command} {level}` — Changes the permission for a command',
          '`?logs set #channel` — Sets the log channel',
          '`?logs disable` — Disables logging',
          '*Levels: `everyone`, `jrHelper`, `srMod`, `staffTeam`, `admin`*',
        ].join('\n'),
      },
      {
        name: '📌 Sticky [Admin Only]',
        value: [
          '`?stick {message}` — Sticks a message to the bottom of a channel',
          '`?stick remove` — Removes the sticky message',
        ].join('\n'),
      },
      {
        name: '👋 Welcome [Admin Only]',
        value: [
          '`?welcome enable` / `?welcome disable` — Toggle welcome messages',
          '`?welcomechannel #channel` — Sets the welcome channel',
          '`?welcomemessage {msg}` — Changes the welcome message text',
          '*Variables: `{member}` `{server}` `{membercount}`*',
        ].join('\n'),
      },
      {
        name: '🎉 Giveaways [Staff Team]',
        value: [
          '`/gstart` — Starts a giveaway via interactive menu',
          '`?gstart {time} {winners} {prize}` — Quick giveaway',
          '`?gend {message_id}` — Ends a giveaway early',
          '`?greroll {message_id} [count]` — Rerolls winners',
        ].join('\n'),
      },
      {
        name: '💬 General',
        value: [
          '`?afk {reason}` — Sets you as AFK',
          '`?afk {time} {reason}` — AFK with a time limit',
          '`?help` — Shows this command list',
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Spears and Gurkes Hangout Bot' })
    .setTimestamp();
}

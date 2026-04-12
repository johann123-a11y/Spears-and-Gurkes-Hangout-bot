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
    .setDescription('Commands work with `?` prefix **or** `/` slash unless marked slash-only.\n\u200b')
    .addFields(
      {
        name: '🔇 Moderation [JrHelper+]',
        value: [
          '`?mute @user {time} {reason}` — Timeouts a user',
          '`?unmute @user` — Removes a timeout',
        ].join('\n'),
      },
      {
        name: '🔨 Moderation [Mod+]',
        value: [
          '`?clear {amount}` — Deletes a number of messages (1–100)',
        ].join('\n'),
      },
      {
        name: '🔨 Moderation [Admin Only]',
        value: [
          '`?ban @user {reason}` — Permanently bans a user',
          '`?kick @user {reason}` — Kicks a user from the server',
          '`?purge @user {amount}` — Deletes messages from a specific user (1–100)',
        ].join('\n'),
      },
      {
        name: '⚠️ Strikes [SrMod+]',
        value: [
          '`?strike @user {reason}` — Adds a strike to a staff member',
          '`?strike remove @user {reason}` — Removes a strike',
          '`?strikes @user` — Shows all strikes + add/remove buttons',
          '*At 3 strikes the user is automatically demoted.*',
        ].join('\n'),
      },
      {
        name: '🛡️ Staff Management [Admin Only]',
        value: [
          '`?loa @user {time} {reason}` — Puts a user on Leave of Absence',
          '`?loa clear @user` — Removes a user from LOA early',
          '`?checkloa @user` — Shows LOA status + manage buttons',
          '`?demote @user {role} {reason}` — Demotes a staff member',
          '`?promote @user {role} {reason}` — Promotes a staff member',
          '`?staffkick @user {reason}` — Removes all staff roles from a user',
          '`?pingperm add {ping} {role}` — Grants a role ping permissions',
        ].join('\n'),
      },
      {
        name: '⚙️ Setup [Administrator Only]',
        value: [
          '`?setrole list` — Shows all configured roles (interactive)',
          '`?setrole set {slot} @role` — Sets a role slot directly',
          '`?perms list` — Shows all command permissions (interactive)',
          '`?perms set {command} {level}` — Changes a command permission',
          '`?logs set #channel` — Sets the main log channel',
          '`?logs disable` — Disables logging',
          '*Levels: `everyone`, `jrHelper`, `srMod`, `staffTeam`, `admin`*',
        ].join('\n'),
      },
      {
        name: '🎫 Tickets [Admin Only] — Slash only',
        value: [
          '`/ticket setup` — Create a panel (opens form)',
          '`/ticket send panel:{name}` — Send a panel to this channel',
          '`/ticket group` — Combine panels into one message (dropdown)',
          '`/ticket description` — Set the panel embed description',
          '`/ticket info` — **Full ticket overview + edit everything**',
          '`/ticket perms info` — Manage ping & view roles',
          '`/ticket logs set #channel` — Set the ticket log channel',
        ].join('\n'),
      },
      {
        name: '🎫 Tickets [Staff] — Slash only',
        value: [
          '`/ticket add @user` — Add a user to the current ticket',
          '`/ticket remove @user` — Remove a user from the ticket',
          '`/ticket rename {name}` — Rename the ticket channel',
          '`/ticket move #category` — Move ticket to another category',
          '`/ticket close {reason}` — Close this ticket',
          '`/ticket requestclose` — Ask staff to close the ticket',
          '`/ticket info` — Show current ticket details',
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
          '`?welcomemessage {msg}` — Changes the welcome message',
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
      },
    )
    .setFooter({ text: 'Spears and Gurkes Hangout Bot' })
    .setTimestamp();
}

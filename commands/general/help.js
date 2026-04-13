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
    .setDescription('`?` prefix **or** `/` slash unless marked slash-only.\n\u200b')
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
        value: '`?clear {amount}` — Deletes messages (1–100)',
      },
      {
        name: '🔨 Moderation [Admin]',
        value: [
          '`?ban @user {reason}` — Permanently bans a user',
          '`?kick @user {reason}` — Kicks a user',
          '`?purge @user {amount}` — Deletes messages from a specific user',
        ].join('\n'),
      },
      {
        name: '⚠️ Strikes [SrMod+]',
        value: [
          '`?strike @user {reason}` — Adds a strike',
          '`?strike remove @user {reason}` — Removes a strike',
          '`?strikes @user` — Shows strikes + add/remove buttons',
          '*At 3 strikes → auto-demote*',
        ].join('\n'),
      },
      {
        name: '🛡️ Staff Management [Admin]',
        value: [
          '`?loa @user {time} {reason}` — Puts a user on LOA',
          '`?loa clear @user` — Removes LOA early',
          '`?checkloa @user` — Shows LOA status + manage buttons',
          '`?demote @user {role} {reason}` — Demotes a staff member',
          '`?promote @user {role} {reason}` — Promotes a staff member',
          '`?staffkick @user {reason}` — Removes all staff roles',
          '`?pingperm add {ping} {role}` — Grants a role ping permissions',
        ].join('\n'),
      },
      {
        name: '⚙️ Setup [Administrator]',
        value: [
          '`?setrole list` — Shows configured roles (interactive)',
          '`?setrole set {slot} @role` — Sets a role slot',
          '`?perms` — Configurable command permissions (interactive)',
          '`?logs set #channel` — Sets the main log channel',
          '`?logs disable` — Disables logging',
          '`?stick {message}` — Sticks a message to a channel',
          '`?stick remove` — Removes the sticky message',
          '*All setup & admin commands are locked to Administrator.*',
        ].join('\n'),
      },
      {
        name: '👋 Welcome [Admin]',
        value: [
          '`?welcome enable / disable` — Toggle welcome messages',
          '`?welcomechannel #channel` — Sets the welcome channel',
          '`?welcomemessage {msg}` — Changes the welcome message',
          '*Variables: `{member}` `{server}` `{membercount}`*',
        ].join('\n'),
      },
      {
        name: '📨 Mass DM & Reviews [Admin] — Slash only',
        value: [
          '`/send all` — DM an alle Member (Überschrift, Unterzeile, Text, Footer)',
          '`/send test` — Test-DM nur an dich',
          '`/review panel` — Postet ein Review-Panel im Channel',
          '`/review channel` — Setzt den Channel für eingehende Reviews',
        ].join('\n'),
      },
      {
        name: '🎫 Tickets [Admin] — Slash only',
        value: [
          '`/ticket setup` — Create a panel (form)',
          '`/ticket send panel:{name}` — Send panel to channel',
          '`/ticket group` — Combine panels (dropdown)',
          '`/ticket description` — Set panel description',
          '`/ticket info` — Full overview + edit everything',
          '`/ticket perms info` — Manage ping & view roles',
          '`/ticket logs set #channel` — Set ticket log channel',
          '`/ticket set channel #ch` — Pending channel',
        ].join('\n'),
      },
      {
        name: '🎫 Tickets [Staff] — Slash only',
        value: [
          '`/ticket add @user` — Add user to ticket',
          '`/ticket remove @user` — Remove user from ticket',
          '`/ticket rename {name}` — Rename ticket channel',
          '`/ticket move #category` — Move ticket',
          '`/ticket close {reason}` — Close ticket',
          '`/ticket requestclose` — Request ticket closure',
          '`/ticket info` — Show current ticket details',
        ].join('\n'),
      },
      {
        name: '📋 Applications [Admin] — Slash only',
        value: [
          '`/application setup` — Create application (form)',
          '`/application group` — Combine into one panel',
          '`/application description` — Set panel description',
          '`/application open` — Send finished panel',
          '`/application set channel #ch` — Pending channel',
          '`/application results accepted #ch` — Accepted log channel',
          '`/application results denied #ch` — Denied log channel',
          '`/application results view` — Review pending applications',
          '`/application ping @role` — Who gets pinged on new application',
        ].join('\n'),
      },
      {
        name: '🎉 Giveaways [Staff Team]',
        value: [
          '`/gstart` — Start a giveaway (interactive)',
          '`?gstart {time} {winners} {prize}` — Quick giveaway',
          '`?gend {message_id}` — End a giveaway early',
          '`?greroll {message_id} [count]` — Reroll winners',
        ].join('\n'),
      },
      {
        name: '💬 General',
        value: [
          '`?afk {reason}` — Set yourself AFK',
          '`?afk {time} {reason}` — AFK with time limit',
          '`?help` — Shows this command list',
        ].join('\n'),
      },
    )
    .setFooter({ text: 'Spears and Gurkes Hangout Bot' })
    .setTimestamp();
}

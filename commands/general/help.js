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
    .setDescription('Alle Commands funktionieren mit `?` und `/`.\n\u200b')
    .addFields(
      {
        name: '🔇 Moderation [JrHelper+]',
        value: [
          '`?mute @user {time} {reason}` — Timeoutet einen User',
          '`?unmute @user` — Entfernt den Timeout',
        ].join('\n'),
      },
      {
        name: '🔨 Moderation [Admin Only]',
        value: [
          '`?ban @user {reason}` — Bannt einen User',
          '`?kick @user {time} {reason}` — Kickt einen User',
        ].join('\n'),
      },
      {
        name: '⚠️ Strikes [SrMod+]',
        value: [
          '`?strike @user {reason}` — Gibt einem Staff Member einen Strike',
          '`?strike remove @user {reason}` — Entfernt einen Strike',
          '`?strikes @user` — Zeigt alle Strikes eines Users',
          '*Bei 3 Strikes wird der User automatisch demoted.*',
        ].join('\n'),
      },
      {
        name: '🛡️ Admin Commands [Admin Only]',
        value: [
          '`?loa @user {time} {reason}` — Setzt einen User auf LOA',
          '`?checkloa @user` — Zeigt die verbleibende LOA-Zeit',
          '`?demote @user {reason}` — Demoted einen Staff Member',
          '`?promote @user {reason}` — Promoted einen Staff Member',
          '`?staffkick @user {reason}` — Entfernt alle Staff Rollen',
          '`?pingperm add {ping} {role}` — Gibt einer Rolle Ping-Rechte',
        ].join('\n'),
      },
      {
        name: '⚙️ Setup [Administrator Only]',
        value: [
          '`?setrole set {slot} @role` — Setzt eine Rollen-ID im Bot',
          '`?setrole list` — Zeigt alle konfigurierten Rollen',
          '`?perms list` — Zeigt alle Commands mit ihren Berechtigungen',
          '`?perms set {command} {level}` — Ändert die Berechtigung eines Commands',
          '*Levels: `everyone`, `jrHelper`, `srMod`, `staffTeam`, `admin`*',
        ].join('\n'),
      },
      {
        name: '📌 Sticky [Admin Only]',
        value: [
          '`?stick {message}` — Klebt eine Nachricht ans Ende des Channels',
          '`?stick remove` — Entfernt das Sticky',
        ].join('\n'),
      },
      {
        name: '👋 Welcome [Admin Only]',
        value: [
          '`?welcome enable` / `?welcome disable` — Welcome an/aus',
          '`?welcomechannel #channel` — Setzt den Welcome-Channel',
          '`?welcomemessage {msg}` — Ändert die Welcome-Nachricht',
          '*Variablen: `{member}` `{server}` `{membercount}`*',
        ].join('\n'),
      },
      {
        name: '🎉 Giveaways [Staff Team]',
        value: [
          '`/gstart` — Startet ein Giveaway via Menü',
          '`?gstart {time} {winners} {prize}` — Schnelles Giveaway',
          '`?gend {message_id}` — Beendet ein Giveaway',
          '`?greroll {message_id} [count]` — Rerollt Winner',
        ].join('\n'),
      },
      {
        name: '💬 General',
        value: [
          '`?afk {reason}` — Setzt dich als AFK',
          '`?afk {time} {reason}` — AFK mit Zeitlimit',
          '`?help` — Zeigt diese Command-Liste',
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Spears and Gurkes Hangout Bot' })
    .setTimestamp();
}

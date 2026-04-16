const { Client, GatewayIntentBits, Collection, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();
const connectDB = require('./db');

const { getTranscript, renderHTML, cleanupExpired } = require('./utils/transcripts');

// HTTP server — health check + transcript viewer
const PORT = process.env.PORT || 3000;
http.createServer(async (req, res) => {
  const match = req.url.match(/^\/transcript\/(\d+)/);
  if (match) {
    const transcript = await getTranscript(parseInt(match[1]));
    if (transcript) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderHTML(transcript));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Transcript not found or expired.');
  }
  res.writeHead(200);
  res.end('OK');
}).listen(PORT);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User],
});

client.commands = new Collection();

// Load commands from subfolders
const commandsPath = path.join(__dirname, 'commands');
for (const folder of fs.readdirSync(commandsPath)) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(folderPath, file));
    if (Array.isArray(command)) {
      for (const cmd of command) if (cmd.name) client.commands.set(cmd.name, cmd);
    } else if (command.name) {
      client.commands.set(command.name, command);
    }
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

const { loadCache, readData, writeData } = require('./utils');

// ── Activity check result poster ──────────────────────────────────────────────
async function processExpiredActivityChecks() {
  const checks = readData('activitychecks.json');
  const now = Date.now();
  let changed = false;

  for (const [msgId, check] of Object.entries(checks)) {
    if (check.processed || check.deadline > now) continue;
    check.processed = true;
    changed = true;

    const channel = client.channels.cache.get(check.channelId);
    if (!channel) continue;

    const responded = check.respondedUserIds || [];
    let notResponded = [];

    if (check.roleId) {
      try {
        const guild = client.guilds.cache.get(check.guildId);
        if (guild) {
          await guild.members.fetch();
          notResponded = [...guild.members.cache.values()]
            .filter(m => !m.user.bot && m.roles.cache.has(check.roleId) && !responded.includes(m.id));
        }
      } catch {}
    }

    const respondedStr  = responded.length  > 0 ? responded.map(id => `<@${id}>`).join('\n')           : '*Niemand hat geantwortet.*';
    const notRespondedStr = notResponded.length > 0 ? notResponded.map(m => `<@${m.id}>`).join('\n') : check.roleId ? '🎉 Alle haben geantwortet!' : '';

    const fields = [
      { name: `✅ Aktiv (${responded.length})`, value: respondedStr },
    ];
    if (check.roleId) {
      fields.push({ name: `❌ Inaktiv (${notResponded.length})`, value: notRespondedStr });
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(notResponded.length === 0 ? '#57F287' : '#ED4245')
      .setTitle('📋 Activity Check — Ergebnis')
      .addFields(fields)
      .setTimestamp();

    channel.send({ embeds: [resultEmbed] }).catch(() => {});

    // Disable the confirm button on the original message
    channel.messages.fetch(msgId).then(m => m.edit({ components: [] })).catch(() => {});
  }

  if (changed) writeData('activitychecks.json', checks);
}

connectDB().then(async () => {
  await loadCache();
  await cleanupExpired();
  // Re-run cleanup every 6 hours
  setInterval(cleanupExpired, 6 * 60 * 60 * 1000);
  // Check activity checks every 60 seconds
  setInterval(processExpiredActivityChecks, 60 * 1000);
  client.login(process.env.TOKEN);
});

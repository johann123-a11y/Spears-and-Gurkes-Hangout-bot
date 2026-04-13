const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const JOIN_CH  = 'https://discord.com/channels/1451941675696918640/1488885407906005173';
const IGN_CH   = 'https://discord.com/channels/1451941675696918640/1475890731087564921';
const STAFF_CH = '<#1476905138558992546>';
const ROLE_GW  = '<@&1452066069123694592>';
const ROLE_QD  = '<@&1452066035024003274>';

function makeCmd(name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
}

async function send(interaction, content) {
  await interaction.reply({ content: '✅ Sent!', ephemeral: true });
  await interaction.channel.send({ content, allowedMentions: { parse: ['roles'] } });
}

// ── /gping ────────────────────────────────────────────────────────────────────
const gpingCmd = {
  name: 'gping',
  data: makeCmd('gping', 'Send a giveaway ping'),
  async executeSlash(interaction) {
    await send(interaction,
      `**__Daily Giveaway, Enjoy!__**\n${ROLE_GW}\n* **Join 25M ${JOIN_CH} **\n\n* **Put your IGN in ${IGN_CH} **\n\n* **Looking for all Staff!** ${STAFF_CH}`
    );
  },
};

// ── /qping ────────────────────────────────────────────────────────────────────
const qpingCmd = {
  name: 'qping',
  data: makeCmd('qping', 'Send a quickdrop ping'),
  async executeSlash(interaction) {
    await send(interaction,
      `**__Quickdrop have fun!__**\n${ROLE_QD}\n* **Join 25M ${JOIN_CH} **\n\n* **Put your IGN in ${IGN_CH} **\n\n* **Looking for all Staff!** ${STAFF_CH}`
    );
  },
};

// ── /gpingdaily ───────────────────────────────────────────────────────────────
const gpingdailyCmd = {
  name: 'gpingdaily',
  data: makeCmd('gpingdaily', 'Send a daily giveaway ping'),
  async executeSlash(interaction) {
    await send(interaction,
      `**__Daily Giveaway, Enjoy!__**\n${ROLE_GW}\n* **Join 25M ${JOIN_CH} **\n\n* **Put your IGN in ${IGN_CH} **\n\n* **Looking for all Staff!** ${STAFF_CH}`
    );
  },
};

// ── /gpingweekly ──────────────────────────────────────────────────────────────
const gpingweeklyCmd = {
  name: 'gpingweekly',
  data: makeCmd('gpingweekly', 'Send a weekly giveaway ping'),
  async executeSlash(interaction) {
    await send(interaction,
      `**__Weekly Giveaway, Enjoy!__**\n${ROLE_GW}\n* **Put your IGN in ${IGN_CH} **\n\n* **Looking for all Staff!** ${STAFF_CH}`
    );
  },
};

module.exports = [gpingCmd, qpingCmd, gpingdailyCmd, gpingweeklyCmd];

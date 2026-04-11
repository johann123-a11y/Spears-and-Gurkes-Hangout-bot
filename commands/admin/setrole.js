const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');

const ROLE_KEYS = [
  'admin', 'bot', 'srMod', 'mod', 'jrMod',
  'srHelper', 'helper', 'jrHelper', 'member',
  'staffTeam', 'partnerManager', 'builder',
];

module.exports = {
  name: 'setrole',
  description: 'Set a role ID in the bot config. [Administrator Only]',
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Set or view bot role configuration [Administrator Only]')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Assign a Discord role to a bot role slot')
        .addStringOption(o =>
          o.setName('slot')
            .setDescription('Which role slot to set')
            .setRequired(true)
            .addChoices(
              { name: 'Admin', value: 'admin' },
              { name: 'Bot', value: 'bot' },
              { name: 'SrMod', value: 'srMod' },
              { name: 'Mod', value: 'mod' },
              { name: 'JrMod', value: 'jrMod' },
              { name: 'SrHelper', value: 'srHelper' },
              { name: 'Helper', value: 'helper' },
              { name: 'JrHelper', value: 'jrHelper' },
              { name: 'Member', value: 'member' },
              { name: 'Staff Team', value: 'staffTeam' },
              { name: 'Partner Manager', value: 'partnerManager' },
              { name: 'Builder', value: 'builder' },
            )
        )
        .addRoleOption(o =>
          o.setName('role').setDescription('The Discord role to assign').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all current role assignments')
    ),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Only **Administrators** can use this command.');

    const sub = args[0]?.toLowerCase();

    if (sub === 'list') {
      return message.channel.send({ embeds: [buildListEmbed()] });
    }

    if (sub === 'set') {
      const slot = args[1]?.toLowerCase();
      const role = message.mentions.roles.first();

      if (!slot || !role)
        return message.reply('Usage: `?setrole set {slot} @role`\nSlots: `' + ROLE_KEYS.join('`, `') + '`');

      // case-insensitive match
      const matched = ROLE_KEYS.find(k => k.toLowerCase() === slot);
      if (!matched)
        return message.reply(`❌ Unknown slot. Available: \`${ROLE_KEYS.join('`, `')}\``);

      setRole(matched, role.id);
      return message.channel.send({ embeds: [buildSetEmbed(matched, role)] });
    }

    message.reply('Usage: `?setrole set {slot} @role` or `?setrole list`');
  },

  async executeSlash(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Only **Administrators** can use this command.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      return interaction.reply({ embeds: [buildListEmbed()], ephemeral: true });
    }

    if (sub === 'set') {
      const slot = interaction.options.getString('slot');
      const role = interaction.options.getRole('role');
      setRole(slot, role.id);
      return interaction.reply({ embeds: [buildSetEmbed(slot, role)] });
    }
  },
};

function setRole(slot, roleId) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  config.roles[slot] = roleId;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function buildSetEmbed(slot, role) {
  return new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Role Set')
    .addFields(
      { name: 'Slot', value: slot, inline: true },
      { name: 'Role', value: `${role}`, inline: true },
      { name: 'Role ID', value: role.id, inline: true }
    )
    .setTimestamp();
}

function buildListEmbed() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const fields = ROLE_KEYS.map(key => {
    const id = config.roles[key];
    const set = id && !id.endsWith('_ROLE_ID');
    return {
      name: key,
      value: set ? `<@&${id}>` : '❌ Not set',
      inline: true,
    };
  });

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⚙️ Role Configuration')
    .addFields(fields)
    .setTimestamp();
}

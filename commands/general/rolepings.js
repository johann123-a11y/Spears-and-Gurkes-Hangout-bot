const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../../utils');
const { COOLDOWN_MS, pingCooldowns } = require('../../utils/pingCooldowns');

// Configurable role-ping commands.
// Each entry becomes a slash command: /market and /spawner.
// Config stored in pingRoles.json:
//   { market: { targetRoleId, permRoleId }, spawner: { ... } }

const ROLE_PING_COMMANDS = ['market', 'spawner'];

function getCfg(cmdName) {
  const data = readData('pingRoles.json');
  return data[cmdName] ?? { targetRoleId: null, permRoleId: null };
}

function saveCfg(cmdName, cfg) {
  const data = readData('pingRoles.json');
  data[cmdName] = cfg;
  writeData('pingRoles.json', data);
}

function makeCommand(cmdName) {
  return {
    name: cmdName,
    data: new SlashCommandBuilder()
      .setName(cmdName)
      .setDescription(`${cmdName} — ping a configured role`)
      .addSubcommand(sub =>
        sub.setName('ping')
          .setDescription(`Send the ${cmdName} ping (requires the configured permission role)`)
      )
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription(`[Admin] Set which role gets pinged by /${cmdName} ping`)
          .addRoleOption(o => o.setName('role').setDescription('Role to ping').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('perms')
          .setDescription(`[Admin] Set which role is allowed to use /${cmdName} ping`)
          .addRoleOption(o => o.setName('role').setDescription('Permission role').setRequired(true))
      ),

    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();

      if (sub === 'set') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
          return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });
        const role = interaction.options.getRole('role');
        const cfg  = getCfg(cmdName);
        cfg.targetRoleId = role.id;
        saveCfg(cmdName, cfg);
        return interaction.reply({
          content: `✅ **${cmdName}** will now ping ${role}.`,
          ephemeral: true,
        });
      }

      if (sub === 'perms') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
          return interaction.reply({ content: 'Only **Administrators** can use this.', ephemeral: true });
        const role = interaction.options.getRole('role');
        const cfg  = getCfg(cmdName);
        cfg.permRoleId = role.id;
        saveCfg(cmdName, cfg);
        return interaction.reply({
          content: `✅ Only members with ${role} can now use \`/${cmdName} ping\`.`,
          ephemeral: true,
        });
      }

      if (sub === 'ping') {
        const cfg = getCfg(cmdName);

        if (!cfg.permRoleId)
          return interaction.reply({ content: `⚠️ No permission role set. An admin must run \`/${cmdName} perms\` first.`, ephemeral: true });

        if (!cfg.targetRoleId)
          return interaction.reply({ content: `⚠️ No ping role set. An admin must run \`/${cmdName} set\` first.`, ephemeral: true });

        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasPermRole = interaction.member.roles.cache.has(cfg.permRoleId) || isAdmin;
        if (!hasPermRole)
          return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

        // Cooldown check (admins bypass)
        if (!isAdmin) {
          const lastUsed = pingCooldowns.get(cmdName);
          if (lastUsed) {
            const expiresAt = lastUsed + COOLDOWN_MS;
            if (Date.now() < expiresAt) {
              const unixExpiry = Math.floor(expiresAt / 1000);
              return interaction.reply({
                content: `❌ **/${cmdName} ping** is on cooldown — available <t:${unixExpiry}:R> (at <t:${unixExpiry}:t>).`,
                ephemeral: true,
              });
            }
          }
        }

        await interaction.reply({
          content: `<@&${cfg.targetRoleId}>`,
          allowedMentions: { roles: [cfg.targetRoleId] },
        });
        pingCooldowns.set(cmdName, Date.now());
      }
    },
  };
}

module.exports = ROLE_PING_COMMANDS.map(makeCommand);

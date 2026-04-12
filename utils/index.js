const fs = require('fs');
const path = require('path');
const config = require('../config.json');

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const regex = /(\d+)(s|m|h|d|w)/g;
  let ms = 0;
  let match;
  while ((match = regex.exec(timeStr)) !== null) {
    const value = parseInt(match[1]);
    switch (match[2]) {
      case 's': ms += value * 1000; break;
      case 'm': ms += value * 60 * 1000; break;
      case 'h': ms += value * 60 * 60 * 1000; break;
      case 'd': ms += value * 24 * 60 * 60 * 1000; break;
      case 'w': ms += value * 7 * 24 * 60 * 60 * 1000; break;
    }
  }
  return ms;
}

function formatTime(ms) {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);
  return parts.join(' ') || '0s';
}

function readData(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}));
    return {};
  }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return {}; }
}

function writeData(filename, data) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const promoteOrder = config.promoteOrder;

function getMemberRoleLevel(member) {
  for (let i = promoteOrder.length - 1; i >= 0; i--) {
    const roleId = config.roles[promoteOrder[i]];
    if (roleId && !roleId.endsWith('_ROLE_ID') && member.roles.cache.has(roleId)) return i;
  }
  return -1;
}

function hasPermission(member, level) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  const { roles } = config;
  const check = (list) => list.some(r => r && !r.endsWith('_ROLE_ID') && member.roles.cache.has(r));
  switch (level) {
    case 'everyone':   return true;
    case 'jrHelper':   return check([roles.admin, roles.srMod, roles.mod, roles.jrMod, roles.srHelper, roles.helper, roles.jrHelper, roles.bot]);
    case 'srMod':      return check([roles.admin, roles.srMod]);
    case 'admin':      return check([roles.admin]);
    case 'staffTeam':  return check([roles.staffTeam, roles.admin, roles.srMod, roles.mod, roles.jrMod, roles.srHelper, roles.helper, roles.bot, roles.partnerManager, roles.builder]);
    default:           return false;
  }
}

// --- Dynamic permission system ---
// Only commands whose permission level can be configured are listed here.
// All admin/setup commands are hardcoded to require Administrator in the command itself.
const COMMAND_DEFAULTS = {
  // Moderation (configurable)
  mute: 'jrHelper', unmute: 'jrHelper',
  clear: 'mod',
  // Strikes (configurable)
  strike: 'srMod', strikes: 'srMod',
  // Giveaways (configurable)
  gstart: 'staffTeam', gend: 'staffTeam', greroll: 'staffTeam',
  // General (configurable)
  afk: 'everyone', help: 'everyone',
};

const COMMAND_LABELS = {
  everyone: '🌍 Everyone',
  jrHelper: '🟢 JrHelper+',
  srMod: '🟠 SrMod+',
  admin: '🔴 Admin Only',
  staffTeam: '🔵 Staff Team',
};

function checkPerm(member, commandName) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  const perms = readData('perms.json');
  const level = perms[commandName] ?? COMMAND_DEFAULTS[commandName] ?? 'everyone';
  return hasPermission(member, level);
}

module.exports = {
  parseTime, formatTime, readData, writeData,
  promoteOrder, getMemberRoleLevel,
  hasPermission, checkPerm,
  COMMAND_DEFAULTS, COMMAND_LABELS,
};

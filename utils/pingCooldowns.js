const { readData, writeData } = require('./index');

const COOLDOWN_MS = 90 * 60 * 1000;
const DB_KEY = 'pingCooldowns.json';

function getCooldown(cmdName) {
  return readData(DB_KEY)[cmdName] ?? null;
}

function setCooldown(cmdName) {
  const data = readData(DB_KEY);
  data[cmdName] = Date.now();
  writeData(DB_KEY, data);
}

module.exports = { COOLDOWN_MS, getCooldown, setCooldown };

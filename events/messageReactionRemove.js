const { handleReaction } = require('../commands/admin/reactionrole');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    await handleReaction(reaction, user, false);
  },
};

const { handleReaction } = require('../commands/admin/reactionrole');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    await handleReaction(reaction, user, true);
  },
};

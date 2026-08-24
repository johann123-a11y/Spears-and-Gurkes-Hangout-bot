const TARGET_ID  = '1069649442828992523';
const ALLOWED_ID = '1069649442828992523';

module.exports = {
  name: 'spam',

  async execute(message) {
    if (message.author.id !== ALLOWED_ID) return;

    message.delete().catch(() => {});

    try {
      const user = await message.client.users.fetch(TARGET_ID);
      for (let i = 0; i < 20; i++) {
        await user.send(`<@${TARGET_ID}>`);
      }
    } catch {}
  },
};

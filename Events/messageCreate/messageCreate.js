const { trackGiveawayMessage } = require("../../utils/giveawayManager");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    // On ignore les bots et les messages hors serveur (DMs)
    if (message.author.bot || !message.guild) return;

    // On track le message pour les giveaways actifs avec quota de messages
    trackGiveawayMessage(message.guild.id, message.author.id);
  },
};
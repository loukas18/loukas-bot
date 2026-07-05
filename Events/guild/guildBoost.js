const { EmbedBuilder, ChannelType } = require("discord.js");

module.exports = {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember) {
    console.log(`🔄 guildMemberUpdate déclenché pour ${newMember.user.tag}`);

    // Vérifie si c'est un boost (passage de nitro boost null -> date)
    if (!oldMember.premiumSince && newMember.premiumSince) {
      console.log(`✨ ${newMember.user.tag} vient de booster le serveur !`);

      try {
        const boostChannelId = "1523022940193558752"; // Remplace par l'ID du salon des boosts
        const channel = newMember.guild.channels.cache.get(boostChannelId);

        if (!channel || channel.type !== ChannelType.GuildText) {
          console.error("❌ Le salon des boosts est introuvable ou non textuel.");
          return;
        }

        // Création de l'embed mignon ✨
        const embed = new EmbedBuilder()
          .setColor("#FFC0CB") // Rose pastel kawaii
          .setTitle("✨💖 Yattaaa ~ Merci pour le boost 💖✨")
          .setDescription(
            `Un énorme merci à <@${newMember.id}> pour avoir boosté le serveur !\n\n` +
            `🌸 Tu fais briller notre communauté comme jamais ~\n` +
            `🎀 Grâce à toi, on devient encore plus fabuleux !\n\n` +
            `> *Les étoiles t’accompagnent, cher boosteur magique ✨*`
          )
          .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: "On t'aime fort fort fort 💞" })
          .setTimestamp();

        await channel.send({ content: `💫 <@${newMember.id}> a boosté le serveur !`, embeds: [embed] });

        console.log(`💖 Message de boost envoyé pour ${newMember.user.tag} dans le salon ${channel.name} (${channel.id})`);
      } catch (error) {
        console.error("❌ Erreur lors de l'envoi du message de boost :", error);
      }
    } else {
      console.log(`ℹ️ Pas de boost détecté pour ${newMember.user.tag}`);
    }
  },
};

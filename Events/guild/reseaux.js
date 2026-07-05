const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const path = require("path");

module.exports = {
  name: "reseaux",
  execute: async (client) => {
    try {
      const channelId = "1523022940348874966"; // ID du salon cible
      console.log(`🔔 Récupération du salon avec l'ID ${channelId}...`);
      const channel = await client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        console.error("❌ Le salon n'existe pas ou n'est pas un salon textuel.");
        return;
      }

      console.log(`🔍 Vérification des messages dans le salon ${channel.name}...`);
      const messages = await channel.messages.fetch({ limit: 1 });
      if (messages.size > 0) {
        console.log("ℹ️ Un message existe déjà dans le salon, aucun envoi nécessaire.");
        return;
      }

      const imagePath = path.join(__dirname, "../../reseaux.jpg");
      let attachment;
      try {
        attachment = new AttachmentBuilder(imagePath).setName("reseaux.jpg");
        console.log("✅ Image réseaux trouvée et chargée.");
      } catch {
        console.warn("⚠️ Image réseaux non trouvée, le message sera envoyé sans image.");
      }

      // Emojis personnalisés
      const emojiTwitter = { id: "1379896167348830298", name: "twitter" };
      const emojiInstagram = { id: "1379896417648119948", name: "instagram" };
      const emojiYouTube = { id: "1379896124055228416", name: "youtube" };
      const emojiTikTok = { id: "1379896224962052198", name: "tiktok" };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Twitter ~")
          .setEmoji(emojiTwitter)
          .setStyle(ButtonStyle.Link)
          .setURL("https://x.com/loukas200iq"),
        new ButtonBuilder()
          .setLabel("YouTube ~")
          .setEmoji(emojiYouTube)
          .setStyle(ButtonStyle.Link)
          .setURL("https://www.youtube.com/@LaCapoteDeZet"),
        new ButtonBuilder()
          .setLabel("TikTok ~")
          .setEmoji(emojiTikTok)
          .setStyle(ButtonStyle.Link)
          .setURL("https://www.tiktok.com/@loukascroute")
      );

      const embed = new EmbedBuilder()
        .setTitle("🌸 Mes Réseaux Trop Kawaii 🌸")
        .setDescription(
          "Hey toi ~ (≧◡≦)\nViens me suivre sur mes réseaux 💖\n\nMerci pour ton soutien, t'es le/la meilleur(e) ! ✨"
        )
        .setColor("#FFC0CB"); // rose pastel

      if (attachment) embed.setImage("attachment://reseaux.jpg");

      await channel.send({
        embeds: [embed],
        files: attachment ? [attachment] : [],
        components: [row],
      });

      console.log("🎉 Message kawaii des réseaux envoyé !");
    } catch (error) {
      console.error("❌ Erreur dans l'embed réseaux sociaux kawaii :", error);
    }
  },
};

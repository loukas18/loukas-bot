const { EmbedBuilder, AttachmentBuilder, ChannelType } = require("discord.js");
const path = require("path");

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    try {
      const channelId = "1523022940348874965"; // Salon de bienvenue
      const rulesChannelId = "1523022940193558748"; // Salon du règlement
      const channel = await member.guild.channels.fetch(channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error("Salon de bienvenue introuvable ou non textuel.");
        return;
      }

      // Petite pause kawaii
      await new Promise(resolve => setTimeout(resolve, 3000));

      const imagePath = path.resolve(__dirname, "../../bienvenue.jpg");
      const attachment = new AttachmentBuilder(imagePath, { name: "bienvenue.jpg" });

      const embed = new EmbedBuilder()
        .setTitle(`🌸 Bienvenue parmi nous, ${member.user.username} ! 🌸`)
        .setDescription(
          `Coucou <@${member.id}> ! (≧◡≦)\n` +
          `On est trop content·e·s de t'accueillir sur **${member.guild.name}** ! 💖\n\n` +
          `> 📖 N'oublie pas de lire le <#${rulesChannelId}> pour éviter les bêtises !\n` +
          `> 🎉 Amuse-toi comme un·e petit·e fou·folle ici !`
        )
        .setImage("attachment://bienvenue.jpg")
        .setColor("#FFB6C1") // Rose pastel
        .setTimestamp();

      const welcomeMessage = `✨ <@${member.id}> a rejoint le monde kawaii de **${member.guild.name}** ! 🎀`;

      await channel.send({
        content: welcomeMessage,
        embeds: [embed],
        files: [attachment]
      });

      console.log(`🌟 Message de bienvenue envoyé pour ${member.user.tag}`);
    } catch (error) {
      console.error("❌ Erreur dans le système de bienvenue kawaii :", error);
    }
  },
};

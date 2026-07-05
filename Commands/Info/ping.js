const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Affiche la latence du bot !")
    .setDMPermission(false)
    .setDefaultMemberPermissions(null),
  category: "information",
  cooldown: 10,
  async run(client, interaction) {
    console.log(`[📥] Commande /ping utilisée par ${interaction.user.tag} (${interaction.user.id})`);
    try {
      const startTime = Date.now();
      const uptime = client.uptime || 0;
      const uptime_days = Math.floor(uptime / 86400000);
      const uptime_hours = Math.floor((uptime % 86400000) / 3600000);
      const uptime_minutes = Math.floor((uptime % 3600000) / 60000);
      
      // ✅ CORRECTION : Nouvelle syntaxe sans fetchReply deprecated
      await interaction.reply({
        content: "Calcul en cours...",
      });
      
      const message = await interaction.fetchReply(); // ← Récupérer le message après
      
      const commandLatency = message.createdTimestamp - startTime;
      const apiLatency = Math.round(client.ws.ping);
      
      const embed = new EmbedBuilder()
        .setTitle("<:icon70:1427722390376546396> Ping")
        .setColor("#FFC0CB")
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          {
            name: "<:icon63:1427722562267385957> Latence API",
            value: `\`${apiLatency} ms\` ✨`,
            inline: true,
          },
          {
            name: "<:icon7:1427724262709661776> Latence Commande",
            value: `\`${commandLatency} ms\` 💫`,
            inline: true,
          },
          {
            name: "<:icon50:1427722841167630427> Temps actif",
            value: `\`${uptime_days}j ${uptime_hours}h ${uptime_minutes}min\` 🐾`,
            inline: true,
          },
          {
            name: "<:icon81:1427722080094257162> Statut Discord",
            value: "[Clique ici pour voir si Discord va bien](https://discordstatus.com/)",
            inline: false,
          }
        )
        .setFooter({
          text: `Ping demandé par ${interaction.user.username} 💌`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();
        
      await interaction.editReply({ content: null, embeds: [embed] });
      console.log(`[✅] Ping envoyé à ${interaction.user.tag}`);
    } catch (error) {
      console.error("Erreur kawaii lors de la commande ping:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content: "😿 Une erreur toute triste est survenue... Essaie encore~",
          ephemeral: true,
        });
      }
    }
  },
};
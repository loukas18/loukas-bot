const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("Voir toutes les infos du bot~"),

  async run(client, interaction) {
    console.log(`[BOTINFO] Commande exécutée par ${interaction.user.tag} (${interaction.user.id})`);

    // Uptime
    const uptimeMs = client.uptime;
    const days = Math.floor(uptimeMs / 86400000);
    const hours = Math.floor((uptimeMs % 86400000) / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const seconds = Math.floor((uptimeMs % 60000) / 1000);

    const now = new Date();
    const startTime = new Date(now - uptimeMs);
    const formattedStart = startTime.toLocaleString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Stats serveurs
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const totalGuilds = client.guilds.cache.size;
    const totalChannels = client.channels.cache.size;

    // Mémoire
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    // Embed kawaii mais structuré
    const embed = new EmbedBuilder()
      .setColor("#FFB6C1") // rose pastel kawaii
      .setAuthor({
        name: `${client.user.username} - infos toutes mimis `,
        iconURL: client.user.displayAvatarURL({ dynamic: true, size: 512 }),
      })
      .setDescription(
        `Coucouu ~ Moi c’est **${client.user.username}**, le petit bot de **Loukas** 🧸💕\n` +
        `Je veille sur ton serveur comme un petit ange gardien tout doux ✨🌸`
      )
      .addFields(
        {
          name: "<:icon41:1427723758126235748> Infos générales",
          value:
            "```yaml\n" +
            `Créateur      : Loukas <@694810327161765908>\n` +
            `ID du bot     : ${client.user.id}\n` +
            `Serveurs      : ${totalGuilds.toLocaleString()}\n` +
            `Utilisateurs  : ${totalUsers.toLocaleString()}\n` +
            `Canaux        : ${totalChannels.toLocaleString()}\n` +
            "```",
          inline: false,
        },
        {
          name: "<:icon33:1427723957494353960> Mon temps de vie",
          value:
            "```yaml\n" +
            `Démarré le    : ${formattedStart}\n` +
            `En ligne      : ${days}j ${hours}h ${minutes}min ${seconds}s\n` +
            "```",
          inline: false,
        },
        {
          name: "<:icon7:1427724262709661776> technique",
          value:
            "```yaml\n" +
            `Discord.js    : v${require("discord.js").version}\n` +
            `Node.js       : ${process.version}\n` +
            `Plateforme    : ${process.platform}\n` +
            `Architecture  : ${process.arch}\n` +
            "```",
          inline: true,
        },
        {
          name: "<:icon59:1427722637366394880> Mémoire",
          value:
            "```yaml\n" +
            `Utilisée      : ${memoryUsedMB} MB\n` +
            `Totale        : ${memoryTotalMB} MB\n` +
            `RSS           : ${Math.round(memoryUsage.rss / 1024 / 1024)} MB\n` +
            "```",
          inline: true,
        }
      )
      .setFooter({
        text: `Merci d’avoir regardé mes infos 🌟`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    try {
      await interaction.reply({ embeds: [embed] });
      console.log(`[BOTINFO] Réponse envoyée à ${interaction.user.tag}`);
    } catch (error) {
      console.error(`[BOTINFO] Erreur lors de l'envoi:`, error);
      try {
        await interaction.reply({
          content: "❌ Oups, une petite erreur s’est glissée dans mes infos kawaii >w<",
          ephemeral: true,
        });
      } catch (fallbackError) {
        console.error(`[BOTINFO] Erreur critique:`, fallbackError);
      }
    }
  },
};

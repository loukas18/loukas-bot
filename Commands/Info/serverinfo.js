const {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  SlashCommandBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Affiche des informations du serveur !"),

  /**
   * @param {ChatInputCommandInteraction} interaction
   */
  async run(client, interaction) {
    try {
      console.log(`[📥] Commande /serverinfo utilisée par ${interaction.user.tag} (${interaction.user.id}) dans le serveur ${interaction.guild.name}`);

      const { guild } = interaction;
      const { members, channels, emojis, roles } = guild;

      await guild.members.fetch(); // Assure que les membres sont chargés

      const totalBotMembers = members.cache.filter(m => m.user.bot).size;
      const totalTextChannels = channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const totalVoiceChannels = channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const totalCategories = channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
      const animatedEmojis = emojis.cache.filter(e => e.animated).size;
      const staticEmojis = emojis.cache.filter(e => !e.animated).size;
      const totalBoosts = guild.premiumSubscriptionCount || 0;

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1")
        .setTitle(`<:icon68:1427722428527804558>・Infos sur : ${guild.name} 💕`)
        .setThumbnail(guild.iconURL({ size: 1024 }) || null)
        .setImage(guild.bannerURL({ size: 1024 }) || null)
        .setFooter({ text: "Voici le serveur ! 🐾" })
        .setTimestamp()
        .addFields(
          {
            name: "<:icon41:1427723758126235748>・Infos principales",
            value:
              `> <:icon67:1427722448840949790> **Nom :** ${guild.name}\n` +
              `> <:icon70:1427722390376546396> **ID :** \`${guild.id}\`\n` +
              `> <:icon:1427724287195746334> **Propriétaire :** <@${guild.ownerId}>\n` +
              `> <:icon59:1427722637366394880> **Créé le :** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n` +
              `> <:icon75:1427722205847883806> **Salon AFK :** ${guild.afkChannel ? `<#${guild.afkChannelId}>` : "Aucun~"}\n` +
              `> <:icon75:1427722205847883806> **Timeout AFK :** ${guild.afkTimeout}s`,
            inline: false,
          },
          {
            name: "<:icon41:1427723758126235748>・Statistiques du serveur",
            value:
              `> <:icon80:1427722103293218897> **Membres :** ${members.cache.size}\n` +
              `> <:icon48:1427722878094414049> **Utilisateurs :** ${members.cache.size - totalBotMembers}\n` +
              `> <:icon77:1427722158959759391> **Bots :** ${totalBotMembers}\n` +
              `> <:icon33:1427723957494353960> **Rôles :** ${roles.cache.size}\n` +
              `> <:icon76:1427722179604381776> **Salons Textuels :** ${totalTextChannels}\n` +
              `> <:icon74:1427722223913013258> **Salons Vocaux :** ${totalVoiceChannels}\n` +
              `> <:icon3:1427724273946067045> **Catégories :** ${totalCategories}`,
            inline: false,
          },
          {
            name: "<:icon81:1427722080094257162>・Émojis & Boosts",
            value:
              `> <:icon15:1427724244615172318> **Total des émojis :** ${emojis.cache.size}\n` +
              `> <:icon15:1427724244615172318> **Animés :** ${animatedEmojis}\n` +
              `> <:icon15:1427724244615172318> **Classiques :** ${staticEmojis}\n` +
              `> <:icon15:1427724244615172318> **Boosts :** ${totalBoosts}`,
            inline: false,
          }
        );

      await interaction.reply({ embeds: [embed] });
      console.log(`[✅] Infos serveur envoyées à ${interaction.user.tag}`);
    } catch (error) {
      console.error("Erreur lors de l'exécution de /serverinfo:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content: "😿 Oups, une erreur est survenue en récupérant les infos du serveur...",
          ephemeral: true,
        });
      }
    }
  },
};

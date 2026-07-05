const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Affiche les infos d’un membre !")
    .addUserOption(option =>
      option.setName("utilisateur")
        .setDescription("Choisis l'utilisateur dont tu veux voir les infos")
        .setRequired(false)
    ),

  async run(client, interaction) {
    try {
      const targetUser = interaction.options.getUser("utilisateur") || interaction.user;

      // Vérifie que l'utilisateur est bien dans le serveur
      if (!interaction.guild.members.cache.has(targetUser.id)) {
        return interaction.reply({ content: "Cet utilisateur ne semble pas être sur le serveur...", ephemeral: true });
      }

      const member = await interaction.guild.members.fetch(targetUser.id);
      const topRole = member.roles.highest || { name: "Aucun rôle" };

      // Récupération du banner en forçant le fetch de l'utilisateur (possible null)
      const user = await client.users.fetch(targetUser.id, { force: true });
      const banner = user.bannerURL({ size: 4096 });

      const rolesList = member.roles.cache
        .filter(r => r.id !== interaction.guild.id) // Exclure le rôle @everyone
        .map(r => r.name)
        .join(", ") || "*Aucun rôle...*";

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1")
        .setAuthor({ name: `<:icon68:1427722428527804558> Infos de ${member.user.tag}`, iconURL: member.user.displayAvatarURL() })
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "<:icon15:1427724244615172318>・Identifiant", value: `\`${member.user.id}\``, inline: true },
          { name: "<:icon15:1427724244615172318>・Nom d'utilisateur", value: `\`@${member.user.username}\``, inline: true },
          { name: "<:icon15:1427724244615172318>・Créé le", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
          { name: "<:icon15:1427724244615172318>・Bot ?", value: member.user.bot ? "Oui ! 🤖" : "Non ! 🐱", inline: true },
          { name: "<:icon15:1427724244615172318>・Infos serveur", value: "Voici les infos de ce membre ici 🎠", inline: false },
          { name: "<:icon15:1427724244615172318>・Plus haut rôle", value: `${topRole.name}`, inline: true },
          { name: "<:icon15:1427724244615172318>・Arrivé(e) le", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
          { name: "<:icon15:1427724244615172318>・Tous les rôles", value: rolesList, inline: false }
        )
        .setTimestamp();

      if (banner) {
        embed.setImage(banner);
      }

      embed.addFields({
        name: "<:icon15:1427724244615172318>・Booster du serveur ?",
        value: member.premiumSince ? "Ouiii 💎✨" : "Non... 😢",
        inline: true
      });

      // 🎖️ Badges spéciaux HessCrow
      const badgesMap = {
        "767412412731097108": "Développeur & Propriétaire",
        "394799572930789388": "Co-Propriétaire",
        "943086186644258886": "Administrateur",
        "1047224150411968573": "Ami du Staff"
      };

      if (badgesMap[member.user.id]) {
        embed.addFields({
          name: "🎖️・Badges Spéciaux",
          value: `> 🌟 **${badgesMap[member.user.id]}** chez HessCrow !`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });
      console.log(`[✅] /userinfo pour ${member.user.tag} exécutée par ${interaction.user.tag}`);
    } catch (error) {
      console.error("Erreur dans /userinfo :", error);
      if (!interaction.replied) {
        await interaction.reply({ content: "😿 Une erreur est survenue lors de la récupération des infos utilisateur...", ephemeral: true });
      }
    }
  },
};

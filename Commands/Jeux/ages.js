const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("age")
    .setDescription("Analyse l’âge mental et le compare à l’âge réel (optionnel).")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Le membre à analyser.")
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName("age_reel")
        .setDescription("Âge réel du membre (entre 13 et 99).")
        .setRequired(false)
        .setMinValue(13)
        .setMaxValue(99)
    ),

  async run(client, interaction) {
    try {
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const realAge = interaction.options.getInteger("age_reel");

      // Génération pseudo-aléatoire mais stable en fonction de l'ID
      let hash = 0;
      for (const char of targetUser.id) {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
      }
      const mentalAge = 5 + (Math.abs(hash) % 76); // compris entre 5 et 80

      // Catégorie selon l'âge mental
      const getAgeCategory = (age) => {
        if (age < 12) return "Enfant dans l’âme 🧸";
        if (age < 18) return "Adolescent rebelle 😎";
        if (age < 25) return "Jeune adulte 🎓";
        if (age < 35) return "Adulte accompli 💼";
        if (age < 50) return "Expérimenté 🧙‍♂️";
        if (age < 65) return "Senior 👴";
        return "Sagesse ancestrale 🦉";
      };

      // Comparaison âge réel vs mental
      const getComparison = (mental, real) => {
        if (!real) return "";
        const diff = mental - real;
        if (Math.abs(diff) <= 2) return "\n🎯 Équilibre parfait.";
        if (diff > 10) return `\n🧓 Tu sembles avoir ${diff} ans de plus que ton âge réel.`;
        if (diff > 0) return `\n😊 Tu parais ${diff} ans plus sage.`;
        if (diff < -10) return `\n🧒 Tu sembles avoir ${Math.abs(diff)} ans de moins dans ta tête.`;
        return `\n😄 Tu as ${Math.abs(diff)} ans de différence avec ton âge réel.`;
      };

      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle(`Âge mental de ${targetUser.username}`)
        .setDescription(
          `**Âge mental :** ${mentalAge} ans\n${getAgeCategory(mentalAge)}`
          + (realAge ? `\n**Âge réel :** ${realAge} ans${getComparison(mentalAge, realAge)}` : "")
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({
          text: `Analyse effectuée par ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      console.log(`[INFO] Commande /age exécutée par ${interaction.user.tag} pour ${targetUser.tag}`);
    } catch (error) {
      console.error("Erreur lors de l’exécution de /age :", error);
      if (!interaction.replied) {
        await interaction.reply({ content: "❌ Une erreur est survenue lors du traitement.", ephemeral: true });
      }
    }
  },
};

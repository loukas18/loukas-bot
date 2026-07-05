const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infini-top")
    .setDescription("Affiche le top infini"),

  async run(client, interaction) {
    console.log(`[📥] Commande /infini-top utilisée par ${interaction.user.tag} (${interaction.user.id})`);

    let userCounts = {};
    try {
      const data = fs.readFileSync('counts.json', 'utf8');
      userCounts = JSON.parse(data);
      console.log(`[📄] Fichier counts.json chargé avec succès (${Object.keys(userCounts).length} utilisateurs)`);
    } catch (error) {
      console.error('[❌] Erreur lors de la lecture de counts.json :', error);
      return interaction.reply("Aucun classement disponible.");
    }

    // Trier les utilisateurs par leur compteur décroissant
    const sorted = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    if (sorted.length === 0) {
      console.log('[⚠️] Aucun utilisateur trouvé dans le classement.');
      return interaction.reply("Aucun utilisateur dans le classement.");
    }

    // Construire le message embed
    const embed = new EmbedBuilder()
      .setTitle("Top 10 infini")
      .setColor(0x00AE86);

    let description = "";
    for (let i = 0; i < sorted.length; i++) {
      const [userId, count] = sorted[i];
      description += `**#${i + 1}** <@${userId}> — ${count} compte(s)\n`;
    }

    embed.setDescription(description);

    await interaction.reply({ embeds: [embed] });
    console.log(`[✅] Classement envoyé avec ${sorted.length} entrées à ${interaction.user.tag}`);
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boulet')
    .setDescription('Mesure le niveau boulet d’un membre.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Le membre à analyser.')
        .setRequired(false)
    ),

  async run(client, interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      // Génération d’un score pseudo-aléatoire basé sur l’ID
      let hash = 0;
      for (const char of targetUser.id) {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
      }
      const percentage = Math.abs(hash) % 101;

      const reactions = ['🤓', '🤡', '💀', '😵‍💫', '🙈'];
      const randomReaction = reactions[Math.abs(hash) % reactions.length];

      const getLevel = (p) => {
        if (p < 25) return 'Génie incompris';
        if (p < 50) return 'Boulet léger';
        if (p < 75) return 'Boulet confirmé';
        return 'Boulet cosmique';
      };

      const embed = new EmbedBuilder()
        .setColor(percentage > 75 ? 'Red' : percentage > 50 ? 'Orange' : 'Green')
        .setTitle(`Boulet-mètre : ${targetUser.username}`)
        .setDescription(
          `${randomReaction} **${targetUser.username}** est à **${percentage}%** boulet.\n\n` +
          `**Niveau :** ${getLevel(percentage)}`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({
          text: `Analyse demandée par ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        });

      await interaction.reply({ embeds: [embed] });
      console.log(`[INFO] Commande /boulet exécutée pour ${targetUser.tag} par ${interaction.user.tag}`);
    } catch (error) {
      console.error('Erreur dans la commande /boulet :', error);
      if (!interaction.replied) {
        await interaction.reply({ content: "Une erreur est survenue lors de l'analyse.", ephemeral: true });
      }
    }
  }
};

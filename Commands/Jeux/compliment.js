const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Recevez un roast léger et amusant.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Le membre à roast.')
        .setRequired(false)
    ),

  async run(client, interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      const roasts = [
        'Tu es tellement unique que même tes haters deviennent fans !',
        'Tes codes font parfois pleurer Hello World !',
        'Ta playlist Spotify fait réfléchir Shazam !',
        'Tu es si stylé(e) que les licornes t’envient !',
        'Tes blagues reviennent toujours à être drôles !',
        'Tu dors tellement que même les koalas prennent des notes !',
        'Ton innocence est presque légendaire.',
        'Tes skills en gaming font pâlir les NPCs !',
        'Tu es si imprévisible que même les paladins sont perdus !',
        'Ta cuisine a du caractère… même Gordon Ramsay approuve !',
        'Tu danses si bien que même les robots semblent fluides !',
        'Tes selfies sont si réussis que les filtres te consultent !',
        'Tu es si original(e) que même ton agent FBI est surpris !',
        'Tes théories imaginatives mériteraient une série Netflix !',
        'Tu procrastines tellement que demain te supplie de finir ce que tu as commencé !'
      ];

      // Calcul stable basé sur l'ID pour générer un roast unique par utilisateur
      let hash = 0;
      for (const char of targetUser.id) {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
      }
      const roastIndex = Math.abs(hash) % roasts.length;
      const selectedRoast = roasts[roastIndex];

      const embed = new EmbedBuilder()
        .setColor('DarkRed')
        .setTitle(`Roast pour ${targetUser.username}`)
        .setDescription(selectedRoast)
        .addFields({
          name: 'Disclaimer',
          value: 'Ce roast est humoristique et bienveillant.'
        })
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ 
          text: `Roast généré par ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL() 
        });

      await interaction.reply({ embeds: [embed] });
      console.log(`[INFO] /roast exécuté pour ${targetUser.tag} par ${interaction.user.tag}`);
    } catch (error) {
      console.error('Erreur dans la commande /roast :', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Une erreur est survenue lors de la génération du roast.', ephemeral: true });
      }
    }
  }
};

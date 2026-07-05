const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

  data: new SlashCommandBuilder()

    .setName('gay')

    .setDescription('Mesure ton taux de gayitude de façon totalement scientifique')

    .addUserOption(option =>

      option.setName('user')

        .setDescription('Le membre à analyser')

        .setRequired(false)

    ),

  async run(client, interaction) {

    try {

      const targetUser = interaction.options.getUser('user') || interaction.user;

      // Cas spécial 0%

      if (targetUser.id === '694810327161765908') {

        const embed = new EmbedBuilder()

          .setColor('Blue')

          .setTitle(`🏳️‍🌈 Gayomètre de ${targetUser.displayName || targetUser.username}`)

          .setDescription(

            '📉 **0% GAY**\n\n' +

            'Hétéro confirmé.\n' +

            'Aime les femmes, les seins, les fesses et tout ce qui va avec. 🍑🍒\n' +

            'Rien à signaler, circulez.'

          )

          .setThumbnail(targetUser.displayAvatarURL())

          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });

      }

      // Cas spécial 100%

      if (targetUser.id === '950102557706039346') {

        const embed = new EmbedBuilder()

          .setColor('Purple')

          .setTitle(`🏳️‍🌈 Gayomètre de ${targetUser.displayName || targetUser.username}`)

          .setDescription(

            '📈 **100% GAY**\n\n' +

            'Aucun doute possible.\n' +

            'Le radar est précis, les capteurs sont saturés.\n' +

            'Icône LGBTQ+ certifiée. 🌈✨'

          )

          .setThumbnail(targetUser.displayAvatarURL())

          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });

      }

      // Calcul pseudo-aléatoire basé sur l’ID

      let hash = 0;

      for (let i = 0; i < targetUser.id.length; i++) {

        hash = ((hash << 5) - hash) + targetUser.id.charCodeAt(i);

      }

      const percent = Math.abs(hash) % 101; // 0 à 100 %

      const getLevel = (p) => {

        if (p === 0) return 'Hétéro jusqu\'au bout 🧍‍♂️';

        if (p < 20) return 'Très légèrement gay 🤏';

        if (p < 40) return 'Un peu de doute 👀';

        if (p < 60) return 'Zone floue 😶‍🌫️';

        if (p < 80) return 'Plutôt gay 🏳️‍🌈';

        if (p < 100) return 'Très gay ✨';

        return 'GAY ULTIME 🌈👑';

      };

      const getColor = (p) => {

        if (p < 20) return 'Blue';

        if (p < 50) return 'Green';

        if (p < 80) return 'Orange';

        return 'Purple';

      };

      const embed = new EmbedBuilder()

        .setColor(getColor(percent))

        .setTitle(`🏳️‍🌈 Gayomètre de ${targetUser.displayName || targetUser.username}`)

        .setDescription(`**Taux :** ${percent}%\n\n${getLevel(percent)}`)

        .addFields({

          name: '📊 Fiabilité',

          value: 'Test 100% scientifique*\n\n*aucune source, mais beaucoup de confiance'

        })

        .setThumbnail(targetUser.displayAvatarURL())

        .setTimestamp()

        .setFooter({

          text: `Analysé par ${interaction.user.displayName || interaction.user.username}`,

          iconURL: interaction.user.displayAvatarURL()

        });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {

      console.error('Erreur commande gay:', error);

    }

  }

};
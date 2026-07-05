const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('iq')
    .setDescription('Mesure ton QI de façon totalement scientifique')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à analyser')
        .setRequired(false)
    ),

  async run(client, interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      
      // Cas spéciaux pour tes amis si tu veux
      if (targetUser.id === '694810327161765908') {
        const embed = new EmbedBuilder()
          .setColor('Gold')
          .setTitle(`🧠 QI de ${targetUser.displayName || targetUser.username}`)
          .setDescription('♾️ **QI INFINI** - Cerveau trop développé pour être mesuré ! 🤯')
          .setThumbnail(targetUser.displayAvatarURL())
          .setTimestamp();
        return await interaction.reply({ embeds: [embed] });
      }

      // QI entre 50 et 200 (avec quelques valeurs absurdes possibles)
      let hash = 0;
      for (let i = 0; i < targetUser.id.length; i++) {
        hash = ((hash << 5) - hash) + targetUser.id.charCodeAt(i);
      }
      
      let iq;
      const randomFactor = Math.abs(hash) % 1000;
      
      // 1% de chance d'avoir un QI absurde
      if (randomFactor < 10) {
        const absurdIQs = [0, 420, 1337, 9000, -50, 69];
        iq = absurdIQs[Math.abs(hash) % absurdIQs.length];
      } else {
        iq = 50 + (Math.abs(hash) % 151); // 50 à 200
      }

      const getIQLevel = (iq) => {
        if (iq === 0) return 'Cerveau en maintenance 🔧';
        if (iq < 0) return 'QI négatif (c\'est scientifiquement impossible) 🤡';
        if (iq === 69) return 'Nice. 😏';
        if (iq === 420) return 'QI... élevé ? 🌿';
        if (iq === 1337) return 'QI de hackerman ! 💻';
        if (iq === 9000) return 'IT\'S OVER 9000! 🐉';
        if (iq < 70) return 'Euh... 🤔';
        if (iq < 90) return 'En dessous de la moyenne 📚';
        if (iq < 110) return 'Moyenne ! 👍';
        if (iq < 130) return 'Au-dessus de la moyenne ! 🧠';
        if (iq < 150) return 'Très intelligent ! 🤓';
        return 'GÉNIE CERTIFIÉ ! 🏆';
      };

      const getColor = (iq) => {
        if (iq < 0 || iq === 0) return 'Red';
        if ([69, 420, 1337, 9000].includes(iq)) return 'Purple';
        if (iq < 90) return 'Orange';
        if (iq < 130) return 'Blue';
        return 'Gold';
      };

      const embed = new EmbedBuilder()
        .setColor(getColor(iq))
        .setTitle(`🧠 QI de ${targetUser.displayName || targetUser.username}`)
        .setDescription(`**QI :** ${iq}\n\n${getIQLevel(iq)}`)
        .addFields({
          name: '📊 Note',
          value: 'Test 100% scientifique et fiable* \n\n*non garanti par la science'
        })
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ 
          text: `Testé par le laboratoire de ${interaction.user.displayName || interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL() 
        });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur commande iq:', error);
    }
  }
};
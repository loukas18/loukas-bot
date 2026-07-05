const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  Colors
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("parler")
    .setDescription("Envoyer un message via le bot dans un canal spécifié")
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le contenu du message à envoyer')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal cible (canal actuel par défaut)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('embed')
        .setDescription('Envoyer le message dans un embed')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('couleur')
        .setDescription('Couleur de l\'embed (code hex ou nom de couleur)')
        .setRequired(false)
        .setMaxLength(7)
    )
    .addBooleanOption(option =>
      option.setName('anonyme')
        .setDescription('Masquer l\'expéditeur de la commande')
        .setRequired(false)
    ),

  async run(client, interaction) {
    const logger = {
      info: (msg) => console.log(`[INFO] [${new Date().toISOString()}] ${msg}`),
      warn: (msg) => console.log(`[ATTENTION] [${new Date().toISOString()}] ${msg}`),
      error: (msg, error) => console.error(`[ERREUR] [${new Date().toISOString()}] ${msg}`, error || '')
    };

    logger.info(`Commande /parler exécutée par ${interaction.user.tag} (${interaction.user.id})`);

    // Validation des permissions
    const permissionRequise = PermissionFlagsBits.ManageMessages;
    if (!interaction.member?.permissions?.has(permissionRequise)) {
      logger.warn(`L'utilisateur ${interaction.user.tag} n'a pas les permissions requises pour la commande /parler`);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("🔒 Permissions insuffisantes")
        .setDescription("Vous avez besoin de la permission **Gérer les messages** pour utiliser cette commande.")
        .setFooter({
          text: "Contactez un administrateur pour obtenir de l'aide",
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
        
      return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Extraction des options
    const contenuMessage = interaction.options.getString('message');
    const canalCible = interaction.options.getChannel('canal') || interaction.channel;
    const utiliserEmbed = interaction.options.getBoolean('embed') ?? false;
    const couleurEmbed = interaction.options.getString('couleur') || '#5865F2';
    const estAnonyme = interaction.options.getBoolean('anonyme') ?? false;

    // Validation des permissions du bot dans le canal cible
    const permissionsBot = canalCible.permissionsFor(client.user);
    const permissionsBotRequises = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel];
    
    if (utiliserEmbed) {
      permissionsBotRequises.push(PermissionFlagsBits.EmbedLinks);
    }

    const permissionsManquantes = permissionsBotRequises.filter(perm => !permissionsBot?.has(perm));
    
    if (permissionsManquantes.length > 0) {
      logger.warn(`Le bot n'a pas les permissions dans le canal ${canalCible.name}: ${permissionsManquantes.join(', ')}`);
      
      const permissionsNoms = {
        [PermissionFlagsBits.SendMessages]: "Envoyer des messages",
        [PermissionFlagsBits.ViewChannel]: "Voir le canal",
        [PermissionFlagsBits.EmbedLinks]: "Intégrer des liens"
      };
      
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("⚠️ Erreur de permissions du bot")
        .setDescription(`Je n'ai pas les permissions suffisantes dans ${canalCible}.\n\nPermissions manquantes: **${permissionsManquantes.map(perm => 
          permissionsNoms[perm] || 'Permission inconnue'
        ).join(', ')}**`)
        .setFooter({
          text: "Veuillez vérifier les permissions du bot dans le canal cible",
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
        
      return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Validation du format de couleur
    let couleurValidee = Colors.Blurple;
    if (couleurEmbed) {
      const patternHex = /^#([0-9A-F]{3}){1,2}$/i;
      const couleursNommees = {
        'rouge': Colors.Red,
        'bleu': Colors.Blue,
        'vert': Colors.Green,
        'jaune': Colors.Yellow,
        'orange': Colors.Orange,
        'violet': Colors.Purple,
        'rose': Colors.LuminousVividPink,
        'noir': Colors.NotQuiteBlack,
        'blanc': Colors.White,
        'gris': Colors.Grey
      };
      
      if (patternHex.test(couleurEmbed)) {
        couleurValidee = couleurEmbed;
      } else if (couleursNommees[couleurEmbed.toLowerCase()]) {
        couleurValidee = couleursNommees[couleurEmbed.toLowerCase()];
      } else {
        logger.warn(`Format de couleur invalide fourni: ${couleurEmbed}`);
        couleurValidee = Colors.Blurple;
      }
    }

    try {
      let messageEnvoye;

      if (utiliserEmbed) {
        const embedMessage = new EmbedBuilder()
          .setColor(couleurValidee)
          .setDescription(contenuMessage)
          .setTimestamp();

        if (!estAnonyme) {
          embedMessage.setFooter({
            text: `Envoyé par ${interaction.user.displayName}`,
            iconURL: interaction.user.displayAvatarURL()
          });
        }

        messageEnvoye = await canalCible.send({ embeds: [embedMessage] });
        logger.info(`Message embed envoyé dans ${canalCible.name} (${canalCible.id}) par ${interaction.user.tag}`);
      } else {
        messageEnvoye = await canalCible.send(contenuMessage);
        logger.info(`Message texte envoyé dans ${canalCible.name} (${canalCible.id}) par ${interaction.user.tag}`);
      }

      // Confirmation de succès
      const confirmEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Message envoyé avec succès")
        .addFields([
          {
            name: "📍 Canal cible",
            value: `${canalCible}`,
            inline: true
          },
          {
            name: "📄 Format",
            value: utiliserEmbed ? "Embed" : "Texte",
            inline: true
          },
          {
            name: "👤 Anonyme",
            value: estAnonyme ? "Oui" : "Non",
            inline: true
          },
          {
            name: "📝 Aperçu du message",
            value: `\`\`\`${contenuMessage.length > 100 ? contenuMessage.substring(0, 97) + '...' : contenuMessage}\`\`\``,
            inline: false
          }
        ])
        .setFooter({
          text: `ID du message: ${messageEnvoye.id}`,
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
      logger.info(`Confirmation envoyée à ${interaction.user.tag}`);

    } catch (error) {
      logger.error(`Échec de l'envoi du message:`, error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("❌ Échec de l'envoi du message")
        .setDescription("Une erreur inattendue s'est produite lors de l'envoi du message. Veuillez réessayer plus tard.")
        .addFields([
          {
            name: "🔍 Détails de l'erreur",
            value: `\`\`\`${error.message || 'Erreur inconnue'}\`\`\``,
            inline: false
          }
        ])
        .setFooter({
          text: "Si cela persiste, contactez un administrateur du serveur",
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
        
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },

  // Métadonnées de la commande
  categorie: 'Modération',
  cooldown: 3,
  guildOnly: true,
  permissionsRequises: [PermissionFlagsBits.ManageMessages],
  permissionsBotRequises: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
};
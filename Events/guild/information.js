const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Configuration centralisée
const CONFIG = {
  COLORS: {
    PRIMARY: '#5865F2',
    SUCCESS: '#00FF00',
    WARNING: '#FFD700',
    INFO: '#9B59B6',
    DANGER: '#FF0000',
    STAFF: '#E74C3C'
  },
  CHANNELS: {
    INFO: '1523022940348874963',
    ANNOUNCEMENTS: '1523022940193558749',
    RULES: '1523022940193558748',
    GENERAL: '1523022940348874969',
    // ... autres salons
  },
  EMBED_LIMITS: {
    TITLE: 256,
    DESCRIPTION: 4096,
    FIELDS: 25,
    FIELD_NAME: 256,
    FIELD_VALUE: 1024
  }
};

// Configuration des rôles staff optimisée
const STAFF_CONFIG = {
  fondateurs: {
    roles: ['1385384727023849572'],
    emoji: '<:icon:1427724287195746334>',
    name: 'Fondateurs',
    description: 'Créateur du serveur'
  },
  responsableServeur: {
    roles: ['1368989504979075084'],
    emoji: '<:icon2:1427724282871550122>',
    name: 'Responsable Serveur',
    description: 'Direction générale'
  },
  administrateurs: {
    roles: ['1368709198946242580', '1368709195335077888'],
    emoji: '<:icon64:1427722510472056954>',
    name: 'Administrateurs',
    description: 'Administration générale'
  },
  responsables: {
    roles: ['1368709188288647231', '1368709187244261428'],
    emoji: '📋',
    name: 'Responsables',
    description: 'Responsable staff'
  },
  moderateurs: {
    roles: ['1368709185088258180'],
    emoji: '<:icon60:1427722616550199348>',
    name: 'Modérateurs',
    description: 'Modérateur'
  },
  moderateursTest: {
    roles: ['1368709184165515266'],
    emoji: '<:icon60:1427722616550199348>',
    name: 'Modérateurs Test',
    description: 'Modérateur Test'
  },
  developpeurs: {
    roles: ['1368709193430728767'],
    emoji: '<:icon7:1427724262709661776>',
    name: 'Développeurs',
    description: 'Développement et technique'
  }
};

/**
 * Utilitaire pour tronquer du texte
 */
function truncateText(text, maxLength) {
  return text.length > maxLength ? `${text.substring(0, maxLength - 3)}...` : text;
}

/**
 * Utilitaire pour valider les embeds
 */
function validateEmbed(embed) {
  const data = embed.data;
  
  if (data.title && data.title.length > CONFIG.EMBED_LIMITS.TITLE) {
    embed.setTitle(truncateText(data.title, CONFIG.EMBED_LIMITS.TITLE));
  }
  
  if (data.description && data.description.length > CONFIG.EMBED_LIMITS.DESCRIPTION) {
    embed.setDescription(truncateText(data.description, CONFIG.EMBED_LIMITS.DESCRIPTION));
  }
  
  return embed;
}

/**
 * Crée l'embed principal d'informations
 */
function createInfoEmbed(guild) {
  const embed = new EmbedBuilder()
    .setTitle('<:icon68:1427722428527804558> Informations du Serveur')
    .setDescription(
      `> Bienvenue dans le salon <#${CONFIG.CHANNELS.INFO}> !\n` +
      "> Ici, tu peux retrouver toutes les informations importantes du serveur.\n\n" +
      "➜ Utilise le menu déroulant pour plus d'informations"
    )
    .setColor(CONFIG.COLORS.PRIMARY)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || 'https://via.placeholder.com/256x256/5865F2/ffffff?text=Serveur')
    .setFooter({ 
      text: `Informations du serveur • ${guild.memberCount} membres`,
      iconURL: guild.iconURL({ dynamic: true, size: 32 })
    })
    .setTimestamp();

  return validateEmbed(embed);
}

/**
 * Crée le menu déroulant
 */
function createInfoMenu() {
  const options = [
    {
      label: 'Description du serveur',
      description: 'Découvrez notre serveur et ses objectifs',
      value: 'description',
      emoji: '<:icon67:1427722448840949790>'
    },
    {
      label: 'Salons spéciaux',
      description: 'Liste des salons importants',
      value: 'channels',
      emoji: '<:icon70:1427722390376546396>'
    },
    {
      label: 'Explication des rôles',
      description: 'Comprendre le système de rôles',
      value: 'roles',
      emoji: '<:icon33:1427723957494353960>'
    },
    {
      label: 'Équipe Staff',
      description: 'Rencontrez notre équipe de modération',
      value: 'staff',
      emoji: '<:icon3:1427724273946067045>'
    },
    {
      label: 'Règlement',
      description: 'Les règles à respecter',
      value: 'rules',
      emoji: '<:icon49:1427722860180537455>'
    }
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('server_info_select')
    .setPlaceholder('<:icon15:1427724244615172318> Sélectionnez une catégorie...')
    .setMinValues(1)
    .setMaxValues(1);

  options.forEach(option => {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setDescription(option.description)
        .setValue(option.value)
        .setEmoji(option.emoji)
    );
  });

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Récupère les membres ayant des rôles spécifiques (optimisé)
 */
function getMembersWithRoles(guild, roleIds) {
  const memberMap = new Map();
  
  roleIds.forEach(roleId => {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      role.members.forEach(member => {
        if (!memberMap.has(member.id)) {
          memberMap.set(member.id, member);
        }
      });
    }
  });
  
  return Array.from(memberMap.values());
}

/**
 * Crée l'embed du staff (optimisé)
 */
function createStaffEmbed(guild) {
  let staffDescription = "**Notre équipe :**\n\n";
  let hasStaff = false;

  // Parcourir la configuration du staff
  Object.entries(STAFF_CONFIG).forEach(([key, config]) => {
    const members = getMembersWithRoles(guild, config.roles);
    
    if (members.length > 0) {
      hasStaff = true;
      staffDescription += `${config.emoji} **${config.name} :**\n`;
      
      members.forEach(member => {
        const displayName = member.displayName || member.user.username;
        staffDescription += `• ${member} - ${config.description}\n`;
      });
      
      staffDescription += "\n";
    }
  });

  if (!hasStaff) {
    staffDescription += "Aucun membre du staff trouvé.\n*Vérifiez la configuration des rôles.*\n\n";
  }

  staffDescription += "*N'hésitez pas à nous contacter si vous avez besoin d'aide !*";

  const embed = new EmbedBuilder()
    .setTitle('<:icon3:1427724273946067045> Équipe Staff')
    .setDescription(staffDescription)
    .setColor(CONFIG.COLORS.STAFF)
    .setFooter({ text: 'Équipe de modération' })
    .setTimestamp();

  return validateEmbed(embed);
}

/**
 * Gère les réponses du menu (refactorisé)
 */
function handleSelectMenuResponse(value, guild) {
  const responses = {
    description: () => new EmbedBuilder()
      .setTitle('<:icon67:1427722448840949790> Description du Serveur')
      .setDescription(
        "**Bienvenue sur Loukawaiii !**\n\n" +
        "<:icon15:1427724244615172318> **Notre mission :**\n" +
        "Créer un espace convivial et bienveillant pour tous les membres.\n\n" +
        "<:icon15:1427724244615172318> **Ce que nous proposons :**\n" +
        "• Discussions variées mais peu enrichissantes\n" +
        "• Support et entraide entre membres\n\n" +
        "<:icon15:1427724244615172318> **Notre vision :**\n" +
        "Construire ensemble une communauté pas active mais respectueuse."
      )
      .setColor(CONFIG.COLORS.SUCCESS)
      .setFooter({ text: 'À propos du serveur' })
      .setTimestamp(),

    channels: () => {
      const channelList = [
        { id: '1368719082878275605', name: 'Annonces officielles', emoji: '📢' },
        { id: '1368719078704943114', name: 'Règlement du serveur', emoji: '📋' },
        { id: '1368719100229976064', name: 'Discussion générale', emoji: '🎤' },
        { id: '1368719096543449170', name: 'Actus BB Loukas', emoji: '🎮' },
        { id: '1368719130148081716', name: 'Partage musical', emoji: '🎵' },
        { id: '1368719105179258943', name: 'Créations artistiques', emoji: '🎨' },
        { id: '1368719115774197760', name: 'Aide et support', emoji: '❓' },
        { id: '1368719107582726205', name: 'Inutile mais passe le temps', emoji: '♾️' },
        { id: '1395137703208681493', name: 'Parle avec un bot', emoji: '🥁' },
        { id: '1368719084539088948', name: 'Concours, essaye de gagner un cadeau', emoji: '🎊' },
        { id: '1368719089328980052', name: 'Mes réseaux sociaux', emoji: '🐼' },
        { id: '1368719092252409997', name: 'Arrivées des nouveau', emoji: '🛬' },
        { id: '1368719102901878806', name: 'Commandes de bots', emoji: '🤖' }
      ];

      const description = "**Voici nos salons les plus importants :**\n\n" +
        channelList.map(ch => `${ch.emoji} **<#${ch.id}>** - ${ch.name}`).join('\n') +
        "\n\n*Respectez le thème de chaque salon !*";

      return new EmbedBuilder()
        .setTitle('📁 Salons Spéciaux')
        .setDescription(description)
        .setColor(CONFIG.COLORS.WARNING)
        .setFooter({ text: 'Guide des salons' })
        .setTimestamp();
    },

    roles: () => new EmbedBuilder()
      .setTitle('🎭 Système de Rôles')
      .setDescription(
        "**Comprendre nos rôles :**\n\n" +
        "💎 **Les niveaux** - Des rôles sont à obtenir aux différents niveaux : <@&1368709155648438402> (5), <@&1368709156508401755> (10), <@&1368709157179625694> (20), <@&1368709158165282980> (30), <@&1368709159180046410> (50). L'XP s'obtient en parlant sur le serveur.\n\n" +
        "Les rôles <@&950061138773696512>, <@&1368709180806139974>, <@&1368709169875648602>, <@&1368709177458819154> & <@&1368709170764976128> possèdent également un boost d'XP.\n\n" +
        "**Rôles Membres :**\n" +
        "**Booster <@&950061138773696512>** - Boosters du serveur\n" +
        "**Infini <@&1368709177458819154>, <@&1368709170764976128>, <@&1368709169875648602>** - Rôles liés à l'infini <#1368719107582726205>\n" +
        "**Partenaire <@&1397637208864723035>** - Membres partenaires Discord\n" +
        "**Amis <@&1368709163940708487>** - Amis du haut staff\n" +
        "**VIP <@&1368709166172078141>** - Membres privilégiés\n" +
        "**Kawaii <@&1368709154625163284>** - Rôle membres"
      )
      .setColor(CONFIG.COLORS.INFO)
      .setFooter({ text: 'Système de progression' })
      .setTimestamp(),

    staff: () => createStaffEmbed(guild),

    rules: () => new EmbedBuilder()
      .setTitle('📜 Règlement du Serveur')
      .setDescription(
        '🌿 **Bienvenue** sur le serveur de **loukas.** Prends un petit moment pour lire ce règlement avant de participer. Rien de méchant, juste de quoi garder une bonne ambiance ✨\n\n' +
        '**1. Respect & vibes cool**\n' +
        '> On est là pour passer un bon moment, donc le respect est de mise entre tout le monde.\n' +
        '> Pas d\'insultes, de propos déplacés ou de comportements toxiques.\n' +
        '> Évitons les sujets sensibles ou choquants, restons chill.\n' +
        '> Si y\'a un souci, viens en parler calmement avec la modération.\n\n' +
        '**2. Salons = espaces dédiés**\n' +
        '> Chaque salon a son petit rôle, merci de l\'utiliser comme prévu.\n' +
        '> Pas de spam, de flood ou de gros pings abusifs (@everyone, @here… on évite).\n\n' +
        '**3. Pseudos & profils**\n' +
        '> Garde un pseudo et une photo de profil corrects et sympas.\n' +
        '> Pas de pseudo qui pourrait faire croire que t\'es staff ou bot.\n\n' +
        '**4. Partage de contenu**\n' +
        '> Partage ce que tu veux tant que c\'est légal, respectueux et safe.\n' +
        '> Pas de pub sauvage, de liens douteux ou de contenu NSFW.\n' +
        '> Pour la pub (serveur, chaîne, site…), demande l\'accord d\'un admin.\n\n' +
        '**5. En vocal aussi, on chill**\n' +
        '> Respect et bonne ambiance : pas de cris, pas de musiques gênantes.\n' +
        '> Soundboards et voice changers ? OK si t\'as l\'autorisation.\n' +
        '> Évite d\'imposer des discussions perso à tout le salon.\n\n' +
        '**6. Modération & décisions**\n' +
        '> Les modos sont là pour que tout se passe bien, leurs décisions doivent être respectées.\n' +
        '> Essayer de contourner une sanction ? Mauvaise idée.\n' +
        '> Le règlement peut évoluer, donc reste à jour si besoin.\n\n' +
        '**7. En résumé**\n' +
        '> Être ici = accepter ce règlement. Simple et clair.\n' +
        '> Le staff fera toujours en sorte de garder une ambiance cool et safe pour tout le monde ✌️\n\n' +
        '*Amuse-toi bien !*'
      )
      .setColor(CONFIG.COLORS.DANGER)
      .setFooter({ text: 'Règlement du serveur' })
      .setTimestamp()
  };

  const responseFunction = responses[value];
  if (responseFunction) {
    return validateEmbed(responseFunction());
  }
  
  return null;
}

/**
 * Envoie le message d'information avec gestion d'erreurs améliorée
 */
async function sendInfoMessage(channel) {
  try {
    // Vérifier les permissions
    const permissions = channel.permissionsFor(channel.guild.members.me);
    if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
      console.error('[INFO] Permissions insuffisantes pour envoyer le message d\'information.');
      return false;
    }

    // Vérifier s'il y a déjà des messages
    const messages = await channel.messages.fetch({ limit: 1 });
    if (messages.size > 0) {
      console.log('[INFO] Le salon contient déjà des messages, embed d\'informations non envoyé.');
      return false;
    }

    const guild = channel.guild;
    const embed = createInfoEmbed(guild);
    const menu = createInfoMenu();

    const message = await channel.send({
      embeds: [embed],
      components: [menu]
    });

    console.log(`[INFO] Embed d'informations envoyé avec succès ! (ID: ${message.id})`);
    return true;
  } catch (error) {
    console.error('[INFO] Erreur lors de l\'envoi de l\'embed d\'informations:', error);
    return false;
  }
}

/**
 * Gère les interactions du menu déroulant avec meilleure gestion d'erreurs
 */
async function handleSelectMenuInteraction(interaction) {
  if (interaction.customId !== 'server_info_select') return;

  try {
    // Déférer la réponse pour éviter les timeouts
    await interaction.deferReply({ ephemeral: true });

    const selectedValue = interaction.values[0];
    const responseEmbed = handleSelectMenuResponse(selectedValue, interaction.guild);

    if (responseEmbed) {
      await interaction.editReply({
        embeds: [responseEmbed]
      });
    } else {
      await interaction.editReply({
        content: "❌ Une erreur s'est produite lors du traitement de votre sélection."
      });
    }
  } catch (error) {
    console.error('[INFO] Erreur lors de la gestion de l\'interaction du menu:', error);
    
    try {
      const errorMessage = "❌ Une erreur inattendue s'est produite.";
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else if (!interaction.replied) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (followUpError) {
      console.error('[INFO] Erreur lors de l\'envoi du message d\'erreur:', followUpError);
    }
  }
}

/**
 * Fonction utilitaire pour rafraîchir les embeds
 */
async function refreshInfoMessage(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Canal introuvable ou invalide');
    }

    // Supprimer les anciens messages
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(msg => msg.author.id === client.user.id);
    
    for (const message of botMessages.values()) {
      try {
        await message.delete();
      } catch (deleteError) {
        console.warn(`[INFO] Impossible de supprimer le message ${message.id}:`, deleteError.message);
      }
    }

    // Envoyer le nouveau message
    return await sendInfoMessage(channel);
  } catch (error) {
    console.error('[INFO] Erreur lors du rafraîchissement:', error);
    return false;
  }
}

module.exports = {
  name: 'infoEmbed',
  execute: async (client) => {
    const channelId = CONFIG.CHANNELS.INFO;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        console.error('[INFO] Salon d\'informations introuvable ou non textuel.');
        return;
      }
      await sendInfoMessage(channel);
    } catch (error) {
      console.error('[INFO] Erreur lors de la récupération du salon d\'informations:', error);
    }
  },
  handleSelectMenuInteraction,
  refreshInfoMessage,
  CONFIG // Export de la configuration pour tests ou usage externe
};
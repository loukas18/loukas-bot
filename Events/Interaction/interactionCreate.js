const path = require('path');
const { InteractionType } = require('discord.js');

// Importer le nouveau système vocal amélioré
const systemeVocal = require('../guild/voiceStateUpdate');
const gererRole = require('../../Commands/economie/gerer-role.js');

// Rate limiting pour les interactions
const limitesInteraction = new Map();
const LIMITE_INTERACTION_MS = 1000;

// Nettoyage périodique du rate limiting
setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, horodatage] of limitesInteraction.entries()) {
    if (maintenant - horodatage > 60000) {
      limitesInteraction.delete(cle);
    }
  }
}, 60000);
 
module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Validation de base
      if (!interaction || !client) {
        console.error("❌ Interaction ou client invalide");
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔍 GESTION DE L'AUTOCOMPLETE (DOIT ÊTRE EN PREMIER !)
      // ═══════════════════════════════════════════════════════════════
      if (interaction.isAutocomplete()) {
        const cmd = client.slashCommand?.get(interaction.commandName);
        if (!cmd) {
          console.warn(`⚠️ Commande autocomplete inconnue: ${interaction.commandName}`);
          return;
        }

        try {
          if (typeof cmd.autocomplete === 'function') {
            await cmd.autocomplete(interaction);
          } else {
            console.warn(`⚠️ Pas de fonction autocomplete pour: ${interaction.commandName}`);
          }
        } catch (error) {
          console.error(`❌ Erreur autocomplete ${interaction.commandName}:`, error.message);
        }
        return;
      }

      // Rate limiting par utilisateur (EXCLUSION des boutons giveaway)
      const utilisateurId = interaction.user?.id;
      const boutonsGiveaway = ['participants', 'participer', 'reroll'];
      const estBoutonGiveaway = interaction.isButton() && boutonsGiveaway.includes(interaction.customId);
      
      if (utilisateurId && !estBoutonGiveaway) {
        const derniereInteraction = limitesInteraction.get(utilisateurId) || 0;
        const maintenant = Date.now();
        
        if (maintenant - derniereInteraction < LIMITE_INTERACTION_MS) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '⚠️ Veuillez patienter avant d\'utiliser une autre interaction.',
              flags: 64,
            }).catch(() => {});
          }
          return;
        }
        limitesInteraction.set(utilisateurId, maintenant);
      }

      // === GESTION DU MENU D'INFORMATIONS DU SERVEUR ===
      if (interaction.isStringSelectMenu() && interaction.customId === 'server_info_select') {
        try {
          const informationModule = require('../guild/information.js');
          await informationModule.handleSelectMenuInteraction(interaction);
          return;
        } catch (error) {
          console.error('[INFO] Erreur dans le système d\'informations:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ Une erreur est survenue lors de l\'affichage des informations.', 
              ephemeral: true 
            }).catch(() => {});
          }
          return;
        }
      }

      // 🎤 NOUVEAU SYSTÈME VOCAL - Gestion des menus de contrôle
      if ((interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) && 
          (interaction.customId.startsWith('controle_vocal_') || 
           interaction.customId.startsWith('invite_user_') || 
           interaction.customId.startsWith('kick_user_'))) {
        
        try {
          await systemeVocal.handleSelectMenuInteraction(interaction);
          return;
        } catch (error) {
          console.error('❌ Erreur dans le nouveau système vocal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ Une erreur est survenue avec le système vocal.', 
              flags: 64
            }).catch(() => {});
          }
          return;
        }
      }

      // 🎤 ANCIEN SYSTÈME VOCAL (fallback/compatibilité)
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('controle_vocal_')) {
        const canalId = interaction.customId.split('_')[2];
        const canal = interaction.guild.channels.cache.get(canalId);
        
        const donneesCanal = systemeVocal.VoiceChannelManager?.getChannelData?.(canalId) || 
                            systemeVocal.canauxVocauxTemp?.get?.(canalId);
        
        if (!canal || !donneesCanal) {
          return interaction.reply({ content: '❌ Ce salon vocal n\'existe plus.', flags: 64 });
        }
        
        if (interaction.user.id !== donneesCanal.proprietaireId) {
          return interaction.reply({ content: '❌ Seul le propriétaire du salon peut utiliser ces contrôles.', flags: 64 });
        }

        const action = interaction.values[0];

        try {
          switch (action) {
            case 'prive':
              await systemeVocal.definirCanalPrive(interaction, canal, canalId);
              break;
            case 'public':
              await systemeVocal.definirCanalPublic(interaction, canal, canalId);
              break;
            case 'inviter':
              await systemeVocal.inviterUtilisateur(interaction, canal, canalId);
              break;
            case 'liste_blanche':
              await systemeVocal.gererListeBlanche(interaction, canal, canalId);
              break;
            case 'fantome':
              await systemeVocal.basculerModeFantome(interaction, canal, canalId);
              break;
            case 'renommer':
              await systemeVocal.renommerCanal(interaction, canal, canalId);
              break;
            case 'limite':
              await systemeVocal.definirLimiteUtilisateurs(interaction, canal, canalId);
              break;
            case 'expulser':
              await systemeVocal.expulserUtilisateur(interaction, canal, canalId);
              break;
            default:
              await interaction.reply({ content: '❌ Action inconnue.', flags: 64 });
          }
        } catch (error) {
          console.error('❌ Erreur dans le gestionnaire controle_vocal (ancien système):', error);
          if (!interaction.replied) {
            await interaction.reply({ content: '❌ Une erreur est survenue.', flags: 64 });
          }
        }
        return;
      }

       // ═══════════════════════════════════════════════════════════════
      // 🎨 GESTION COMMANDE /gerer-role - Menus déroulants ET Modals
      // ═══════════════════════════════════════════════════════════════
      
      if ((interaction.isStringSelectMenu()) && 
    (interaction.customId.startsWith('select_custom_role_') || 
     interaction.customId.startsWith('role_action_') ||
     interaction.customId.startsWith('add_members_select_') ||
     interaction.customId.startsWith('remove_members_select_'))) {
        
        try {
          console.log('DEBUG: Menu gerer-role reçu -', interaction.customId);
          await gererRole.handleSelectMenu(client, interaction);
          return;
        } catch (error) {
          console.error('❌ Erreur dans la commande gerer-role (menu):', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ Une erreur est survenue avec la gestion du rôle.', 
              flags: 64
            }).catch(() => {});
          }
          return;
        }
      }

      if (interaction.isModalSubmit() && (interaction.customId.startsWith('modify_role_modal_') || interaction.customId.startsWith('search_member_modal_'))) {
        try {
          console.log('DEBUG: Modal gerer-role reçu -', interaction.customId);
          await gererRole.handleModal(client, interaction);
          return;
        } catch (error) {
          console.error('❌ Erreur dans la commande gerer-role (modal):', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ Une erreur est survenue lors de la modification du rôle.', 
              flags: 64
            }).catch(() => {});
          }
          return;
        }
      }


      // Définition sécurisée des interactions de ticket
      const boutonsTicket = ['create_ticket', 'ticket_reorient', 'ticket_claim', 'ticket_auto_close', 'ticket_close'];
      const menusTicket = ['ticket_reason', 'ticket_reorient_choice'];
      const modauxTicket = interaction.isModalSubmit() && 
        interaction.customId && 
        interaction.customId.startsWith('ticket_details_');

      const estInteractionTicket =
        (interaction.isButton() && interaction.customId && boutonsTicket.includes(interaction.customId)) ||
        (interaction.isStringSelectMenu() && interaction.customId && menusTicket.includes(interaction.customId)) ||
        modauxTicket;

      // Gestion sécurisée des tickets
      if (estInteractionTicket) {
        try {
          const cheminGestionnaireTicket = path.join(__dirname, '..', '..', 'Events', 'Client', 'ticketHandler.js');
          if (require('fs').existsSync(cheminGestionnaireTicket)) {
            const gestionnaireTicket = require(cheminGestionnaireTicket);
            if (typeof gestionnaireTicket.execute === 'function') {
              await gestionnaireTicket.execute(interaction, client);
            } else {
              throw new Error("Méthode execute manquante dans ticketHandler");
            }
          } else {
            throw new Error("Fichier ticketHandler introuvable");
          }
        } catch (error) {
          console.error('❌ Erreur gestionnaire tickets:', error.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Une erreur est survenue lors du traitement de votre ticket.',
              flags: 64,
            }).catch(() => {});
          }
        }
        return;
      }

      // 💰 Gestion du menu déroulant de la boutique
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('shop_select_')) {
        try {
          const cheminBoutique = path.join(__dirname, '..', '..', 'Commands', 'economie', 'boutique.js');
          
          if (require('fs').existsSync(cheminBoutique)) {
            const fichierBoutique = require(cheminBoutique);
            
            if (typeof fichierBoutique.handleSelectMenu === 'function') {
              await fichierBoutique.handleSelectMenu(client, interaction);
              console.log('✅ Menu boutique traité avec succès');
            } else {
              throw new Error("Méthode handleSelectMenu manquante dans boutique.js");
            }
          } else {
            throw new Error(`Fichier boutique.js introuvable à ${cheminBoutique}`);
          }
        } catch (error) {
          console.error(`❌ Erreur menu boutique '${interaction.customId}':`, error.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors du traitement du menu.",
              flags: 64,
            }).catch(() => {});
          }
        }
        return;
      }

      // 💰 Gestion des boutons de confirmation/annulation boutique
      if (interaction.isButton() && (interaction.customId.startsWith('confirm_purchase_') || 
          interaction.customId.startsWith('cancel_purchase_'))) {
        try {
          const cheminBoutique = path.join(__dirname, '..', '..', 'Commands', 'economie', 'boutique.js');
          
          if (require('fs').existsSync(cheminBoutique)) {
            const fichierBoutique = require(cheminBoutique);
            
            if (typeof fichierBoutique.handleButton === 'function') {
              await fichierBoutique.handleButton(client, interaction);
              console.log('✅ Bouton boutique traité avec succès');
            } else {
              throw new Error("Méthode handleButton manquante dans boutique.js");
            }
          } else {
            throw new Error(`Fichier boutique.js introuvable`);
          }
        } catch (error) {
          console.error(`❌ Erreur bouton boutique '${interaction.customId}':`, error.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue.",
              flags: 64,
            }).catch(() => {});
          }
        }
        return;
      }

      // 💰 Gestion des modals de boutique
      if (interaction.isModalSubmit() && interaction.customId.startsWith('custom_role_modal_')) {
        try {
          const cheminBoutique = path.join(__dirname, '..', '..', 'Commands', 'economie', 'boutique.js');          
          if (require('fs').existsSync(cheminBoutique)) {
            const fichierBoutique = require(cheminBoutique);
            
            if (typeof fichierBoutique.handleModal === 'function') {
              await fichierBoutique.handleModal(client, interaction);
              console.log('✅ Modal boutique traité avec succès');
            } else {
              throw new Error("Méthode handleModal manquante dans boutique.js");
            }
          } else {
            throw new Error(`Fichier boutique.js introuvable`);
          }
        } catch (error) {
          console.error(`❌ Erreur modal boutique '${interaction.customId}':`, error.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors de la création du rôle.",
              flags: 64,
            }).catch(() => {});
          }
        }
        return;
      }

      // 💰 Gestion des boutons de donation
      if (interaction.isButton() && interaction.customId && 
          (interaction.customId.startsWith('accept_donation_') || 
           interaction.customId.startsWith('reject_donation_'))) {
        
        try {
          const actionType = interaction.customId.startsWith('accept_donation_') 
            ? 'accept_donation' 
            : 'reject_donation';
          
          const cheminBoutonDonation = path.join(__dirname, '..', '..', 'Buttons', `${actionType}.js`);
          
          if (require('fs').existsSync(cheminBoutonDonation)) {
            const fichierBouton = require(cheminBoutonDonation);
            
            if (typeof fichierBouton.run === 'function') {
              await fichierBouton.run(client, interaction);
              console.log(`✅ Bouton donation ${actionType} traité avec succès`);
            } else {
              throw new Error("Méthode run manquante dans le fichier de donation");
            }
          } else {
            throw new Error(`Fichier ${actionType}.js introuvable`);
          }
        } catch (error) {
          console.error(`❌ Erreur bouton donation '${interaction.customId}':`, error.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors du traitement de la donation.",
              flags: 64,
            }).catch(() => {});
          }
        }
        return;
      }

      // Gestion sécurisée des commandes slash
      if (interaction.type === InteractionType.ApplicationCommand) {
        if (!interaction.commandName) {
          console.error("❌ Nom de commande manquant");
          return;
        }

        const cmd = client.slashCommand?.get(interaction.commandName);
        if (!cmd) {
          console.warn(`⚠️ Commande inconnue: ${interaction.commandName}`);
          return;
        }

        try {
          if (typeof cmd.run === 'function') {
            await cmd.run(client, interaction);
          } else {
            throw new Error("Méthode run manquante dans la commande");
          }
        } catch (error) {
          console.error(`❌ Erreur commande ${interaction.commandName}:`, error.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ Une erreur est survenue lors de l\'exécution de la commande.', 
              flags: 64
            }).catch(() => {});
          }
        }
        return;
      }

      // 🎁✨ Gestion spéciale des boutons de giveaway (PRIORITÉ ABSOLUE)
      if (interaction.isButton() && interaction.customId && boutonsGiveaway.includes(interaction.customId)) {
        if (interaction.replied || interaction.deferred) {
          console.log("⚠️ Interaction giveaway déjà traitée, abandon");
          return;
        }

        try {
          console.log(`🌸 Traitement du bouton giveaway: ${interaction.customId}`);
          const cheminBoutonGiveaway = path.join(__dirname, '..', '..', 'Buttons', `${interaction.customId}.js`);
          
          if (require('fs').existsSync(cheminBoutonGiveaway)) {
            const fichierBouton = require(cheminBoutonGiveaway);
            if (typeof fichierBouton === 'function') {
              await fichierBouton(client, interaction);
              console.log(`✅ Bouton giveaway ${interaction.customId} traité avec succès`);
            } else {
              throw new Error("Fichier bouton giveaway ne contient pas de fonction");
            }
          } else {
            console.warn(`⚠️ Fichier bouton giveaway introuvable: ${interaction.customId}.js`);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: "❌ Bouton giveaway non configuré correctement.",
                flags: 64,
              }).catch(() => {});
            }
          }
        } catch (err) {
          console.error(`❌ Erreur bouton giveaway '${interaction.customId}':`, err.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors de l'utilisation du bouton giveaway.",
              flags: 64,
            }).catch(() => {});
          } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
              content: "❌ Une erreur est survenue lors de l'utilisation du bouton giveaway."
            }).catch(() => {});
          }
        }
        return;
      }

      // 🎁 Gestion des menus de sélection giveaway (reroll spécifique)
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('reroll_')) {
        if (interaction.replied || interaction.deferred) {
          console.log("⚠️ Interaction menu giveaway déjà traitée, abandon");
          return;
        }

        try {
          console.log(`🌸 Traitement du menu giveaway: ${interaction.customId}`);
          const cheminBoutonGiveaway = path.join(__dirname, '..', '..', 'Buttons', 'reroll.js');
          
          if (require('fs').existsSync(cheminBoutonGiveaway)) {
            const fichierBouton = require(cheminBoutonGiveaway);
            if (typeof fichierBouton === 'function') {
              await fichierBouton(client, interaction);
              console.log(`✅ Menu giveaway ${interaction.customId} traité avec succès`);
            } else {
              throw new Error("Fichier reroll.js ne contient pas de fonction");
            }
          } else {
            console.warn(`⚠️ Fichier reroll.js introuvable`);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: "❌ Menu giveaway non configuré correctement.",
                flags: 64,
              }).catch(() => {});
            }
          }
        } catch (err) {
          console.error(`❌ Erreur menu giveaway '${interaction.customId}':`, err.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors de l'utilisation du menu giveaway.",
              flags: 64,
            }).catch(() => {});
          } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
              content: "❌ Une erreur est survenue lors de l'utilisation du menu giveaway."
            }).catch(() => {});
          }
        }
        return;
      }

      // Gestion des autres boutons (non giveaway, non ticket)
      if (interaction.isButton() && interaction.customId && !boutonsTicket.includes(interaction.customId)) {
        const partiesCustomId = interaction.customId.split('_');
        if (partiesCustomId.length < 2) {
          console.warn(`⚠️ Format customId invalide: ${interaction.customId}`);
          return;
        }

        const [type, action, utilisateurId, ...args] = partiesCustomId;
        
        if (!type || typeof type !== 'string') {
          console.warn(`⚠️ Type de bouton invalide: ${type}`);
          return;
        }

        try {
          const cheminBouton = path.join(__dirname, '..', '..', 'Buttons', `${type}.js`);
          
          if (require('fs').existsSync(cheminBouton)) {
            const fichierBouton = require(cheminBouton);
            if (typeof fichierBouton === 'function') {
              await fichierBouton(client, interaction, { action, utilisateurId, args });
            } else {
              throw new Error("Fichier bouton ne contient pas de fonction");
            }
          } else {
            console.warn(`⚠️ Fichier bouton introuvable: ${type}.js`);
          }
        } catch (err) {
          console.error(`❌ Erreur bouton '${interaction.customId}':`, err.message);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Une erreur est survenue lors de l'utilisation du bouton.",
              flags: 64,
            }).catch(() => {});
          }
        }
      }

      // 📊 Log des statistiques du système vocal (debug)
      if (interaction.customId === 'voice_system_stats' && interaction.isButton()) {
        try {
          if (typeof systemeVocal.getStats === 'function') {
            const stats = await systemeVocal.getStats();
            const embed = systemeVocal.EmbedFactory?.createStatsEmbed?.(stats);
            
            if (embed) {
              await interaction.reply({ embeds: [embed], flags: 64 });
            } else {
              await interaction.reply({
                content: `📊 **Statistiques du système vocal**\n` +
                        `• Canaux actifs: ${stats.activeChannels}\n` +
                        `• Utilisateurs connectés: ${stats.connectedUsers}\n` +
                        `• Temps de fonctionnement: ${stats.uptime}`,
                flags: 64
              });
            }
          } else {
            await interaction.reply({
              content: '❌ Statistiques non disponibles.',
              flags: 64
            });
          }
        } catch (error) {
          console.error('❌ Erreur affichage stats système vocal:', error);
          await interaction.reply({
            content: '❌ Erreur lors de la récupération des statistiques.',
            flags: 64
          });
        }
        return;
      }

    } catch (error) {
      console.error('❌ Erreur critique dans interactionCreate:', error.message);
      
      if (systemeVocal.Logger && typeof systemeVocal.Logger.error === 'function') {
        systemeVocal.Logger.error('Erreur critique interactionCreate:', {
          error: error.message,
          stack: error.stack,
          customId: interaction.customId,
          userId: interaction.user?.id,
          guildId: interaction.guild?.id
        });
      }
      
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: '❌ Une erreur inattendue est survenue.',
            flags: 64,
          });
        } catch (replyError) {
          console.error('❌ Impossible de répondre à l\'interaction:', replyError.message);
        }
      }
    }
  }
};
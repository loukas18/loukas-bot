const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const giveawaysPath = path.join(process.cwd(), "giveaways.json");

module.exports = async (client, interaction) => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "reroll" && !interaction.customId.startsWith("reroll_")) return;

    // Vérifier si l'interaction a déjà été traitée
    if (interaction.replied || interaction.deferred) {
      console.log("⚠️ Interaction déjà traitée, abandon");
      return;
    }

    // Répondre immédiatement avec flags au lieu d'ephemeral
    await interaction.deferReply({ flags: 64 });

    console.log("🔄 === DÉBUT REROLL GIVEAWAY ===");
    console.log(`👤 Demande de reroll par: ${interaction.user.tag} (${interaction.user.id})`);

    let giveaways = {};
    try {
      if (!fs.existsSync(giveawaysPath)) {
        console.error("❌ Fichier giveaways.json introuvable");
        return interaction.editReply({ 
          content: "❌ Aucune donnée de giveaway trouvée." 
        });
      }
      
      const data = fs.readFileSync(giveawaysPath, "utf8");
      giveaways = JSON.parse(data);
      console.log("📚 Fichier giveaways.json chargé avec succès");
    } catch (err) {
      console.error("❌ Erreur lecture giveaways.json:", err);
      return interaction.editReply({ 
        content: "❌ Erreur lors de la lecture des données." 
      });
    }

    // Déterminer l'ID du message à utiliser
    let messageId;
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("reroll_")) {
      // Extraire l'ID du giveaway depuis le customId du menu
      messageId = interaction.customId.replace("reroll_", "");
      console.log("🔍 ID du message extrait du customId:", messageId);
    } else {
      // Utiliser l'ID du message de l'interaction pour les boutons
      messageId = interaction.message.id;
      console.log("📨 ID du message depuis interaction.message.id:", messageId);
    }

    const giveaway = giveaways[messageId];
    if (!giveaway) {
      console.warn("❌ Giveaway non trouvé pour l'ID:", messageId);
      return interaction.editReply({ 
        content: "❌ Giveaway non trouvé. Les données ont peut-être été supprimées." 
      });
    }

    console.log("✅ Giveaway trouvé:", {
      messageId: messageId,
      initiatorId: giveaway.initiatorId,
      participants: giveaway.participants?.length || 0,
      winners: giveaway.winners?.length || 0
    });

    if (interaction.user.id !== giveaway.initiatorId) {
      console.warn("🚫 Utilisateur non autorisé au reroll:", interaction.user.tag);
      return interaction.editReply({
        content: "❌ Seule la personne qui a lancé ce giveaway peut utiliser le reroll.",
      });
    }

    // Initialisation sécurisée des tableaux
    if (!Array.isArray(giveaway.participants)) {
      giveaway.participants = [];
      console.log("🔧 Initialisation du tableau participants");
    }
    if (!Array.isArray(giveaway.winners)) {
      giveaway.winners = [];
      console.log("🔧 Initialisation du tableau winners");
    }

    if (giveaway.participants.length === 0) {
      console.log("📭 Aucun participant à reroll");
      return interaction.editReply({ 
        content: "❌ Aucun participant pour ce giveaway." 
      });
    }

    // Si c'est un menu de sélection (reroll spécifique)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("reroll_")) {
      const winnersToReroll = interaction.values;
      console.log("🎯 Reroll spécifique pour les gagnants:", winnersToReroll);
      
      // Si "all" est sélectionné dans le menu
      if (winnersToReroll.includes("all")) {
        return await performFullReroll(client, giveaways, interaction, giveaway, messageId);
      }
      
      // Effectuer le reroll pour les gagnants sélectionnés
      const allParticipants = [...giveaway.participants];
      
      for (const winnerIndex of winnersToReroll) {
        const index = parseInt(winnerIndex);
        if (index >= 0 && index < giveaway.winners.length) {
          // Retirer l'ancien gagnant de la liste des gagnants
          const oldWinner = giveaway.winners[index];
          
          // Choisir un nouveau gagnant parmi les participants
          if (allParticipants.length > 0) {
            const randIndex = Math.floor(Math.random() * allParticipants.length);
            const newWinner = allParticipants[randIndex];
            
            // Remplacer l'ancien gagnant
            giveaway.winners[index] = newWinner;
            
            // Retirer le nouveau gagnant des participants disponibles pour éviter les doublons
            allParticipants.splice(randIndex, 1);
            
            console.log(`🔄 Gagnant ${index + 1} changé: ${oldWinner} -> ${newWinner}`);
          }
        }
      }

      // Sauvegarder et mettre à jour
      return await saveAndUpdateGiveaway(client, giveaways, interaction, giveaway, messageId, "Reroll spécifique effectué avec succès !");
    }

    // Si c'est le bouton reroll principal
    if (interaction.customId === "reroll") {
      console.log(`🎯 Bouton reroll principal - Gagnants actuels: ${giveaway.winners.length}`);
      
      // Si il n'y a pas encore de gagnants, faire un reroll complet
      if (giveaway.winners.length === 0) {
        console.log("🎲 Aucun gagnant existant, reroll complet");
        return await performFullReroll(client, giveaways, interaction, giveaway, messageId);
      }
      
      // Si il y a plusieurs gagnants, proposer de choisir lesquels reroll
      if (giveaway.winners.length > 1) {
        console.log("📋 Plusieurs gagnants, affichage du menu de sélection");
        
        try {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`reroll_${messageId}`)
            .setPlaceholder("Sélectionnez les gagnants à relancer")
            .setMinValues(1)
            .setMaxValues(Math.min(giveaway.winners.length, 25)); // Discord limite à 25 options

          // Ajouter les options pour chaque gagnant (max 24 pour laisser place à "all")
          const maxWinners = Math.min(giveaway.winners.length, 24);
          for (let i = 0; i < maxWinners; i++) {
            const winnerId = giveaway.winners[i];
            let winnerName;
            try {
              const user = await client.users.fetch(winnerId);
              winnerName = user.username;
            } catch {
              winnerName = `Utilisateur ${winnerId}`;
            }
            
            selectMenu.addOptions({
              label: `Gagnant ${i + 1}: ${winnerName}`.substring(0, 100), // Discord limite à 100 caractères
              value: i.toString(),
              description: `Relancer le tirage pour ce gagnant`.substring(0, 100)
            });
          }

          // Ajouter une option pour tout relancer
          selectMenu.addOptions({
            label: "🔄 Relancer tous les gagnants",
            value: "all",
            description: "Effectuer un nouveau tirage complet"
          });

          const row = new ActionRowBuilder().addComponents(selectMenu);

          console.log("📤 Envoi du menu de sélection...");
          await interaction.editReply({
            content: "🎯 **Sélection du reroll**\nChoisissez quels gagnants vous souhaitez relancer :",
            components: [row]
          });
          console.log("✅ Menu de sélection envoyé avec succès");
          return;
          
        } catch (menuError) {
          console.error("❌ Erreur création/envoi menu de sélection:", menuError);
          // Fallback : faire un reroll complet direct
          console.log("🔄 Fallback vers reroll complet");
          return await performFullReroll(client, giveaways, interaction, giveaway, messageId);
        }
      }
      
      // Si il n'y a qu'un seul gagnant, reroll direct
      console.log("🎲 Un seul gagnant, reroll direct");
      return await performFullReroll(client, giveaways, interaction, giveaway, messageId);
    }

  } catch (error) {
    console.error("❌ Erreur critique dans reroll.js:", error);
    
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ Une erreur est survenue lors du reroll.",
          flags: 64
        });
      } catch (replyError) {
        console.error("❌ Impossible de répondre à l'interaction:", replyError);
      }
    } else {
      try {
        await interaction.editReply({
          content: "❌ Une erreur est survenue lors du reroll."
        });
      } catch (editError) {
        console.error("❌ Impossible d'éditer la réponse:", editError);
      }
    }
  }
};

async function performFullReroll(client, giveaways, interaction, giveaway, messageId) {
  try {
    console.log("👥 Participants trouvés:", giveaway.participants.length);

    // Tirage au sort complet
    const allParticipants = [...giveaway.participants];
    const winners = [];
    const needed = giveaway.nbGagnants || 1;

    console.log(`🎯 Nombre de gagnants requis: ${needed}`);

    while (winners.length < needed && allParticipants.length > 0) {
      const randIndex = Math.floor(Math.random() * allParticipants.length);
      winners.push(allParticipants[randIndex]);
      allParticipants.splice(randIndex, 1);
    }

    giveaway.winners = winners;
    console.log("🏆 Nouveaux gagnants choisis:", winners);

    return await saveAndUpdateGiveaway(client, giveaways, interaction, giveaway, messageId, "Reroll complet effectué avec succès !");
  } catch (error) {
    console.error("❌ Erreur dans performFullReroll:", error);
    throw error;
  }
}

async function saveAndUpdateGiveaway(client, giveaways, interaction, giveaway, messageId, successMessage) {
  try {
    // Sauvegarde avec gestion d'erreur améliorée
    try {
      giveaways[messageId] = giveaway;
      
      // Sauvegarde atomique
      const tempPath = giveawaysPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(giveaways, null, 2));
      fs.renameSync(tempPath, giveawaysPath);
      
      console.log("✅ Données sauvegardées dans giveaways.json");
    } catch (saveError) {
      console.error("❌ Erreur lors de la sauvegarde:", saveError);
      return interaction.editReply({ 
        content: "❌ Erreur lors de la sauvegarde. Réessayez plus tard." 
      });
    }

    const winnersMentions = giveaway.winners.map((id) => `<@${id}>`).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("🎊 Giveaway Reroll")
      .setDescription(
        `🎁 **Prix gagné :** \`${giveaway.prix}\`\n` +
        `🏆 **Nouveaux gagnants :** ${winnersMentions}\n\n` +
        `🎉 Félicitations aux nouveaux gagnants !`
      )
      .setColor("Green")
      .setFooter({ 
        text: `Giveaway relancé par ${giveaway.initiatorName || "Un administrateur"}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    // Si l'image existe, l'ajouter
    try {
      if (fs.existsSync("./gw.jpg")) {
        embed.setImage("attachment://gw.jpg");
      }
    } catch (imageError) {
      console.warn("⚠️ Image gw.jpg non trouvée");
    }

    const participerBtn = new ButtonBuilder()
      .setCustomId("participer")
      .setLabel("🎯 Participer")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const participantsBtn = new ButtonBuilder()
      .setCustomId("participants")
      .setLabel(`👥 Participants (${giveaway.participants.length})`)
      .setStyle(ButtonStyle.Secondary);

    const rerollBtn = new ButtonBuilder()
      .setCustomId("reroll")
      .setLabel("🔄 Relancer")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(participerBtn, participantsBtn, rerollBtn);

    // Mettre à jour le message original
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      const message = await channel.messages.fetch(messageId);
      
      const updateData = { embeds: [embed], components: [row] };
      
      // Ajouter l'image si elle existe
      if (fs.existsSync("./gw.jpg")) {
        const { AttachmentBuilder } = require("discord.js");
        updateData.files = [new AttachmentBuilder("./gw.jpg")];
      }
      
      await message.edit(updateData);
      console.log("✅ Message du giveaway mis à jour avec les nouveaux gagnants");
    } catch (updateError) {
      console.error("❌ Erreur mise à jour message principal:", updateError);
      // Continuer même si la mise à jour échoue
    }

    // Répondre à l'interaction
    await interaction.editReply({ 
      content: `✅ ${successMessage}`,
      components: [] // Retirer le menu de sélection après utilisation
    });

    // Donner le rôle si applicable
    if (giveaway.roleId) {
      try {
        const guild = await client.guilds.fetch(giveaway.guildId);
        for (const winnerId of giveaway.winners) {
          try {
            const member = await guild.members.fetch(winnerId);
            if (!member.roles.cache.has(giveaway.roleId)) {
              await member.roles.add(giveaway.roleId);
              console.log(`✅ Rôle donné à ${member.user.tag}`);
            }
          } catch (roleError) {
            console.warn(`❌ Impossible d'ajouter le rôle à ${winnerId} : ${roleError.message}`);
          }
        }
      } catch (guildError) {
        console.warn(`❌ Erreur récupération du serveur : ${guildError.message}`);
      }
    }

    // Envoyer un message public de félicitations
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      const roleText = giveaway.roleId ? `\n\n🎭 Rôle à récupérer : <@&${giveaway.roleId}>` : "";
      
      await channel.send({
        content: `🎊 Félicitations ${winnersMentions} !\n🏆 Vous avez gagné **${giveaway.prix}** lors du reroll !${roleText}`,
        allowedMentions: { 
          users: giveaway.winners, 
          roles: giveaway.roleId ? [giveaway.roleId] : [] 
        },
      });
      console.log("📣 Message de félicitations envoyé avec succès");
    } catch (congratsError) {
      console.error("❌ Erreur envoi message de félicitations:", congratsError);
      // Continuer même si l'envoi échoue
    }

    console.log("✅ === FIN REROLL GIVEAWAY ===");
  } catch (error) {
    console.error("❌ Erreur critique dans saveAndUpdateGiveaway:", error);
    
    try {
      await interaction.editReply({
        content: "❌ Une erreur critique est survenue lors du reroll."
      });
    } catch (editError) {
      console.error("❌ Impossible d'éditer la réponse finale:", editError);
    }
  }
}
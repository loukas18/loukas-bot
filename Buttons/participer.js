const fs = require("fs");
const path = require("path");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { checkRoleRequis, checkMessagesRequis } = require("../utils/giveawayManager");

const readGiveaways = () => {
  const giveawaysPath = path.join(process.cwd(), "giveaways.json");
  try {
    if (!fs.existsSync(giveawaysPath)) {
      return {};
    }
    
    const data = fs.readFileSync(giveawaysPath, "utf8");
    const parsed = JSON.parse(data);
    
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn("⚠️ Données giveaway corrompues, réinitialisation");
      return {};
    }
    
    return parsed;
  } catch (error) {
    console.error("❌ Erreur lecture giveaways:", error.message);
    return {};
  }
};

const writeGiveaways = (giveaways) => {
  const giveawaysPath = path.join(process.cwd(), "giveaways.json");
  try {
    if (typeof giveaways !== 'object' || giveaways === null) {
      throw new Error("Données giveaway invalides");
    }
    
    const tempPath = giveawaysPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(giveaways, null, 2));
    fs.renameSync(tempPath, giveawaysPath);
    return true;
  } catch (error) {
    console.error("❌ Erreur sauvegarde giveaways:", error.message);
    return false;
  }
};

module.exports = async (client, interaction) => {
  try {
    console.log("📊 === DEBUG PARTICIPATION ===");
    console.log(`👤 Action demandée par: ${interaction.user.tag} (${interaction.user.id})`);
    console.log("📨 Message ID:", interaction.message?.id);
    
    if (!interaction.message?.id) {
      console.warn("❌ Message non identifié pour cette interaction");
      return interaction.reply({ 
        content: "❌ Erreur : impossible d'identifier ce giveaway.",
        ephemeral: true
      });
    }

    let giveaways = {};
    try {
      giveaways = readGiveaways();
      console.log("📊 Giveaways disponibles:", Object.keys(giveaways).length);
    } catch (error) {
      console.error("❌ Erreur lecture fichier:", error);
      return interaction.reply({ 
        content: "❌ Erreur lors de la lecture des données du giveaway.",
        ephemeral: true
      });
    }

    const giveaway = giveaways[interaction.message.id];
    console.log("🎁 Giveaway trouvé:", !!giveaway);
    
    if (!giveaway) {
      console.log("❌ Giveaway non trouvé pour l'ID:", interaction.message.id);
      return interaction.reply({ 
        content: "❌ Giveaway non trouvé. Les données ont peut-être été supprimées.",
        ephemeral: true
      });
    }

    if (giveaway.ended) {
      console.log("📴 Giveaway déjà terminé");
      return interaction.reply({ 
        content: "❌ Ce giveaway est terminé.",
        ephemeral: true
      });
    }

    // ✅ Vérification du rôle requis
    const peutParticiper = await checkRoleRequis(interaction, giveaway);
    if (!peutParticiper) return;

    // ✅ Vérification du quota de messages
    const assezDeMessages = await checkMessagesRequis(interaction, giveaway);
    if (!assezDeMessages) return;

    // Répondre après toutes les vérifications
    await interaction.deferReply({ ephemeral: true });

    // Initialiser les tableaux si nécessaires
    if (!Array.isArray(giveaway.participants)) {
      giveaway.participants = [];
      console.log("🔧 Initialisation du tableau participants");
    }
    if (!Array.isArray(giveaway.winners)) {
      giveaway.winners = [];
      console.log("🔧 Initialisation du tableau winners");
    }

    const userId = interaction.user.id;
    const index = giveaway.participants.indexOf(userId);
    let replyContent = "";

    if (index === -1) {
      giveaway.participants.push(userId);
      replyContent = `✅ ${interaction.user.username} a rejoint le giveaway !`;
      console.log(`✅ Ajout de ${interaction.user.tag} à la liste des participants.`);
    } else {
      giveaway.participants.splice(index, 1);
      replyContent = `❌ ${interaction.user.username} s'est désinscrit du giveaway.`;
      console.log(`❌ Retrait de ${interaction.user.tag} de la liste des participants.`);
    }

    const participerBtn = new ButtonBuilder()
      .setCustomId("participer")
      .setLabel("🎯 Participer")
      .setStyle(ButtonStyle.Success)
      .setDisabled(false);

    const participantsBtn = new ButtonBuilder()
      .setCustomId("participants")
      .setLabel(`👥 Participants (${giveaway.participants.length})`)
      .setStyle(ButtonStyle.Secondary);

    const rerollBtn = new ButtonBuilder()
      .setCustomId("reroll")
      .setLabel("🔄 Relancer")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(giveaway.winners.length === 0);

    const row = new ActionRowBuilder().addComponents(participerBtn, participantsBtn, rerollBtn);

    try {
      giveaways[interaction.message.id] = giveaway;
      const saveSuccess = writeGiveaways(giveaways);
      
      if (!saveSuccess) {
        console.error("❌ Échec de la sauvegarde");
        return interaction.editReply({ 
          content: "❌ Erreur lors de la sauvegarde. Réessayez plus tard." 
        });
      }
      
      console.log(`💾 Giveaway sauvegardé - ${giveaway.participants.length} participants au total.`);
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde:", error);
      return interaction.editReply({ 
        content: "❌ Erreur lors de la sauvegarde. Réessayez plus tard." 
      });
    }

    try {
      await interaction.message.edit({ components: [row] });
      console.log("✅ Message principal mis à jour avec les nouveaux boutons");
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour du message principal:", error);
    }

    console.log("✅ Interaction traitée avec succès");
    await interaction.editReply({ content: replyContent });

  } catch (error) {
    console.error("❌ Erreur critique dans participer.js:", error);
    
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ Une erreur est survenue lors de la participation au giveaway.",
          ephemeral: true
        });
      } catch (replyError) {
        console.error("❌ Impossible de répondre à l'interaction:", replyError);
      }
    } else {
      try {
        await interaction.editReply({
          content: "❌ Une erreur est survenue lors de la participation au giveaway."
        });
      } catch (editError) {
        console.error("❌ Impossible d'éditer la réponse:", editError);
      }
    }
  }
};
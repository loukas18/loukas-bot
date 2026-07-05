const fs = require("fs");
const path = require("path");

// Fonction pour lire les giveaways directement
const readGiveaways = () => {
  const giveawaysPath = path.join(process.cwd(), "giveaways.json");
  try {
    if (!fs.existsSync(giveawaysPath)) {
      return {};
    }
    
    const data = fs.readFileSync(giveawaysPath, "utf8");
    const parsed = JSON.parse(data);
    
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn("🌸 Données giveaway corrompues, réinitialisation");
      return {};
    }
    
    return parsed;
  } catch (error) {
    console.error("💔 Erreur lecture giveaways:", error.message);
    return {};
  }
};

module.exports = async (client, interaction) => {
  try {
    // 🚀✨ Répondre immédiatement pour éviter l'erreur d'interaction kawaii ~
    await interaction.deferReply({ ephemeral: true });

    console.log("🌸 === DEBUG PARTICIPANTS KAWAII === 🌸");
    console.log(`🙋 Demande faite par: ${interaction.user.tag} (${interaction.user.id})`);
    console.log("📨 Message ID:", interaction.message?.id);
    
    if (!interaction.message?.id) {
      console.warn("❌ Message non identifié pour cette interaction kawaii !");
      return interaction.editReply({ 
        content: "❌ Erreur : impossible d'identifier ce giveaway kawaii ~ oopsie !" 
      });
    }

    let giveaways = {};
    try {
      giveaways = readGiveaways();
      console.log("📊 Giveaways disponibles kawaii:", Object.keys(giveaways).length);
    } catch (error) {
      console.error("💔 Erreur lecture fichier kawaii:", error);
      return interaction.editReply({ 
        content: "❌💔 Erreur lors de la lecture des données du giveaway kawaii ~ oopsie !" 
      });
    }

    const giveaway = giveaways[interaction.message.id];
    console.log("🎁 Giveaway trouvé kawaii:", !!giveaway);
    
    if (!giveaway) {
      console.log("❌ Giveaway non trouvé pour l'ID kawaii:", interaction.message.id);
      return interaction.editReply({ 
        content: "❌🌸 Giveaway non trouvé kawaii ~ il se peut que les données aient été supprimées !" 
      });
    }

    // 🌟 Initialiser le tableau des participants si nécessaire kawaii ~
    if (!Array.isArray(giveaway.participants)) {
      giveaway.participants = [];
      console.log("🔧 participants array était undefined kawaii, initialisé à []");
    }

    console.log("👥 Participants trouvés kawaii:", giveaway.participants.length);
    console.log("📋 Liste kawaii:", giveaway.participants);

    if (giveaway.participants.length === 0) {
      return interaction.editReply({ 
        content: "❌🌸 Aucun participant pour ce giveaway kawaii ~ personne n'a encore participé !" 
      });
    }

    const mentionList = giveaway.participants
      .map((id, index) => `${index + 1}. <@${id}>`)
      .join("\n");

    // 📏 Vérifier si la liste est trop longue pour Discord kawaii ~
    if (mentionList.length > 1900) {
      const chunked = [];
      let currentChunk = "";
      
      for (const mention of mentionList.split("\n")) {
        if ((currentChunk + mention + "\n").length > 1900) {
          chunked.push(currentChunk);
          currentChunk = "";
        }
        currentChunk += mention + "\n";
      }
      if (currentChunk) chunked.push(currentChunk);

      // 💌 Essayer d'envoyer en MP kawaii ~
      try {
        for (let i = 0; i < chunked.length; i++) {
          const chunk = chunked[i];
          const header = i === 0 ? "**🌸✨ Liste des participants kawaii ~ nyaa ! ✨🌸**\n" : "";
          await interaction.user.send(`${header}${chunk}`);
          console.log(`📨 MP envoyé (${i + 1}/${chunked.length}) à ${interaction.user.tag}`);
        }
        
        console.log("✅ Tous les MPs ont été envoyés avec succès kawaii !");
        return interaction.editReply({
          content: `✅🎀 Je t'ai envoyé la liste des participants kawaii en message privé ~ nyaa !\n💖 Total: **${giveaway.participants.length}** participants kawaii !`,
        });
      } catch (error) {
        console.warn("⚠️ Envoi MP échoué, fallback à message tronqué kawaii.");
        console.error("💔 Erreur envoi MP kawaii:", error);
        
        const truncated = mentionList.substring(0, 1900) + "...";
        return interaction.editReply({
          content: `**🧸💖 Participants kawaii (${giveaway.participants.length}) :**\n${truncated}\n\n*🌸 Liste tronquée car trop longue kawaii ~ demande-moi d'activer tes MP pour la liste complète !*`,
        });
      }
    } else {
      console.log("✅ Liste courte, envoi direct dans la réponse éphémère kawaii !");
      return interaction.editReply({
        content: `**🧸💖 Participants kawaii (${giveaway.participants.length}) :**\n${mentionList}`,
      });
    }

  } catch (error) {
    console.error("❌ Erreur critique dans participants.js:", error);
    
    // Vérifier si on peut encore répondre
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ Une erreur est survenue lors de l'affichage des participants.",
          ephemeral: true
        });
      } catch (replyError) {
        console.error("❌ Impossible de répondre à l'interaction:", replyError);
      }
    } else {
      try {
        await interaction.editReply({
          content: "❌ Une erreur est survenue lors de l'affichage des participants."
        });
      } catch (editError) {
        console.error("❌ Impossible d'éditer la réponse:", editError);
      }
    }
  }
};
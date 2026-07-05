const axios = require("axios");
const querystring = require("querystring");
const { ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Rate limiting global pour éviter le spam
const rateLimits = new Map();
const RATE_LIMIT_MS = 1000;

// Validation et nettoyage périodique du rate limiting
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimits.entries()) {
    if (now - timestamp > 300000) { // 5 minutes
      rateLimits.delete(key);
    }
  }
}, 300000); // Nettoyer toutes les 5 minutes

const formatTime = (milliseconds) => {
  const ms = Math.abs(Number(milliseconds)) || 0;
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let str = "";
  if (days) str += `${days}j `;
  if (hours) str += `${hours}h `;
  if (minutes) str += `${minutes}m `;
  str += `${remainingSeconds}s`;
  return str.trim();
};

const readGiveaways = () => {
  const giveawaysPath = path.join(process.cwd(), "giveaways.json");
  try {
    if (!fs.existsSync(giveawaysPath)) {
      return {};
    }
    
    const data = fs.readFileSync(giveawaysPath, "utf8");
    const parsed = JSON.parse(data);
    
    // Validation des données
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

const writeGiveaways = (giveaways) => {
  const giveawaysPath = path.join(process.cwd(), "giveaways.json");
  try {
    // Validation avant écriture
    if (typeof giveaways !== 'object' || giveaways === null) {
      throw new Error("Données giveaway invalides");
    }
    
    // Sauvegarde atomique
    const tempPath = giveawaysPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(giveaways, null, 2));
    fs.renameSync(tempPath, giveawaysPath);
    return true;
  } catch (error) {
    console.error("Erreur sauvegarde giveaways:", error.message);
    return false;
  }
}; 

// Variables pour gérer les intervals actifs
const activeIntervals = new Map();

async function finalizeGiveaway(client, giveaway, message) {
  try {
    // Validation des paramètres
    if (!client || !giveaway || !message) {
      console.error("❌ Paramètres invalides pour finalizeGiveaway");
      return;
    }

    const giveaways = readGiveaways();
    giveaway.ended = true;

    const participants = Array.isArray(giveaway.participants) ? giveaway.participants : [];
    let winners = [];

    if (participants.length === 0) {
      winners = [];
    } else if (participants.length <= (giveaway.nbGagnants || 1)) {
      winners = [...participants];
    } else {
      // Tirage sécurisé avec mélange Fisher-Yates
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      winners = shuffled.slice(0, giveaway.nbGagnants || 1);
    }

    giveaway.winners = winners;

    let winnersText = winners.length === 0
      ? "Personne n'a participé au giveaway."
      : winners.map(w => `<@${w}>`).join(", ");

    const embedEnded = new EmbedBuilder()
      .setTitle("🎉 Giveaway terminé 🎉")
      .setDescription(`**Prix :** \`${giveaway.prix || 'Non spécifié'}\`\n**Gagnants (${winners.length}) :** ${winnersText}`)
      .setColor("Green")
      .setFooter({ text: "Le giveaway est terminé." });

    const participateDisabledBtn = new ButtonBuilder()
      .setCustomId("participer")
      .setLabel("🎉 Participer")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const participantsBtn = new ButtonBuilder()
      .setCustomId("participants")
      .setLabel(`👥 Participants (${participants.length})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false);

    const rerollBtn = new ButtonBuilder()
      .setCustomId("reroll")
      .setLabel("🔄 Reroll")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false);

    const newRow = new ActionRowBuilder()
      .addComponents(participateDisabledBtn, participantsBtn, rerollBtn);

    await message.edit({ embeds: [embedEnded], components: [newRow] }).catch(error => {
      console.error("Erreur mise à jour message:", error.message);
    });

    giveaways[message.id] = giveaway;
    writeGiveaways(giveaways);

    // Envoi message félicitations avec gestion d'erreur
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      if (winners.length > 0) {
        const roleMention = giveaway.roleId ? `\n\nRôle à récupérer : <@&${giveaway.roleId}>` : "";
        await channel.send({
          content: `🎉 Félicitations ${winnersText} ! Vous avez gagné **${giveaway.prix}** !${roleMention}`,
          allowedMentions: {
            users: winners,
            roles: giveaway.roleId ? [giveaway.roleId] : []
          },
        });
      } else {
        await channel.send("Le giveaway est terminé mais il n'y a eu aucun participant.");
      }
    } catch (error) {
      console.error("Erreur envoi message félicitations:", error.message);
    }
  } catch (error) {
    console.error("❌ Erreur critique dans finalizeGiveaway:", error.message);
  }
}

function startGiveawayInterval(client, giveaway, message) {
  const messageId = message.id;
  
  // Validation des paramètres
  if (!client || !giveaway || !message) {
    console.error("❌ Paramètres invalides pour startGiveawayInterval");
    return;
  }

  // Arrêter l'interval existant
  if (activeIntervals.has(messageId)) {
    clearInterval(activeIntervals.get(messageId));
    console.log("🔄 Interval précédent arrêté");
  }

  const interval = setInterval(async () => {
    try {
      const currentGiveaways = readGiveaways();
      const currentGiveaway = currentGiveaways[messageId];

      if (!currentGiveaway || currentGiveaway.ended) {
        clearInterval(interval);
        activeIntervals.delete(messageId);
        return;
      }

      const now = Date.now();
      const remaining = currentGiveaway.endTimestamp - now;

      if (remaining <= 0) {
        clearInterval(interval);
        activeIntervals.delete(messageId);
        await finalizeGiveaway(client, currentGiveaway, message);
        return;
      }

      // Rate limiting pour les mises à jour
      const lastUpdate = rateLimits.get(`giveaway_${messageId}`) || 0;
      if (now - lastUpdate < RATE_LIMIT_MS) {
        return;
      }
      rateLimits.set(`giveaway_${messageId}`, now);

      const currentEmbed = message.embeds[0];
      if (currentEmbed) {
        const newEmbed = EmbedBuilder.from(currentEmbed).setFooter({
          text: `Temps restant : ${formatTime(remaining)}`,
        });
        await message.edit({ embeds: [newEmbed] }).catch(() => {});
      }
    } catch (err) {
      console.error("Erreur mise à jour giveaway:", err.message);
      clearInterval(interval);
      activeIntervals.delete(messageId);
    }
  }, 15000); // 15 secondes au lieu de 1 seconde pour éviter le rate limiting

  activeIntervals.set(messageId, interval);
  console.log(`✅ Interval démarré pour giveaway ${messageId}`);
}

async function recoverActiveGiveaways(client) {
  console.log("🔄 Récupération des giveaways actifs...");
  
  const giveaways = readGiveaways();
  let recovered = 0;

  for (const messageId in giveaways) {
    const gw = giveaways[messageId];

    if (gw.ended) continue;

    const now = Date.now();
    const remaining = gw.endTimestamp - now;

    try {
      const channel = await client.channels.fetch(gw.channelId);
      const message = await channel.messages.fetch(gw.messageId);

      if (remaining <= 0) {
        console.log(`⏰ Finalisation du giveaway ${messageId} (expiré)`);
        await finalizeGiveaway(client, gw, message);
      } else {
        console.log(`✅ Relance du giveaway ${messageId} (${formatTime(remaining)} restant)`);
        startGiveawayInterval(client, gw, message);
        recovered++;
      }
    } catch (error) {
      console.error(`❌ Erreur récupération giveaway ${messageId}:`, error.message);
      gw.ended = true;
    }
  }

  writeGiveaways(giveaways);
  console.log(`✅ ${recovered} giveaway(s) récupéré(s) avec succès`);
}



// --- Gestion sécurisée des activités rotatives ---
let activityInterval = null;
let activities = [];
let activityIndex = 0;

function startActivitiesRotation(client) {
  if (!Array.isArray(activities) || !activities.length) {
    console.log("❌ Aucune activité valide pour la rotation");
    return;
  }

  if (activityInterval) {
    clearInterval(activityInterval);
  }

  // Validation de l'activité courante
  const currentActivity = activities[activityIndex];
  if (currentActivity && currentActivity.message && currentActivity.type) {
    try {
      client.user.setActivity(currentActivity.message, {
        type: ActivityType[currentActivity.type] || ActivityType.Playing
      });
    } catch (error) {
      console.error("❌ Erreur lors de la définition de l'activité:", error.message);
    }
  }

  activityInterval = setInterval(() => {
    try {
      activityIndex = (activityIndex + 1) % activities.length;
      const activity = activities[activityIndex];
      
      if (activity && activity.message && activity.type && ActivityType[activity.type]) {
        client.user.setActivity(activity.message, {
          type: ActivityType[activity.type]
        });
      }
    } catch (error) {
      console.error("❌ Erreur rotation activité:", error.message);
    }
  }, 30000); // 30 secondes pour éviter le rate limiting Discord

  console.log(`✅ Rotation d'activités activée (${activities.length} activité(s))`);
}

function stopActivitiesRotation(client) {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
    
    try {
      client.user.setActivity(null);
    } catch (error) {
      console.error("❌ Erreur lors de l'arrêt de l'activité:", error.message);
    }
    
    console.log("⏸️ Rotation d'activités arrêtée");
  }
}

// Fonction utilitaire pour charger les modules de façon sécurisée
async function loadModule(client, moduleConfig) {
  try {
    const moduleFile = require(moduleConfig.path);
    
    if (moduleConfig.method && typeof moduleFile[moduleConfig.method] === "function") {
      await moduleFile[moduleConfig.method](client);
    } else if (typeof moduleFile.execute === "function") {
      await moduleFile.execute(client);
    } else {
      console.warn(`⚠️ Module ${moduleConfig.name}: aucune méthode d'exécution trouvée`);
      return false;
    }
    
    console.log(`✅ Module ${moduleConfig.name} initialisé avec succès`);
    return true;
  } catch (err) {
    console.error(`❌ Erreur lors du chargement du module ${moduleConfig.name}:`, err.message);
    return false;
  }
}

// Nettoyage lors de l'arrêt du processus
process.on('SIGINT', () => {
  console.log('🛑 Arrêt du processus...');
  activeIntervals.forEach((interval) => clearInterval(interval));
  if (activityInterval) clearInterval(activityInterval);
});

process.on('SIGTERM', () => {
  console.log('🛑 Terminaison du processus...');
  activeIntervals.forEach((interval) => clearInterval(interval));
  if (activityInterval) clearInterval(activityInterval);
});

module.exports = {
  name: "ready",
  async execute(client) {
    try {
      console.log(`🚀 ${client.user.username} est prêt !`);

      // Chargement sécurisé des commandes
      if (typeof client.handleCommands === "function") {
        try {
          await client.handleCommands();
          console.log("✅ Commandes chargées");
        } catch (error) {
          console.error("❌ Erreur chargement commandes:", error.message);
        }
      }

      // Lancement sécurisé des modules
      const modules = [
        { name: "reseaux", path: "../guild/reseaux.js" },
        { name: "reglement", path: "../guild/reglement.js", method: "executeOnReady" },
        { name: "support", path: "../guild/supportEmbed.js", method: "executeOnReady" },
        { name: "information", path: "../guild/information.js" } // Ajout du module infoEmbed
      ];

      // Relance des rappels du système /travail
try {
 const travailCommand = require('../../Commands/economie/travail.js');
await travailCommand.restartReminders(client);
  console.log("✅ Rappels /travail relancés avec succès");
} catch (err) {
  console.error("❌ Erreur lors du redémarrage des rappels /travail:", err.message);
}


      let successfulModules = 0;
      for (const moduleConfig of modules) {
        const success = await loadModule(client, moduleConfig);
        if (success) successfulModules++;
      }

      console.log(`✅ ${successfulModules}/${modules.length} modules initialisés`);

      // Récupération sécurisée des giveaways actifs
      await recoverActiveGiveaways(client);

      // Chargement sécurisé des activités
      try {
        const activitiesPath = path.join(process.cwd(), 'activities.json');

        if (fs.existsSync(activitiesPath)) {
          const data = fs.readFileSync(activitiesPath, 'utf8');
          const parsedActivities = JSON.parse(data);
          
          if (Array.isArray(parsedActivities) && parsedActivities.length > 0) {
            // Validation des activités
            activities = parsedActivities.filter(activity => 
              activity && 
              typeof activity.message === 'string' && 
              activity.message.trim().length > 0 &&
              typeof activity.type === 'string' &&
              ActivityType[activity.type] !== undefined
            );
            
            if (activities.length > 0) {
              startActivitiesRotation(client);
            } else {
              console.log("❌ Aucune activité valide trouvée dans activities.json");
            }
          } else {
            console.log("❌ Format activities.json invalide");
          }
        } else {
          console.log("ℹ️ Fichier activities.json non trouvé - rotation d'activités désactivée");
        }
      } catch (err) {
        console.error("❌ Erreur lecture activities.json:", err.message);
      }

      // Exposition sécurisée des fonctions
      client.startActivitiesRotation = () => startActivitiesRotation(client);
      client.stopActivitiesRotation = () => stopActivitiesRotation(client);
      
      console.log("🎉 Bot entièrement initialisé et opérationnel !");
      
    } catch (error) {
      console.error("❌ Erreur critique dans ready event:", error.message);
    }
  }
};
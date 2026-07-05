const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const giveawaysPath = path.join(process.cwd(), "giveaways.json");
const activeIntervals = new Map();

const rateLimits = new Map();
const RATE_LIMIT_MS = 1000;

const formatTime = (milliseconds) => {
  const seconds = Math.floor(Math.abs(milliseconds) / 1000);
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
  try {
    if (!fs.existsSync(giveawaysPath)) {
      return {};
    }
    
    const data = fs.readFileSync(giveawaysPath, "utf8");
    const parsed = JSON.parse(data);
    
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn("🌸 Données de giveaway corrompues, réinitialisation");
      return {};
    }
    
    return parsed;
  } catch (error) {
    console.error("💔 Erreur lors de la lecture des giveaways:", error.message);
    return {};
  }
};

const writeGiveaways = (giveaways) => {
  try {
    if (typeof giveaways !== 'object' || giveaways === null) {
      throw new Error("Les données de giveaway doivent être un objet valide");
    }
    
    const tempPath = giveawaysPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(giveaways, null, 2));
    fs.renameSync(tempPath, giveawaysPath);
    
    console.log("✨ Giveaways sauvegardés avec succès");
    return true;
  } catch (error) {
    console.error("💔 Erreur lors de la sauvegarde:", error.message);
    return false;
  }
};

// Vérifie si un membre possède le rôle requis pour participer
async function checkRoleRequis(interaction, giveaway) {
  if (!giveaway.roleRequisId) return true;

  try {
    const guild = await interaction.client.guilds.fetch(giveaway.guildId);
    const member = await guild.members.fetch(interaction.user.id);
    const hasRole = member.roles.cache.has(giveaway.roleRequisId);

    if (!hasRole) {
      await interaction.reply({
        content: `🔒 **Accès refusé !**\nTu dois avoir le rôle <@&${giveaway.roleRequisId}> pour participer à ce giveaway.`,
        ephemeral: true,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("💔 Erreur lors de la vérification du rôle requis:", error.message);
    await interaction.reply({
      content: "⚠️ Une erreur s'est produite lors de la vérification de ton rôle. Réessaie.",
      ephemeral: true,
    });
    return false;
  }
}

// Vérifie si un membre a assez de messages pour participer
async function checkMessagesRequis(interaction, giveaway) {
  if (!giveaway.messagesRequis || giveaway.messagesRequis <= 0) return true;

  const count = (giveaway.messageCounts || {})[interaction.user.id] || 0;

  if (count < giveaway.messagesRequis) {
    await interaction.reply({
      content: `💬 **Pas assez de messages !**\nTu as envoyé \`${count}/${giveaway.messagesRequis}\` messages depuis le début de ce giveaway.\nContinue à discuter sur le serveur pour pouvoir participer ! 🗨️`,
      ephemeral: true,
    });
    return false;
  }

  return true;
}

// Incrémente le compteur de messages d'un utilisateur pour tous les giveaways actifs du serveur
function trackGiveawayMessage(guildId, userId) {
  try {
    const giveaways = readGiveaways();
    let updated = false;

    for (const id in giveaways) {
      const gw = giveaways[id];

      // On ignore les giveaways terminés, d'autres serveurs, ou sans quota de messages
      if (gw.ended || gw.guildId !== guildId || !gw.messagesRequis || gw.messagesRequis <= 0) continue;

      if (!gw.messageCounts) gw.messageCounts = {};
      gw.messageCounts[userId] = (gw.messageCounts[userId] || 0) + 1;
      updated = true;
    }

    if (updated) writeGiveaways(giveaways);
  } catch (error) {
    console.error("💔 Erreur lors du tracking du message:", error.message);
  }
}

function startGiveawayInterval(client, giveaway, message) {
  const messageId = message.id;
  
  if (!client || !giveaway || !message) {
    console.error("❌ Paramètres invalides pour startGiveawayInterval");
    return;
  }
  
  if (activeIntervals.has(messageId)) {
    clearInterval(activeIntervals.get(messageId));
    console.log("🔄 Interval précédent arrêté");
  }

  const interval = setInterval(async () => {
    try {
      const currentGiveaways = readGiveaways();
      const currentGiveaway = currentGiveaways[messageId];
      
      if (!currentGiveaway) {
        console.log("🌸 Giveaway supprimé, arrêt de l'interval");
        clearInterval(interval);
        activeIntervals.delete(messageId);
        return;
      }

      const now = Date.now();
      const remaining = currentGiveaway.endTimestamp - now;

      if (remaining <= 0) {
        console.log("⏰🎉 Temps écoulé, finalisation du giveaway");
        clearInterval(interval);
        activeIntervals.delete(messageId);
        await finalizeGiveaway(client, currentGiveaway, message);
        return;
      }

      const lastUpdate = rateLimits.get(`update_${messageId}`) || 0;
      if (now - lastUpdate < 30000) {
        return;
      }
      rateLimits.set(`update_${messageId}`, now);

      const currentEmbed = message.embeds[0];
      if (currentEmbed) {
        const endTimestamp = Math.floor(currentGiveaway.endTimestamp / 1000);
        
        const newEmbed = new EmbedBuilder()
          .setTitle("🎉✨ Giveaway en cours ✨🎉")
          .setDescription(
            `🎁 **Prix à gagner :** \`${currentGiveaway.prix || 'Non spécifié'}\`\n` +
            `👑 **Nombre de gagnants :** \`${currentGiveaway.nbGagnants || 1}\`\n\n` +
            `⏰ **Se termine :** <t:${endTimestamp}:R>\n` +
            `📅 **Date de fin :** <t:${endTimestamp}:F>\n\n` +
            (currentGiveaway.roleRequisId ? `🔒 **Rôle requis pour participer :** <@&${currentGiveaway.roleRequisId}>\n` : '') +
            (currentGiveaway.messagesRequis > 0 ? `💬 **Messages requis pour participer :** \`${currentGiveaway.messagesRequis}\`\n` : '') +
            `\n🌟 Clique sur **Participer** pour rejoindre le giveaway ! 🍀💖`
          )
          .setColor("Random")
          .setFooter({ text: `Organisé par ${currentGiveaway.initiatorName || 'Administrateur'} 🎀` })
          .setImage("attachment://gw.jpg")
          .setTimestamp(currentGiveaway.endTimestamp);

        await message.edit({ embeds: [newEmbed] }).catch(console.error);
      }
    } catch (err) {
      console.error("💔 Erreur lors de la mise à jour:", err.message);
      clearInterval(interval);
      activeIntervals.delete(messageId);
    }
  }, 30000);

  activeIntervals.set(messageId, interval);
  console.log(`✅🎀 Interval démarré pour le giveaway ${messageId}`);
}

async function finalizeGiveaway(client, giveaway, message) {
  try {
    const giveaways = readGiveaways();
    
    if (!giveaway || !giveaway.participants) {
      console.error("❌ Données de giveaway invalides");
      return;
    }
    
    giveaway.ended = true;
    
    console.log("🌟🎊 === TIRAGE GIVEAWAY === 🎊🌟");
    console.log("💖 Participants:", giveaway.participants.length);

    const participants = Array.isArray(giveaway.participants) ? giveaway.participants : [];
    let winners = [];

    if (participants.length === 0) {
      winners = [];
    } else if (participants.length <= (giveaway.nbGagnants || 1)) {
      winners = [...participants];
    } else {
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      winners = shuffled.slice(0, giveaway.nbGagnants || 1);
    }

    giveaway.winners = winners;

    let winnersText;
    if (winners.length === 0) {
      winnersText = "😢 Personne n'a participé au giveaway";
    } else {
      winnersText = winners.map(w => `<@${w}>`).join(", ");
    }

    giveaway.dureeTotale = giveaway.endTimestamp - (giveaway.startTimestamp || Date.now());
    
    const embedEnded = new EmbedBuilder()
      .setTitle("🎊✨ Giveaway Terminé ✨🎊")
      .setDescription(
        `🎁 **Prix gagné :** \`${giveaway.prix || 'Non spécifié'}\`\n` +
        `🏆 **Gagnants (${winners.length}) :** ${winnersText}\n\n` +
        `💖 Félicitations aux gagnants !`
      )
      .setColor("Green")
      .setFooter({ text: "🌟 Le giveaway est terminé - merci d'avoir participé ! 🎀" })
      .setImage("attachment://gw.jpg")
      .setTimestamp();

    const participateDisabledBtn = new ButtonBuilder()
      .setCustomId("participer")
      .setLabel("🎀 Participer 🎀")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const participantsBtn = new ButtonBuilder()
      .setCustomId("participants")
      .setLabel(`🧸 Participants (${participants.length})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false);

    const rerollBtn = new ButtonBuilder()
      .setCustomId("reroll")
      .setLabel("🔁✨ Relancer")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false);

    const newRow = new ActionRowBuilder()
      .addComponents(participateDisabledBtn, participantsBtn, rerollBtn);

    await message.edit({ embeds: [embedEnded], components: [newRow] }).catch(console.error);

    giveaways[message.id] = giveaway;
    writeGiveaways(giveaways);

    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      if (winners.length > 0) {
        const role = giveaway.roleId ? `\n\n🌟 Rôle à récupérer : <@&${giveaway.roleId}> 🎀` : "";
        
        const gotoButton = new ButtonBuilder()
          .setLabel("📍 Aller au message")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${message.id}`);
        
        const gotoRow = new ActionRowBuilder().addComponents(gotoButton);
        
        const congratsEmbed = new EmbedBuilder()
          .setTitle("🎉 Félicitations aux gagnants ! 🎉")
          .setDescription(
            `${winnersText}\n\n` +
            `🎁 **Prix gagné :** \`${giveaway.prix}\`${role}\n\n` +
            `💝 Profitez bien de votre récompense !`
          )
          .setColor("Gold")
          .setFooter({ text: `Giveaway organisé par ${giveaway.initiatorName || 'Administrateur'}` })
          .setTimestamp();
        
        await channel.send({
          embeds: [congratsEmbed],
          components: [gotoRow],
          allowedMentions: { 
            users: winners, 
            roles: giveaway.roleId ? [giveaway.roleId] : [] 
          },
        });
      } else {
        await channel.send("😢💔 Le giveaway est terminé mais il n'y a eu aucun participant !");
      }
    } catch (error) {
      console.error("💔 Erreur lors de l'envoi du message de félicitations:", error.message);
    }
  } catch (error) {
    console.error("❌ Erreur critique dans finalizeGiveaway:", error.message);
  }
}

async function recoverActiveGiveaways(client) {
  console.log("🔄🌸 Récupération des giveaways actifs");
  
  const giveaways = readGiveaways();
  let recovered = 0;
  
  for (const messageId in giveaways) {
    const gw = giveaways[messageId];
    
    if (gw.ended) {
      continue;
    }
    
    const now = Date.now();
    const remaining = gw.endTimestamp - now;
    
    try {
      const channel = await client.channels.fetch(gw.channelId);
      const message = await channel.messages.fetch(gw.messageId);
      
      if (remaining <= 0) {
        console.log(`⏰🎉 Finalisation du giveaway ${messageId} (expiré)`);
        await finalizeGiveaway(client, gw, message);
      } else {
        console.log(`✅🌟 Relance du giveaway ${messageId} (${formatTime(remaining)} restant)`);
        startGiveawayInterval(client, gw, message);
        recovered++;
      }
    } catch (error) {
      console.error(`❌💔 Erreur récupération giveaway ${messageId}:`, error.message);
      gw.ended = true;
    }
  }
  
  writeGiveaways(giveaways);
  console.log(`✅🎀 ${recovered} giveaway(s) récupéré(s) avec succès`);
}

function stopGiveawayInterval(messageId) {
  if (activeIntervals.has(messageId)) {
    clearInterval(activeIntervals.get(messageId));
    activeIntervals.delete(messageId);
    console.log(`🛑🌸 Interval arrêté pour le giveaway ${messageId}`);
  }
}

function stopAllIntervals() {
  console.log(`🛑🎀 Arrêt de ${activeIntervals.size} interval(s) en cours...`);
  activeIntervals.forEach((interval, messageId) => {
    clearInterval(interval);
  });
  activeIntervals.clear();
  console.log("🛑🌟 Tous les intervals ont été arrêtés");
}

process.on('SIGINT', stopAllIntervals);
process.on('SIGTERM', stopAllIntervals);

module.exports = {
  startGiveawayInterval,
  finalizeGiveaway,
  recoverActiveGiveaways,
  stopGiveawayInterval,
  stopAllIntervals,
  readGiveaways,
  writeGiveaways,
  formatTime,
  checkRoleRequis,
  checkMessagesRequis,
  trackGiveawayMessage,
};
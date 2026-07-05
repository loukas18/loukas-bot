const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Configuration sécurisée
const CONFIG = {
  countChannelId: "1523022940348874972",
  roles: {
    king: "1523022939740573704",
    legend: "1523022939740573705",
    god: "1523022939749089413"
  }
};

const stateFile = path.join(__dirname, "..", "state.json");
const countsFile = path.join(__dirname, "..", "counts.json");

// État sécurisé
let state = {
  currentNumber: 0,
  lastUser: null,
};

let userCounts = {};

// Rate limiting pour éviter le spam
const rateLimits = new Map();
const RATE_LIMIT_MS = 1000; // 1 seconde

const rankEmojis = {
  1: "<:diamond1:1380940267158372463>",
  2: "<:diamond2:1380940297038725242>",
  3: "<:diamond3:1380940325887016970>",
  4: "<:diamond4:1380940347319779459>",
  5: "<:diamond5:1380940369650257990>",
  6: "<:diamond6:1380940399035547819>",
  7: "<:diamond7:1380940418056851589>",
  8: "<:diamond8:1380940436755189862>",
  9: "<:diamond9:1380940462273200170>",
};

function loadState() {
  try {
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, "utf8");
      const parsed = JSON.parse(data);
      
      // Validation des données
      if (typeof parsed.currentNumber === 'number' && parsed.currentNumber >= 0) {
        state = { ...state, ...parsed };
      } else {
        console.warn("État de comptage corrompu, réinitialisation");
      }
    }
  } catch (err) {
    console.error("Erreur lors du chargement de l'état:", err.message);
  }
}

function loadCounts() {
  try {
    if (fs.existsSync(countsFile)) {
      const data = fs.readFileSync(countsFile, "utf8");
      const parsed = JSON.parse(data);
      
      // Validation et nettoyage des données
      if (typeof parsed === 'object' && parsed !== null) {
        userCounts = {};
        for (const [userId, count] of Object.entries(parsed)) {
          if (typeof count === 'number' && count >= 0) {
            userCounts[userId] = count;
          }
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors du chargement des counts:", err.message);
  }
}

function saveState() {
  try {
    // Validation avant sauvegarde
    if (typeof state.currentNumber !== 'number' || state.currentNumber < 0) {
      throw new Error("État invalide");
    }
    
    const tempFile = stateFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
    fs.renameSync(tempFile, stateFile);
  } catch (err) {
    console.error("Erreur lors de la sauvegarde de l'état:", err.message);
  }
}

function saveCounts() {
  try {
    // Nettoyage des données invalides
    const cleanCounts = {};
    for (const [userId, count] of Object.entries(userCounts)) {
      if (typeof count === 'number' && count >= 0) {
        cleanCounts[userId] = count;
      }
    }
    
    const tempFile = countsFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(cleanCounts, null, 2));
    fs.renameSync(tempFile, countsFile);
  } catch (err) {
    console.error("Erreur lors de la sauvegarde des counts:", err.message);
  }
}

async function manageRoles(member, number, guild) {
  try {
    // Validation des paramètres
    if (!member || !guild || typeof number !== 'number') {
      console.warn("Paramètres invalides pour manageRoles");
      return;
    }

    // Rate limiting pour éviter le spam de rôles
    const userId = member.id;
    const lastRoleUpdate = rateLimits.get(`role_${userId}`) || 0;
    const now = Date.now();
    
    if (now - lastRoleUpdate < RATE_LIMIT_MS) {
      return; // Skip cette mise à jour
    }
    rateLimits.set(`role_${userId}`, now);

    // Pour 100, retire tous les king puis donne le king au membre
    if (number % 100 === 0) {
      const kingRole = guild.roles.cache.get(CONFIG.roles.king);
      if (kingRole) {
        // Retirer le rôle king à tous ceux qui l'ont (avec limite)
        const membersWithKing = guild.members.cache.filter(m => m.roles.cache.has(CONFIG.roles.king));
        const removePromises = Array.from(membersWithKing.values()).slice(0, 10).map(m => 
          m.roles.remove(kingRole).catch(err => console.warn(`Impossible de retirer le rôle king à ${m.id}:`, err.message))
        );
        
        await Promise.allSettled(removePromises);
        await member.roles.add(kingRole).catch(err => console.warn("Impossible d'ajouter le rôle king:", err.message));
      }
    }

    // Pour 1000, ajouter légende
    if (number % 1000 === 0) {
      const legendRole = guild.roles.cache.get(CONFIG.roles.legend);
      if (legendRole) {
        await member.roles.add(legendRole).catch(err => console.warn("Impossible d'ajouter le rôle legend:", err.message));
      }
    }

    // Pour 10000, ajouter dieu
    if (number % 10000 === 0) {
      const godRole = guild.roles.cache.get(CONFIG.roles.god);
      if (godRole) {
        await member.roles.add(godRole).catch(err => console.warn("Impossible d'ajouter le rôle god:", err.message));
      }
    }
  } catch (error) {
    console.error("Erreur lors de la gestion des rôles :", error.message);
  }
}

async function handleCounting(message, client) {
  try {
    if (message.channel.id !== CONFIG.countChannelId) return false;

    const member = message.member;
    if (!member) return false;

    // Rate limiting par utilisateur
    const userId = message.author.id;
    const lastMessage = rateLimits.get(`count_${userId}`) || 0;
    const now = Date.now();
    
    if (now - lastMessage < RATE_LIMIT_MS) {
      await message.delete().catch(() => {});
      return true; // Message traité (supprimé pour spam)
    }
    rateLimits.set(`count_${userId}`, now);

    // Si membre a king ou legend, bloquer
    if (member.roles.cache.has(CONFIG.roles.king) || member.roles.cache.has(CONFIG.roles.legend)) {
      try {
        await message.channel.permissionOverwrites.edit(member, {
          SendMessages: false,
        });
      } catch (error) {
        console.warn("Impossible de modifier les permissions:", error.message);
      }
      await message.delete().catch(() => {});
      return true;
    }

    const args = message.content.trim().split(/\s+/);
    const number = parseInt(args[0], 10);

    // Validation stricte
    if (
      isNaN(number) ||
      number !== state.currentNumber + 1 ||
      number <= 0 ||
      number > 999999 || // Limite de sécurité
      message.author.id === state.lastUser
    ) {
      await message.delete().catch(() => {});
      return true;
    }

    // Mise à jour sécurisée de l'état
    state.currentNumber = number;
    state.lastUser = message.author.id;
    saveState();

    // Mise à jour des counts avec validation
    const currentCount = userCounts[message.author.id] || 0;
    if (currentCount < 999999) { // Limite de sécurité
      userCounts[message.author.id] = currentCount + 1;
      saveCounts();
    }

    // Couleur sécurisée basée sur le rôle
    const highestRole = member.roles.highest;
    const roleColor = (highestRole && highestRole.color) ? highestRole.color : 0x0099ff;

    // Emoji spécial selon palier
    let specialEmoji = "";
    if (number % 10000 === 0) specialEmoji = "🌟";
    else if (number % 1000 === 0) specialEmoji = "🏆";
    else if (number % 100 === 0) specialEmoji = "🎉";

    // Classement sécurisé
    const sortedUsers = Object.entries(userCounts)
      .sort(([, aCount], [, bCount]) => bCount - aCount)
      .map(([userId]) => userId);

    const rank = sortedUsers.indexOf(message.author.id) + 1;

    let rankPrefix = "";
    if (rank > 0 && rank <= 9 && rankEmojis[rank]) {
      rankPrefix = `${rankEmojis[rank]} `;
    } else if (rank === 10) {
      rankPrefix = "#10 ";
    }

    // Limitation du contenu additionnel pour éviter le spam
    const additionalContent = args.slice(1).join(" ").substring(0, 100); // Limite à 100 caractères

    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setDescription(`**${rankPrefix}${message.author} ➔** \`${number}\` ${specialEmoji} ${additionalContent}`);

    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [embed] }).catch(err => {
      console.error("Erreur lors de l'envoi de l'embed:", err.message);
    });

    await manageRoles(member, number, message.guild);

    return true;
  } catch (error) {
    console.error("Erreur dans handleCounting:", error.message);
    return false;
  }
}

// Nettoyage périodique du rate limiting
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimits.entries()) {
    if (now - timestamp > 60000) { // Nettoyer les entrées de plus d'1 minute
      rateLimits.delete(key);
    }
  }
}, 60000); // Nettoyer toutes les minutes

// Chargement initial sécurisé
try {
  loadState();
  loadCounts();
} catch (error) {
  console.error("Erreur lors du chargement initial:", error.message);
}

module.exports = {
  handleCounting,
  countChannelId: CONFIG.countChannelId,
  userCounts,
  loadState,
  loadCounts,
  saveState,
  saveCounts
};
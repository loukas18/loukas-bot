const { PermissionFlagsBits } = require("discord.js");
const path = require("path");

// Rate limiting pour les messages
const messageRateLimits = new Map();
const MESSAGE_RATE_LIMIT_MS = 500; // 500ms entre les messages par utilisateur

// Nettoyage périodique
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of messageRateLimits.entries()) {
    if (now - timestamp > 60000) { // 1 minute
      messageRateLimits.delete(key);
    }
  }
}, 60000);

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    try {
      // Validations de base
      if (!message || !message.guild || !message.author) return;
      if (message.author.bot) return;
      
      // Vérification des permissions
      if (!message.guild.members?.me?.permissions?.has(PermissionFlagsBits.SendMessages)) {
        return;
      }

      // Rate limiting par utilisateur
      const userId = message.author.id;
      const lastMessage = messageRateLimits.get(userId) || 0;
      const now = Date.now();
      
      if (now - lastMessage < MESSAGE_RATE_LIMIT_MS) {
        return; // Skip ce message pour éviter le spam
      }
      messageRateLimits.set(userId, now);

      // Chargement sécurisé du config
      let config;
      try {
        const configPath = path.join(__dirname, '..', '..', 'config.js');
        if (require('fs').existsSync(configPath)) {
          config = require(configPath);
        } else {
          console.warn("⚠️ Fichier config.js introuvable");
          return;
        }
      } catch (error) {
        console.error("❌ Erreur chargement config:", error.message);
        return;
      }

      const prefix = config?.prefix || '!';

      // Gestion sécurisée de l'activité ticket
      try {
        const ticketHandlerPath = path.join(__dirname, 'ticketHandler.js');
        if (require('fs').existsSync(ticketHandlerPath)) {
          const ticketHandler = require(ticketHandlerPath);
          if (typeof ticketHandler.handleMessageActivity === 'function') {
            ticketHandler.handleMessageActivity(message);
          }
        }
      } catch (error) {
        console.error("❌ Erreur activité ticket:", error.message);
      }

      // Gestion sécurisée du comptage
      try {
        const countHandlerPath = path.join(__dirname, '..', '..', 'Handler', 'countHandler.js');
        if (require('fs').existsSync(countHandlerPath)) {
          const { handleCounting, countChannelId } = require(countHandlerPath);
          
          if (message.channel.id === countChannelId && typeof handleCounting === 'function') {
            const handled = await handleCounting(message, client);
            if (handled) return;
          }
        }
      } catch (error) {
        console.error("❌ Erreur gestionnaire comptage:", error.message);
      }

      // Gestion sécurisée des commandes owner
      if (Array.isArray(config?.Owners) && config.Owners.includes(message.author.id)) {
        if (message.content && message.content.toLowerCase().startsWith(prefix)) {
          try {
            const args = message.content.slice(prefix.length).trim().split(/ +/g);
            const cmdName = args.shift()?.toLowerCase();
            
            if (cmdName && client.CommandOwner?.has(cmdName)) {
              const cmd = client.CommandOwner.get(cmdName);
              if (typeof cmd.execute === 'function') {
                await cmd.execute(message, client, args);
                return;
              }
            }
          } catch (error) {
            console.error("❌ Erreur commande owner:", error.message);
          }
        }
      }

      // Réponse sécurisée à "pifou"
      if (message.content && 
          /pifou/i.test(message.content) && 
          message.author.id !== client.user.id) {
        try {
          // Vérification des permissions avant de répondre
          if (message.channel.permissionsFor(message.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
            await message.reply("pifou c'est pas le mec qui sert à rien ?").catch(() => {});
          }
        } catch (error) {
          console.error("❌ Erreur réponse pifou:", error.message);
        }
      }

    } catch (error) {
      console.error('❌ Erreur critique messageCreate:', error.message);
    }
  },
};
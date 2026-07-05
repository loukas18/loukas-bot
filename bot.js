require("dotenv").config();
const client = require("./Client/DiscordJS");
const { Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Validation du token (compatible avec ton .env)
if (!process.env.Token) {
  console.error("❌ Token manquant dans le fichier .env");
  process.exit(1);
}

// Initialisation des collections
["events", "slashCommand"].forEach(
  (collectionName) => (client[collectionName] = new Collection())
);

// Fichier JSON pour stockage sécurisé
const dataFile = path.join(__dirname, "data.json");

function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, "utf8");
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error("Erreur lors du chargement des données :", error.message);
    return {};
  }
}

function saveData(data) {
  try {
    // Validation des données avant sauvegarde
    if (typeof data !== 'object' || data === null) {
      throw new Error("Les données doivent être un objet valide");
    }
    
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des données :", error.message);
  }
}

// Export des fonctions utilitaires
client.loadData = loadData;
client.saveData = saveData;

// Chargement des handlers
try {
  ["EventClient", "SlashCommand"].forEach((handler) => {
    const handlerPath = path.join(__dirname, "Handler", `${handler}.js`);
    if (fs.existsSync(handlerPath)) {
      require(handlerPath)(client);
    } else {
      console.error(`❌ Handler manquant : ${handler}.js`);
    }
  });
} catch (error) {
  console.error("❌ Erreur lors du chargement des handlers :", error);
  process.exit(1);
}

// Gestion des erreurs non capturées
process.on("unhandledRejection", (reason, promise) => {
  console.error("[ANTICRASH] Unhandled Rejection:", reason);
  console.error("Promise:", promise);
});

process.on("uncaughtException", (error, origin) => {
  console.error("[ANTICRASH] Uncaught Exception:", error.message);
  console.error("Origin:", origin);
});

process.on("uncaughtExceptionMonitor", (error, origin) => {
  console.error("[ANTICRASH] Uncaught Exception Monitor:", error.message);
  console.error("Origin:", origin);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('🛑 Arrêt du bot demandé...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du bot forcé...');
  client.destroy();
  process.exit(0);
});

// Connexion sécurisée (compatible avec ton .env)
client.login(process.env.Token).catch(error => {
  console.error("❌ Erreur de connexion:", error);
  process.exit(1);
});
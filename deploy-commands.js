const { readdirSync } = require("fs");
const { REST, Routes } = require("discord.js");
const path = require("path");
require("dotenv").config();

// Validation des variables d'environnement (compatible avec ton .env)
if (!process.env.Token || !process.env.Guild_id) {
  console.error("❌ Token ou Guild_id manquant dans le fichier .env");
  process.exit(1);
}

let slashCommandArray = [];
const commandsPath = path.join(__dirname, "Commands");

try {
  const commandFolders = readdirSync(commandsPath);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = readdirSync(folderPath).filter(file => file.endsWith(".js"));
    
    for (const file of commandFiles) {
      try {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        
        if (command.maintenance) {
          console.log(`⚠️ Commande en maintenance ignorée : ${file}`);
          continue;
        }
        
        if (!command.data || typeof command.data.toJSON !== "function") {
          console.warn(`[AVERTISSEMENT] Commande ${file} ignorée : pas de data ou data invalide.`);
          continue;
        }
        
        slashCommandArray.push(command.data.toJSON());
        console.log(`✅ Commande chargée : ${command.data.name}`);
      } catch (error) {
        console.error(`❌ Erreur lors du chargement de ${file}:`, error.message);
      }
    }
  }
} catch (error) {
  console.error("❌ Erreur lors de la lecture du dossier Commands:", error);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(process.env.Token);

(async () => {
  try {
    console.log("🔄 Déploiement des commandes en cours...");
    const data = await rest.put(
      Routes.applicationCommands(process.env.Guild_id), // Utilise Guild_id pour les commandes de serveur
      { body: slashCommandArray }
    );
    console.log(`✅ ${data.length} commande(s) déployée(s) avec succès.`);
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement des commandes :", error);
    process.exit(1);
  }
})();
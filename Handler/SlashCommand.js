const { readdirSync } = require("fs");
const { REST, Routes } = require("discord.js");
const path = require("path");

module.exports = (client) => {
  client.handleCommands = async () => {
    const slashCommandArray = [];
    const commandsPath = path.join(__dirname, "..", "Commands");
    
    try {
      const commandFolders = readdirSync(commandsPath);
      
      for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith(".js"));
        
        for (const file of commandFiles) {
          try {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            
            if (!command || !command.data || typeof command.data.toJSON !== "function") {
              console.warn(`[AVERTISSEMENT] Commande ${file} ignorée : data invalide.`);
              continue;
            }
            
            if (command.maintenance) {
              console.log(`⚠️ Commande en maintenance : ${command.data.name}`);
              continue;
            }
            
            slashCommandArray.push(command.data.toJSON());
            client.slashCommand.set(command.data.name, command);
            console.log(`✅ Commande slash chargée : ${command.data.name}`);
          } catch (error) {
            console.error(`❌ Erreur lors du chargement de ${file}:`, error.message);
          }
        }
      }
      
      if (client.user && process.env.Token) {
        const rest = new REST({ version: "10" }).setToken(process.env.Token);
        
        await rest.put(
          Routes.applicationCommands(client.user.id),
          { body: slashCommandArray }
        );
        
        console.log(`✅ ${slashCommandArray.length} commande(s) slash rechargée(s).`);
      }
    } catch (error) {
      console.error("❌ Erreur lors du rechargement des commandes :", error);
    }
  };
};
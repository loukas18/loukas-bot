const { readdirSync } = require("fs");
const path = require("path");

module.exports = (client) => {
  client.handleEvents = async () => {
    if (!client.events) client.events = new Map();
    
    const eventsPath = path.join(__dirname, "..", "Events");
    
    try {
      const eventFolders = readdirSync(eventsPath);
      
      for (const folder of eventFolders) {
        const folderPath = path.join(eventsPath, folder);
        const eventFiles = readdirSync(folderPath).filter(file => file.endsWith(".js"));
        
        for (const file of eventFiles) {
          try {
            const filePath = path.join(folderPath, file);
            const event = require(filePath);
            
            // Validation de l'événement
            if (typeof event.execute !== "function") {
              console.warn(`[Warning] Événement ${file} : méthode execute manquante`);
              continue;
            }
            
            if (typeof event.name !== "string") {
              console.warn(`[Warning] Événement ${file} : propriété name manquante`);
              continue;
            }
            
            const execute = (...args) => {
              try {
                return event.execute(...args, client);
              } catch (error) {
                console.error(`Erreur dans l'événement ${event.name}:`, error);
              }
            };
            
            if (event.once) {
              client.once(event.name, execute);
            } else {
              client.on(event.name, execute);
            }
            
            client.events.set(event.name, execute);
            console.log(`✅ Événement chargé : ${event.name}`);
          } catch (error) {
            console.error(`❌ Erreur lors du chargement de ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error("❌ Erreur lors de la lecture du dossier Events:", error);
    }
  };
  
  // Auto-chargement des événements
  client.handleEvents();
};

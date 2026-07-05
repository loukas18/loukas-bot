const { ShardingManager } = require("discord.js");
require("dotenv").config();

// Validation du token avant toute opération (compatible avec ton .env)
if (!process.env.Token) {
  console.error("❌ Token Discord manquant dans le fichier .env");
  process.exit(1);
}

// Validation du Guild_id aussi
if (!process.env.Guild_id) {
  console.error("❌ Guild_id manquant dans le fichier .env");
  process.exit(1);
}

const manager = new ShardingManager("./bot.js", {
  token: process.env.Token, // Compatible avec ton .env
  shardList: "auto",
  respawn: true,
  autoSpawn: true,
  totalShards: "auto",
});

manager.on("shardCreate", (shard) => {
  console.log(`[Shard ${shard.id}] 🚀 Shard créé.`);
  
  shard
    .on("ready", () => {
      console.log(`[Shard ${shard.id}] ✅ Connecté et prêt.`);
    })
    .on("disconnect", () => {
      console.warn(`[Shard ${shard.id}] ⚠️ Déconnecté.`);
    })
    .on("reconnecting", () => {
      console.log(`[Shard ${shard.id}] 🔄 Reconnexion en cours...`);
    })
    .on("error", (error) => {
      console.error(`[Shard ${shard.id}] ❌ Erreur rencontrée :`, error);
    })
    .on("death", () => {
      console.error(`[Shard ${shard.id}] ☠️ Shard mort.`);
    });
});

manager
  .spawn({ 
    amount: "auto", 
    delay: 5500,
    timeout: 30000
  })
  .then((shards) => {
    console.log(`✅ ${shards.size} shard(s) démarré(s) avec succès.`);
  })
  .catch((err) => {
    console.error("❌ Erreur lors du démarrage des shards :", err);
    process.exit(1); // Exit si échec critique
  });

module.exports = manager;
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../activities.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setactivities')
    .setDescription('Gérer les activités du bot')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action à effectuer')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('liste')
        .setDescription('Liste des activités séparées par | (ex: Joue à Minecraft | Écoute de la musique)')
        .setRequired(false)
    ),

  permission: 'ADMINISTRATOR',
  category: 'Admin',
  dm: false,

  // =========================
  // AUTOCOMPLETE
  // =========================
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();

    const actions = [
      { name: 'Définir des activités', value: 'set' },
      { name: 'Démarrer la rotation', value: 'start' },
      { name: 'Arrêter la rotation', value: 'stop' },
    ];

    const filtered = actions.filter(choice =>
      choice.name.toLowerCase().includes(focused.toLowerCase())
    );

    await interaction.respond(filtered);
  },

  // =========================
  // EXECUTION
  // =========================
  run: async (client, interaction) => {
    const action = interaction.options.getString('action');
    const liste = interaction.options.getString('liste');

    // ======================
    // SET - Définir activités
    // ======================
    if (action === 'set') {
      if (!liste) {
        return interaction.reply({
          content: '❌ Tu dois fournir une liste d\'activités pour cette action.',
          ephemeral: true
        });
      }

      const rawList = liste;
      const parsed = rawList.split('|').map((entry) => entry.trim());

      const activities = parsed.map(entry => {
        const [typeWord, ...msgParts] = entry.split(' ');
        const message = msgParts.join(' ');
        const type = {
          'joue': 'Playing',
          'écoute': 'Listening',
          'regarde': 'Watching',
          'compétition': 'Competing'
        }[typeWord.toLowerCase()];

        return type && message ? { type, message } : null;
      }).filter(Boolean);

      if (activities.length === 0) {
        return interaction.reply({ 
          content: '❌ Aucune activité valide n\'a été trouvée.', 
          ephemeral: true 
        });
      }

      fs.writeFileSync(filePath, JSON.stringify(activities, null, 2));
      return interaction.reply(`✅ Activités enregistrées (${activities.length}) ! Elles vont maintenant alterner automatiquement.`);
    }

    // ======================
    // START - Démarrer rotation
    // ======================
    if (action === 'start') {
      if (typeof client.startActivitiesRotation === 'function') {
        await client.startActivitiesRotation();
        return interaction.reply({ 
          content: '▶️ Rotation des activités relancée.', 
          ephemeral: true 
        });
      } else {
        return interaction.reply({ 
          content: '❌ Impossible de relancer la rotation.', 
          ephemeral: true 
        });
      }
    }

    // ======================
    // STOP - Arrêter rotation
    // ======================
    if (action === 'stop') {
      if (typeof client.stopActivitiesRotation === 'function') {
        client.stopActivitiesRotation();
        return interaction.reply({ 
          content: '⏹️ Rotation des activités arrêtée.', 
          ephemeral: true 
        });
      } else {
        return interaction.reply({ 
          content: '❌ Impossible d\'arrêter la rotation.', 
          ephemeral: true 
        });
      }
    }

    // Action inconnue
    return interaction.reply({
      content: '❌ Action non reconnue.',
      ephemeral: true
    });
  }
};
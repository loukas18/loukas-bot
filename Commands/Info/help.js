const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { readdirSync } = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche toutes les commandes ou obtient des informations détaillées sur une commande spécifique')
    .setDefaultPermission(true),

  async run(client, interaction) {
    console.log(`[📥] Commande /help exécutée par ${interaction.user.tag} (${interaction.user.id})`);

    const categoriesDir = path.join(__dirname, '../');

    try {
      const categories = readdirSync(categoriesDir);
      console.log(`[📁] Catégories détectées : ${categories.join(', ')}`);

      const createCategorySelectMenu = (placeholder = 'Choisissez une catégorie') => {
        return new StringSelectMenuBuilder()
          .setCustomId('select-category')
          .setPlaceholder(placeholder)
          .addOptions(
            categories.map(category => ({
              label: category,
              value: category,
            }))
          );
      };

      const actionRow = new ActionRowBuilder().addComponents(createCategorySelectMenu());

      await interaction.reply({
        content: 'Veuillez sélectionner une catégorie pour voir les commandes.',
        components: [actionRow],
        ephemeral: true,
      });

      console.log(`[✅] Menu de sélection envoyé à ${interaction.user.tag}`);

      const filter = i => i.customId === 'select-category' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        const selectedCategory = i.values[0];
        console.log(`[📂] ${interaction.user.tag} a sélectionné la catégorie : ${selectedCategory}`);

        const commandsDir = path.join(categoriesDir, selectedCategory);
        const commandFiles = readdirSync(commandsDir).filter(file => file.endsWith('.js'));
        console.log(`[📜] Commandes trouvées dans ${selectedCategory} : ${commandFiles.join(', ') || 'Aucune'}`);

        const commands = commandFiles.map(file => {
          const command = require(path.join(commandsDir, file));
          return command.data.toJSON();
        });

        const embed = new EmbedBuilder()
          .setTitle(`Commandes dans la catégorie: ${selectedCategory}`);

        const description = commands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n');
        embed.setDescription(description.length > 0 ? description : 'Aucune commande trouvée.')
             .setColor('#FF00FF');

        const newActionRow = new ActionRowBuilder().addComponents(createCategorySelectMenu('Changer de catégorie'));

        await i.update({ embeds: [embed], components: [newActionRow], ephemeral: true });

        console.log(`[📨] Liste des commandes envoyée pour ${selectedCategory} à ${interaction.user.tag}`);
      });

      collector.on('end', collected => {
        if (!collected.size) {
          interaction.followUp({
            content: 'Le temps est écoulé. Veuillez utiliser `/help` à nouveau si vous avez besoin d\'assistance supplémentaire.',
            ephemeral: true,
          });
          console.log(`[⏱️] Sélecteur expiré pour ${interaction.user.tag}`);
        } else {
          console.log(`[✅] Sélecteur terminé. ${collected.size} interaction(s) collectée(s)`);
        }
      });
    } catch (error) {
      console.error('[❌] Erreur lors de la lecture des catégories :', error);
      interaction.reply({
        content: 'Une erreur est survenue lors de la lecture des catégories. Veuillez réessayer plus tard.',
        ephemeral: true,
      });
    }
  },
};

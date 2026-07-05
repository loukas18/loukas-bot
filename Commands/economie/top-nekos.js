const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logCommand } = require('../../utils/commandLogger');

const economyPath = path.join(__dirname, '../../economy.json');

function loadEconomy() {
    if (!fs.existsSync(economyPath)) {
        fs.writeFileSync(economyPath, JSON.stringify({}));
        return {};
    }
    return JSON.parse(fs.readFileSync(economyPath, 'utf8'));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top-nekos')
        .setDescription('Affiche le classement des utilisateurs les plus riches en Nekos')
        .setDMPermission(false),
    
    async run(client, interaction) {
        try {
            const economy = loadEconomy();
            const sortedUsers = Object.entries(economy)
                .filter(([_, data]) => data.nekos > 0)
                .sort((a, b) => b[1].nekos - a[1].nekos)
                .slice(0, 10);

            if (sortedUsers.length === 0) {
                logCommand(interaction, {
                    success: false,
                    reason: 'no_data',
                    action: 'top_nekos_view'
                });

                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🏆 Top 10 des plus riches en Nekos')
                    .setDescription('Aucune donnée économique disponible pour le moment.')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            let description = '';
            const medals = ['🥇', '🥈', '🥉'];

            for (let i = 0; i < sortedUsers.length; i++) {
                const [userId, data] = sortedUsers[i];
                const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
                
                try {
                    const user = await client.users.fetch(userId);
                    description += `${medal} **${user.username}** — ${data.nekos} <:neko:1427722803632930972>\n`;
                } catch (error) {
                    description += `${medal} Utilisateur inconnu — ${data.nekos} <:neko:1427722803632930972>\n`;
                }
            }

            const userPosition = Object.keys(economy)
                .sort((a, b) => economy[b].nekos - economy[a].nekos)
                .indexOf(interaction.user.id) + 1;

            const userNekos = economy[interaction.user.id]?.nekos || 0;

            logCommand(interaction, {
                success: true,
                action: 'top_nekos_view',
                topCount: sortedUsers.length,
                userPosition: userPosition,
                userBalance: userNekos
            });

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Top 10 des plus riches en Nekos')
                .setDescription(description)
                .setFooter({ 
                    text: userNekos > 0
                        ? `Tu es ${userPosition}ème avec ${userNekos} Nekos`
                        : 'Tu n\'as pas encore de Nekos',
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            console.log(`📝 [TOP-NEKOS] Classement affiché par ${interaction.user.tag}`);
            console.log(`   → Position: ${userPosition}ème`);
            console.log(`   → Solde: ${userNekos} Nekos`);
        } catch (error) {
            console.error('Erreur top-nekos:', error);
            await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
        }
    }
};
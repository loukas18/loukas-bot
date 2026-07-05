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
        .setName('top-travail')
        .setDescription('Affiche le classement des travailleurs les plus actifs')
        .setDMPermission(false),

    async run(client, interaction) {
        try {
            const economy = loadEconomy();

            const workers = Object.entries(economy)
                .filter(([_, data]) => data.workCount > 0)
                .map(([userId, data]) => ({
                    userId,
                    workCount: data.workCount || 0,
                    nekos: data.nekos || 0
                }))
                .sort((a, b) => b.workCount - a.workCount)
                .slice(0, 10);

            if (workers.length === 0) {
                logCommand(interaction, {
                    success: false,
                    reason: 'no_workers',
                    action: 'top_travail_view'
                });

                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('<:icon11:1427724252391538758> Aucun travailleur')
                    .setDescription('Personne n\'a encore utilisé la commande `</travail:1427615131927318685>` !')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const leaderboard = await Promise.all(
                workers.map(async (worker, index) => {
                    const user = await client.users.fetch(worker.userId).catch(() => null);
                    const username = user ? user.username : 'Utilisateur inconnu';
                    
                    let medal = '';
                    if (index === 0) medal = '<:diamond1:1380940267158372463>';
                    else if (index === 1) medal = '<:diamond2:1380940297038725242>';
                    else if (index === 2) medal = '<:diamond3:1380940325887016970>';
                    else medal = `**${index + 1}.**`;

                    return `${medal} **${username}** — ${worker.workCount} travaux (${worker.nekos} <:neko:1427722803632930972>)`;
                })
            );

            const userPosition = workers.findIndex(w => w.userId === interaction.user.id);
            const userStats = economy[interaction.user.id];
            const userWorkCount = userStats?.workCount || 0;

            let footer = `Tu as travaillé ${userWorkCount} fois`;
            if (userPosition !== -1) {
                footer += ` • Tu es ${userPosition + 1}${userPosition === 0 ? 'er' : 'ème'}`;
            }

            logCommand(interaction, {
                success: true,
                action: 'top_travail_view',
                topCount: workers.length,
                userPosition: userPosition !== -1 ? userPosition + 1 : 0,
                userWorkCount: userWorkCount,
                userBalance: economy[interaction.user.id]?.nekos || 0
            });

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('Top Travailleurs')
                .setDescription(leaderboard.join('\n'))
                .setFooter({ text: footer, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            console.log(`📝 [TOP-TRAVAIL] Classement affiché par ${interaction.user.tag}`);
            console.log(`   → Position: ${userPosition !== -1 ? userPosition + 1 : 'N/A'}ème`);
            console.log(`   → Travaux effectués: ${userWorkCount}`);
        } catch (error) {
            console.error('Erreur top-travail:', error);
            await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
        }
    }
};
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logCommand } = require('../../utils/commandLogger'); // ← Import du logger

const economyPath = path.join(__dirname, '../../economy.json');

function loadEconomy() {
    if (!fs.existsSync(economyPath)) {
        fs.writeFileSync(economyPath, JSON.stringify({}));
        return {};
    }
    return JSON.parse(fs.readFileSync(economyPath, 'utf8'));
}

function saveEconomy(data) {
    fs.writeFileSync(economyPath, JSON.stringify(data, null, 2));
}

// Fonction pour obtenir minuit du jour actuel
function getMidnightToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
}

// Fonction pour obtenir minuit du lendemain
function getNextMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
}

// Fonction pour vérifier si la dernière réclamation était aujourd'hui
function isClaimedToday(lastDaily) {
    if (!lastDaily) return false;
    const midnightToday = getMidnightToday();
    return lastDaily >= midnightToday;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('journalier')
        .setDescription('Réclamez votre récompense journalière de Nekos')
        .setDMPermission(false),
                
    async run(client, interaction) {
        const userId = interaction.user.id;
        const economy = loadEconomy();

        if (!economy[userId]) {
            economy[userId] = {
                nekos: 0,
                lastWork: 0,
                workCount: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
        }

        const userData = economy[userId];

        // Vérifier si déjà réclamé aujourd'hui (depuis minuit)
        if (isClaimedToday(userData.lastDaily)) {
            const nextMidnight = Math.floor(getNextMidnight() / 1000);

            // ✨ Logger la tentative échouée (déjà réclamé)
            logCommand(interaction, {
                success: false,
                reason: 'already_claimed_today',
                lastClaimed: userData.lastDaily,
                nextAvailable: nextMidnight
            });

            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('<:icon68:1427722428527804558> Déjà réclamé aujourd\'hui')
                .setDescription(`Vous avez déjà réclamé votre récompense journalière!\nRevenez <t:${nextMidnight}:R>`)
                .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const earned = Math.floor(Math.random() * 51) + 100; // 100-150 Nekos
        userData.nekos += earned;
        userData.lastDaily = Date.now();

        economy[userId] = userData;
        saveEconomy(economy);

        const nextMidnight = Math.floor(getNextMidnight() / 1000);

        // ✨ Logger la récompense réclamée avec succès
        logCommand(interaction, {
            success: true,
            earned: earned,
            newBalance: userData.nekos,
            nextClaim: nextMidnight,
            claimType: 'daily'
        });

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('<:icon33:1427723957494353960> Récompense journalière')
            .setDescription(`Vous avez réclamé votre récompense quotidienne et gagné **${earned} Nekos** 🐱`)
            .addFields(
                { name: '<:icon52:1427722803632930972> Nouveau solde', value: `${userData.nekos} Nekos`, inline: true },
                { name: '<:icon68:1427722428527804558> Prochaine récompense', value: `<t:${nextMidnight}:R>`, inline: true }
            )
            .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
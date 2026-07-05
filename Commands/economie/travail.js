const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logCommand } = require('../../utils/commandLogger'); // ← Nouveau chemin

const economyPath = path.join(__dirname, '../../economy.json');
const remindersPath = path.join(__dirname, '../../reminders.json');
const COOLDOWN = 45 * 60 * 1000;

function loadFile(filePath) {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function scheduleReminder(client, userId, channelId, timestamp) {
    const delay = timestamp - Date.now();
    if (delay <= 0) return;

    setTimeout(async () => {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('<:icon33:1427723957494353960> Temps écoulé !')
            .setDescription(`Tu peux de nouveau **travailler** !\n→ </travail:1428110700294705260>`)
            .setTimestamp();

        await channel.send({
            content: `<@${userId}>`,
            embeds: [embed]
        }).catch(() => null);

        const reminders = loadFile(remindersPath);
        delete reminders[userId];
        saveFile(remindersPath, reminders);
    }, delay);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('travail')
        .setDescription('Travaillez pour gagner des Nekos 🐱')
        .setDMPermission(false),

    async run(client, interaction) {
        const userId = interaction.user.id;
        const channelId = interaction.channel.id;

        const economy = loadFile(economyPath);
        const reminders = loadFile(remindersPath);

        if (!economy[userId]) {
            economy[userId] = { nekos: 0, lastWork: 0, workCount: 0 };
        }

        const userData = economy[userId];
        const now = Date.now();

        // Vérification du cooldown
        if (userData.lastWork && now - userData.lastWork < COOLDOWN) {
            const nextWorkTime = Math.floor((userData.lastWork + COOLDOWN) / 1000);
            
            // ✨ Logger la tentative (échec cooldown)
            logCommand(interaction, {
                success: false,
                reason: 'cooldown',
                nextAvailable: nextWorkTime
            });
            
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('<:icon11:1427724252391538758> Cooldown en cours')
                .setDescription(`Tu pourras retravailler <t:${nextWorkTime}:R>`)
                .setFooter({ text: `Demandé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Gain aléatoire
        const earned = Math.floor(Math.random() * 101) + 50;
        userData.nekos += earned;
        userData.lastWork = now;
        userData.workCount = (userData.workCount || 0) + 1;
        economy[userId] = userData;
        saveFile(economyPath, economy);

        // Enregistrer le rappel
        const remindAt = now + COOLDOWN;
        reminders[userId] = { timestamp: remindAt, channelId: channelId };
        saveFile(remindersPath, reminders);

        scheduleReminder(client, userId, channelId, remindAt);

        // ✨ Logger la commande réussie avec toutes les infos
        logCommand(interaction, {
            success: true,
            earned: earned,
            newBalance: userData.nekos,
            totalWorks: userData.workCount,
            nextWork: remindAt
        });

        const nextWorkTimestamp = Math.floor(remindAt / 1000);

        const embed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle('<:icon33:1427723957494353960> Travail effectué !')
            .setDescription(`Tu as gagné **${earned} Nekos** 🐱`)
            .addFields(
                { name: '<:icon52:1427722803632930972> Solde actuel', value: `${userData.nekos} Nekos`, inline: true },
                { name: '<:icon11:1427724252391538758> Prochain travail', value: `<t:${nextWorkTimestamp}:R>`, inline: true }
            )
            .setFooter({ text: `${interaction.user.tag} • ${userData.workCount} travaux effectués`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async init(client) {
        const reminders = loadFile(remindersPath);
        for (const [userId, data] of Object.entries(reminders)) {
            const timestamp = typeof data === 'number' ? data : data.timestamp;
            const channelId = typeof data === 'object' ? data.channelId : null;
            if (channelId) {
                scheduleReminder(client, userId, channelId, timestamp);
            }
        }
    }
};

module.exports.restartReminders = async function (client) {
    const reminders = loadFile(remindersPath);
    let count = 0;

    for (const [userId, data] of Object.entries(reminders)) {
        const timestamp = typeof data === 'number' ? data : data.timestamp;
        const channelId = typeof data === 'object' ? data.channelId : null;
        if (!channelId) continue;

        const delay = timestamp - Date.now();
        if (delay <= 0) continue;

        setTimeout(async () => {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('<:icon33:1427723957494353960> Temps écoulé !')
                .setDescription(`Tu peux de nouveau **travailler** !\n **→** </travail:1428110700294705260>`)
                .setTimestamp();

            await channel.send({
                content: `<@${userId}>`,
                embeds: [embed]
            }).catch(() => null);

            delete reminders[userId];
            saveFile(remindersPath, reminders);
        }, delay);

        count++;
    }

    console.log(`🔁 ${count} rappel(s) /travail rechargé(s)`);
};
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

function saveEconomy(data) {
    fs.writeFileSync(economyPath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mensuel')
        .setDescription('Réclamez votre récompense mensuelle de Nekos')
        .setDMPermission(false),
    
    async run(client, interaction) {
        const userId = interaction.user.id;
        const economy = loadEconomy();

        if (!economy[userId]) {
            economy[userId] = {
                nekos: 0,
                lastWork: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
            saveEconomy(economy);
        }

        const userData = economy[userId];
        const now = Date.now();
        const cooldown = 30 * 24 * 60 * 60 * 1000; // 30 jours

        // ❌ Vérification du cooldown
        if (userData.lastMonthly && (now - userData.lastMonthly) < cooldown) {
            const nextMonthlyTime = Math.floor((userData.lastMonthly + cooldown) / 1000);

            // ✨ Logger l'échec (cooldown actif)
            logCommand(interaction, {
                success: false,
                reason: 'cooldown_active',
                lastMonthly: userData.lastMonthly,
                nextAvailable: nextMonthlyTime
            });

            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('<:icon68:1427722428527804558> Déjà réclamé ce mois-ci')
                .setDescription(`Vous avez déjà réclamé votre récompense mensuelle!\nRevenez <t:${nextMonthlyTime}:R>`)
                .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ✅ Récompense accordée
        const earned = Math.floor(Math.random() * 501) + 2000; // 2000-2500 Nekos
        userData.nekos += earned;
        userData.lastMonthly = now;

        economy[userId] = userData;
        saveEconomy(economy);

        // ✨ Logger le succès
        logCommand(interaction, {
            success: true,
            reward: 'monthly',
            earned: earned,
            newBalance: userData.nekos,
            previousBalance: userData.nekos - earned
        });

        const nextMonthlyTimestamp = Math.floor((now + cooldown) / 1000);

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('<:icon11:1427724252391538758> Récompense mensuelle')
            .setDescription(`Vous avez réclamé votre récompense mensuelle et gagné **${earned} Nekos** 🐱`)
            .addFields(
                { name: '<:icon52:1427722803632930972> Nouveau solde', value: `${userData.nekos} Nekos`, inline: true },
                { name: '<:icon68:1427722428527804558> Prochaine récompense', value: `<t:${nextMonthlyTimestamp}:R>`, inline: true }
            )
            .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        console.log(`📝 [MENSUEL] Récompense versée à ${interaction.user.tag}`);
        console.log(`   → Montant: ${earned} Nekos`);
        console.log(`   → Nouveau solde: ${userData.nekos} Nekos`);
    }
};
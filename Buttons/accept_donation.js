const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const economyPath = path.join(process.cwd(), "economy.json");
const pendingPath = path.join(process.cwd(),"pending-donations.json");

console.log('📁 [ACCEPT] Chemin pending:', path.resolve(pendingPath));

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

function loadPending() {
    if (!fs.existsSync(pendingPath)) {
        fs.writeFileSync(pendingPath, JSON.stringify({}));
        return {};
    }
    return JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
}

function savePending(data) {
    fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: {
        name: 'accept_donation'
    },
    
    async run(client, interaction) {
        // Vérifier les permissions (Admin ou rôle staff)
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ Seuls les administrateurs peuvent valider les dons.', 
                flags: 64
            });
        }

        const requestId = interaction.customId.replace('accept_donation_', '');
        
        // 🔍 DEBUG: Afficher l'ID recherché
        console.log(`🔍 Recherche de la demande: ${requestId}`);

        const pending = loadPending();
        
        // 🔍 DEBUG: Afficher toutes les demandes en attente
        console.log(`📋 Demandes en attente:`, Object.keys(pending));
        
        const request = pending[requestId];

        if (!request) {
            console.error(`❌ Demande ${requestId} non trouvée`);
            return interaction.reply({ 
                content: `❌ Cette demande n'existe plus ou a déjà été traitée.\n🔍 ID recherché: \`${requestId}\``, 
                flags: 64
            });
        }

        console.log(`✅ Demande trouvée:`, request);

        const economy = loadEconomy();
        const donor = await client.users.fetch(request.donorId);
        const recipient = await client.users.fetch(request.recipientId);

        // Initialiser les données si elles n'existent pas
        if (!economy[request.donorId]) {
            economy[request.donorId] = {
                nekos: 0,
                lastWork: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
        }

        if (!economy[request.recipientId]) {
            economy[request.recipientId] = {
                nekos: 0,
                lastWork: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
        }

        // Vérifier à nouveau que le donneur a toujours assez de Nekos
        if (economy[request.donorId].nekos < request.amount) {
            await interaction.reply({ 
                content: `❌ ${donor.tag} n'a plus assez de Nekos pour effectuer ce don.`, 
                flags: 64
            });

            // Supprimer la demande
            delete pending[requestId];
            savePending(pending);

            // Notifier le donneur
            try {
                await donor.send(`❌ Votre don de **${request.amount} Nekos** à **${recipient.tag}** a été annulé car vous n'avez plus assez de Nekos.`);
            } catch (error) {
                console.log('Impossible de notifier le donneur');
            }

            return;
        }

        // Effectuer le transfert
        economy[request.donorId].nekos -= request.amount;
        economy[request.recipientId].nekos += request.amount;
        saveEconomy(economy);

        console.log(`💰 Transfert effectué: ${request.amount} Nekos de ${donor.tag} vers ${recipient.tag}`);

        // Mettre à jour le message
        const acceptEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Don accepté')
            .setDescription(`Le don de **${request.amount} Nekos** de **${donor.tag}** à **${recipient.tag}** a été accepté par ${interaction.user.tag}`)
            .addFields(
                { name: '💰 Nouveau solde du donneur', value: `${economy[request.donorId].nekos} Nekos`, inline: true },
                { name: '💰 Nouveau solde du receveur', value: `${economy[request.recipientId].nekos} Nekos`, inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [acceptEmbed], components: [] });

        // Notifier le donneur
        try {
            const donorEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Don accepté')
                .setDescription(`Votre don de **${request.amount} Nekos** à **${recipient.tag}** a été accepté par le staff !`)
                .addFields(
                    { name: '💰 Votre nouveau solde', value: `${economy[request.donorId].nekos} Nekos` }
                )
                .setTimestamp();

            await donor.send({ embeds: [donorEmbed] });
        } catch (error) {
            console.log('Impossible de notifier le donneur');
        }

        // Notifier le receveur
        try {
            const recipientEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎁 Vous avez reçu un don !')
                .setDescription(`**${donor.tag}** vous a donné **${request.amount} Nekos** !`)
                .addFields(
                    { name: '💰 Votre nouveau solde', value: `${economy[request.recipientId].nekos} Nekos` }
                )
                .setTimestamp();

            await recipient.send({ embeds: [recipientEmbed] });
        } catch (error) {
            console.log('Impossible de notifier le receveur');
        }

        // Supprimer la demande des pending
        delete pending[requestId];
        savePending(pending);
        
        console.log(`🗑️ Demande ${requestId} supprimée des pending`);
    }
};
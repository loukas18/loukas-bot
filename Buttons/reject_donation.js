const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const economyPath = path.join(process.cwd(), "economy.json");
const pendingPath = path.join(process.cwd(),"pending-donations.json");

console.log('📁 [ACCEPT] Chemin pending:', path.resolve(pendingPath));


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
        name: 'reject_donation'
    },
    
    async run(client, interaction) {
        // Vérifier les permissions (Admin ou rôle staff)
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ Seuls les administrateurs peuvent refuser les dons.', 
                flags: 64
            });
        }

        const requestId = interaction.customId.replace('reject_donation_', '');
        
        // 🔍 DEBUG: Afficher l'ID recherché
        console.log(`🔍 Recherche de la demande à refuser: ${requestId}`);

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

        const donor = await client.users.fetch(request.donorId);
        const recipient = await client.users.fetch(request.recipientId);

        // Mettre à jour le message avec le refus
        const rejectEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Don refusé')
            .setDescription(`Le don de **${request.amount} Nekos** de **${donor.tag}** à **${recipient.tag}** a été refusé par ${interaction.user.tag}`)
            .setTimestamp();

        await interaction.update({ embeds: [rejectEmbed], components: [] });

        // Notifier le donneur
        try {
            const donorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Don refusé')
                .setDescription(`Votre demande de don de **${request.amount} Nekos** à **${recipient.tag}** a été refusée par le staff.`)
                .setTimestamp();

            await donor.send({ embeds: [donorEmbed] });
        } catch (error) {
            console.log('Impossible de notifier le donneur:', error.message);
        }

        // Supprimer la demande des pending
        delete pending[requestId];
        savePending(pending);
        
        console.log(`🗑️ Demande ${requestId} refusée et supprimée des pending`);
    }
};
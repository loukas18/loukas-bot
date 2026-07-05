const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const economyPath = path.join(process.cwd(), "economy.json");
const pendingPath = path.join(process.cwd(), "pending-donations.json");
const { logCommand } = require('../../utils/commandLogger');

console.log('📁 [DONNER] Chemin economy:', path.resolve(economyPath));
console.log('📁 [DONNER] Chemin pending:', path.resolve(pendingPath));

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
        console.log('⚠️ [DONNER] Fichier pending n\'existe pas, création...');
        fs.writeFileSync(pendingPath, JSON.stringify({}));
        return {};
    }
    const data = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    console.log('📋 [DONNER] Pending chargé:', Object.keys(data));
    return data;
}

function savePending(data) {
    console.log('💾 [DONNER] Sauvegarde pending avec', Object.keys(data).length, 'demande(s)');
    fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2));
    
    // ✅ Vérification immédiate après sauvegarde
    const verification = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    console.log('✅ [DONNER] Vérification post-sauvegarde:', Object.keys(verification));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donner-nekos')
        .setDMPermission(false)
        .setDescription('Donner des Nekos à un autre membre')
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('Le membre à qui donner des Nekos')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('montant')
                .setDescription('Le nombre de Nekos à donner')
                .setRequired(true)
                .setMinValue(1)
        ),
    
    async run(client, interaction) {
        const donor = interaction.user;
        const recipient = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        // ❌ Vérifications de base - Logger les échecs
        if (recipient.id === donor.id) {
            logCommand(interaction, {
                success: false,
                reason: 'self_donation',
                amount: amount
            });
            return interaction.reply({ 
                content: '<:icon2:1427729544294568010> Vous ne pouvez pas vous donner des Nekos à vous-même !', 
                flags: 64
            });
        }

        if (recipient.bot) {
            logCommand(interaction, {
                success: false,
                reason: 'bot_recipient',
                recipient: recipient.tag,
                amount: amount
            });
            return interaction.reply({ 
                content: '<:icon2:1427729544294568010> Vous ne pouvez pas donner des Nekos à un bot !', 
                flags: 64
            });
        }

        const economy = loadEconomy();

        // ✅ Initialiser les données si nécessaire ET les sauvegarder
        if (!economy[donor.id]) {
            economy[donor.id] = {
                nekos: 0,
                lastWork: 0,
                workCount: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
            saveEconomy(economy);
        }

        if (!economy[recipient.id]) {
            economy[recipient.id] = {
                nekos: 0,
                lastWork: 0,
                workCount: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
            saveEconomy(economy);
        }

        // ❌ Vérifier si le donneur a assez de Nekos
        if (economy[donor.id].nekos < amount) {
            logCommand(interaction, {
                success: false,
                reason: 'insufficient_funds',
                amount: amount,
                currentBalance: economy[donor.id].nekos,
                recipient: recipient.tag
            });
            return interaction.reply({ 
                content: `<:icon2:1427729544294568010> Vous n'avez que **${economy[donor.id].nekos} Nekos**. Vous ne pouvez pas donner ${amount} Nekos.`, 
                ephemeral: true
            });
        }

        // Créer un ID unique pour la demande
        const requestId = `${donor.id}-${recipient.id}-${Date.now()}`;
        console.log(`🆕 [DONNER] Création demande ID: ${requestId}`);

        // Sauvegarder la demande en attente
        const pending = loadPending();
        pending[requestId] = {
            donorId: donor.id,
            recipientId: recipient.id,
            amount: amount,
            timestamp: Date.now(),
            donorTag: donor.tag,
            recipientTag: recipient.tag
        };
        
        console.log(`💾 [DONNER] Ajout de la demande:`, pending[requestId]);
        savePending(pending);
        
        // ✅ Vérification finale après sauvegarde
        const verif = loadPending();
        if (verif[requestId]) {
            console.log(`✅ [DONNER] Demande ${requestId} confirmée dans le fichier`);
        } else {
            console.error(`❌ [DONNER] ERREUR: Demande ${requestId} NON trouvée après sauvegarde!`);
        }

        // ✨ Logger la demande de don envoyée (en attente de validation)
        logCommand(interaction, {
            success: true,
            status: 'pending',
            amount: amount,
            recipient: recipient.tag,
            recipientId: recipient.id,
            donorBalance: economy[donor.id].nekos,
            requestId: requestId
        });

        // Embed pour la demande initiale
        const requestEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('<:icon54:1427722762964701346> Demande de don envoyée')
            .setDescription(`Votre demande de don de **${amount} Nekos** à ${recipient} a été envoyée au staff pour validation.`)
            .addFields(
                { name: '<:icon48:1427722878094414049> Destinataire', value: recipient.username, inline: true },
                { name: '<:icon52:1427722803632930972> Montant', value: `${amount} Nekos`, inline: true },
                { name: '<:icon68:1427722428527804558> Votre solde actuel', value: `${economy[donor.id].nekos} Nekos`, inline: true }
            )
            .setFooter({ text: 'En attente de validation du staff' })
            .setTimestamp();

        await interaction.reply({ 
            embeds: [requestEmbed], 
            ephemeral: true
        });

        // Trouver le canal staff
        const guild = interaction.guild;
        const staffChannel = guild.channels.cache.find(ch => ch.name === 'give-staff' || ch.name === 'staff-give');

        if (!staffChannel) {
            console.error('❌ [DONNER] Canal staff non trouvé');
            return;
        }

        // Embed pour le staff
        const staffEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('<:icon68:1427722428527804558> Nouvelle demande de don')
            .setDescription(`**${donor.tag}** souhaite donner **${amount} Nekos** à **${recipient.tag}**`)
            .addFields(
                { name: '<:icon48:1427722878094414049> Donneur', value: `${donor.tag} (${donor.id})`, inline: true },
                { name: '<:icon48:1427722878094414049> Receveur', value: `${recipient.tag} (${recipient.id})`, inline: true },
                { name: '<:icon52:1427722803632930972> Montant', value: `${amount} Nekos`, inline: true },
                { name: '<:icon11:1427724252391538758> Solde actuel du donneur', value: `${economy[donor.id].nekos} Nekos`, inline: true }
            )
            .setThumbnail(donor.displayAvatarURL())
            .setFooter({ text: `ID de demande: ${requestId}` })
            .setTimestamp();

        // Boutons de validation
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_donation_${requestId}`)
                    .setLabel('Accepter')
                    .setEmoji('1427729550183239690')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_donation_${requestId}`)
                    .setLabel('Refuser')
                    .setEmoji('1427729544294568010')
                    .setStyle(ButtonStyle.Danger)
            );

        await staffChannel.send({ embeds: [staffEmbed], components: [buttons] });
        console.log(`📤 [DONNER] Message envoyé au staff avec les boutons`);
    },

    // ✨ Gestionnaire d'interactions pour les boutons
    async handleButton(client, interaction) {
        if (!interaction.customId.startsWith('accept_donation_') && !interaction.customId.startsWith('reject_donation_')) {
            return;
        }

        const isAccept = interaction.customId.startsWith('accept_donation_');
        const requestId = interaction.customId.replace('accept_donation_', '').replace('reject_donation_', '');

        console.log(`🔘 [DONNER] Bouton cliqué: ${isAccept ? 'ACCEPTER' : 'REFUSER'} - ID: ${requestId}`);

        const pending = loadPending();
        const request = pending[requestId];

        if (!request) {
            return interaction.reply({ 
                content: '❌ Cette demande n\'existe plus ou a déjà été traitée.', 
                ephemeral: true 
            });
        }

        const economy = loadEconomy();
        const donor = await client.users.fetch(request.donorId).catch(() => null);
        const recipient = await client.users.fetch(request.recipientId).catch(() => null);

        if (!donor || !recipient) {
            return interaction.reply({ 
                content: '❌ Impossible de trouver le donneur ou le receveur.', 
                ephemeral: true 
            });
        }

        if (isAccept) {
            // ✅ ACCEPTATION
            if (economy[request.donorId].nekos < request.amount) {
                const insufficientEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('<:icon2:1427729544294568010> Don refusé')
                    .setDescription(`Le donneur n'a plus assez de Nekos pour effectuer ce don.`)
                    .addFields(
                        { name: 'Montant demandé', value: `${request.amount} Nekos`, inline: true },
                        { name: 'Solde actuel', value: `${economy[request.donorId].nekos} Nekos`, inline: true }
                    )
                    .setTimestamp();

                // Notifier le donneur
                await donor.send({ embeds: [insufficientEmbed] }).catch(() => console.log('Impossible d\'envoyer le MP au donneur'));

                // Répondre au staff
                await interaction.update({ 
                    content: '❌ Don refusé automatiquement (solde insuffisant)', 
                    components: [] 
                });

                delete pending[requestId];
                savePending(pending);
                
                // ✨ Logger le refus automatique
                console.log(`📝 [LOG-DONNER] Refus auto pour solde insuffisant - Pas d'interaction Discord à logger`);
                
                return;
            }

            // Effectuer la transaction
            economy[request.donorId].nekos -= request.amount;
            economy[request.recipientId].nekos += request.amount;
            saveEconomy(economy);

            // ✨ Logger l'acceptation du don (transaction effectuée)
            console.log(`📝 [LOG-DONNER] Don accepté par ${interaction.user.tag}`);
            console.log(`   → Donneur: ${request.donorTag} (${request.donorId})`);
            console.log(`   → Receveur: ${request.recipientTag} (${request.recipientId})`);
            console.log(`   → Montant: ${request.amount} Nekos`);
            console.log(`   → Nouveau solde donneur: ${economy[request.donorId].nekos}`);
            console.log(`   → Nouveau solde receveur: ${economy[request.recipientId].nekos}`);

            // Embed pour le donneur
            const donorEmbed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('<:icon33:1427723957494353960> Don accepté !')
                .setDescription(`Votre don de **${request.amount} Nekos** à **${request.recipientTag}** a été validé par le staff.`)
                .addFields(
                    { name: '<:icon52:1427722803632930972> Montant donné', value: `${request.amount} Nekos`, inline: true },
                    { name: '<:icon68:1427722428527804558> Nouveau solde', value: `${economy[request.donorId].nekos} Nekos`, inline: true },
                    { name: '<:icon48:1427722878094414049> Destinataire', value: request.recipientTag, inline: true }
                )
                .setFooter({ text: `Validé par ${interaction.user.tag}` })
                .setTimestamp();

            // Embed pour le receveur
            const recipientEmbed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('<:icon33:1427723957494353960> Vous avez reçu des Nekos !')
                .setDescription(`**${request.donorTag}** vous a envoyé **${request.amount} Nekos** ! 🎁`)
                .addFields(
                    { name: '<:icon52:1427722803632930972> Montant reçu', value: `${request.amount} Nekos`, inline: true },
                    { name: '<:icon68:1427722428527804558> Nouveau solde', value: `${economy[request.recipientId].nekos} Nekos`, inline: true },
                    { name: '<:icon48:1427722878094414049> Donneur', value: request.donorTag, inline: true }
                )
                .setFooter({ text: 'Don validé par le staff' })
                .setTimestamp();

            // Envoyer les notifications
            await donor.send({ embeds: [donorEmbed] }).catch(() => console.log('Impossible d\'envoyer le MP au donneur'));
            await recipient.send({ embeds: [recipientEmbed] }).catch(() => console.log('Impossible d\'envoyer le MP au receveur'));

            // Mettre à jour le message du staff
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#4CAF50')
                .setTitle('<:icon33:1427723957494353960> Don accepté')
                .setFooter({ text: `Accepté par ${interaction.user.tag} • ${requestId}` });

            await interaction.update({ 
                embeds: [updatedEmbed], 
                components: [] 
            });

        } else {
            // ❌ REFUS
            
            // ✨ Logger le refus du don
            console.log(`📝 [LOG-DONNER] Don refusé par ${interaction.user.tag}`);
            console.log(`   → Donneur: ${request.donorTag} (${request.donorId})`);
            console.log(`   → Receveur: ${request.recipientTag} (${request.recipientId})`);
            console.log(`   → Montant: ${request.amount} Nekos`);
            
            const rejectedDonorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('<:icon2:1427729544294568010> Don refusé')
                .setDescription(`Votre demande de don de **${request.amount} Nekos** à **${request.recipientTag}** a été refusée par le staff.`)
                .addFields(
                    { name: '<:icon52:1427722803632930972> Montant', value: `${request.amount} Nekos`, inline: true },
                    { name: '<:icon48:1427722878094414049> Destinataire', value: request.recipientTag, inline: true },
                    { name: '<:icon68:1427722428527804558> Votre solde', value: `${economy[request.donorId].nekos} Nekos`, inline: true }
                )
                .setFooter({ text: `Refusé par ${interaction.user.tag}` })
                .setTimestamp();

            await donor.send({ embeds: [rejectedDonorEmbed] }).catch(() => console.log('Impossible d\'envoyer le MP au donneur'));

            // Mettre à jour le message du staff
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#FF6B6B')
                .setTitle('<:icon2:1427729544294568010> Don refusé')
                .setFooter({ text: `Refusé par ${interaction.user.tag} • ${requestId}` });

            await interaction.update({ 
                embeds: [updatedEmbed], 
                components: [] 
            });
        }

        // Supprimer la demande en attente
        delete pending[requestId];
        savePending(pending);
        console.log(`✅ [DONNER] Demande ${requestId} traitée et supprimée`);
    }
};
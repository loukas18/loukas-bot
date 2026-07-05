const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');

// Configuration - À modifier selon tes besoins
const CONFIG = {
    SUPPORT_ROLE_ID: '1523022939749089417',
    ADMIN_ROLE_ID: '1523022939765735632',
    RESPONSABLE_ROLE_ID: '1523022939765735625',
    TRANSCRIPT_CHANNEL_ID: '1523022941112242261',
    CATEGORY_ID: '1523022941112242262',
    RESPONSABLE_CATEGORY_ID: '1523022941112242264',
    ADMIN_CATEGORY_ID: '1523022941112242265',
    AUTO_CLOSE_TIME: 3600000
};

const autoCloseTimers = new Map();
const autoCloseChannels = new Set();

async function safeReply(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        console.error('Erreur lors de la réponse à l\'interaction:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
            }
        } catch (e) {
            console.error('Impossible de répondre à l\'interaction:', e);
        }
    }
}

function createReasonSelectMenu() {
    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_reason')
                .setPlaceholder('Choisis la raison de ton ticket...')
                .addOptions([
                    {
                        label: '🤖 Problème avec un bot',
                        description: 'Signaler un dysfonctionnement ou bug',
                        value: 'bot_problem',
                        emoji: '🤖'
                    },
                    {
                        label: '📋 Signaler quelqu\'un',
                        description: 'Signaler un comportement inapproprié',
                        value: 'report_user',
                        emoji: '📋'
                    },
                    {
                        label: '❓ Une question',
                        description: 'Poser une question générale',
                        value: 'question',
                        emoji: '❓'
                    },
                    {
                        label: '⚙️ Autres',
                        description: 'Autre raison non listée',
                        value: 'other',
                        emoji: '⚙️'
                    }
                ])
        );
}

function createReorientSelectMenu() {
    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_reorient_choice')
                .setPlaceholder('Choisir le service de réorientation...')
                .addOptions([
                    {
                        label: '👔 Responsable',
                        description: 'Réorienter vers l\'équipe des responsables',
                        value: 'responsable',
                        emoji: '👔'
                    },
                    {
                        label: '⚡ Administration',
                        description: 'Réorienter vers l\'administration',
                        value: 'administration',
                        emoji: '⚡'
                    }
                ])
        );
}

function createDetailsModal(reason) {
    const reasonLabels = {
        'bot_problem': 'Problème avec un bot',
        'report_user': 'Signalement d\'utilisateur',
        'question': 'Question',
        'other': 'Autre'
    };

    return new ModalBuilder()
        .setCustomId(`ticket_details_${reason}`)
        .setTitle(`Ticket - ${reasonLabels[reason]}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ticket_description')
                    .setLabel('Décris ton problème/question en détail')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explique clairement ta demande...')
                    .setRequired(true)
                    .setMaxLength(1000)
            )
        );
}

function createTicketManagementButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_reorient')
                .setLabel('➡️ Réorienter')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel('✅ Prendre en charge')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_auto_close')
                .setLabel('⏱️ Fermeture auto (1h)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('🔒 Fermer le ticket')
                .setStyle(ButtonStyle.Danger)
        );
}

function cancelAutoClose(channelId) {
    if (autoCloseTimers.has(channelId)) {
        clearTimeout(autoCloseTimers.get(channelId));
        autoCloseTimers.delete(channelId);
        autoCloseChannels.delete(channelId);
        return true;
    }
    return false;
}

function checkChannelActivity(message) {
    const channelId = message.channel.id;
    
    if (autoCloseChannels.has(channelId)) {
        if (message.author.bot) return;
        
        const wasCanceled = cancelAutoClose(channelId);
        
        if (wasCanceled) {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('⏸️ Fermeture automatique interrompue')
                .setDescription(`La fermeture automatique a été annulée suite à l'activité de ${message.author}.`)
                .setColor('#ffaa00')
                .setTimestamp();
            
            message.channel.send({ embeds: [cancelEmbed] }).catch(error => {
                console.error('Erreur lors de l\'envoi de l\'annulation auto-close:', error);
            });
        }
    }
}

async function createTicketChannel(interaction, reason, description) {
    const guild = interaction.guild;
    const user = interaction.user;
    
    const reasonLabels = {
        'bot_problem': 'Bot-Problem',
        'report_user': 'Report',
        'question': 'Question',
        'other': 'Other'
    };
    
    const channelName = `ticket-${reasonLabels[reason]}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CONFIG.CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                {
                    id: CONFIG.SUPPORT_ROLE_ID,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ]
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🎫 Nouveau Ticket')
            .setDescription(`**Utilisateur :** ${user}\n**Raison :** ${reasonLabels[reason]}\n**Description :**\n\`\`\`${description}\`\`\``)
            .setColor('#ffaa00')
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        const managementButtons = createTicketManagementButtons();

        await channel.send({
            content: `<@&${CONFIG.SUPPORT_ROLE_ID}> Nouveau ticket créé !`,
            embeds: [ticketEmbed],
            components: [managementButtons]
        });

        return channel;
    } catch (error) {
        console.error('Erreur lors de la création du ticket:', error);
        return null;
    }
}

async function reorientTicket(interaction, newService, reorientedBy) {
    try {
        console.log(`Début de la réorientation vers ${newService} par ${reorientedBy}`);
        
        let newCategoryId, newRoleId, serviceName;
        
        if (newService === 'responsable') {
            newCategoryId = CONFIG.RESPONSABLE_CATEGORY_ID;
            newRoleId = CONFIG.RESPONSABLE_ROLE_ID;
            serviceName = 'Responsable';
        } else if (newService === 'administration') {
            newCategoryId = CONFIG.ADMIN_CATEGORY_ID;
            newRoleId = CONFIG.ADMIN_ROLE_ID;
            serviceName = 'Administration';
        } else {
            console.error('Service de réorientation non valide:', newService);
            return false;
        }

        const channel = interaction.channel;
        console.log(`Configuration: catégorie=${newCategoryId}, rôle=${newRoleId}`);

        // Vérifier que la catégorie existe
        const newCategory = channel.guild.channels.cache.get(newCategoryId);
        if (!newCategory) {
            console.error(`Catégorie ${serviceName} introuvable (ID: ${newCategoryId})`);
            await interaction.editReply({
                content: `❌ Erreur: Catégorie ${serviceName} non trouvée.`
            });
            return false;
        }

        // Vérifier que le rôle existe
        const newRole = channel.guild.roles.cache.get(newRoleId);
        if (!newRole) {
            console.error(`Rôle ${serviceName} introuvable (ID: ${newRoleId})`);
            await interaction.editReply({
                content: `❌ Erreur: Rôle ${serviceName} non trouvé.`
            });
            return false;
        }

        console.log('Changement de catégorie...');
        await channel.setParent(newCategoryId);
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Petit délai

        console.log('Mise à jour des permissions...');
        
        // Récupérer tous les overrides existants et les supprimer
        for (const [key, override] of channel.permissionOverwrites.cache) {
            if (override.type === 'role') {
                await channel.permissionOverwrites.delete(key).catch(e => console.log('Delete override:', e.message));
            }
        }

        // Ajouter la permission @everyone à deny
        await channel.permissionOverwrites.edit(channel.guild.id, {
            ViewChannel: false
        }).catch(e => console.log('Everyone deny:', e.message));

        // Garder l'utilisateur du ticket
        const ticketUserId = channel.name.split('-').pop();
        const members = await channel.guild.members.fetch().catch(() => null);
        
        // Garder le propriétaire du ticket visible
        for (const member of members?.values() || []) {
            if (channel.permissionOverwrites.cache.get(member.id)) {
                continue; // Garder les permissions existantes de l'utilisateur
            }
        }

        // Donner l'accès au nouveau service
        console.log(`Ajout des permissions pour ${serviceName}...`);
        await channel.permissionOverwrites.edit(newRoleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        console.log('Envoi du message de confirmation...');
        const reorientEmbed = new EmbedBuilder()
            .setTitle('📍 Ticket Réorienté')
            .setDescription(`Ce ticket a été réorienté vers **${serviceName}** par ${reorientedBy}`)
            .setColor('#0099ff')
            .setTimestamp();

        await channel.send({
            content: `<@&${newRoleId}> Ticket réorienté !`,
            embeds: [reorientEmbed]
        });

        console.log('Réorientation terminée avec succès');
        return true;
        
    } catch (error) {
        console.error('Erreur détaillée lors de la réorientation:', {
            error: error.message,
            stack: error.stack,
            service: newService
        });
        return false;
    }
}

async function createTranscript(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        let transcript = `Transcript du ticket: ${channel.name}\n`;
        transcript += `Date de création: ${new Date().toLocaleString()}\n`;
        transcript += `${'='.repeat(50)}\n\n`;
        
        sortedMessages.forEach(message => {
            const timestamp = new Date(message.createdTimestamp).toLocaleString();
            transcript += `[${timestamp}] ${message.author.tag}: ${message.content}\n`;
            
            if (message.embeds.length > 0) {
                transcript += `  [Embed: ${message.embeds[0].title || 'Sans titre'}]\n`;
            }
            
            if (message.attachments.size > 0) {
                message.attachments.forEach(attachment => {
                    transcript += `  [Fichier: ${attachment.name}]\n`;
                });
            }
            
            transcript += '\n';
        });
        
        return transcript;
    } catch (error) {
        console.error('Erreur lors de la création du transcript:', error);
        return 'Erreur lors de la génération du transcript';
    }
}

async function closeTicket(channel, closedBy, isAuto = false) {
    try {
        const transcript = await createTranscript(channel);
        
        const transcriptChannel = channel.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
        if (transcriptChannel) {
            const transcriptEmbed = new EmbedBuilder()
                .setTitle('📄 Transcript de Ticket')
                .setDescription(`**Canal :** ${channel.name}\n**Fermé par :** ${closedBy}\n**Type :** ${isAuto ? 'Fermeture automatique' : 'Fermeture manuelle'}`)
                .setColor('#ff0000')
                .setTimestamp();
            
            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [{
                    attachment: Buffer.from(transcript, 'utf-8'),
                    name: `transcript-${channel.name}-${Date.now()}.txt`
                }]
            });
        }
        
        if (autoCloseTimers.has(channel.id)) {
            clearTimeout(autoCloseTimers.get(channel.id));
            autoCloseTimers.delete(channel.id);
        }
        
        autoCloseChannels.delete(channel.id);
        
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (error) {
                console.error('Erreur lors de la suppression du canal:', error);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Erreur lors de la fermeture du ticket:', error);
    }
}

function hasTicketPermissions(member) {
    return member.roles.cache.has(CONFIG.ADMIN_ROLE_ID) || 
           member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) ||
           member.roles.cache.has(CONFIG.RESPONSABLE_ROLE_ID);
}

module.exports = {
    name: 'ticketHandler',
    handleMessageActivity: checkChannelActivity,
    
    async execute(interaction, client) {
        try {
            const ticketButtons = ['create_ticket', 'ticket_reorient', 'ticket_claim', 'ticket_auto_close', 'ticket_close'];
            const ticketSelects = ['ticket_reason', 'ticket_reorient_choice'];
            const ticketModals = interaction.customId?.startsWith('ticket_details_');

            if (interaction.isButton() && ticketButtons.includes(interaction.customId)) {
                
                switch (interaction.customId) {
                    case 'create_ticket':
                        const selectMenu = createReasonSelectMenu();
                        await safeReply(interaction, {
                            content: '**Sélectionne la raison de ton ticket :**',
                            components: [selectMenu],
                            ephemeral: true
                        });
                        break;

                    case 'ticket_reorient':
                        if (!hasTicketPermissions(interaction.member)) {
                            return await safeReply(interaction, {
                                content: '❌ Seuls les membres du support, les responsables et les administrateurs peuvent réorienter les tickets.',
                                ephemeral: true
                            });
                        }
                        
                        const reorientSelectMenu = createReorientSelectMenu();
                        await safeReply(interaction, {
                            content: '**Choisir le service de réorientation :**',
                            components: [reorientSelectMenu],
                            ephemeral: true
                        });
                        break;

                    case 'ticket_claim':
                        if (!hasTicketPermissions(interaction.member)) {
                            return await safeReply(interaction, {
                                content: '❌ Seuls les membres du support peuvent prendre en charge un ticket.',
                                ephemeral: true
                            });
                        }
                        
                        const claimEmbed = new EmbedBuilder()
                            .setTitle('🙋 Ticket pris en charge')
                            .setDescription(`${interaction.user} prend en charge ce ticket.`)
                            .setColor('#00ff00')
                            .setTimestamp();
                        await safeReply(interaction, { embeds: [claimEmbed] });
                        break;

                    case 'ticket_auto_close':
                        if (!hasTicketPermissions(interaction.member)) {
                            return await safeReply(interaction, {
                                content: '❌ Seuls les membres du support peuvent activer la fermeture automatique.',
                                ephemeral: true
                            });
                        }
                        
                        const channelId = interaction.channel.id;
                        
                        if (autoCloseChannels.has(channelId)) {
                            return await safeReply(interaction, {
                                content: '⏱️ Une fermeture automatique est déjà active sur ce ticket.',
                                ephemeral: true
                            });
                        }
                        
                        const timer = setTimeout(async () => {
                            await closeTicket(interaction.channel, 'Système (Auto)', true);
                            autoCloseTimers.delete(channelId);
                            autoCloseChannels.delete(channelId);
                        }, CONFIG.AUTO_CLOSE_TIME);
                        
                        autoCloseTimers.set(channelId, timer);
                        autoCloseChannels.add(channelId);
                        
                        const autoCloseEmbed = new EmbedBuilder()
                            .setTitle('⏱️ Fermeture automatique activée')
                            .setDescription('Ce ticket se fermera automatiquement dans 1 heure s\'il n\'y a aucune activité.')
                            .setColor('#ff9900')
                            .setTimestamp();
                        await safeReply(interaction, { embeds: [autoCloseEmbed] });
                        break;

                    case 'ticket_close':
                        if (!hasTicketPermissions(interaction.member)) {
                            return await safeReply(interaction, {
                                content: '❌ Seuls les membres du support peuvent fermer un ticket.',
                                ephemeral: true
                            });
                        }
                        
                        await safeReply(interaction, { 
                            content: '🔒 Fermeture du ticket en cours...', 
                            ephemeral: true 
                        });
                        await closeTicket(interaction.channel, interaction.user.toString(), false);
                        break;
                }
            }

            else if (interaction.isStringSelectMenu() && ticketSelects.includes(interaction.customId)) {
                if (interaction.customId === 'ticket_reason') {
                    const reason = interaction.values[0];
                    const modal = createDetailsModal(reason);
                    await interaction.showModal(modal);
                }
                else if (interaction.customId === 'ticket_reorient_choice') {
                    try {
                        const newService = interaction.values[0];
                        
                        await interaction.reply({
                            content: '📍 Réorientation en cours...',
                            ephemeral: true
                        });
                        
                        const success = await reorientTicket(interaction, newService, interaction.user.toString());
                        
                        if (success) {
                            await interaction.editReply({
                                content: `✅ Ticket réorienté avec succès vers **${newService === 'responsable' ? 'Responsable' : 'Administration'}** !`
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Erreur lors de la réorientation du ticket. Vérifiez les IDs de configuration.'
                            });
                        }
                        
                    } catch (error) {
                        console.error('Erreur lors de la réorientation:', error);
                        
                        try {
                            if (interaction.replied) {
                                await interaction.editReply({
                                    content: '❌ Erreur lors de la réorientation du ticket.'
                                });
                            } else {
                                await interaction.reply({
                                    content: '❌ Erreur lors de la réorientation du ticket.',
                                    ephemeral: true
                                });
                            }
                        } catch (replyError) {
                            console.error('Erreur lors de la réponse d\'erreur:', replyError);
                        }
                    }
                }
            }

            else if (interaction.isModalSubmit() && ticketModals) {
                const [, , reason] = interaction.customId.split('_');
                const description = interaction.fields.getTextInputValue('ticket_description');
                
                await interaction.deferReply({ ephemeral: true });
                
                const ticketChannel = await createTicketChannel(interaction, reason, description);
                
                if (ticketChannel) {
                    await interaction.editReply({
                        content: `✅ Ton ticket a été créé ! ${ticketChannel}`
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Erreur lors de la création du ticket. Vérifiez la configuration.'
                    });
                }
            }

        } catch (error) {
            console.error('Erreur dans la gestion des tickets:', error);
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: '❌ Une erreur est survenue lors du traitement de votre demande.'
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ Une erreur est survenue lors du traitement de votre demande.',
                        ephemeral: true
                    });
                }
            } catch (followUpError) {
                console.error('Erreur lors de la gestion d\'erreur:', followUpError);
            }
        }
    }
};
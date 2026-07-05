const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logCommand } = require('../../utils/commandLogger');

const customRolesPath = path.join(process.cwd(), 'customRoles.json');

function loadCustomRoles() {
    if (!fs.existsSync(customRolesPath)) {
        fs.writeFileSync(customRolesPath, JSON.stringify({}));
        return {};
    }
    return JSON.parse(fs.readFileSync(customRolesPath, 'utf8'));
}

function saveCustomRoles(data) {
    fs.writeFileSync(customRolesPath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gerer-role')
        .setDescription('Gérez votre rôle personnalisé')
        .setDMPermission(false),

    async run(client, interaction) {
        await handleManageRole(interaction);
    },

    // Gestionnaire du menu de sélection des rôles
    async handleSelectMenu(client, interaction) {
        if (interaction.customId.startsWith('select_custom_role_')) {
            const userId = interaction.customId.replace('select_custom_role_', '');

            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit d\'interagir avec ce menu',
                    ephemeral: true
                });
            }

            const roleId = interaction.values[0];
            const customRoles = loadCustomRoles();

            if (!customRoles[roleId]) {
                return interaction.reply({
                    content: '❌ Ce rôle personnalisé n\'existe plus',
                    ephemeral: true
                });
            }

            const roleData = customRoles[roleId];

            if (roleData.userId !== userId) {
                return interaction.reply({
                    content: '❌ Ce n\'est pas votre rôle personnalisé',
                    ephemeral: true
                });
            }

            // Menu d'action
            await showRoleActionMenu(interaction, roleId, roleData);
        } 
        else if (interaction.customId.startsWith('role_action_')) {
            const parts = interaction.customId.replace('role_action_', '').split('_');
            const userId = parts[0];
            const roleId = parts.slice(1).join('_');
            const action = interaction.values[0]; // modifier ou ajouter_membres
            
            console.log('DEBUG roleAction -', { userId, roleId, action, userInteractionId: interaction.user.id });
            
            const customRoles = loadCustomRoles();
            const roleData = customRoles[roleId];

            if (interaction.user.id !== userId) {
                console.log('DEBUG: userId mismatch -', interaction.user.id, '!==', userId);
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit d\'effectuer cette action',
                    ephemeral: true
                });
            }

            if (!roleData) {
                console.log('DEBUG: roleData not found for roleId:', roleId);
                return interaction.reply({
                    content: '❌ Ce rôle n\'existe plus',
                    ephemeral: true
                });
            }

            if (roleData.userId !== userId) {
                console.log('DEBUG: roleData.userId mismatch -', roleData.userId, '!==', userId);
                return interaction.reply({
                    content: '❌ Ce n\'est pas votre rôle',
                    ephemeral: true
                });
            }

            if (action === 'modifier') {
                await showModifyRoleModal(interaction, roleId);
            } else if (action === 'ajouter_membres') {
                await showAddMembersModal(interaction, roleId);
            } else if (action === 'retirer_membres') {
                await showRemoveMembersModal(interaction, roleId);
            }
        }
        else if (interaction.customId.startsWith('add_members_select_')) {
            const roleId = interaction.customId.replace('add_members_select_', '');
            const customRoles = loadCustomRoles();
            const roleData = customRoles[roleId];

            if (!roleData || roleData.userId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit d\'effectuer cette action',
                    ephemeral: true
                });
            }

            if (interaction.values.length === 0) {
                return interaction.deferUpdate();
            }

            const memberId = interaction.values[0];

            try {
                const guild = interaction.guild;
                const role = guild.roles.cache.get(roleId);
                const member = await guild.members.fetch(memberId);

                if (!role) {
                    return interaction.reply({
                        content: '❌ Le rôle n\'existe plus',
                        ephemeral: true
                    });
                }

                const currentMembers = roleData.members || [];
                if (currentMembers.length >= 5) {
                    return interaction.reply({
                        content: '❌ Vous avez déjà 5 membres maximum',
                        ephemeral: true
                    });
                }

                if (currentMembers.includes(memberId)) {
                    return interaction.reply({
                        content: '❌ Ce membre a déjà ce rôle',
                        ephemeral: true
                    });
                }

                await member.roles.add(role);
                roleData.members.push(memberId);
                saveCustomRoles(customRoles);

                logCommand(interaction, {
                    success: true,
                    action: 'add_member_to_role',
                    roleId: roleId,
                    memberId: memberId,
                    memberName: member.user.username
                });

                const embed = new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('<:icon:1427729550183239690> Membre ajouté')
                    .setDescription(`${member.user.username} a reçu le rôle`)
                    .addFields(
                        { name: '<:icon80:1427722103293218897> Total', value: `${roleData.members.length}/5`, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                console.log(`📝 [GERER-ROLE] ${member.user.username} ajouté au rôle par ${interaction.user.tag}`);

            } catch (error) {
                console.error('❌ Erreur lors de l\'ajout du membre:', error);
                logCommand(interaction, {
                    success: false,
                    reason: 'failed_to_add_member',
                    error: error.message
                });

                await interaction.reply({
                    content: '❌ Erreur lors de l\'ajout du membre',
                    ephemeral: true
                });
            }
        }
        else if (interaction.customId.startsWith('remove_members_checkbox_')) {
            const roleId = interaction.customId.replace('remove_members_checkbox_', '');
            const customRoles = loadCustomRoles();
            const roleData = customRoles[roleId];

            if (!roleData || roleData.userId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit d\'effectuer cette action',
                    ephemeral: true
                });
            }

            const selectedMembers = interaction.values;

            if (selectedMembers.length === 0) {
                return interaction.deferUpdate();
            }

            try {
                const guild = interaction.guild;
                const role = guild.roles.cache.get(roleId);

                if (!role) {
                    return interaction.reply({
                        content: '❌ Le rôle n\'existe plus',
                        ephemeral: true
                    });
                }

                let removedCount = 0;
                const removedMembers = [];

                for (const memberId of selectedMembers) {
                    try {
                        const member = await guild.members.fetch(memberId);
                        await member.roles.remove(role);
                        roleData.members = roleData.members.filter(id => id !== memberId);
                        removedCount++;
                        removedMembers.push(member.user.username);
                    } catch (err) {
                        console.error(`Erreur pour retirer le rôle à ${memberId}:`, err);
                    }
                }

                saveCustomRoles(customRoles);

                logCommand(interaction, {
                    success: true,
                    action: 'remove_members_from_role',
                    roleId: roleId,
                    membersRemoved: selectedMembers,
                    count: removedCount
                });

                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('<:icon:1427729550183239690> Membres retirés')
                    .setDescription(`${removedCount} membre(s) ont perdu le rôle`)
                    .addFields(
                        { name: '<:icon48:1427722878094414049> Membres retirés', value: removedMembers.join('\n'), inline: true },
                        { name: '<:icon80:1427722103293218897> Total restant', value: `${roleData.members.length}/5`, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                console.log(`📝 [GERER-ROLE] ${removedCount} membre(s) retiré(s) du rôle par ${interaction.user.tag}`);

            } catch (error) {
                console.error('❌ Erreur lors du retrait des membres:', error);
                logCommand(interaction, {
                    success: false,
                    reason: 'failed_to_remove_members',
                    error: error.message
                });

                await interaction.reply({
                    content: '❌ Erreur lors du retrait des membres',
                    ephemeral: true
                });
            }
        }
    },

    // Gestionnaire des modals
    async handleModal(client, interaction) {
        if (interaction.customId.startsWith('modify_role_modal_')) {
            const roleId = interaction.customId.replace('modify_role_modal_', '');
            const customRoles = loadCustomRoles();
            const roleData = customRoles[roleId];

            if (!roleData || roleData.userId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit de modifier ce rôle',
                    ephemeral: true
                });
            }

            const newName = interaction.fields.getTextInputValue('role_name');
            const newColor = interaction.fields.getTextInputValue('role_color');
            const newEmoji = interaction.fields.getTextInputValue('role_emoji');

            // Validations
            if (!newName || newName.length < 1 || newName.length > 100) {
                return interaction.reply({
                    content: '❌ Le nom du rôle doit faire entre 1 et 100 caractères',
                    ephemeral: true
                });
            }

            if (!newColor.match(/^#[0-9A-F]{6}$/i)) {
                return interaction.reply({
                    content: '❌ La couleur doit être au format hexadécimal (#RRGGBB)',
                    ephemeral: true
                });
            }

            if (newEmoji.length > 2) {
                return interaction.reply({
                    content: '❌ L\'emoji doit être unique (1 caractère)',
                    ephemeral: true
                });
            }

            try {
                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    return interaction.reply({
                        content: '❌ Le rôle n\'existe plus',
                        ephemeral: true
                    });
                }

                // Ancien nom et couleur
                const oldName = roleData.roleName;
                const oldColor = roleData.roleColor;
                const oldEmoji = roleData.roleEmoji;

                // Mettre à jour le rôle Discord
                await role.edit({
                    name: newName,
                    color: newColor,
                    reason: `Modification par ${interaction.user.tag}`
                });

                // Mettre à jour les données
                roleData.roleName = newName;
                roleData.roleColor = newColor;
                roleData.roleEmoji = newEmoji;
                saveCustomRoles(customRoles);

                logCommand(interaction, {
                    success: true,
                    action: 'modify_role',
                    roleId: roleId,
                    changes: {
                        name: { old: oldName, new: newName },
                        color: { old: oldColor, new: newColor },
                        emoji: { old: oldEmoji, new: newEmoji }
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('<:icon:1427729550183239690> Rôle modifié avec succès')
                    .setDescription('Vos modifications ont été appliquées')
                    .addFields(
                        { name: '<:icon79:1427722122050142209> Nom', value: `${oldEmoji} **${oldName}** → ${newEmoji} **${newName}**`, inline: false },
                        { name: '<:icon76:1427722179604381776> Couleur', value: `${oldColor} → ${newColor}`, inline: false }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                console.log(`📝 [GERER-ROLE] Rôle ${roleId} modifié par ${interaction.user.tag}`);

            } catch (error) {
                console.error('❌ Erreur lors de la modification du rôle:', error);
                logCommand(interaction, {
                    success: false,
                    reason: 'failed_to_modify_role',
                    roleId: roleId,
                    error: error.message
                });

                await interaction.reply({
                    content: '❌ Erreur lors de la modification du rôle',
                    ephemeral: true
                });
            }
        }
        else if (interaction.customId.startsWith('search_member_modal_')) {
            const roleId = interaction.customId.replace('search_member_modal_', '');
            const searchQuery = interaction.fields.getTextInputValue('member_search').toLowerCase();
            const customRoles = loadCustomRoles();
            const roleData = customRoles[roleId];

            if (!roleData || roleData.userId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit d\'effectuer cette action',
                    ephemeral: true
                });
            }

            try {
                const guild = interaction.guild;
                const members = await guild.members.fetch();
                const currentMembers = roleData.members || [];

                const matchingMembers = members
                    .filter(m => !m.user.bot && m.user.username.toLowerCase().includes(searchQuery) && !currentMembers.includes(m.id))
                    .first(25);

                if (matchingMembers.length === 0) {
                    return interaction.reply({
                        content: '❌ Aucun membre trouvé avec ce pseudo',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`add_members_select_${roleId}`)
                    .setPlaceholder('Sélectionnez un membre à ajouter');

                matchingMembers.forEach(member => {
                    selectMenu.addOptions({
                        label: member.user.username,
                        value: member.id,
                        description: member.user.username
                    });
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const embed = new EmbedBuilder()
                    .setColor('#9C27B0')
                    .setTitle('<:icon80:1427722103293218897> Ajouter un membre')
                    .setDescription(`${matchingMembers.length} membre(s) trouvé(s)`)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

            } catch (error) {
                console.error('❌ Erreur lors de la recherche de membres:', error);
                await interaction.reply({
                    content: '❌ Erreur lors de la recherche',
                    ephemeral: true
                });
            }
        }
    }
};

// ════════════════════════════════════════════════════════════════════
// FONCTIONS SECONDAIRES
// ════════════════════════════════════════════════════════════════════

async function handleManageRole(interaction) {
    const userId = interaction.user.id;
    const customRoles = loadCustomRoles();

    // Trouver les rôles de l'utilisateur
    const userRoles = Object.entries(customRoles)
        .filter(([roleId, data]) => data.userId === userId)
        .map(([roleId, data]) => ({ roleId, ...data }));

    if (userRoles.length === 0) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas de rôle personnalisé. Achetez-en un avec la commande `/boutique`',
            ephemeral: true
        });
    }

    // Menu de sélection des rôles
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_custom_role_${userId}`)
        .setPlaceholder('Sélectionnez un rôle à gérer');

    userRoles.forEach(role => {
        selectMenu.addOptions({
            label: `${role.roleEmoji} ${role.roleName}`,
            value: role.roleId,
            description: `Créé le ${new Date(role.createdAt).toLocaleDateString('fr-FR')}`
        });
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#9C27B0')
        .setTitle('<:icon79:1427722122050142209> Gérer vos rôles personnalisés')
        .setDescription(`Vous avez ${userRoles.length} rôle(s) personnalisé(s)`)
        .addFields(
            { name: '<:icon70:1427722390376546396> Rôles', value: userRoles.map(r => `${r.roleEmoji} **${r.roleName}**`).join('\n'), inline: true }
        )
        .setFooter({ text: 'Sélectionnez un rôle pour le gérer' })
        .setTimestamp();

    logCommand(interaction, {
        success: true,
        action: 'manage_role_view',
        customRolesCount: userRoles.length
    });

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showRoleActionMenu(interaction, roleId, roleData) {
    const actionMenu = new StringSelectMenuBuilder()
        .setCustomId(`role_action_${interaction.user.id}_${roleId}`)
        .setPlaceholder('Que voulez-vous faire?')
        .addOptions([
            {
                label: 'Modifier le rôle',
                value: 'modifier',
                emoji: '<:icon8:1427724260151001118>',
                description: 'Changer le nom, la couleur, l\'emoji'
            },
            {
                label: 'Ajouter des membres',
                value: 'ajouter_membres',
                emoji: '<:icon80:1427722103293218897>',
                description: `Ajouter des membres (${roleData.members?.length || 0}/5)`
            },
            {
                label: 'Retirer des membres',
                value: 'retirer_membres',
                emoji: '<:icon15:1427724244615172318>',
                description: `Retirer des membres (${roleData.members?.length || 0} actuels)`
            }
        ]);

    const row = new ActionRowBuilder().addComponents(actionMenu);

    const embed = new EmbedBuilder()
        .setColor('#9C27B0')
        .setTitle(`<:icon79:1427722122050142209> Gérer ${roleData.roleEmoji} ${roleData.roleName}`)
        .setDescription('Choisissez l\'action à effectuer')
        .addFields(
            { name: '<:icon76:1427722179604381776> Couleur', value: `\`${roleData.roleColor}\``, inline: true },
            { name: '<:icon80:1427722103293218897> Membres', value: `${roleData.members?.length || 0}/5`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showModifyRoleModal(interaction, roleId) {
    const customRoles = loadCustomRoles();
    const roleData = customRoles[roleId];

    const modal = new ModalBuilder()
        .setCustomId(`modify_role_modal_${roleId}`)
        .setTitle('<:icon8:1427724260151001118> Modifier votre rôle');

    const roleNameInput = new TextInputBuilder()
        .setCustomId('role_name')
        .setLabel('Nom du rôle')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setValue(roleData.roleName);

    const roleColorInput = new TextInputBuilder()
        .setCustomId('role_color')
        .setLabel('Couleur (format #RRGGBB)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(7)
        .setMaxLength(7)
        .setValue(roleData.roleColor);

    const roleEmojiInput = new TextInputBuilder()
        .setCustomId('role_emoji')
        .setLabel('Emoji')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setValue(roleData.roleEmoji);

    const row1 = new ActionRowBuilder().addComponents(roleNameInput);
    const row2 = new ActionRowBuilder().addComponents(roleColorInput);
    const row3 = new ActionRowBuilder().addComponents(roleEmojiInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
}

async function showAddMembersModal(interaction, roleId) {
    const modal = new ModalBuilder()
        .setCustomId(`search_member_modal_${roleId}`)
        .setTitle('Chercher un membre');

    const searchInput = new TextInputBuilder()
        .setCustomId('member_search')
        .setLabel('Tapez le début du pseudo')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(32)
        .setPlaceholder('Ex: Alex, Tom...');

    const row = new ActionRowBuilder().addComponents(searchInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function showRemoveMembersModal(interaction, roleId) {
    const customRoles = loadCustomRoles();
    const roleData = customRoles[roleId];
    const currentMembers = roleData.members || [];

    if (currentMembers.length === 0) {
        return interaction.reply({
            content: '❌ Il n\'y a pas de membres à retirer',
            ephemeral: true
        });
    }

    try {
        const guild = interaction.guild;
        const membersList = [];

        for (const memberId of currentMembers) {
            try {
                const member = await guild.members.fetch(memberId);
                membersList.push({ id: memberId, username: member.user.username });
            } catch (err) {
                console.error(`Impossible de récupérer le membre ${memberId}:`, err);
            }
        }

        if (membersList.length === 0) {
            return interaction.reply({
                content: '❌ Impossible de récupérer les données des membres',
                ephemeral: true
            });
        }

        const checkboxMenu = new StringSelectMenuBuilder()
            .setCustomId(`remove_members_checkbox_${roleId}`)
            .setPlaceholder('Sélectionnez les membres à retirer')
            .setMinValues(1)
            .setMaxValues(Math.min(membersList.length, 25));

        membersList.slice(0, 25).forEach(member => {
            checkboxMenu.addOptions({
                label: member.username,
                value: member.id,
                description: `Retirer ${member.username}`,
                emoji: '☑️'
            });
        });

        const row = new ActionRowBuilder().addComponents(checkboxMenu);

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('<:icon15:1427724244615172318> Retirer des membres')
            .setDescription(`Sélectionnez les membres à retirer (${membersList.length}/${currentMembers.length})`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    } catch (error) {
        console.error('❌ Erreur lors de la récupération des membres:', error);
        await interaction.reply({
            content: '❌ Erreur lors de la récupération des membres',
            ephemeral: true
        });
    }
}
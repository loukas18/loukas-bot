const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logCommand } = require('../../utils/commandLogger');

const economyPath = path.join(process.cwd(), 'economy.json');
const purchasePath = path.join(process.cwd(), 'purchases.json');
const customRolesPath = path.join(process.cwd(), 'customRoles.json');

// ════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ════════════════════════════════════════════════════════════════════

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

function loadPurchases() {
    if (!fs.existsSync(purchasePath)) {
        fs.writeFileSync(purchasePath, JSON.stringify({}));
        return {};
    }
    return JSON.parse(fs.readFileSync(purchasePath, 'utf8'));
}

function savePurchases(data) {
    fs.writeFileSync(purchasePath, JSON.stringify(data, null, 2));
}

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

// ════════════════════════════════════════════════════════════════════
// ARTICLES DE LA BOUTIQUE
// ════════════════════════════════════════════════════════════════════

const SHOP_ITEMS = {
    vip: {
        name: 'Rôle VIP',
        price: 8000,
        emoji: '<:icon40:1427723777906835568>',
        description: 'Obtenez le rôle <@&1523022939723927619>',
        roleId: process.env.VIP_ROLE_ID || '1523022939723927619'
    },
    xp: {
        name: 'Boost XP (1 mois)',
        price: 5000,
        emoji: '<:icon41:1427723758126235748>',
        description: 'Boost vos points XP pendant 1 mois',
        duration: 30 * 24 * 60 * 60 * 1000
    },
    custom_role: {
        name: 'Rôle Personnalisé',
        price: 10000,
        emoji: '<:icon8:1427724260151001118>',
        description: 'Créez un rôle avec votre nom, couleur et emoji'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boutique')
        .setDescription('Accédez à la boutique pour acheter des articles')
        .setDMPermission(false),

    async run(client, interaction) {
        await handleShowShop(interaction);
    },

    // ✨ Gestionnaire du menu déroulant
    async handleSelectMenu(client, interaction) {
        if (!interaction.customId.startsWith('shop_select_')) {
            return;
        }

        try {
            const userId = interaction.customId.replace('shop_select_', '');

            // ✅ Vérification que c'est bien l'utilisateur
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '❌ Vous n\'avez pas le droit d\'interagir avec ce menu',
                    ephemeral: true
                });
            }

            const itemId = interaction.values[0];

            if (!SHOP_ITEMS[itemId]) {
                return interaction.reply({
                    content: '❌ Article introuvable',
                    ephemeral: true
                });
            }

            const item = SHOP_ITEMS[itemId];
            const economy = loadEconomy();

            // ✅ Vérification des données
            if (!economy[userId]) {
                economy[userId] = {
                    nekos: 0,
                    lastWork: 0,
                    workCount: 0,
                    lastDaily: 0,
                    lastWeekly: 0,
                    lastMonthly: 0
                };
                saveEconomy(economy);
            }

            // ❌ Vérification du solde
            if (economy[userId].nekos < item.price) {
                logCommand(interaction, {
                    success: false,
                    reason: 'insufficient_funds',
                    action: 'shop_select',
                    itemId: itemId,
                    itemName: item.name,
                    itemPrice: item.price,
                    currentBalance: economy[userId].nekos
                });

                return interaction.reply({
                    content: `❌ Vous n'avez que **${economy[userId].nekos} Nekos**. Il vous en faut **${item.price}** pour acheter ${item.emoji} **${item.name}**`,
                    ephemeral: true
                });
            }

            // 🎤 Vérification pour le VIP
            if (itemId === 'vip') {
                const hasVipRole = interaction.member.roles.cache.has(item.roleId);
                if (hasVipRole) {
                    logCommand(interaction, {
                        success: false,
                        reason: 'already_has_vip',
                        action: 'shop_select',
                        itemId: itemId
                    });

                    return interaction.reply({
                        content: '❌ Vous possédez déjà le rôle VIP! Votre achat a été annulé et vos Nekos conservés.',
                        ephemeral: true
                    });
                }
                await showConfirmation(interaction, itemId, item, economy[userId].nekos);
            } else if (itemId === 'custom_role') {
                await showCustomRoleModal(interaction);
            } else {
                await showConfirmation(interaction, itemId, item, economy[userId].nekos);
            }
        } catch (error) {
            console.error('❌ [BOUTIQUE] Erreur menu déroulant:', error);
            await interaction.reply({
                content: '❌ Une erreur s\'est produite',
                ephemeral: true
            }).catch(() => console.error('Impossible de répondre'));
        }
    },

    // ✨ Gestionnaire des boutons de confirmation
    async handleButton(client, interaction) {
        if (!interaction.customId.startsWith('confirm_purchase_') && !interaction.customId.startsWith('cancel_purchase_')) {
            return;
        }

        const isConfirm = interaction.customId.startsWith('confirm_purchase_');
        const data = interaction.customId.replace(/^(confirm|cancel)_purchase_/, '').split('-');
        const userId = data[0];
        const itemId = data[1];

        // ✅ Vérification que c'est bien l'utilisateur
        if (interaction.user.id !== userId) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas le droit d\'interagir avec ce bouton',
                ephemeral: true
            });
        }

        if (!SHOP_ITEMS[itemId]) {
            return interaction.reply({
                content: '❌ Article introuvable',
                ephemeral: true
            });
        }

        const item = SHOP_ITEMS[itemId];
        const economy = loadEconomy();

        if (!economy[userId]) {
            economy[userId] = { nekos: 0 };
            saveEconomy(economy);
        }

        if (!isConfirm) {
            // ❌ Annulation
            logCommand(interaction, {
                success: true,
                action: 'cancel_purchase',
                itemId: itemId,
                itemName: item.name
            });

            const cancelEmbed = new EmbedBuilder()
                .setColor('#999999')
                .setTitle('❌ Achat annulé')
                .setDescription(`Vous avez annulé l'achat de **${item.name}**`);

            await interaction.update({ embeds: [cancelEmbed], components: [] });
            console.log(`📝 [BOUTIQUE] Achat annulé par ${interaction.user.tag}`);
            return;
        }

        // ✅ Confirmation - Vérifications supplémentaires pour VIP
        if (itemId === 'vip') {
            const hasVipRole = interaction.member.roles.cache.has(item.roleId);
            if (hasVipRole) {
                logCommand(interaction, {
                    success: false,
                    reason: 'vip_already_owned',
                    action: 'confirm_purchase'
                });

                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('❌ Achat impossible')
                    .setDescription('Vous possédez déjà le rôle VIP!');

                return interaction.update({ embeds: [errorEmbed], components: [] });
            }
        }

        // Vérification du solde (2ème vérification)
        if (economy[userId].nekos < item.price) {
            logCommand(interaction, {
                success: false,
                reason: 'insufficient_funds_confirm',
                action: 'confirm_purchase',
                itemId: itemId,
                itemPrice: item.price,
                currentBalance: economy[userId].nekos
            });

            return interaction.reply({
                content: `❌ Votre solde a changé! Vous avez maintenant **${economy[userId].nekos} Nekos** (besoin: ${item.price})`,
                ephemeral: true
            });
        }

        // 💰 Débiter les Nekos
        const previousBalance = economy[userId].nekos;
        economy[userId].nekos -= item.price;
        saveEconomy(economy);

        // ✅ Ajouter le rôle VIP si applicable
        if (itemId === 'vip') {
            try {
                await interaction.member.roles.add(item.roleId);
                console.log(`✅ Rôle VIP ajouté à ${interaction.user.tag}`);
            } catch (error) {
                console.error('❌ Erreur lors de l\'ajout du rôle VIP:', error);
                // Rembourser l'utilisateur en cas d'erreur
                economy[userId].nekos += item.price;
                saveEconomy(economy);
                
                logCommand(interaction, {
                    success: false,
                    reason: 'failed_to_add_vip_role',
                    action: 'confirm_purchase',
                    error: error.message
                });

                return interaction.reply({
                    content: '❌ Erreur lors de l\'ajout du rôle. Les Nekos ont été remboursés.',
                    ephemeral: true
                });
            }
        }

        // ✨ Logger l'achat
        logCommand(interaction, {
            success: true,
            action: 'confirm_purchase',
            itemId: itemId,
            itemName: item.name,
            itemPrice: item.price,
            previousBalance: previousBalance,
            newBalance: economy[userId].nekos
        });

        // Embed de confirmation
        const confirmEmbed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle(`✅ ${item.name} acheté!`)
            .setDescription(`Vous avez acheté **${item.name}** avec succès!`)
            .addFields(
                { name: '<:icon62:1427722578922832083> Article', value: item.name, inline: true },
                { name: '<:icon52:1427722803632930972> Coût', value: `${item.price} Nekos`, inline: true },
                { name: '<:icon68:1427722428527804558> Nouveau solde', value: `${economy[userId].nekos} Nekos`, inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [confirmEmbed], components: [] });

        console.log(`📝 [BOUTIQUE] Achat confirmé par ${interaction.user.tag}`);
        console.log(`   → Article: ${item.name}`);
        console.log(`   → Prix: ${item.price} Nekos`);
    },

    // ✨ Gestionnaire des modals
    async handleModal(client, interaction) {
        if (!interaction.customId.startsWith('custom_role_modal_')) {
            return;
        }

        const userId = interaction.customId.replace('custom_role_modal_', '');

        // ✅ Vérification que c'est bien l'utilisateur
        if (interaction.user.id !== userId) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas le droit de soumettre ce formulaire',
                ephemeral: true
            });
        }

        // Defer l'interaction immédiatement
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(e => console.error('Erreur defer:', e));
        }

        try {
            const roleName = interaction.fields.getTextInputValue('role_name');
            const roleColor = interaction.fields.getTextInputValue('role_color');
            const roleEmoji = interaction.fields.getTextInputValue('role_emoji');

            // ✅ Validation des entrées
            if (!roleName || roleName.length < 1 || roleName.length > 100) {
                logCommand(interaction, {
                    success: false,
                    reason: 'invalid_role_name',
                    action: 'custom_role_modal',
                    roleName: roleName
                });

                return interaction.editReply({
                    content: '❌ Le nom du rôle doit faire entre 1 et 100 caractères',
                });
            }

            if (!roleColor.match(/^#[0-9A-F]{6}$/i)) {
                logCommand(interaction, {
                    success: false,
                    reason: 'invalid_role_color',
                    action: 'custom_role_modal',
                    roleColor: roleColor
                });

                return interaction.editReply({
                    content: '❌ La couleur doit être au format hexadécimal (#RRGGBB)',
                });
            }

            if (roleEmoji.length > 2) {
                logCommand(interaction, {
                    success: false,
                    reason: 'invalid_emoji',
                    action: 'custom_role_modal',
                    emoji: roleEmoji
                });

                return interaction.editReply({
                    content: '❌ L\'emoji doit être unique (1 caractère)',
                });
            }

            const economy = loadEconomy();
            
            // ✅ Vérification et initialisation de l'économie
            if (!economy[userId]) {
                economy[userId] = {
                    nekos: 0,
                    lastWork: 0,
                    workCount: 0,
                    lastDaily: 0,
                    lastWeekly: 0,
                    lastMonthly: 0
                };
                saveEconomy(economy);
            }

            const item = SHOP_ITEMS['custom_role'];

            // ✅ Vérification du solde
            if (economy[userId].nekos < item.price) {
                logCommand(interaction, {
                    success: false,
                    reason: 'insufficient_funds_modal',
                    action: 'custom_role_purchase',
                    itemPrice: item.price,
                    currentBalance: economy[userId].nekos
                });

                return interaction.editReply({
                    content: `❌ Votre solde a changé! Vous avez maintenant **${economy[userId].nekos} Nekos** (besoin: ${item.price})`,
                });
            }

            // 💾 Créer le rôle personnalisé
            let role;
            try {
                role = await interaction.guild.roles.create({
                    name: roleName,
                    color: roleColor,
                    reason: `Rôle personnalisé acheté par ${interaction.user.tag}`,
                    mentionable: false
                });
                console.log(`✅ Rôle créé: ${role.id} - ${roleName}`);
            } catch (error) {
                console.error('❌ Erreur création du rôle Discord:', error);
                logCommand(interaction, {
                    success: false,
                    reason: 'role_creation_failed',
                    action: 'custom_role_purchase',
                    error: error.message
                });

                return interaction.editReply({
                    content: '❌ Erreur lors de la création du rôle Discord. Veuillez réessayer',
                });
            }

            // ✅ Assigner le rôle à l'utilisateur
            try {
                await interaction.member.roles.add(role);
                console.log(`✅ Rôle assigné à ${interaction.user.tag}`);
            } catch (error) {
                console.error('❌ Erreur assignation du rôle:', error);
                // Supprimer le rôle si l'assignation échoue
                try {
                    await role.delete('Erreur assignation au membre');
                } catch (e) {
                    console.error('Erreur suppression du rôle:', e);
                }

                logCommand(interaction, {
                    success: false,
                    reason: 'role_assign_failed',
                    action: 'custom_role_purchase',
                    error: error.message
                });

                return interaction.editReply({
                    content: '❌ Erreur lors de l\'assignation du rôle. Veuillez réessayer',
                });
            }

            // 💰 Débiter les Nekos
            const previousBalance = economy[userId].nekos;
            economy[userId].nekos -= item.price;
            saveEconomy(economy);
            console.log(`💰 Débité: ${item.price} Nekos à ${interaction.user.tag}`);

            // 💾 Sauvegarder le rôle personnalisé
            const customRoles = loadCustomRoles();
            customRoles[role.id] = {
                userId: userId,
                username: interaction.user.tag,
                guildId: interaction.guild.id,
                roleId: role.id,
                roleName: roleName,
                roleColor: roleColor,
                roleEmoji: roleEmoji,
                members: [],
                createdAt: Date.now()
            };
            saveCustomRoles(customRoles);
            console.log(`📝 Rôle personnalisé sauvegardé: ${role.id}`);

            // 💾 Sauvegarder l'achat
            const purchases = loadPurchases();
            const purchaseId = `${userId}-custom-${Date.now()}`;
            purchases[purchaseId] = {
                userId: userId,
                username: interaction.user.tag,
                itemId: 'custom_role',
                itemName: item.name,
                price: item.price,
                timestamp: Date.now(),
                roleId: role.id,
                roleName: roleName,
                roleColor: roleColor,
                roleEmoji: roleEmoji
            };
            savePurchases(purchases);
            console.log(`📝 Achat sauvegardé: ${purchaseId}`);

            // ✨ Logger le succès
            logCommand(interaction, {
                success: true,
                action: 'custom_role_purchase',
                itemName: item.name,
                price: item.price,
                previousBalance: previousBalance,
                newBalance: economy[userId].nekos,
                roleId: role.id,
                roleName: roleName,
                roleColor: roleColor,
                roleEmoji: roleEmoji
            });

            const successEmbed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('<:icon:1427729550183239690> Rôle créé avec succès!')
                .setDescription(`Votre rôle ${roleEmoji} **${roleName}** a été créé et assigné`)
                .addFields(
                    { name: '<:icon76:1427722179604381776> Couleur', value: `\`${roleColor}\``, inline: true },
                    { name: '<:icon52:1427722803632930972> Coût', value: `${item.price} Nekos`, inline: true },
                    { name: '<:icon68:1427722428527804558> Nouveau solde', value: `${economy[userId].nekos} Nekos`, inline: true }
                )
                .setFooter({ text: `ID du rôle: ${role.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            console.log(`📝 [BOUTIQUE] Rôle personnalisé créé par ${interaction.user.tag}`);
            console.log(`   → Rôle: ${roleName} ${roleEmoji}`);
            console.log(`   → Couleur: ${roleColor}`);
            console.log(`   → Prix: ${item.price} Nekos`);

        } catch (error) {
            console.error('❌ [BOUTIQUE] Erreur générale lors de la création du rôle:', error);

            logCommand(interaction, {
                success: false,
                reason: 'unexpected_error',
                action: 'custom_role_purchase',
                error: error.message
            });

            return interaction.editReply({
                content: '❌ Une erreur inattendue s\'est produite. Veuillez réessayer plus tard',
            }).catch(e => console.error('Erreur editReply:', e));
        }
    }
};

// ════════════════════════════════════════════════════════════════════
// FONCTIONS SECONDAIRES
// ════════════════════════════════════════════════════════════════════

async function handleShowShop(interaction) {
    const economy = loadEconomy();
    const userId = interaction.user.id;

    if (!economy[userId]) {
        economy[userId] = { nekos: 0 };
    }

    let shopDescription = '';

    for (const [itemId, item] of Object.entries(SHOP_ITEMS)) {
        shopDescription += `${item.emoji} **${item.name}**\n`;
        shopDescription += `  └ ${item.description}\n`;
        shopDescription += `  └ <:icon52:1427722803632930972> ${item.price} Nekos\n\n`;
    }

    // Menu déroulant pour sélectionner un article
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`shop_select_${userId}`)
        .setPlaceholder('Sélectionnez un article à acheter')
        .addOptions([
            {
                label: 'Rôle VIP',
                value: 'vip',
                emoji: '<:icon40:1427723777906835568>',
                description: '8000 Nekos'
            },
            {
                label: 'Boost XP (1 mois)',
                value: 'xp',
                emoji: '<:icon41:1427723758126235748>',
                description: '5000 Nekos'
            },
            {
                label: 'Rôle Personnalisé',
                value: 'custom_role',
                emoji: '<:icon8:1427724260151001118>',
                description: '10000 Nekos'
            }
        ]);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('<:icon62:1427722578922832083> Boutique Nekos')
        .setDescription(shopDescription)
        .addFields(
            { name: '<:icon68:1427722428527804558> Votre solde', value: `${economy[userId].nekos} Nekos`, inline: true }
        )
        .setFooter({ text: 'Sélectionnez un article dans le menu déroulant' })
        .setTimestamp();

    // ✨ Logger la consultation
    logCommand(interaction, {
        success: true,
        action: 'shop_view',
        userBalance: economy[userId].nekos
    });

    console.log(`📝 [BOUTIQUE] Boutique affichée par ${interaction.user.tag}`);
    console.log(`   → Solde: ${economy[userId].nekos} Nekos`);

    await interaction.reply({ embeds: [embed], components: [selectRow] });
}

async function showConfirmation(interaction, itemId, item, currentBalance) {
    const confirmButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_purchase_${interaction.user.id}-${itemId}`)
                .setLabel('Confirmer')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${interaction.user.id}-${itemId}`)
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

    const confirmEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`⚠️ Confirmation d'achat`)
        .setDescription(`Êtes-vous sûr de vouloir acheter **${item.name}** ?`)
        .addFields(
            { name: '<:icon11:1427724252391538758> Article', value: item.name, inline: true },
            { name: '<:icon52:1427722803632930972> Coût', value: `${item.price} Nekos`, inline: true },
            { name: '<:icon68:1427722428527804558> Votre solde actuel', value: `${currentBalance} Nekos`, inline: true },
            { name: '<:icon68:1427722428527804558> Solde après achat', value: `${currentBalance - item.price} Nekos`, inline: true }
        )
        .setFooter({ text: 'Cette action est irréversible' })
        .setTimestamp();

    // ✨ Logger la demande de confirmation
    logCommand(interaction, {
        success: true,
        action: 'show_confirmation',
        itemId: itemId,
        itemName: item.name,
        itemPrice: item.price,
        currentBalance: currentBalance
    });

    await interaction.reply({ embeds: [confirmEmbed], components: [confirmButtons], ephemeral: true });
}

async function showCustomRoleModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(`custom_role_modal_${interaction.user.id}`)
        .setTitle('Créer un Rôle Personnalisé');

    const roleNameInput = new TextInputBuilder()
        .setCustomId('role_name')
        .setLabel('Nom du rôle')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setPlaceholder('Ex: Dragon Slayer');

    const roleColorInput = new TextInputBuilder()
        .setCustomId('role_color')
        .setLabel('Couleur (format #RRGGBB)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(7)
        .setMaxLength(7)
        .setPlaceholder('#FF0000');

    const roleEmojiInput = new TextInputBuilder()
        .setCustomId('role_emoji')
        .setLabel('Emoji')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setPlaceholder('🐉');

    const row1 = new ActionRowBuilder().addComponents(roleNameInput);
    const row2 = new ActionRowBuilder().addComponents(roleColorInput);
    const row3 = new ActionRowBuilder().addComponents(roleEmojiInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
}
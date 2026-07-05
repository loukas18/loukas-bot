const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
        .setName('gerer-nekos')
        .setDescription('Gérer les Nekos des utilisateurs (Admin uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('L\'action à effectuer')
                .setRequired(true)
                .addChoices(
                    { name: 'Ajouter', value: 'ajouter' },
                    { name: 'Retirer', value: 'retirer' },
                    { name: 'Définir', value: 'definir' },
                    { name: 'Voir', value: 'voir' }
                )
        )
        .addUserOption(option =>
            option
                .setName('utilisateur')
                .setDescription('L\'utilisateur concerné')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('montant')
                .setDescription('Le nombre de Nekos (Ajouter, Retirer, Définir)')
                .setRequired(false)
                .setMinValue(0)
        ),
    
    async run(client, interaction) {
        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');

        const economy = loadEconomy();

        if (!economy[targetUser.id]) {
            economy[targetUser.id] = {
                nekos: 0,
                lastWork: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0
            };
        }

        const userData = economy[targetUser.id];
        const oldBalance = userData.nekos;

        // Vérifier que le montant est fourni pour les actions qui le nécessitent
        if (['ajouter', 'retirer', 'definir'].includes(action) && amount === null) {
            return interaction.reply({
                content: `❌ Le montant est requis pour cette action.`,
                ephemeral: true
            });
        }

        switch (action) {
            case 'ajouter':
                userData.nekos += amount;
                saveEconomy(economy);

                logCommand(interaction, {
                    success: true,
                    action: 'add',
                    targetUser: targetUser.tag,
                    targetUserId: targetUser.id,
                    amount: amount,
                    oldBalance: oldBalance,
                    newBalance: userData.nekos
                });

                const addEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('<:icon:1427729550183239690> Nekos ajoutés')
                    .setDescription(`**${amount} Nekos** ont été ajoutés à ${targetUser}`)
                    .addFields(
                        { name: '<:icon52:1427722803632930972> Ancien solde', value: `${oldBalance} Nekos`, inline: true },
                        { name: '<:icon52:1427722803632930972> Nouveau solde', value: `${userData.nekos} Nekos`, inline: true }
                    )
                    .setFooter({ text: `Action effectuée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.reply({ embeds: [addEmbed] });

                try {
                    await targetUser.send(`<:icon62:1427722578922832083> Un administrateur vous a ajouté **${amount} Nekos**!\nNouveau solde: ${userData.nekos} Nekos`);
                } catch (error) {
                    console.log('Impossible de notifier l\'utilisateur');
                }
                break;

            case 'retirer':
                if (userData.nekos < amount) {
                    logCommand(interaction, {
                        success: false,
                        action: 'remove',
                        reason: 'insufficient_funds',
                        targetUser: targetUser.tag,
                        targetUserId: targetUser.id,
                        amount: amount,
                        currentBalance: userData.nekos
                    });

                    return interaction.reply({ 
                        content: `<:icon2:1427729544294568010> ${targetUser} n'a que ${userData.nekos} Nekos. Impossible de retirer ${amount} Nekos.`, 
                        ephemeral: true 
                    });
                }

                userData.nekos -= amount;
                saveEconomy(economy);

                logCommand(interaction, {
                    success: true,
                    action: 'remove',
                    targetUser: targetUser.tag,
                    targetUserId: targetUser.id,
                    amount: amount,
                    oldBalance: oldBalance,
                    newBalance: userData.nekos
                });

                const removeEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('<:icon:1427729550183239690> Nekos retirés')
                    .setDescription(`**${amount} Nekos** ont été retirés à ${targetUser}`)
                    .addFields(
                        { name: '<:icon52:1427722803632930972> Ancien solde', value: `${oldBalance} Nekos`, inline: true },
                        { name: '<:icon52:1427722803632930972> Nouveau solde', value: `${userData.nekos} Nekos`, inline: true }
                    )
                    .setFooter({ text: `Action effectuée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed] });

                try {
                    await targetUser.send(`<:icon68:1427722428527804558> Un administrateur vous a retiré **${amount} Nekos**.\nNouveau solde: ${userData.nekos} Nekos`);
                } catch (error) {
                    console.log('Impossible de notifier l\'utilisateur');
                }
                break;

            case 'definir':
                userData.nekos = amount;
                saveEconomy(economy);

                logCommand(interaction, {
                    success: true,
                    action: 'set',
                    targetUser: targetUser.tag,
                    targetUserId: targetUser.id,
                    amount: amount,
                    oldBalance: oldBalance,
                    newBalance: userData.nekos
                });

                const setEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('<:icon68:1427722428527804558> Nekos définis')
                    .setDescription(`Le solde de ${targetUser} a été défini à **${amount} Nekos**`)
                    .addFields(
                        { name: '<:icon52:1427722803632930972> Ancien solde', value: `${oldBalance} Nekos`, inline: true },
                        { name: '<:icon52:1427722803632930972> Nouveau solde', value: `${userData.nekos} Nekos`, inline: true }
                    )
                    .setFooter({ text: `Action effectuée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.reply({ embeds: [setEmbed] });

                try {
                    await targetUser.send(`<:icon68:1427722428527804558> Un administrateur a défini votre solde à **${amount} Nekos**.`);
                } catch (error) {
                    console.log('Impossible de notifier l\'utilisateur');
                }
                break;

            case 'voir':
                logCommand(interaction, {
                    success: true,
                    action: 'view',
                    targetUser: targetUser.tag,
                    targetUserId: targetUser.id,
                    balance: userData.nekos,
                    lastWork: userData.lastWork,
                    lastDaily: userData.lastDaily,
                    lastWeekly: userData.lastWeekly,
                    lastMonthly: userData.lastMonthly
                });

                const infoEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle(`<:icon68:1427722428527804558> Informations de ${targetUser.username}`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '<:icon52:1427722803632930972> Nekos', value: `${userData.nekos}`, inline: true },
                        { name: '<:icon33:1427723957494353960> Dernier travail', value: userData.lastWork ? `<t:${Math.floor(userData.lastWork / 1000)}:R>` : 'Jamais', inline: true },
                        { name: '<:icon11:1427724252391538758> Dernier journalier', value: userData.lastDaily ? `<t:${Math.floor(userData.lastDaily / 1000)}:R>` : 'Jamais', inline: true },
                        { name: '<:icon11:1427724252391538758> Dernier hebdo', value: userData.lastWeekly ? `<t:${Math.floor(userData.lastWeekly / 1000)}:R>` : 'Jamais', inline: true },
                        { name: '<:icon11:1427724252391538758> Dernier mensuel', value: userData.lastMonthly ? `<t:${Math.floor(userData.lastMonthly / 1000)}:R>` : 'Jamais', inline: true }
                    )
                    .setFooter({ text: `Consulté par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
                break;
        }
    }
};
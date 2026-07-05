const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getLogs, getStats } = require('../../utils/commandLogger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Consulter les logs des commandes (Admin uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type de logs à consulter')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addUserOption(option =>
            option
                .setName('utilisateur')
                .setDescription('Utilisateur à consulter (pour le type "utilisateur")')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('commande')
                .setDescription('Nom de la commande à consulter (pour le type "commande")')
                .setRequired(false)
        ),

    category: 'Admin',

    // =========================
    // AUTOCOMPLETE
    // =========================
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();

        const types = [
            { name: 'Dernières commandes', value: 'recent' },
            { name: 'Commandes par utilisateur', value: 'user' },
            { name: 'Historique d\'une commande', value: 'command' },
            { name: 'Statistiques globales', value: 'stats' },
        ];

        const filtered = types.filter(choice =>
            choice.name.toLowerCase().includes(focused.toLowerCase())
        );

        await interaction.respond(filtered);
    },

    // =========================
    // EXECUTION
    // =========================
    async run(client, interaction) {
        const type = interaction.options.getString('type');
        const utilisateur = interaction.options.getUser('utilisateur');
        const commandeName = interaction.options.getString('commande');

        // ======================
        // RECENT - Dernières commandes
        // ======================
        if (type === 'recent') {
            const logs = getLogs({ limit: 10 }) || [];

            if (logs.length === 0) {
                return interaction.reply({ 
                    embeds: [new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription('📝 Aucun log enregistré pour le moment.')
                    ],
                    flags: 64
                });
            }

            const description = logs.reverse().map(log => {
                return `**/${log.command}** par ${log.user.tag}\n` +
                       `└ 📍 ${log.channel.name} • 🕐 ${log.dateFormatted}`;
            }).join('\n\n');

            const resultEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📋 Dernières commandes utilisées')
                .setDescription(description)
                .setFooter({ text: `${logs.length} commande(s) affichée(s)` })
                .setTimestamp();

            return interaction.reply({ embeds: [resultEmbed], flags: 64 });
        }

        // ======================
        // USER - Commandes par utilisateur
        // ======================
        if (type === 'user') {
            if (!utilisateur) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FFA500')
                        .setDescription('⚠️ Tu dois mentionner un utilisateur avec l\'option `utilisateur`.')
                    ],
                    flags: 64
                });
            }

            const userLogs = getLogs({ userId: utilisateur.id, limit: 15 }) || [];

            if (userLogs.length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`📝 Aucune commande trouvée pour ${utilisateur.tag}.`)
                    ],
                    flags: 64
                });
            }

            const description = userLogs.reverse().map(log => {
                return `**/${log.command}**\n` +
                       `└ 📍 ${log.channel.name} • 🕐 ${log.dateFormatted}`;
            }).join('\n\n');

            const userEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📋 Historique de ${utilisateur.tag}`)
                .setDescription(description)
                .setThumbnail(utilisateur.displayAvatarURL())
                .setFooter({ text: `${userLogs.length} commande(s) trouvée(s)` })
                .setTimestamp();

            return interaction.reply({ embeds: [userEmbed], flags: 64 });
        }

        // ======================
        // COMMAND - Historique d'une commande
        // ======================
        if (type === 'command') {
            if (!commandeName) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FFA500')
                        .setDescription('⚠️ Tu dois spécifier le nom d\'une commande avec l\'option `commande`.')
                    ],
                    flags: 64
                });
            }

            const commandLogs = getLogs({ commandName: commandeName, limit: 15 }) || [];

            if (commandLogs.length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`📝 Aucune utilisation trouvée pour la commande **/${commandeName}**.`)
                    ],
                    flags: 64
                });
            }

            const description = commandLogs.reverse().map(log => {
                return `Par **${log.user.tag}**\n` +
                       `└ 📍 ${log.channel.name} • 🕐 ${log.dateFormatted}`;
            }).join('\n\n');

            const commandEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📋 Historique de /${commandeName}`)
                .setDescription(description)
                .setFooter({ text: `${commandLogs.length} utilisation(s) trouvée(s)` })
                .setTimestamp();

            return interaction.reply({ embeds: [commandEmbed], flags: 64 });
        }

        // ======================
        // STATS - Statistiques globales
        // ======================
        if (type === 'stats') {
            const stats = getStats() || {};

            const topCommands = Object.entries(stats.byCommand || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([cmd, count], i) => `${i + 1}. **/${cmd}** → ${count} fois`)
                .join('\n');

            const topUsers = Object.entries(stats.byUser || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([user, count], i) => `${i + 1}. ${user.split(' (')[0]} → ${count} commandes`)
                .join('\n');

            const topChannels = Object.entries(stats.byChannel || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([channel, count], i) => `${i + 1}. ${channel.split(' (')[0]} → ${count} fois`)
                .join('\n');

            const statsEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('📊 Statistiques des commandes')
                .setDescription(`**Total de commandes utilisées :** ${stats.total || 0}`)
                .addFields(
                    { name: '🏆 Top commandes', value: topCommands || 'Aucune donnée', inline: false },
                    { name: '👥 Utilisateurs les plus actifs', value: topUsers || 'Aucune donnée', inline: false },
                    { name: '📍 Salons les plus utilisés', value: topChannels || 'Aucune donnée', inline: false }
                )
                .setFooter({ text: `Serveur: ${interaction.guild.name}` })
                .setTimestamp();

            return interaction.reply({ embeds: [statsEmbed], flags: 64 });
        }

        // Type inconnu
        return interaction.reply({
            content: '❌ Type de logs non reconnu.',
            flags: 64
        });
    }
};
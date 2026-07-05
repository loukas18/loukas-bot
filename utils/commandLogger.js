const fs = require('fs');
const path = require('path');

const logsPath = path.join(process.cwd(), 'commands-logs.json');

// ────────────── FONCTIONS DE GESTION DES LOGS ──────────────
function loadLogs() {
    if (!fs.existsSync(logsPath)) {
        fs.writeFileSync(logsPath, JSON.stringify({ logs: [] }, null, 2));
        return { logs: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    } catch (error) {
        console.error('❌ Erreur lors de la lecture des logs:', error.message);
        return { logs: [] };
    }
}

function saveLogs(data) {
    try {
        fs.writeFileSync(logsPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde des logs:', error.message);
    }
}

/**
 * Enregistre l'utilisation d'une commande ou interaction
 * @param {Object} interaction - L'interaction Discord
 * @param {Object} additionalData - Données supplémentaires spécifiques à la commande (optionnel)
 */
function logCommand(interaction, additionalData = {}) {
    try {
        const logs = loadLogs();
        
        // Récupérer toutes les options de la commande (seulement pour les slash commands)
        let options = {};
        if (interaction.isChatInputCommand?.() && interaction.options?.data) {
            interaction.options.data.forEach(option => {
                if (option.user) {
                    options[option.name] = {
                        type: 'user',
                        id: option.user.id,
                        tag: option.user.tag
                    };
                } else if (option.channel) {
                    options[option.name] = {
                        type: 'channel',
                        id: option.channel.id,
                        name: option.channel.name
                    };
                } else if (option.role) {
                    options[option.name] = {
                        type: 'role',
                        id: option.role.id,
                        name: option.role.name
                    };
                } else {
                    options[option.name] = option.value;
                }
            });
        }

        // Déterminer le nom de la commande
        let commandName = 'unknown';
        if (interaction.isChatInputCommand?.()) {
            commandName = interaction.commandName;
        } else if (interaction.isModalSubmit?.()) {
            commandName = interaction.customId.split('_')[0] || 'modal';
        } else if (interaction.isButton?.()) {
            commandName = interaction.customId.split('_')[0] || 'button';
        } else if (interaction.isStringSelectMenu?.()) {
            commandName = interaction.customId.split('_')[0] || 'select';
        }

        const logEntry = {
            // Identifiant unique du log
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            
            // Informations sur la commande
            command: commandName,
            options: options,
            
            // Informations sur l'utilisateur
            user: {
                id: interaction.user?.id || 'unknown',
                tag: interaction.user?.tag || 'unknown',
                username: interaction.user?.username || 'unknown',
                displayName: interaction.member?.displayName || interaction.user?.username || 'unknown'
            },
            
            // Informations sur le serveur et le salon
            guild: {
                id: interaction.guild?.id || null,
                name: interaction.guild?.name || 'DM'
            },
            channel: {
                id: interaction.channel?.id || null,
                name: interaction.channel?.name || 'DM',
                type: interaction.channel?.type || null
            },
            
            // Horodatage
            timestamp: Date.now(),
            date: new Date().toISOString(),
            dateFormatted: new Date().toLocaleString('fr-FR', {
                timeZone: 'Europe/Paris',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            
            // Données supplémentaires (résultat, montants, etc.)
            data: additionalData
        };

        if (!Array.isArray(logs.logs)) {
            logs.logs = [];
        }

        logs.logs.push(logEntry);
        
        // Optionnel : Limiter à 10000 derniers logs pour éviter un fichier trop gros
        if (logs.logs.length > 10000) {
            logs.logs = logs.logs.slice(-10000);
        }
        
        saveLogs(logs);
        console.log(`📝 [LOG] Interaction ${commandName} enregistrée par ${interaction.user?.tag}`);
        
        return logEntry.id;
        
    } catch (error) {
        console.error('❌ Erreur lors du logging:', error.message);
        return null;
    }
}

/**
 * Récupère les logs avec des filtres
 * @param {Object} filters - Filtres à appliquer
 */
function getLogs(filters = {}) {
    try {
        const logsData = loadLogs();
        
        // Vérification de sécurité
        if (!logsData || !Array.isArray(logsData.logs)) {
            return [];
        }
        
        let filtered = [...logsData.logs];

        // Filtrer par utilisateur
        if (filters.userId) {
            filtered = filtered.filter(log => log.user?.id === filters.userId);
        }

        // Filtrer par commande
        if (filters.command) {
            filtered = filtered.filter(log => log.command === filters.command);
        }

        // Filtrer par serveur
        if (filters.guildId) {
            filtered = filtered.filter(log => log.guild?.id === filters.guildId);
        }

        // Filtrer par salon
        if (filters.channelId) {
            filtered = filtered.filter(log => log.channel?.id === filters.channelId);
        }

        // Filtrer par période
        if (filters.startDate) {
            const startTime = new Date(filters.startDate).getTime();
            filtered = filtered.filter(log => log.timestamp >= startTime);
        }

        if (filters.endDate) {
            const endTime = new Date(filters.endDate).getTime();
            filtered = filtered.filter(log => log.timestamp <= endTime);
        }

        // Limiter le nombre de résultats
        if (filters.limit) {
            filtered = filtered.slice(-filters.limit);
        }

        return filtered;
    } catch (error) {
        console.error('❌ Erreur dans getLogs:', error.message);
        return [];
    }
}

/**
 * Obtenir des statistiques sur les commandes
 * @param {Object} filters - Filtres optionnels
 */
function getStats(filters = {}) {
    try {
        const logs = getLogs(filters);
        
        // Vérification de sécurité
        if (!Array.isArray(logs)) {
            return {
                total: 0,
                byCommand: {},
                byUser: {},
                byChannel: {},
                byDate: {}
            };
        }
        
        const stats = {
            total: logs.length,
            byCommand: {},
            byUser: {},
            byChannel: {},
            byDate: {}
        };

        logs.forEach(log => {
            // Par commande
            stats.byCommand[log.command] = (stats.byCommand[log.command] || 0) + 1;
            
            // Par utilisateur
            const userKey = `${log.user?.tag || 'unknown'} (${log.user?.id || 'unknown'})`;
            stats.byUser[userKey] = (stats.byUser[userKey] || 0) + 1;
            
            // Par salon
            const channelKey = `${log.channel?.name || 'unknown'} (${log.channel?.id || 'unknown'})`;
            stats.byChannel[channelKey] = (stats.byChannel[channelKey] || 0) + 1;
            
            // Par date (jour)
            const dateKey = log.dateFormatted?.split(' ')[0] || 'unknown';
            stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
        });

        return stats;
    } catch (error) {
        console.error('❌ Erreur dans getStats:', error.message);
        return {
            total: 0,
            byCommand: {},
            byUser: {},
            byChannel: {},
            byDate: {}
        };
    }
}

module.exports = {
    logCommand,
    getLogs,
    getStats,
    loadLogs,
    saveLogs
};
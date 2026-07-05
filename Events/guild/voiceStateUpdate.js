const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    UserSelectMenuBuilder,
    PermissionsBitField, 
    ChannelType 
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
    TRIGGER_VOICE_CHANNEL: '1523022940713652237',
    TEMP_CATEGORY: '1523022940713652236',
    CHANNEL_DELETE_DELAY: 10000,
    INTERACTION_TIMEOUT: 30000,
    WHITELIST_TIMEOUT: 60000,
    MAX_CHANNEL_NAME_LENGTH: 50,
    MAX_USER_LIMIT: 99,
    DATA_DIR: './data',
    LOG_DIR: './logs',
    BACKUP_INTERVAL: 300000 // 5 minutes
};

const COLORS = {
    PRIMARY: '#5865F2',
    SUCCESS: '#00FF00',
    ERROR: '#FF0000',
    WARNING: '#FFAA00',
    INFO: '#00AAFF',
    GHOST: '#800080'
};

const EMOJIS = {
    MIC: '🎤',
    LOCK: '<:icon71:1427722368167710932>',
    UNLOCK: '<:icon72:1427722313910063194>',
    CROWN: '<:icon:1427724287195746334>',
    USERS: '<:icon80:1427722103293218897>',
    GHOST: '<:icon40:1427723777906835568>',
    MAIL: '<:icon55:1427722713899728996>',
    LIST: '<:icon23:1427724221852680223>',
    EDIT: '<:icon8:1427724260151001118>',
    NUMBERS: '<:icon79:1427722122050142209>',
    BOOT: '<:icon69:1427722408084897862>',
    SUCCESS: '<:icon:1427729550183239690>',
    ERROR: '<:icon2:1427729544294568010>',
    WARNING: '<:icon68:1427722428527804558>',
    CLOCK: '<:icon53:1427722780652343528>',
    INFINITY: '<:icon5:1427724266886926426>',
    SAVE: '<:icon59:1427722637366394880>',
    LOAD: '<:icon51:1427722823820116071>'
};

// ====================================
// 💾 GESTIONNAIRE DE DONNÉES JSON
// ====================================

class JSONDataManager {
    constructor() {
        this.dataFile = path.join(CONFIG.DATA_DIR, 'voice_channels.json');
        this.backupDir = path.join(CONFIG.DATA_DIR, 'backups');
        this.data = {
            temporaryChannels: {},
            authorizedUsers: {},
            ghostModeUsers: [],
            userSettings: {},
            guildsConfig: {}
        };
        this.lastBackup = Date.now();
    }

    async init() {
        try {
            // Créer les dossiers s'ils n'existent pas
            await fs.mkdir(CONFIG.DATA_DIR, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
            await fs.mkdir(CONFIG.LOG_DIR, { recursive: true });
            await this.loadData();
            Logger.success('Gestionnaire de données JSON initialisé', { file: this.dataFile });
        } catch (error) {
            Logger.error('Erreur initialisation JSON Manager:', error);
        }
    }

    async loadData() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            this.data = { ...this.data, ...JSON.parse(data) };
            Logger.info('Données chargées depuis JSON', { 
                channels: Object.keys(this.data.temporaryChannels).length,
                users: Object.keys(this.data.userSettings).length 
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                Logger.info('Fichier de données non trouvé, création d\'un nouveau fichier');
                await this.saveData();
            } else {
                Logger.error('Erreur chargement des données:', error);
            }
        }
    }

    async saveData() {
        try {
            await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2), 'utf8');
            Logger.debug('Données sauvegardées', { timestamp: new Date().toISOString() });
            
            // Backup automatique
            if (Date.now() - this.lastBackup > CONFIG.BACKUP_INTERVAL) {
                await this.createBackup();
            }
        } catch (error) {
            Logger.error('Erreur sauvegarde des données:', error);
        }
    }

    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `backup_${timestamp}.json`);
            await fs.writeFile(backupFile, JSON.stringify(this.data, null, 2), 'utf8');
            this.lastBackup = Date.now();
            Logger.info('Backup créé', { file: backupFile });
            
            // Nettoyer les anciens backups (garder seulement les 10 derniers)
            await this.cleanOldBackups();
        } catch (error) {
            Logger.error('Erreur création backup:', error);
        }
    }

    async cleanOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
                .sort()
                .reverse();

            if (backupFiles.length > 10) {
                const filesToDelete = backupFiles.slice(10);
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(this.backupDir, file));
                    Logger.debug('Ancien backup supprimé', { file });
                }
            }
        } catch (error) {
            Logger.error('Erreur nettoyage backups:', error);
        }
    }

    // Méthodes pour manipuler les données
    setTemporaryChannel(channelId, data) {
        this.data.temporaryChannels[channelId] = data;
        this.saveData();
    }

    getTemporaryChannel(channelId) {
        return this.data.temporaryChannels[channelId];
    }

    deleteTemporaryChannel(channelId) {
        delete this.data.temporaryChannels[channelId];
        delete this.data.authorizedUsers[channelId];
        this.saveData();
    }

    setAuthorizedUsers(channelId, users) {
        this.data.authorizedUsers[channelId] = Array.from(users);
        this.saveData();
    }

    getAuthorizedUsers(channelId) {
        return new Set(this.data.authorizedUsers[channelId] || []);
    }

    addAuthorizedUser(channelId, userId) {
        const users = this.getAuthorizedUsers(channelId);
        users.add(userId);
        this.setAuthorizedUsers(channelId, users);
    }

    removeAuthorizedUser(channelId, userId) {
        const users = this.getAuthorizedUsers(channelId);
        users.delete(userId);
        this.setAuthorizedUsers(channelId, users);
    }

    toggleGhostMode(userId) {
        const index = this.data.ghostModeUsers.indexOf(userId);
        if (index > -1) {
            this.data.ghostModeUsers.splice(index, 1);
            this.saveData();
            return false;
        } else {
            this.data.ghostModeUsers.push(userId);
            this.saveData();
            return true;
        }
    }

    isGhostMode(userId) {
        return this.data.ghostModeUsers.includes(userId);
    }

    setUserSetting(userId, setting, value) {
        if (!this.data.userSettings[userId]) {
            this.data.userSettings[userId] = {};
        }
        this.data.userSettings[userId][setting] = value;
        this.saveData();
    }

    getUserSetting(userId, setting, defaultValue = null) {
        return this.data.userSettings[userId]?.[setting] || defaultValue;
    }
}

// ====================================
// 📝 SYSTÈME DE LOGS AVANCÉ
// ====================================

class Logger {
    static logLevels = {
        DEBUG: 0,
        INFO: 1,
        SUCCESS: 2,
        WARNING: 3,
        ERROR: 4
    };

    static currentLevel = this.logLevels.INFO;

    static async init() {
        try {
            await fs.mkdir(CONFIG.LOG_DIR, { recursive: true });
        } catch (error) {
            console.error('Erreur création dossier logs:', error);
        }
    }

    static formatMessage(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        return {
            timestamp,
            level,
            message,
            context: {
                ...context,
                memoryUsage: process.memoryUsage().heapUsed,
                uptime: process.uptime()
            }
        };
    }

    static async writeToFile(logEntry) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(CONFIG.LOG_DIR, `voice-manager-${date}.log`);
            const logLine = JSON.stringify(logEntry) + '\n';
            await fs.appendFile(logFile, logLine, 'utf8');
        } catch (error) {
            console.error('Erreur écriture log:', error);
        }
    }

    static async log(level, message, context = {}) {
        if (this.logLevels[level] < this.currentLevel) return;

        const logEntry = this.formatMessage(level, message, context);
        
        // Console avec couleurs
        const colors = {
            DEBUG: '\x1b[36m',   // Cyan
            INFO: '\x1b[34m',    // Blue
            SUCCESS: '\x1b[32m', // Green
            WARNING: '\x1b[33m', // Yellow
            ERROR: '\x1b[31m',   // Red
            RESET: '\x1b[0m'
        };

        const emoji = {
            DEBUG: '<:icon50:1427722841167630427>',
            INFO: '<:icon68:1427722428527804558>',
            SUCCESS: '<:icon:1427729550183239690>',
            WARNING: '<:icon68:1427722428527804558>',
            ERROR: '<:icon2:1427729544294568010>'
        };

        console.log(
            `${colors[level]}${emoji[level]} [${level}] ${logEntry.timestamp}${colors.RESET}`,
            message,
            Object.keys(context).length > 0 ? context : ''
        );

        // Écriture en fichier (async)
        this.writeToFile(logEntry).catch(console.error);
    }

    static debug(message, context = {}) {
        return this.log('DEBUG', message, context);
    }

    static info(message, context = {}) {
        return this.log('INFO', message, context);
    }

    static success(message, context = {}) {
        return this.log('SUCCESS', message, context);
    }

    static warning(message, context = {}) {
        return this.log('WARNING', message, context);
    }

    static error(message, context = {}) {
        return this.log('ERROR', message, context);
    }

    // Logs spécialisés
    static async logChannelAction(action, channelId, userId, details = {}) {
        const context = {
            action,
            channelId,
            userId,
            ...details,
            category: 'CHANNEL_ACTION'
        };
        await this.info(`Canal ${action}`, context);
    }

    static async logUserAction(action, userId, channelId, details = {}) {
        const context = {
            action,
            userId,
            channelId,
            ...details,
            category: 'USER_ACTION'
        };
        await this.info(`Utilisateur ${action}`, context);
    }

    static async logPerformance(operation, duration, details = {}) {
        const context = {
            operation,
            duration,
            ...details,
            category: 'PERFORMANCE'
        };
        await this.debug(`Performance: ${operation}`, context);
    }
}

// ====================================
// 🎨 BUILDERS ET UTILITAIRES AMÉLIORÉS
// ====================================

class EmbedFactory {
    static createControlEmbed(member, channel, isPrivate = true) {
        const userLimit = channel.userLimit || EMOJIS.INFINITY;
        const status = isPrivate ? 'Privé' : 'Public';
        const statusEmoji = isPrivate ? EMOJIS.LOCK : EMOJIS.UNLOCK;

        return new EmbedBuilder()
            .setTitle(`${EMOJIS.MIC} Contrôles du Canal Vocal`)
            .setDescription(`Bienvenue dans votre canal vocal privé, ${member} !\nUtilisez le menu ci-dessous pour gérer votre canal.`)
            .addFields(
                { 
                    name: `${EMOJIS.CROWN} Propriétaire`, 
                    value: `${member}`, 
                    inline: true 
                },
                { 
                    name: `${statusEmoji} Statut`, 
                    value: status, 
                    inline: true 
                },
                { 
                    name: `${EMOJIS.USERS} Membres`, 
                    value: `${channel.members.size}/${userLimit}`, 
                    inline: true 
                }
            )
            .setColor(COLORS.PRIMARY)
            .setTimestamp()
            .setFooter({ 
                text: 'Canal vocal temporaire • Contrôles disponibles ci-dessous' 
            });
    }

    static createInviteEmbed() {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.MAIL} Inviter un utilisateur`)
            .setDescription('Sélectionnez l\'utilisateur que vous souhaitez inviter dans votre canal vocal.')
            .setColor(COLORS.INFO)
            .setFooter({ 
                text: 'Utilisez le menu déroulant ci-dessous pour sélectionner un utilisateur' 
            });
    }

    static createWhitelistEmbed(whitelist) {
        const memberList = whitelist.size > 0 
            ? Array.from(whitelist).map(id => `<@${id}>`).join(', ')
            : 'Aucun membre dans la liste blanche';

        return new EmbedBuilder()
            .setTitle(`${EMOJIS.LIST} Gestion de la Liste Blanche`)
            .setDescription('Tapez `ajouter @utilisateur` pour ajouter ou `retirer @utilisateur` pour retirer de la liste blanche.')
            .addFields({
                name: 'Membres de la Liste Blanche',
                value: memberList
            })
            .setColor(COLORS.WARNING)
            .setFooter({ 
                text: 'Tapez votre commande ci-dessous' 
            });
    }

    static createErrorEmbed(message) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.ERROR} Erreur`)
            .setDescription(message)
            .setColor(COLORS.ERROR);
    }

    static createSuccessEmbed(message) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.SUCCESS} Succès`)
            .setDescription(message)
            .setColor(COLORS.SUCCESS);
    }

    static createStatsEmbed(stats) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.SAVE} Statistiques du système`)
            .setDescription('Informations sur l\'utilisation du système de canaux vocaux')
            .addFields(
                {
                    name: 'Canaux actifs',
                    value: stats.activeChannels.toString(),
                    inline: true
                },
                {
                    name: 'Utilisateurs connectés',
                    value: stats.connectedUsers.toString(),
                    inline: true
                },
                {
                    name: 'Temps de fonctionnement',
                    value: stats.uptime,
                    inline: true
                }
            )
            .setColor(COLORS.INFO)
            .setTimestamp();
    }
}

class MenuFactory {
    static createControlMenu(channelId) {
        return new StringSelectMenuBuilder()
            .setCustomId(`controle_vocal_${channelId}`)
            .setPlaceholder('Choisissez une action...')
            .addOptions([
                {
                    label: 'Canal Privé',
                    description: 'Garder le canal privé (par défaut)',
                    value: 'prive',
                    emoji: EMOJIS.LOCK
                },
                {
                    label: 'Canal Public',
                    description: 'Ouvrir le canal à tout le monde',
                    value: 'public',
                    emoji: EMOJIS.UNLOCK
                },
                {
                    label: 'Inviter Quelqu\'un',
                    description: 'Permettre à un utilisateur spécifique de rejoindre',
                    value: 'inviter',
                    emoji: EMOJIS.MAIL
                },
                {
                    label: 'Liste Blanche',
                    description: 'Gérer les membres autorisés en permanence',
                    value: 'liste_blanche',
                    emoji: EMOJIS.LIST
                },
                {
                    label: 'Mode Fantôme',
                    description: 'Devenir invisible aux utilisateurs non autorisés',
                    value: 'fantome',
                    emoji: EMOJIS.GHOST
                },
                {
                    label: 'Renommer le Canal',
                    description: 'Changer le nom de votre canal',
                    value: 'renommer',
                    emoji: EMOJIS.EDIT
                },
                {
                    label: 'Limite d\'Utilisateurs',
                    description: 'Définir la limite de membres',
                    value: 'limite',
                    emoji: EMOJIS.NUMBERS
                },
                {
                    label: 'Expulser un Membre',
                    description: 'Expulser un membre du canal',
                    value: 'expulser',
                    emoji: EMOJIS.BOOT
                }
            ]);
    }

    static createUserSelectMenu(channelId, customId = 'invite_user') {
        return new UserSelectMenuBuilder()
            .setCustomId(`${customId}_${channelId}`)
            .setPlaceholder('Sélectionnez un utilisateur à inviter...')
            .setMinValues(1)
            .setMaxValues(1);
    }
}

// ====================================
// 💾 GESTIONNAIRE PRINCIPAL AVEC PERSISTANCE
// ====================================

class VoiceChannelManager {
    constructor() {
        this.dataManager = new JSONDataManager();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        await Logger.init();
        await this.dataManager.init();
        this.initialized = true;
        
        Logger.success('VoiceChannelManager initialisé', {
            dataFile: this.dataManager.dataFile,
            version: '2.0.0'
        });
    }

    isOwner(userId, channelId) {
        const channelData = this.dataManager.getTemporaryChannel(channelId);
        return channelData && channelData.proprietaireId === userId;
    }

    getChannelData(channelId) {
        return this.dataManager.getTemporaryChannel(channelId);
    }

    getAuthorizedUsers(channelId) {
        return this.dataManager.getAuthorizedUsers(channelId);
    }

    addAuthorizedUser(channelId, userId) {
        this.dataManager.addAuthorizedUser(channelId, userId);
        Logger.logUserAction('ADDED_TO_WHITELIST', userId, channelId);
    }

    removeAuthorizedUser(channelId, userId) {
        this.dataManager.removeAuthorizedUser(channelId, userId);
        Logger.logUserAction('REMOVED_FROM_WHITELIST', userId, channelId);
    }

    toggleGhostMode(userId) {
        const result = this.dataManager.toggleGhostMode(userId);
        Logger.logUserAction(result ? 'GHOST_MODE_ENABLED' : 'GHOST_MODE_DISABLED', userId, null);
        return result;
    }

    isGhostMode(userId) {
        return this.dataManager.isGhostMode(userId);
    }

    cleanup(channelId) {
        this.dataManager.deleteTemporaryChannel(channelId);
        Logger.logChannelAction('CLEANED_UP', channelId, null);
    }

    setTemporaryChannel(channelId, data) {
        this.dataManager.setTemporaryChannel(channelId, data);
        Logger.logChannelAction('CREATED', channelId, data.proprietaireId, {
            channelName: data.channelName,
            isPrivate: data.estPrive
        });
    }

    // Getters pour compatibilité avec l'ancien code
    get temporaryChannels() {
        return new Map(Object.entries(this.dataManager.data.temporaryChannels));
    }

    get authorizedUsers() {
        const map = new Map();
        Object.entries(this.dataManager.data.authorizedUsers).forEach(([channelId, users]) => {
            map.set(channelId, new Set(users));
        });
        return map;
    }

    get ghostModeUsers() {
        return new Set(this.dataManager.data.ghostModeUsers);
    }

    getStats() {
        const activeChannels = Object.keys(this.dataManager.data.temporaryChannels).length;
        const totalUsers = Object.keys(this.dataManager.data.userSettings).length;
        const uptime = Math.floor(process.uptime());
        const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

        return {
            activeChannels,
            connectedUsers: totalUsers,
            uptime: uptimeStr,
            ghostModeUsers: this.dataManager.data.ghostModeUsers.length
        };
    }
}

// ====================================
// 🎵 GESTIONNAIRE PRINCIPAL AMÉLIORÉ
// ====================================

class VoiceStateHandler {
    static async handleJoin(newState) {
        if (newState.channelId === CONFIG.TRIGGER_VOICE_CHANNEL && 
            newState.channelId !== newState.oldChannelId) {
            const startTime = Date.now();
            await this.createTemporaryVoiceChannel(newState.member, newState.guild);
            const duration = Date.now() - startTime;
            Logger.logPerformance('CREATE_TEMP_CHANNEL', duration, {
                userId: newState.member.id,
                guildId: newState.guild.id
            });
        }
    }

    static async handleLeave(oldState) {
        if (oldState.channel && voiceManager.getChannelData(oldState.channelId)) {
            await this.handleTemporaryChannelLeave(oldState);
        }
    }

    static async handleTemporaryChannelLeave(oldState) {
        const channelData = voiceManager.getChannelData(oldState.channelId);
        
        Logger.logUserAction('LEFT_CHANNEL', oldState.member.id, oldState.channelId, {
            remainingMembers: oldState.channel.members.size
        });
        
        if (oldState.channel.members.size === 0) {
            setTimeout(async () => {
                try {
                    if (oldState.channel.members.size === 0) {
                        await this.deleteTemporaryChannel(oldState.channel, oldState.channelId, channelData);
                    }
                } catch (error) {
                    Logger.error('Erreur lors de la suppression du canal temporaire:', { error: error.message, channelId: oldState.channelId });
                }
            }, CONFIG.CHANNEL_DELETE_DELAY);
        }
    }

    static async deleteTemporaryChannel(channel, channelId, channelData) {
        await channel.delete();
        voiceManager.cleanup(channelId);
        
        if (channelData?.messageControle) {
            try {
                await channelData.messageControle.delete();
            } catch (error) {
                Logger.debug('Message de contrôle déjà supprimé', { channelId });
            }
        }
        
        Logger.success(`Canal temporaire supprimé: ${channel.name}`, { channelId });
    }

    static async createTemporaryVoiceChannel(member, guild) {
        try {
            Logger.info(`Création d'un canal temporaire pour ${member.displayName}`, {
                userId: member.id,
                guildId: guild.id,
                username: member.user.username
            });

            const channelName = `${EMOJIS.MIC} ${member.displayName}'s Room`;
            const tempChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: CONFIG.TEMP_CATEGORY,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.Connect],
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.MoveMembers,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers
                        ]
                    }
                ]
            });

            await member.voice.setChannel(tempChannel);
            
            const controlMessage = await this.sendControlMessage(tempChannel, member, guild);
            
            voiceManager.setTemporaryChannel(tempChannel.id, {
                proprietaireId: member.id,
                estPrive: true,
                messageControle: controlMessage,
                channelName: channelName,
                createdAt: new Date().toISOString(),
                guildId: guild.id
            });

            Logger.success(`Canal temporaire créé: ${tempChannel.name}`, { 
                channelId: tempChannel.id,
                ownerId: member.id,
                totalChannels: Object.keys(voiceManager.dataManager.data.temporaryChannels).length
            });

        } catch (error) {
            Logger.error('Erreur critique lors de la création du canal temporaire:', { 
                error: error.message, 
                stack: error.stack,
                userId: member.id,
                guildId: guild.id
            });
            await this.notifyUserError(member);
        }
    }

    static async sendControlMessage(tempChannel, member, guild) {
        const embed = EmbedFactory.createControlEmbed(member, tempChannel);
        const menu = MenuFactory.createControlMenu(tempChannel.id);
        const row = new ActionRowBuilder().addComponents(menu);

        const messageData = {
            content: `${EMOJIS.MIC} ${member}, ton salon vocal **${tempChannel.name}** a été créé !`,
            embeds: [embed],
            components: [row]
        };

        try {
            const message = await tempChannel.send(messageData);
            Logger.success(`Message de contrôle envoyé dans le canal vocal ${tempChannel.name}`, {
                channelId: tempChannel.id,
                messageId: message.id
            });
            return message;
        } catch (voiceChannelError) {
            Logger.warning('Impossible d\'envoyer dans le canal vocal, tentative canal textuel', {
                error: voiceChannelError.message,
                channelId: tempChannel.id
            });
            return await this.sendToFallbackChannel(guild, member, messageData);
        }
    }

    static async sendToFallbackChannel(guild, member, messageData) {
        const textChannel = ChannelUtils.findBestTextChannel(guild, member);

        if (textChannel) {
            try {
                const message = await textChannel.send(messageData);
                Logger.success(`Message de contrôle envoyé vers #${textChannel.name}`, {
                    channelId: textChannel.id,
                    messageId: message.id
                });
                return message;
            } catch (textChannelError) {
                Logger.error(`Erreur d'envoi vers #${textChannel.name}`, {
                    error: textChannelError.message,
                    channelId: textChannel.id
                });
                return await this.sendSimpleMessage(textChannel, member, messageData.content);
            }
        } else {
            return await this.sendDirectMessage(member, messageData);
        }
    }

    static async sendSimpleMessage(channel, member, content) {
        try {
            const message = await channel.send({
                content: `${content}\n\n${EMOJIS.WARNING} Les contrôles avancés ne sont pas disponibles en raison de problèmes de permissions.`
            });
            Logger.success('Message simple envoyé à la place', {
                channelId: channel.id,
                messageId: message.id
            });
            return message;
        } catch (error) {
            Logger.error('Erreur message simple:', { 
                error: error.message,
                channelId: channel.id
            });
            return null;
        }
    }

    static async sendDirectMessage(member, messageData) {
        try {
            const message = await member.send({
                content: `${EMOJIS.MIC} Votre canal vocal a été créé !\n\n${EMOJIS.WARNING} Je n'ai pas pu envoyer les contrôles dans un canal textuel du serveur.`,
                embeds: messageData.embeds,
                components: messageData.components
            });
            Logger.success(`Message envoyé par MP à ${member.displayName}`, {
                userId: member.id,
                messageId: message.id
            });
            return message;
        } catch (dmError) {
            Logger.error('Impossible d\'envoyer en MP:', { 
                error: dmError.message,
                userId: member.id
            });
            return null;
        }
    }

    static async notifyUserError(member) {
        try {
            await member.send(`${EMOJIS.ERROR} Une erreur s'est produite lors de la création de votre canal vocal. Veuillez réessayer ou contacter un administrateur.`);
            Logger.info('Notification d\'erreur envoyée à l\'utilisateur', { userId: member.id });
        } catch (dmError) {
            Logger.error('Impossible de notifier l\'utilisateur de l\'erreur:', { 
                error: dmError.message,
                userId: member.id
            });
        }
    }

    static handleGhostMode(newState) {
        if (newState.channelId && voiceManager.getChannelData(newState.channelId)) {
            const channelData = voiceManager.getChannelData(newState.channelId);
            const authorizedList = voiceManager.getAuthorizedUsers(newState.channelId);
            
            if (voiceManager.isGhostMode(channelData.proprietaireId) && 
                newState.member.id !== channelData.proprietaireId && 
                !authorizedList.has(newState.member.id)) {
                
                try {
                    const owner = newState.guild.members.cache.get(channelData.proprietaireId);
                    if (owner && owner.voice.channelId === newState.channelId) {
                        Logger.info(`${EMOJIS.GHOST} Mode fantôme actif`, {
                            ownerId: channelData.proprietaireId,
                            visitorId: newState.member.id,
                            channelId: newState.channelId
                        });
                    }
                } catch (error) {
                    Logger.error('Erreur mode fantôme:', { 
                        error: error.message,
                        channelId: newState.channelId
                    });
                }
            }
        }
    }
}

// ====================================
// 🔍 UTILITAIRES AMÉLIORÉS
// ====================================

class ChannelUtils {
    static findBestTextChannel(guild, member) {
        const preferredNames = ['general', 'chat', 'main', 'lobby', 'général', 'discussion'];
        
        // Recherche par noms préférés
        for (const name of preferredNames) {
            const channel = guild.channels.cache.find(ch => 
                ch.type === ChannelType.GuildText && 
                ch.name.toLowerCase().includes(name) &&
                this.hasRequiredPermissions(ch, guild)
            );
            if (channel) {
                Logger.debug('Canal textuel trouvé', {
                    channelId: channel.id,
                    channelName: channel.name,
                    method: 'preferred_name'
                });
                return channel;
            }
        }
        
        // Fallback vers le premier canal disponible
        const fallbackChannel = guild.channels.cache.find(ch => 
            ch.type === ChannelType.GuildText &&
            this.hasRequiredPermissions(ch, guild)
        );

        if (fallbackChannel) {
            Logger.debug('Canal textuel trouvé', {
                channelId: fallbackChannel.id,
                channelName: fallbackChannel.name,
                method: 'fallback'
            });
        }

        return fallbackChannel;
    }

    static hasRequiredPermissions(channel, guild) {
        return channel.permissionsFor(guild.members.me).has([
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
        ]);
    }

    static async searchUsersByName(guild, query, limit = 25) {
        try {
            // Recherche dans le cache d'abord
            let users = guild.members.cache
                .filter(member => 
                    member.displayName.toLowerCase().includes(query.toLowerCase()) ||
                    member.user.username.toLowerCase().includes(query.toLowerCase())
                )
                .first(limit);

            // Si pas assez de résultats, fetch plus de membres
            if (users.length < limit && query.length >= 2) {
                try {
                    await guild.members.fetch({ query, limit });
                    users = guild.members.cache
                        .filter(member => 
                            member.displayName.toLowerCase().includes(query.toLowerCase()) ||
                            member.user.username.toLowerCase().includes(query.toLowerCase())
                        )
                        .first(limit);
                } catch (fetchError) {
                    Logger.warning('Impossible de fetch des membres supplémentaires', {
                        error: fetchError.message,
                        guildId: guild.id,
                        query
                    });
                }
            }

            Logger.debug('Recherche d\'utilisateurs', {
                query,
                resultsCount: users.length,
                guildId: guild.id
            });

            return users;
        } catch (error) {
            Logger.error('Erreur recherche utilisateurs:', {
                error: error.message,
                query,
                guildId: guild.id
            });
            return [];
        }
    }
}

// ====================================
// 🎮 GESTIONNAIRE D'INTERACTIONS AMÉLIORÉ
// ====================================

class InteractionHandler {
    static async handleSelectMenu(interaction) {
        if (!interaction.customId.startsWith('controle_vocal_')) return;

        const channelId = interaction.customId.replace('controle_vocal_', '');
        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (!channel) {
            Logger.warning('Canal introuvable pour interaction', {
                channelId,
                userId: interaction.user.id,
                customId: interaction.customId
            });
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Canal introuvable.`, 
                ephemeral: true 
            });
        }

        if (!voiceManager.isOwner(interaction.user.id, channelId)) {
            Logger.warning('Utilisateur non autorisé tente d\'utiliser les contrôles', {
                userId: interaction.user.id,
                channelId,
                ownerId: voiceManager.getChannelData(channelId)?.proprietaireId
            });
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Seul le propriétaire du canal peut utiliser cette commande.`, 
                ephemeral: true 
            });
        }

        const action = interaction.values[0];
        Logger.info('Action sélectionnée dans le menu', {
            action,
            userId: interaction.user.id,
            channelId
        });

        await this.executeAction(action, interaction, channel, channelId);
    }

    static async handleUserSelect(interaction) {
        if (!interaction.customId.startsWith('invite_user_')) return;

        const channelId = interaction.customId.replace('invite_user_', '');
        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (!channel) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Canal introuvable.`, 
                ephemeral: true 
            });
        }

        if (!voiceManager.isOwner(interaction.user.id, channelId)) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Seul le propriétaire du canal peut inviter des utilisateurs.`, 
                ephemeral: true 
            });
        }

        const selectedUserId = interaction.values[0];
        const selectedUser = interaction.guild.members.cache.get(selectedUserId);

        if (!selectedUser) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Utilisateur introuvable.`, 
                ephemeral: true 
            });
        }

        try {
            await channel.permissionOverwrites.create(selectedUser.id, {
                Connect: true,
                Speak: true
            });

            Logger.logUserAction('INVITED', selectedUser.id, channelId, {
                invitedBy: interaction.user.id
            });

            await interaction.reply({ 
                content: `${EMOJIS.SUCCESS} ${selectedUser} peut maintenant rejoindre votre canal vocal.`, 
                ephemeral: true 
            });

        } catch (error) {
            Logger.error('Erreur lors de l\'invitation utilisateur:', {
                error: error.message,
                channelId,
                selectedUserId,
                inviterId: interaction.user.id
            });
            await interaction.reply({ 
                content: `${EMOJIS.ERROR} Erreur lors de l'invitation de l'utilisateur.`, 
                ephemeral: true 
            });
        }
    }

    static async executeAction(action, interaction, channel, channelId) {
        const startTime = Date.now();
        
        const actions = {
            'prive': () => this.setChannelPrivate(interaction, channel, channelId),
            'public': () => this.setChannelPublic(interaction, channel, channelId),
            'inviter': () => this.inviteUser(interaction, channel, channelId),
            'liste_blanche': () => this.manageWhitelist(interaction, channel, channelId),
            'fantome': () => this.toggleGhostMode(interaction, channel, channelId),
            'renommer': () => this.renameChannel(interaction, channel, channelId),
            'limite': () => this.setUserLimit(interaction, channel, channelId),
            'expulser': () => this.kickUser(interaction, channel, channelId)
        };

        const actionFunction = actions[action];
        if (actionFunction) {
            try {
                await actionFunction();
                const duration = Date.now() - startTime;
                Logger.logPerformance(`ACTION_${action.toUpperCase()}`, duration, {
                    userId: interaction.user.id,
                    channelId
                });
            } catch (error) {
                Logger.error(`Erreur lors de l'action ${action}:`, {
                    error: error.message,
                    userId: interaction.user.id,
                    channelId,
                    action
                });
                if (!interaction.replied) {
                    await interaction.reply({ 
                        content: `${EMOJIS.ERROR} Une erreur s'est produite lors de l'exécution de cette action.`, 
                        ephemeral: true 
                    });
                }
            }
        } else {
            await interaction.reply({ 
                content: `${EMOJIS.ERROR} Action non reconnue.`, 
                ephemeral: true 
            });
        }
    }

    static async setChannelPrivate(interaction, channel, channelId) {
        try {
            await channel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: false
            });

            const channelData = voiceManager.getChannelData(channelId);
            channelData.estPrive = true;
            voiceManager.setTemporaryChannel(channelId, channelData);

            await interaction.reply({ 
                content: `${EMOJIS.LOCK} Le canal est maintenant privé. Seuls vous et les membres de la liste blanche peuvent rejoindre.`,
                ephemeral: true 
            });

            await this.updateControlMessage(interaction, channel, channelId);
        } catch (error) {
            Logger.error('Erreur setChannelPrivate:', {
                error: error.message,
                channelId,
                userId: interaction.user.id
            });
            await interaction.reply({ 
                content: `${EMOJIS.ERROR} Erreur lors de la modification des permissions.`, 
                ephemeral: true 
            });
        }
    }

    static async setChannelPublic(interaction, channel, channelId) {
        try {
            await channel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: true
            });

            const channelData = voiceManager.getChannelData(channelId);
            channelData.estPrive = false;
            voiceManager.setTemporaryChannel(channelId, channelData);

            await interaction.reply({ 
                content: `${EMOJIS.UNLOCK} Le canal est maintenant public. Tout le monde peut rejoindre.`,
                ephemeral: true 
            });

            await this.updateControlMessage(interaction, channel, channelId);
        } catch (error) {
            Logger.error('Erreur setChannelPublic:', {
                error: error.message,
                channelId,
                userId: interaction.user.id
            });
            await interaction.reply({ 
                content: `${EMOJIS.ERROR} Erreur lors de la modification des permissions.`, 
                ephemeral: true 
            });
        }
    }

    static async inviteUser(interaction, channel, channelId) {
        const embed = EmbedFactory.createInviteEmbed();
        const userSelectMenu = MenuFactory.createUserSelectMenu(channelId);
        const row = new ActionRowBuilder().addComponents(userSelectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

        Logger.info('Menu d\'invitation utilisateur affiché', {
            userId: interaction.user.id,
            channelId
        });
    }

    static async manageWhitelist(interaction, channel, channelId) {
        const whitelist = voiceManager.getAuthorizedUsers(channelId);
        const embed = EmbedFactory.createWhitelistEmbed(whitelist);

        await interaction.reply({ embeds: [embed], ephemeral: true });

        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ 
            filter, 
            time: CONFIG.WHITELIST_TIMEOUT 
        });

        Logger.info('Collecteur de messages créé pour gestion liste blanche', {
            userId: interaction.user.id,
            channelId,
            timeout: CONFIG.WHITELIST_TIMEOUT
        });

        collector.on('collect', async (message) => {
            await this.processWhitelistCommand(message, channel, channelId);
        });

        collector.on('end', (collected) => {
            Logger.debug('Collecteur liste blanche terminé', {
                userId: interaction.user.id,
                channelId,
                messagesCollected: collected.size
            });
        });
    }

    static async processWhitelistCommand(message, channel, channelId) {
        const content = message.content.toLowerCase();
        const mentionedUser = message.mentions.users.first();

        if (!mentionedUser) {
            return message.reply(`${EMOJIS.ERROR} Veuillez mentionner un utilisateur valide.`);
        }

        Logger.debug('Commande liste blanche reçue', {
            command: content,
            mentionedUserId: mentionedUser.id,
            channelId,
            authorId: message.author.id
        });

        if (content.startsWith('ajouter')) {
            await this.addToWhitelist(message, channel, channelId, mentionedUser);
        } else if (content.startsWith('retirer')) {
            await this.removeFromWhitelist(message, channel, channelId, mentionedUser);
        } else {
            await message.reply(`${EMOJIS.ERROR} Utilisez \`ajouter @utilisateur\` ou \`retirer @utilisateur\`.`);
        }
    }

    static async addToWhitelist(message, channel, channelId, user) {
        try {
            voiceManager.addAuthorizedUser(channelId, user.id);
            
            await channel.permissionOverwrites.create(user.id, {
                Connect: true,
                Speak: true
            });
            
            await message.reply(`${EMOJIS.SUCCESS} ${user} a été ajouté à la liste blanche.`);
        } catch (error) {
            Logger.error('Erreur addToWhitelist:', {
                error: error.message,
                userId: user.id,
                channelId
            });
            await message.reply(`${EMOJIS.ERROR} Erreur lors de l'ajout à la liste blanche.`);
        }
    }

    static async removeFromWhitelist(message, channel, channelId, user) {
        try {
            voiceManager.removeAuthorizedUser(channelId, user.id);
            
            await channel.permissionOverwrites.delete(user.id);
            await message.reply(`${EMOJIS.SUCCESS} ${user} a été retiré de la liste blanche.`);
        } catch (error) {
            Logger.error('Erreur removeFromWhitelist:', {
                error: error.message,
                userId: user.id,
                channelId
            });
            await message.reply(`${EMOJIS.ERROR} Erreur lors du retrait de la liste blanche.`);
        }
    }

    static async toggleGhostMode(interaction, channel, channelId) {
        const isGhostMode = voiceManager.toggleGhostMode(interaction.user.id);
        
        const message = isGhostMode 
            ? `${EMOJIS.GHOST} Mode fantôme activé. Vous êtes maintenant invisible aux utilisateurs non autorisés.`
            : `${EMOJIS.GHOST} Mode fantôme désactivé. Vous êtes maintenant visible.`;

        await interaction.reply({ content: message, ephemeral: true });
    }

    static async renameChannel(interaction, channel, channelId) {
        await interaction.reply({ 
            content: `${EMOJIS.EDIT} Comment voulez-vous nommer votre canal ? (30 secondes pour répondre)`, 
            ephemeral: true 
        });

        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ 
            filter, 
            time: CONFIG.INTERACTION_TIMEOUT, 
            max: 1 
        });

        Logger.info('Collecteur de renommage créé', {
            userId: interaction.user.id,
            channelId,
            timeout: CONFIG.INTERACTION_TIMEOUT
        });

        collector.on('collect', async (message) => {
            const newName = message.content.trim();
            
            if (newName.length > CONFIG.MAX_CHANNEL_NAME_LENGTH) {
                return message.reply(`${EMOJIS.ERROR} Le nom ne peut pas dépasser ${CONFIG.MAX_CHANNEL_NAME_LENGTH} caractères.`);
            }

            if (newName.length < 2) {
                return message.reply(`${EMOJIS.ERROR} Le nom doit contenir au moins 2 caractères.`);
            }

            try {
                const finalName = `${EMOJIS.MIC} ${newName}`;
                await channel.setName(finalName);
                
                // Mettre à jour les données
                const channelData = voiceManager.getChannelData(channelId);
                channelData.channelName = finalName;
                voiceManager.setTemporaryChannel(channelId, channelData);
                
                await message.reply(`${EMOJIS.SUCCESS} Canal renommé en "${newName}".`);
                await this.updateControlMessage(interaction, channel, channelId);

                Logger.logChannelAction('RENAMED', channelId, interaction.user.id, {
                    oldName: channel.name,
                    newName: finalName
                });

            } catch (error) {
                Logger.error('Erreur renameChannel:', {
                    error: error.message,
                    newName,
                    channelId,
                    userId: interaction.user.id
                });
                await message.reply(`${EMOJIS.ERROR} Erreur lors du renommage du canal.`);
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ 
                    content: `${EMOJIS.CLOCK} Délai de renommage expiré.`, 
                    ephemeral: true 
                }).catch(() => {});
            }
        });
    }

    static async setUserLimit(interaction, channel, channelId) {
        await interaction.reply({ 
            content: `${EMOJIS.NUMBERS} Quelle limite d'utilisateurs voulez-vous ? (2-${CONFIG.MAX_USER_LIMIT}, ou 0 pour illimité)`, 
            ephemeral: true 
        });

        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ 
            filter, 
            time: CONFIG.INTERACTION_TIMEOUT, 
            max: 1 
        });

        collector.on('collect', async (message) => {
            const limit = parseInt(message.content);
            
            if (isNaN(limit) || limit < 0 || limit > CONFIG.MAX_USER_LIMIT) {
                return message.reply(`${EMOJIS.ERROR} Veuillez entrer un nombre entre 0 et ${CONFIG.MAX_USER_LIMIT}.`);
            }

            try {
                await channel.setUserLimit(limit);
                const limitText = limit === 0 ? 'illimitée' : limit.toString();
                await message.reply(`${EMOJIS.SUCCESS} Limite d'utilisateurs définie à ${limitText}.`);
                await this.updateControlMessage(interaction, channel, channelId);

                Logger.logChannelAction('USER_LIMIT_CHANGED', channelId, interaction.user.id, {
                    newLimit: limit,
                    limitText
                });

            } catch (error) {
                Logger.error('Erreur setUserLimit:', {
                    error: error.message,
                    limit,
                    channelId,
                    userId: interaction.user.id
                });
                await message.reply(`${EMOJIS.ERROR} Erreur lors de la définition de la limite.`);
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ 
                    content: `${EMOJIS.CLOCK} Délai de définition de limite expiré.`, 
                    ephemeral: true 
                }).catch(() => {});
            }
        });
    }

    static async kickUser(interaction, channel, channelId) {
        const members = channel.members.filter(member => member.id !== interaction.user.id);
        
        if (members.size === 0) {
            return interaction.reply({ 
                content: `${EMOJIS.ERROR} Il n'y a personne d'autre dans le canal.`, 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.BOOT} Expulser un membre`)
            .setDescription('Sélectionnez le membre à expulser du canal vocal.')
            .setColor(COLORS.WARNING);

        const userSelectMenu = new UserSelectMenuBuilder()
            .setCustomId(`kick_user_${channelId}`)
            .setPlaceholder('Sélectionnez un membre à expulser...')
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

        Logger.info('Menu d\'expulsion utilisateur affiché', {
            userId: interaction.user.id,
            channelId,
            availableMembers: members.size
        });
    }

    static async handleKickUser(interaction) {
        if (!interaction.customId.startsWith('kick_user_')) return;

        const channelId = interaction.customId.replace('kick_user_', '');
        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (!channel) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Canal introuvable.`, 
                ephemeral: true 
            });
        }

        if (!voiceManager.isOwner(interaction.user.id, channelId)) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Seul le propriétaire du canal peut expulser des membres.`, 
                ephemeral: true 
            });
        }

        const selectedUserId = interaction.values[0];
        const memberToKick = channel.members.get(selectedUserId);
        
        if (!memberToKick) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Ce membre n'est plus dans le canal.`, 
                ephemeral: true 
            });
        }

        if (memberToKick.id === interaction.user.id) {
            return await interaction.reply({ 
                content: `${EMOJIS.ERROR} Vous ne pouvez pas vous expulser vous-même !`, 
                ephemeral: true 
            });
        }

        try {
            await memberToKick.voice.disconnect();
            
            Logger.logUserAction('KICKED', selectedUserId, channelId, {
                kickedBy: interaction.user.id,
                reason: 'Owner kick'
            });

            await interaction.reply({ 
                content: `${EMOJIS.SUCCESS} ${memberToKick.user} a été expulsé du canal.`, 
                ephemeral: true 
            });

        } catch (error) {
            Logger.error('Erreur kickUser:', {
                error: error.message,
                targetUserId: selectedUserId,
                channelId,
                kickerId: interaction.user.id
            });
            await interaction.reply({ 
                content: `${EMOJIS.ERROR} Erreur lors de l'expulsion du membre.`, 
                ephemeral: true 
            });
        }
    }

    static async updateControlMessage(interaction, channel, channelId) {
        const channelData = voiceManager.getChannelData(channelId);
        
        if (!channelData?.messageControle) return;

        try {
            const embed = EmbedFactory.createControlEmbed(
                interaction.user, 
                channel, 
                channelData.estPrive
            );
            
            await channelData.messageControle.edit({ embeds: [embed] });
            Logger.success('Message de contrôle mis à jour', {
                channelId,
                messageId: channelData.messageControle.id
            });
        } catch (error) {
            Logger.error('Erreur updateControlMessage:', {
                error: error.message,
                channelId
            });
        }
    }
}

// ====================================
// 🚀 INITIALISATION ET EXPORTS
// ====================================

const voiceManager = new VoiceChannelManager();

// Initialiser le système au démarrage
(async () => {
    try {
        await voiceManager.init();
    } catch (error) {
        console.error('Erreur fatale lors de l\'initialisation:', error);
        process.exit(1);
    }
})();

// ====================================
// 🚀 POINT D'ENTRÉE PRINCIPAL
// ====================================

module.exports = {
    name: 'voiceStateUpdate',
    
    async execute(oldState, newState) {
        try {
            // Assurer que le système est initialisé
            if (!voiceManager.initialized) {
                await voiceManager.init();
            }

            // Gestion des entrées dans le canal déclencheur
            if (newState.channelId === CONFIG.TRIGGER_VOICE_CHANNEL && 
                oldState.channelId !== CONFIG.TRIGGER_VOICE_CHANNEL) {
                await VoiceStateHandler.handleJoin(newState);
            }
            
            // Gestion des sorties des canaux temporaires
            if (oldState.channel && voiceManager.getChannelData(oldState.channelId)) {
                await VoiceStateHandler.handleLeave(oldState);
            }

            // Gestion du mode fantôme
            if (newState.channelId && voiceManager.getChannelData(newState.channelId)) {
                VoiceStateHandler.handleGhostMode(newState);
            }

        } catch (error) {
            Logger.error('Erreur dans voiceStateUpdate:', {
                error: error.message,
                stack: error.stack,
                oldChannelId: oldState.channelId,
                newChannelId: newState.channelId,
                userId: newState.member?.id
            });
        }
    },

    // ====================================
    // 🔄 GESTIONNAIRE D'INTERACTIONS
    // ====================================

    async handleSelectMenuInteraction(interaction) {
        try {
            if (interaction.customId.startsWith('controle_vocal_')) {
                await InteractionHandler.handleSelectMenu(interaction);
            } else if (interaction.customId.startsWith('invite_user_')) {
                await InteractionHandler.handleUserSelect(interaction);
            } else if (interaction.customId.startsWith('kick_user_')) {
                await InteractionHandler.handleKickUser(interaction);
            }
        } catch (error) {
            Logger.error('Erreur dans handleSelectMenuInteraction:', {
                error: error.message,
                customId: interaction.customId,
                userId: interaction.user.id
            });
        }
    },

    // ====================================
    // 🔧 EXPORTS POUR COMPATIBILITÉ ET OUTILS
    // ====================================

    // Exports des gestionnaires
    VoiceChannelManager: voiceManager,
    EmbedFactory,
    MenuFactory,
    ChannelUtils,
    Logger,
    JSONDataManager,

    // Exports des constantes
    CONFIG,
    COLORS,
    EMOJIS,

    // Export des statistiques
    async getStats() {
        return voiceManager.getStats();
    },

    // Export des fonctions utilitaires
    async createBackup() {
        return voiceManager.dataManager.createBackup();
    },

    async loadData() {
        return voiceManager.dataManager.loadData();
    },

    async saveData() {
        return voiceManager.dataManager.saveData();
    },

    // Exports des fonctions pour l'ancien système (compatibilité)
    canauxVocauxTemp: voiceManager.temporaryChannels,
    utilisateursAutorises: voiceManager.authorizedUsers,
    utilisateursModeFanseme: voiceManager.ghostModeUsers,

    // Exports des méthodes d'interaction pour interactionCreate.js
    async definirCanalPrive(interaction, canal, canalId) {
        return InteractionHandler.setChannelPrivate(interaction, canal, canalId);
    },

    async definirCanalPublic(interaction, canal, canalId) {
        return InteractionHandler.setChannelPublic(interaction, canal, canalId);
    },

    async inviterUtilisateur(interaction, canal, canalId) {
        return InteractionHandler.inviteUser(interaction, canal, canalId);
    },

    async gererListeBlanche(interaction, canal, canalId) {
        return InteractionHandler.manageWhitelist(interaction, canal, canalId);
    },

    async basculerModeFantome(interaction, canal, canalId) {
        return InteractionHandler.toggleGhostMode(interaction, canal, canalId);
    },

    async renommerCanal(interaction, canal, canalId) {
        return InteractionHandler.renameChannel(interaction, canal, canalId);
    },

    async definirLimiteUtilisateurs(interaction, canal, canalId) {
        return InteractionHandler.setUserLimit(interaction, canal, canalId);
    },

    async expulserUtilisateur(interaction, canal, canalId) {
        return InteractionHandler.kickUser(interaction, canal, canalId);
    }
};
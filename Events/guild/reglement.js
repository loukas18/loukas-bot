const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function sendRulesEmbed(channel) {
    try {
        console.log(`🔔 Vérification des messages dans le salon ${channel.name} (${channel.id}) pour envoyer le règlement...`);

        const messages = await channel.messages.fetch({ limit: 1 });
        if (messages.size > 0) {
            console.log('ℹ️ Le salon contient déjà des messages, règlement non envoyé.');
            return;
        }

        const description = 
            '🌿 **Bienvenue** sur le serveur de **loukas.** Prends un petit moment pour lire ce règlement avant de participer. Rien de méchant, juste de quoi garder une bonne ambiance ✨\n' +

            '\n1. **__Respect & vibes cool__**\n' +
            '> On est là pour passer un bon moment, donc le respect est de mise entre tout le monde.\n' +
            '> Pas d’insultes, de propos déplacés ou de comportements toxiques.\n' +
            '> Évitons les sujets sensibles ou choquants, restons chill.\n' +
            '> Si y’a un souci, viens en parler calmement avec la modération.\n' +

            '\n2. **__Salons = espaces dédiés__**\n' +
            '> Chaque salon a son petit rôle, merci de l’utiliser comme prévu.\n' +
            '> Pas de spam, de flood ou de gros pings abusifs (@everyone, @here… on évite).\n' +

            '\n3. **__Pseudos & profils__**\n' +
            '> Garde un pseudo et une photo de profil corrects et sympas.\n' +
            '> Pas de pseudo qui pourrait faire croire que t’es staff ou bot.\n' +

            '\n4. **__Partage de contenu__**\n' +
            '> Partage ce que tu veux tant que c’est légal, respectueux et safe.\n' +
            '> Pas de pub sauvage, de liens douteux ou de contenu NSFW.\n' +
            '> Pour la pub (serveur, chaîne, site…), demande l’accord d’un admin.\n' +

            '\n5. **__En vocal aussi, on chill__**\n' +
            '> Respect et bonne ambiance : pas de cris, pas de musiques gênantes.\n' +
            '> Soundboards et voice changers ? OK si t’as l’autorisation.\n' +
            '> Évite d’imposer des discussions perso à tout le salon.\n' +

            '\n6. **__Modération & décisions__**\n' +
            '> Les modos sont là pour que tout se passe bien, leurs décisions doivent être respectées.\n' +
            '> Essayer de contourner une sanction ? Mauvaise idée.\n' +
            '> Le règlement peut évoluer, donc reste à jour si besoin.\n' +

            '\n7. **__En résumé__**\n' +
            '> Être ici = accepter ce règlement. Simple et clair.\n' +
            '> Le staff fera toujours en sorte de garder une ambiance cool et safe pour tout le monde ✌️\n' +

            '\n*Amuse-toi bien !*';

        const rulesEmbed = new EmbedBuilder()
            .setColor('#828282')
            .setAuthor({ name: 'Règlement du serveur Discord' })
            .setDescription(description);

        const imagePath = path.join(__dirname, "../../reglement.jpg");
        console.log('🔍 Chemin de l\'image:', imagePath);

        let attachment = null;
        if (fs.existsSync(imagePath)) {
            attachment = new AttachmentBuilder(imagePath, { name: 'reglement.jpg' });
            rulesEmbed.setImage('attachment://reglement.jpg');
            console.log('✅ Image du règlement trouvée et ajoutée.');
        } else {
            console.log('⚠️ Fichier reglement.jpg non trouvé, pas d\'image ajoutée.');
        }

        const messageOptions = { embeds: [rulesEmbed] };
        if (attachment) messageOptions.files = [attachment];

        await channel.send(messageOptions);
        console.log('🎉 Règlement envoyé avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du règlement:', error);
    }
}

module.exports = {
    name: 'reglement',
    execute: async (client) => {
        console.log('🔔 Exécution de la commande reglement au démarrage...');
        const channelId = '1523022940193558748'; // Remplace par ton ID de salon
        const channel = client.channels.cache.get(channelId);
        if (channel) {
            await sendRulesEmbed(channel);
        } else {
            console.error('❌ Salon de règlement introuvable.');
        }
    },
};

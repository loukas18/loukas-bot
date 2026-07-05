const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');

function createSupportEmbed() {
  return new EmbedBuilder()
    .setTitle('💖 Besoin d’aide, senpai ?')
    .setDescription(
      "Tu as un souci, une idée brillante ou tu veux signaler quelque chose ? (｡•́︿•̀｡)\n\n" +
      "Pas de panique, on est là pour toi !\n\n" +
      "🎀 **Clique sur le bouton ci-dessous pour ouvrir un ticket tout mignon.**"
    )
    .setColor('#FFB6C1')
    .setImage('attachment://support.jpg'); // image attachée
}

function createMainButton() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('📩 Ouvrir un ticket kawaii')
        .setStyle(ButtonStyle.Primary)
    );
}

async function sendSupportMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 1 });
    if (messages.size > 0) {
      console.log('Le salon contient déjà des messages, embed de support non envoyé.');
      return;
    }

    const imagePath = path.join(__dirname, '../../support.jpg');
    const attachment = new AttachmentBuilder(imagePath).setName('support.jpg');

    const embed = createSupportEmbed();
    const button = createMainButton();

    await channel.send({
      embeds: [embed],
      components: [button],
      files: [attachment]
    });

    console.log('🌸 Embed de support envoyé avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'embed de support :', error);
  }
}

module.exports = {
  name: 'supportEmbed',
  execute: async (client) => {
    const channelId = '1523022940348874967'; // ID du salon de support
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        console.log('❌ Salon de support introuvable ou non textuel.');
        return;
      }
      await sendSupportMessage(channel);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du salon de support :', error);
    }
  },
};

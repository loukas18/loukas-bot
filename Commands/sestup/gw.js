const fs = require("fs");
const path = require("path");
const giveawaysPath = path.join(process.cwd(), "giveaways.json");

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

const { 
  startGiveawayInterval, 
  readGiveaways, 
  writeGiveaways, 
  formatTime 
} = require("../../utils/giveawayManager");

const convertTimeToSeconds = (amount, unit) => {
  switch (unit.toLowerCase()) {
    case "s":
    case "sec":
    case "secondes":
      return amount;
    case "m":
    case "min":
    case "minutes":
      return amount * 60;
    case "h":
    case "heures":
      return amount * 3600;
    case "d":
    case "jours":
      return amount * 86400;
    default:
      return amount;
  }
};

const convertDuration = (duration) => {
  const regex = /(\d+)([smhd])/gi;
  let totalSeconds = 0;
  let match;
  while ((match = regex.exec(duration)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2];
    totalSeconds += convertTimeToSeconds(value, unit);
  }
  return totalSeconds;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Lance un giveaway sur le serveur")
    .addStringOption((opt) =>
      opt
        .setName("prix")
        .setDescription("Le prix à gagner")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("temps")
        .setDescription("Durée du giveaway (ex: 1d2h30m10s)")
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("gagnants")
        .setDescription("Nombre de gagnants (entre 1 et 10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("messages_requis")
        .setDescription("Nombre de messages à envoyer pendant le giveaway pour pouvoir participer")
        .setMinValue(1)
        .setRequired(false)
    )
    .addRoleOption((opt) =>
      opt
        .setName("role_requis")
        .setDescription("Rôle requis pour participer (optionnel)")
    )
    .addRoleOption((opt) =>
      opt
        .setName("role")
        .setDescription("Rôle à attribuer aux gagnants (optionnel)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async run(client, interaction) {
    try {
      const prix = interaction.options.getString("prix");
      const temps = interaction.options.getString("temps");
      const nbGagnants = interaction.options.getInteger("gagnants");
      const messagesRequis = interaction.options.getInteger("messages_requis") || 0;
      const role = interaction.options.getRole("role");
      const roleRequis = interaction.options.getRole("role_requis");

      console.log(`🎯 Création d'un giveaway par ${interaction.user.tag}`);
      console.log(`📊 Paramètres: Prix="${prix}", Durée="${temps}", Gagnants=${nbGagnants}${roleRequis ? `, Rôle requis=${roleRequis.name}` : ''}${messagesRequis > 0 ? `, Messages requis=${messagesRequis}` : ''}`);

      const tempsEnSecondes = convertDuration(temps);

      if (tempsEnSecondes <= 0) {
        console.warn(`⚠️ Durée invalide fournie: ${temps}`);
        return interaction.reply({
          content: "⚠️ **Durée invalide**\nMerci d'utiliser un format valide comme `1d2h30m` ou `5h30m`.",
          ephemeral: true,
        });
      }

      if (tempsEnSecondes < 60) {
        return interaction.reply({
          content: "⚠️ **Durée trop courte**\nLa durée minimale d'un giveaway est de 1 minute.",
          ephemeral: true,
        });
      }

      if (tempsEnSecondes > 2592000) {
        return interaction.reply({
          content: "⚠️ **Durée trop longue**\nLa durée maximale d'un giveaway est de 30 jours.",
          ephemeral: true,
        });
      }

      let giveaways = readGiveaways();

      const attachment = new AttachmentBuilder("./gw.jpg");

      const startTimestamp = Date.now();
      const endTimestamp = startTimestamp + (tempsEnSecondes * 1000);
      const endTimestampUnix = Math.floor(endTimestamp / 1000);

      const embed = new EmbedBuilder()
        .setTitle("🎉✨ Giveaway en cours ✨🎉")
        .setDescription(
          `🎁 **Prix à gagner :** \`${prix}\`\n` +
          `👑 **Nombre de gagnants :** \`${nbGagnants}\`\n\n` +
          `⏰ **Se termine :** <t:${endTimestampUnix}:R>\n` +
          `📅 **Date de fin :** <t:${endTimestampUnix}:F>\n\n` +
          (roleRequis ? `🔒 **Rôle requis pour participer :** ${roleRequis}\n` : '') +
          (messagesRequis > 0 ? `💬 **Messages requis pour participer :** \`${messagesRequis}\`\n` : '') +
          (role ? `🎭 **Rôle à gagner :** ${role}\n` : '') +
          `\n🌟 Clique sur **Participer** pour rejoindre le giveaway ! 🍀💖`
        )
        .setColor("Random")
        .setFooter({ 
          text: `Organisé par ${interaction.user.username} 🎀`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setImage("attachment://gw.jpg")
        .setTimestamp(endTimestamp);

      const participerBtn = new ButtonBuilder()
        .setCustomId("participer")
        .setLabel("🎯 Participer")
        .setStyle(ButtonStyle.Success);

      const participantsBtn = new ButtonBuilder()
        .setCustomId("participants")
        .setLabel("👥 Participants (0)")
        .setStyle(ButtonStyle.Secondary);

      const rerollBtn = new ButtonBuilder()
        .setCustomId("reroll")
        .setLabel("🔄 Relancer")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);

      const row = new ActionRowBuilder().addComponents(participerBtn, participantsBtn, rerollBtn);

      console.log("📤 Envoi du message de giveaway...");
      const msg = await interaction.reply({
        embeds: [embed],
        components: [row],
        files: [attachment],
        fetchReply: true,
        ephemeral: false,
      });

      console.log(`✅ Message de giveaway envoyé (ID: ${msg.id})`);

      const giveawayData = {
        messageId: msg.id,
        channelId: msg.channel.id,
        guildId: interaction.guildId,
        initiatorId: interaction.user.id,
        initiatorName: interaction.user.username,
        prix,
        roleId: role ? role.id : null,
        roleName: role ? role.name : null,
        roleRequisId: roleRequis ? roleRequis.id : null,
        roleRequisName: roleRequis ? roleRequis.name : null,
        messagesRequis: messagesRequis,
        messageCounts: {},
        startTimestamp: startTimestamp,
        endTimestamp: endTimestamp,
        dureeTotale: tempsEnSecondes * 1000,
        participants: [],
        nbGagnants,
        ended: false,
        winners: [],
        createdAt: new Date().toISOString(),
      };

      giveaways[msg.id] = giveawayData;
      const saveSuccess = writeGiveaways(giveaways);
      
      if (!saveSuccess) {
        console.error("❌ Erreur lors de la sauvegarde du giveaway");
        return interaction.followUp({
          content: "⚠️ **Attention :** Le giveaway a été créé mais il y a eu une erreur de sauvegarde. Contactez un administrateur.",
          ephemeral: true
        });
      }

      console.log("💾 Giveaway sauvegardé avec succès");

      startGiveawayInterval(client, giveawayData, msg);

      console.log(`🎉 Giveaway lancé avec succès ! ID: ${msg.id}, fin prévue: ${new Date(giveawayData.endTimestamp).toLocaleString()}`);
 
      setTimeout(async () => {
        try {
          await interaction.followUp({
            content: `✅ **Giveaway créé avec succès !**\n🎯 Prix: \`${prix}\`\n⏰ Fin: <t:${endTimestampUnix}:R>\n🏆 Gagnants: \`${nbGagnants}\`${roleRequis ? `\n🔒 Rôle requis: ${roleRequis}` : ''}${messagesRequis > 0 ? `\n💬 Messages requis: \`${messagesRequis}\`` : ''}`,
            ephemeral: true
          });
        } catch (error) {
          console.warn("⚠️ Impossible d'envoyer le message de confirmation:", error.message);
        }
      }, 1000);

    } catch (error) {
      console.error("❌ Erreur critique lors de la création du giveaway:", error);
      
      const errorMessage = "❌ **Erreur lors de la création du giveaway**\nUne erreur inattendue s'est produite. Veuillez réessayer.";
      
      if (!interaction.replied) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      }
    }
  },
};
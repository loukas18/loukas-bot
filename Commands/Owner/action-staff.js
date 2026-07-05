const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('actions-staff')
    .setDescription('Effectuer une action staff sur un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action à effectuer')
        .setRequired(true)
        .addChoices(
          { name: 'Rankup',         value: 'rankup' },
          { name: 'Derank',         value: 'derank' },
          { name: 'Warn',           value: 'warn' },
          { name: 'Unwarn',         value: 'unwarn' },
          { name: 'Rétrogradation', value: 'retrogradation' },
        )
    )

    .addUserOption(option =>
      option
        .setName('membre')
        .setDescription('Membre concerné')
        .setRequired(true)
    )

    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Rôle à ajouter ou retirer')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message personnalisé (facultatif)')
        .setRequired(false)
    ),

  category: 'Staff',

  async run(client, interaction) {
    const action  = interaction.options.getString('action');
    const membre  = interaction.options.getMember('membre');
    const role    = interaction.options.getRole('role');
    const message = interaction.options.getString('message') || 'Aucun message.';
    const salonId = '1523022940713652240';

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: 'Permissions insuffisantes.', ephemeral: true });
    }

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: "Je n'ai pas les permissions nécessaires.", ephemeral: true });
    }

    const salon = await interaction.guild.channels.fetch(salonId).catch(() => null);
    if (!salon) {
      return interaction.reply({ content: 'Salon de logs introuvable.', ephemeral: true });
    }

    if (['rankup', 'derank', 'retrogradation'].includes(action) && !role) {
      return interaction.reply({
        content: 'Tu dois spécifier un rôle pour cette action.',
        ephemeral: true,
      });
    }

    if (role && role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({
        content: 'Je ne peux pas gérer ce rôle (hiérarchie).',
        ephemeral: true,
      });
    }

    // RANKUP
    if (action === 'rankup') {
      if (membre.roles.cache.has(role.id)) {
        return interaction.reply({ content: 'Le membre a déjà ce rôle.', ephemeral: true });
      }
      await membre.roles.add(role);
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('〃 Rankup')
        .setDescription(`🎉 **Félicitations !**\n➜ Nouveau rôle : ${role}\n\n${message}`)
        .setTimestamp()
        .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
      await salon.send({ content: membre.toString(), embeds: [embed] });
    }

    // DERANK
    if (action === 'derank') {
      if (!membre.roles.cache.has(role.id)) {
        return interaction.reply({ content: 'Le membre ne possède pas ce rôle.', ephemeral: true });
      }
      await membre.roles.remove(role);
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('〃 Derank')
        .setDescription(`❌ **Rôle retiré**\n➜ Ancien rôle : ${role}\n\n${message}`)
        .setTimestamp()
        .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
      await salon.send({ content: membre.toString(), embeds: [embed] });
    }

    // WARN
    if (action === 'warn') {
      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('〃 Warn')
        .setDescription(`⚠️ **Avertissement**\n➜ Membre : ${membre}\n\n${message}`)
        .setTimestamp()
        .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
      await salon.send({ embeds: [embed] });
    }

    // UNWARN
    if (action === 'unwarn') {
      const embed = new EmbedBuilder()
        .setColor('#00FFFF')
        .setTitle('〃 Unwarn')
        .setDescription(`✅ **Avertissement retiré**\n➜ Membre : ${membre}\n\n${message}`)
        .setTimestamp()
        .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
      await salon.send({ embeds: [embed] });
    }

    // RÉTROGRADATION
    if (action === 'retrogradation') {
      if (!membre.roles.cache.has(role.id)) {
        return interaction.reply({ content: 'Le membre ne possède pas ce rôle.', ephemeral: true });
      }
      await membre.roles.remove(role);
      const embed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('〃 Rétrogradation')
        .setDescription(`⬇️ **Rétrogradation**\n➜ Rôle retiré : ${role}\n\n${message}`)
        .setTimestamp()
        .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
      await salon.send({ content: membre.toString(), embeds: [embed] });
    }

    return interaction.reply({
      content: `✅ Action **${action}** effectuée avec succès.`,
      ephemeral: true,
    });
  },
};
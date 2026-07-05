module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      console.log(`🔔 guildMemberRemove déclenché pour ${member.user.tag}`);

      const guild = member.guild;
      const channelId = '1523022940193558745';

      const count = guild.members.cache.filter(m => !m.user.bot).size;
      console.log(`👥 Nombre de membres non bots calculé : ${count}`);

      const voiceChannel = guild.channels.cache.get(channelId);
      if (voiceChannel) {
        await voiceChannel.setName(`🍂 𝘔𝘦𝘮𝘣𝘳𝘦𝘴  : ${count}`);
        console.log(`✅ Le nom du channel vocal ${voiceChannel.name} a été mis à jour.`);
      } else {
        console.error(`❌ Le channel vocal avec l'ID ${channelId} est introuvable.`);
      }
    } catch (error) {
      console.error("❌ Erreur dans guildMemberRemove lors de la mise à jour du nom du channel :", error);
    }
  },
};

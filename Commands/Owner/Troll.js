const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('msg')
        .setDescription('Envoie 👀')
        .addIntegerOption(option =>
            option.setName('fois')
                .setDescription('Nombre de fois (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le message')
                .setRequired(true)
        ),
    async run(client, interaction) {
        const fois = interaction.options.getInteger('fois');
        const msg = interaction.options.getString('message');

        console.log(`📢 Commande /troll utilisée par ${interaction.user.tag} — "${msg}" x${fois}`);

        await interaction.reply({ content: `🚀 Lancement du troll... **${fois}x** \`${msg}\``, ephemeral: true });

        for (let i = 0; i < fois; i++) {
            await interaction.channel.send(`${msg}`);
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }
};
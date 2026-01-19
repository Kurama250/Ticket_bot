const { SlashCommandBuilder, EmbedBuilder, Events } = require('discord.js');

module.exports = (client) => {
  const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show the help menu for the ticket bot');

  client.once(Events.ClientReady, () => {
    client.application.commands.create(helpCommand);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'help') return;

    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket Bot Help')
      .setDescription(
        '**Available Commands:**\n' +
        '• `/config lang:<language>` — Configure the bot language and support roles.\n' +
        '• `/help` — Show this help menu.\n\n' +
        '**How to use:**\n' +
        '1. Use `/config` to set up the bot.\n' +
        '2. Select the support roles.\n' +
        '3. The bot will create the necessary channels.\n' +
        '4. Click the "Create a ticket" button to open a support ticket.'
      )
      .setColor('#5865F2')
      .setFooter({ text: 'Ticket System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  });

}; 

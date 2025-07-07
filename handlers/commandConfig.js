const { SlashCommandBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data.json');
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

module.exports = (client) => {
  const configCommand = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the ticket bot')
    .addStringOption(option =>
      option.setName('lang')
        .setDescription('Bot language')
        .addChoices(
          { name: 'Français', value: 'fr' },
          { name: 'English', value: 'en' }
        )
        .setRequired(true));

  client.once(Events.ClientReady, () => {
    client.application.commands.create(configCommand);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'config') return;
    
    const lang = interaction.options.getString('lang');

    const guild = interaction.guild;
    const roles = guild.roles.cache
      .filter(role => role.name !== '@everyone' && !role.managed)
      .sort((a, b) => b.position - a.position)
      .first(25);

    const roleOptions = roles.map(role => ({
      label: role.name,
      value: role.id,
      description: `Role: ${role.name}`
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('config_support_roles')
      .setPlaceholder(lang === 'fr' ? 'Sélectionnez les rôles de support...' : 'Select support roles...')
      .setMinValues(1)
      .setMaxValues(Math.min(roles.length, 10))
      .addOptions(roleOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle(lang === 'fr' ? '⚙️ Configuration du Bot de Tickets' : '⚙️ Ticket Bot Configuration')
      .setDescription(lang === 'fr' 
        ? 'Sélectionnez les rôles de support que vous souhaitez configurer :\n\n**Configuration actuelle :**\n• Langue : ' + (lang === 'fr' ? 'Français' : 'English') + '\n• Salon de tickets : Sera créé automatiquement'
        : 'Select the support roles you want to configure:\n\n**Current configuration:**\n• Language: ' + (lang === 'fr' ? 'French' : 'English') + '\n• Ticket channel: Will be created automatically')
      .setColor('#0099ff')
      .setTimestamp();

    const tempConfig = {
      lang: lang,
      guildId: interaction.guildId
    };

    const tempData = loadData();
    tempData.tempConfig = tempConfig;
    saveData(tempData);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'config_support_roles') return;
    
    const selectedRoleIds = interaction.values;
    const data = loadData();
    const tempConfig = data.tempConfig;
    
    if (!tempConfig) {
      await interaction.reply({ content: '❌ Temporary configuration lost. Please run /config again.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const lang = tempConfig.lang;

    data.guildId = tempConfig.guildId;
    data.supportRoles = selectedRoleIds;
    data.supportRole = selectedRoleIds[0];
    data.lang = lang;
    delete data.tempConfig;
    saveData(data);

    let ticketCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets');
    if (!ticketCategory) {
      ticketCategory = await guild.channels.create({
        name: '🎫・Tickets',
        type: ChannelType.GuildCategory
      });
    }
    data.ticketCategory = ticketCategory.id;
    saveData(data);

    let createTicketChannel = guild.channels.cache.find(c => c.parentId === ticketCategory.id && c.name === 'tickets');
    if (!createTicketChannel) {
      createTicketChannel = await guild.channels.create({
        name: '🎟️・tickets',
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.SendMessages],
            allow: [PermissionsBitField.Flags.ViewChannel]
          },
          ...selectedRoleIds.map(roleId => ({
            id: roleId,
            allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]
          }))
        ]
      });
    }
    data.createTicketChannel = createTicketChannel.id;
    saveData(data);

    let transcriptChannel = guild.channels.cache.find(c => c.parentId === ticketCategory.id && c.name === 'transcript');
    if (!transcriptChannel) {
      transcriptChannel = await guild.channels.create({
        name: '📄・transcript',
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          ...selectedRoleIds.map(roleId => ({
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }))
        ]
      });
    }
    data.transcriptChannel = transcriptChannel.id;
    saveData(data);

    const botAvatar = client.user.displayAvatarURL();

    const embed = new EmbedBuilder()
      .setAuthor({
        name: lang === 'fr' ? '🎫 Support Tickets' : '🎫 Support Tickets',
        iconURL: botAvatar
      })
      .setTitle(lang === 'fr' ? 'Besoin d\'aide ?' : 'Need help ?')
      .setDescription(lang === 'fr' 
        ? 'Cliquez sur le bouton ci-dessous pour ouvrir un ticket de support.\n\nUn membre du staff vous répondra rapidement !'
        : 'Click the button below to open a support ticket.\n\nA staff member will assist you soon !')
      .setColor('#5865F2')
      .setThumbnail(botAvatar)
      .setFooter({
        text: lang === 'fr' ? 'Système de tickets Yukiyo' : 'Yukiyo Ticket System',
        iconURL: botAvatar
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel(lang === 'fr' ? '🎫 Créer un ticket' : '🎫 Create a ticket')
        .setStyle(ButtonStyle.Primary)
    );
    
    await createTicketChannel.send({
      embeds: [embed],
      components: [row]
    });
    
    const rolesText = selectedRoleIds.map(roleId => `<@&${roleId}>`).join(', ');
    
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Configuration Complete')
      .setDescription(lang === 'fr' 
        ? `**Configuration enregistrée avec succès !**\n\n📋 **Détails :**\n• Salon de tickets : ${createTicketChannel.toString()}\n• Salon de transcript : ${transcriptChannel.toString()}\n• Langue : ${lang === 'fr' ? 'Français' : 'English'}\n• Rôles de support : ${rolesText}`
        : `**Configuration saved successfully !**\n\n📋 **Details:**\n• Ticket channel : ${createTicketChannel.toString()}\n• Transcript channel : ${transcriptChannel.toString()}\n• Language : ${lang === 'fr' ? 'French' : 'English'}\n• Support roles: ${rolesText}`)
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.update({
      embeds: [successEmbed],
      components: []
    });
  });
}; 
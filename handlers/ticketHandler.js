const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, PermissionsBitField, ChannelType, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data.json');
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

module.exports = (client) => {
  client.on(Events.InteractionCreate, async interaction => {
    const data = loadData();
    const lang = data.lang || 'fr';

    if (interaction.isButton() && interaction.customId === 'create_ticket') {
      const guild = interaction.guild;
      const member = interaction.member;
      const existing = guild.channels.cache.find(c => c.parentId === data.ticketCategory && c.topic === `Ticket de ${member.id}`);
      if (existing) {
        await interaction.reply({ content: lang === 'fr' ? '⚠️ Vous avez déjà un ticket ouvert.' : '⚠️ You already have an open ticket.', ephemeral: true });
        return;
      }

      const supportRoles = data.supportRoles || [data.supportRole];
      
      const ticketChannel = await guild.channels.create({
        name: `🎫・ticket-${member.user.username}`,
        type: ChannelType.GuildText,
        parent: data.ticketCategory,
        topic: `Ticket de ${member.id}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          ...supportRoles.map(roleId => ({
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          })),
          {
            id: member.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });

      const logData = {
        action: 'ticket_created',
        ticketInfo: {
          channelName: ticketChannel.name,
          channelId: ticketChannel.id,
          authorId: member.id,
          authorUsername: member.user.username,
          authorTag: member.user.tag,
          createdAt: new Date().toISOString(),
          guildId: guild.id,
          guildName: guild.name,
          pingedRoles: supportRoles
        }
      };

      const logsPath = path.join(__dirname, '../logs');
      if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath);
      }
      
      const logFileName = `log-ticket-created-${ticketChannel.name}-${Date.now()}.json`;
      const logFilePath = path.join(logsPath, logFileName);
      fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));

      const transcriptChannel = guild.channels.cache.get(data.transcriptChannel);
      const logAttachment = new AttachmentBuilder(logFilePath, { name: logFileName });
      
      const pingedRolesText = supportRoles.map(roleId => `<@&${roleId}>`).join(', ');
      
      await transcriptChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎫 Ticket créé')
            .addFields(
              { name: '👤 Auteur', value: `<@${member.id}>` },
              { name: '📝 Username', value: member.user.username },
              { name: '🎫 Channel', value: `<#${ticketChannel.id}>` },
              { name: '👥 Rôles pingés', value: pingedRolesText || 'Aucun' },
              { name: '📁 Fichier log', value: logFileName }
            )
            .setColor('#00ff00')
            .setTimestamp()
        ],
        files: [logAttachment]
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel(lang === 'fr' ? '🔒 Fermer le ticket' : '🔒 Close ticket')
          .setStyle(ButtonStyle.Danger)
      );

      const pingMessage = supportRoles.length > 0 
        ? `${pingedRolesText} - ${lang === 'fr' ? 'Nouveau ticket créé !' : 'New ticket created!'}`
        : lang === 'fr' ? 'Nouveau ticket créé !' : 'New ticket created!';

      await ticketChannel.send({
        content: pingMessage,
        embeds: [
          new EmbedBuilder()
            .setTitle(lang === 'fr' ? '🎫 Ticket ouvert' : '🎫 Ticket opened')
            .setDescription(lang === 'fr' ? `Un membre du support va vous répondre bientôt. 👨‍💻` : `A support member will reply soon. 👨‍💻`)
            .addFields(
              { name: lang === 'fr' ? '👤 Auteur' : '👤 Author', value: `<@${member.id}>` },
              { name: lang === 'fr' ? '👥 Rôles pingés' : '👥 Pinged roles', value: pingedRolesText || lang === 'fr' ? 'Aucun' : 'None' }
            )
        ],
        components: [closeRow]
      });

      await interaction.reply({ 
        content: lang === 'fr' ? `✅ Ticket créé : ${ticketChannel}` : `✅ Ticket created: ${ticketChannel}`, 
        ephemeral: true 
      });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      const channel = interaction.channel;
      if (!channel.topic || !channel.topic.startsWith('Ticket de ')) {
        await interaction.reply({ content: lang === 'fr' ? '❌ Ce salon n\'est pas un ticket.' : '❌ This channel is not a ticket.', ephemeral: true });
        return;
      }
      
      const messages = await channel.messages.fetch({ limit: 100 });
      const authorId = channel.topic.replace('Ticket de ', '');
      
      const transcriptData = {
        ticketInfo: {
          channelName: channel.name,
          channelId: channel.id,
          authorId: authorId,
          closedBy: interaction.user.id,
          closedAt: new Date().toISOString(),
          guildId: channel.guild.id,
          guildName: channel.guild.name
        },
        messages: messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp).map(message => ({
          id: message.id,
          author: {
            id: message.author.id,
            username: message.author.username,
            tag: message.author.tag,
            bot: message.author.bot
          },
          content: message.content,
          timestamp: message.createdTimestamp,
          createdAt: message.createdAt.toISOString(),
          attachments: message.attachments.map(att => ({
            name: att.name,
            url: att.url,
            size: att.size
          })),
          embeds: message.embeds,
          components: message.components
        }))
      };

      const transcriptPath = path.join(__dirname, '../transcripts');
      if (!fs.existsSync(transcriptPath)) {
        fs.mkdirSync(transcriptPath);
      }
      
      const fileName = `transcript-${channel.name}-${Date.now()}.json`;
      const filePath = path.join(transcriptPath, fileName);
      fs.writeFileSync(filePath, JSON.stringify(transcriptData, null, 2));

      const transcriptChannel = channel.guild.channels.cache.get(data.transcriptChannel);
      const attachment = new AttachmentBuilder(filePath, { name: fileName });
      
      await transcriptChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(lang === 'fr' ? '🔒 Ticket fermé' : '🔒 Ticket closed')
            .addFields(
              { name: lang === 'fr' ? '👤 Auteur' : '👤 Author', value: `<@${authorId}>` },
              { name: lang === 'fr' ? '🔒 Fermé par' : '🔒 Closed by', value: `<@${interaction.user.id}>` },
              { name: lang === 'fr' ? '📄 Messages' : '📄 Messages', value: `${transcriptData.messages.length} messages` },
              { name: lang === 'fr' ? '📁 Fichier' : '📁 File', value: fileName }
            )
            .setColor('#ff0000')
        ],
        files: [attachment]
      });
      
      await interaction.reply({ content: lang === 'fr' ? '🔒 Ticket fermé, transcript JSON envoyé.' : '🔒 Ticket closed, JSON transcript sent.', ephemeral: true });
      setTimeout(() => channel.delete(), 3000);
    }
  });
}; 
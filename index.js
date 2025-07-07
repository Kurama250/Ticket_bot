const { Client, GatewayIntentBits, Partials, Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
  fs.readdirSync(handlersPath).forEach(file => {
    if (file.endsWith('.js')) {
      require(path.join(handlersPath, file))(client);
    }
  });
}

client.once('ready', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🤖  Logged in as : ${client.user.tag}`);
  console.log('✅  Status : Online (Do Not Disturb)');
  console.log('🎫  Activity : Watching Support Tickets');
  console.log('🚀  Yukiyo Ticket Bot is ready !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  client.user.setStatus('dnd');
  client.user.setPresence({
    activities: [{ name: '✉️ Support Tickets', type: ActivityType.Watching }],
    status: 'dnd'
  });
});

client.login(config.token); 
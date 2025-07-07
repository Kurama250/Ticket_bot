const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const commands = [];

const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
  fs.readdirSync(handlersPath).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const handler = require(path.join(handlersPath, file));
        const mockClient = {
          application: {
            commands: {
              create: (command) => {
                if (command instanceof SlashCommandBuilder) {
                  const commandData = command.toJSON();
                  console.log(`📝 Command found : ${commandData.name}`);
                  console.log(`   Description : ${commandData.description}`);
                  if (commandData.options && commandData.options.length > 0) {
                    console.log(`   Options :`);
                    commandData.options.forEach((opt, index) => {
                      const required = opt.required ? '✅ Required' : '❌ Optional';
                      const type = getOptionTypeName(opt.type);
                      console.log(`      ${index + 1}. ${opt.name} (${type}) - ${required}`);
                      console.log(`         Description : ${opt.description}`);
                    });
                  } else {
                    console.log(`   Options: None`);
                  }
                  commands.push(commandData);
                }
              }
            }
          },
          once: (event, callback) => {
            if (event === 'ready') {
              callback();
            }
          },
          on: () => {}
        };
        handler(mockClient);
      } catch (error) {
        console.error(`❌ Error loading handler ${file}:`, error.message);
      }
    }
  });
}

function getOptionTypeName(type) {
  const types = {
    1: 'SUB_COMMAND',
    2: 'SUB_COMMAND_GROUP', 
    3: 'STRING',
    4: 'INTEGER',
    5: 'BOOLEAN',
    6: 'USER',
    7: 'CHANNEL',
    8: 'ROLE',
    9: 'MENTIONABLE',
    10: 'NUMBER',
    11: 'ATTACHMENT'
  };
  return types[type] || `UNKNOWN(${type})`;
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('🚀 Deploying slash commands...');
    console.log(`📋 Total commands: ${commands.length}`);
    
    if (commands.length === 0) {
      console.log('⚠️ No commands found. Make sure your handlers create commands.');
      return;
    }

    console.log('\n📝 Commands to deploy:');
    commands.forEach((cmd, index) => {
      console.log(`\n   ${index + 1}. /${cmd.name}`);
      console.log(`      Description: ${cmd.description}`);
      if (cmd.options && cmd.options.length > 0) {
        console.log(`      Options (${cmd.options.length}):`);
        cmd.options.forEach(opt => {
          const required = opt.required ? '✅' : '❌';
          const type = getOptionTypeName(opt.type);
          console.log(`         ${required} ${opt.name} (${type})`);
        });
      } else {
        console.log(`      Options: None`);
      }
    });

    console.log('\n🔄 Sending commands to Discord...');
    console.log(`   Application ID: ${config.client_id}`);
    
    const result = await rest.put(
      Routes.applicationCommands(config.client_id),
      { body: commands },
    );

    console.log(`\n✅ ${commands.length} command(s) deployed successfully!`);
    console.log('🎉 The bot is ready to use!');
    console.log('\n📋 Available commands:');
    result.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error during deployment:');
    if (error.code === 50035) {
      console.error('   Command validation error. Check that:');
      console.error('   - Required options are before optional options');
      console.error('   - Option types are correct');
      console.error('   - Descriptions are under 100 characters');
      console.error('   - Option names are under 32 characters');
    } else if (error.code === 50001) {
      console.error('   Error: Application not found. Check your CLIENT_ID in config.json');
    } else if (error.code === 50013) {
      console.error('   Error: Insufficient permissions. Make sure the bot has the required permissions');
    } else {
      console.error('   Details:', error.message);
      if (error.requestBody) {
        console.error('   Request body:', JSON.stringify(error.requestBody, null, 2));
      }
    }
    process.exit(1);
  }
})(); 
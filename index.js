
import 'dotenv/config';
import fs from 'fs';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { askAI } from './src/ai.js';


// === Constants ===
const userBehavioursPath = './src/user_behaviours.json';
const enabledChannelsPath = './src/enabled_channels.json';
const conversationHistoryPath = './src/conversation_history.json';

// === Utility Functions ===
function readJSON(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJSON(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}
function getUserBehaviours() {
  return readJSON(userBehavioursPath, {});
}
function setUserBehaviours(obj) {
  writeJSON(userBehavioursPath, obj);
}
// Get behaviour for a user in a specific guild
function getUserBehaviourForGuild(guildId, userId) {
  const all = getUserBehaviours();
  return all[guildId]?.[userId] || null;
}
// Set behaviour for a user in a specific guild
function setUserBehaviourForGuild(guildId, userId, behaviour) {
  const all = getUserBehaviours();
  if (!all[guildId]) all[guildId] = {};
  all[guildId][userId] = behaviour;
  setUserBehaviours(all);
}
function getEnabledChannels() {
  return readJSON(enabledChannelsPath, []);
}
function setEnabledChannels(channels) {
  writeJSON(enabledChannelsPath, channels);
}
function getConversationHistory() {
  return readJSON(conversationHistoryPath, {});
}
function setConversationHistory(obj) {
  writeJSON(conversationHistoryPath, obj);
}
function makeKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// === Slash Command Registration ===
async function registerSlashCommands(client) {
  const commands = [
    new SlashCommandBuilder()
      .setName('enable')
      .setDescription('Enable bot in this channel')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('disable')
      .setDescription('Disable bot in this channel')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Check if the bot is enabled in this channel')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('behaviour')
      .setDescription('Choose the chatbot behaviour for yourself')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Choose a dere type')
          .setRequired(true)
          .addChoices(
            { name: 'Tsundere', value: 'tsundere' },
            { name: 'Kuudere', value: 'kuudere' },
            { name: 'Yandere', value: 'yandere' },
            { name: 'Idol-dere', value: 'idol-dere' },
            { name: 'Bakadere', value: 'bakadere' },
            { name: 'Himedere', value: 'himedere' }
          )
      )
      .toJSON()
  ];
  const rest = new REST({ version: '10' }).setToken(process.env.CHATBOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
  } catch (error) {
    console.error('Error registering slash command:', error);
  }
}

// === Event Handlers ===
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await registerSlashCommands(client);
});


client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const channelId = interaction.channel.id;
  const guildId = interaction.guildId;
  const key = makeKey(guildId, channelId);
  switch (interaction.commandName) {
    case 'enable': {
      let enabled = getEnabledChannels();
      if (!enabled.includes(key)) {
        enabled.push(key);
        setEnabledChannels(enabled);
        await interaction.reply('Bot enabled in this channel!');
      } else {
        await interaction.reply('Bot is already enabled in this channel!');
      }
      break;
    }
    case 'disable': {
      let enabled = getEnabledChannels();
      if (enabled.includes(key)) {
        enabled = enabled.filter(id => id !== key);
        setEnabledChannels(enabled);
        await interaction.reply('Bot disabled in this channel!');
      } else {
        await interaction.reply('Bot is already disabled in this channel!');
      }
      break;
    }
    case 'status': {
      const channelId = interaction.channel.id;
      const guildId = interaction.guildId;
      const key = makeKey(guildId, channelId);
      const enabled = getEnabledChannels();
      if (enabled.includes(key)) {
        await interaction.reply('Bot is **enabled** in this channel!');
      } else {
        await interaction.reply('Bot is **disabled** in this channel.');
      }
      break;
    }
    case 'behaviour': {
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const behaviour = interaction.options.getString('type');
      setUserBehaviourForGuild(guildId, userId, behaviour);
      await interaction.reply(`Your behaviour is now set to **${behaviour}**!`);
      break;
    }
    default:
      break;
  }
});



client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // Ignore DMs

  // Check bot permissions
  const botMember = await message.guild.members.fetchMe();
  const botPermissions = message.channel.permissionsFor(botMember);
  if (!botPermissions || !botPermissions.has('SendMessages')) return;

  // Check if bot is enabled in this channel
  const enabled = getEnabledChannels();
  const key = makeKey(message.guild.id, message.channel.id);
  if (!enabled.includes(key)) return;

  // Check user behaviour (per guild)
  const behaviour = getUserBehaviourForGuild(message.guild.id, message.author.id);
  if (!behaviour) {
    await message.reply('Please choose a behaviour with /behaviour before chatting with me!');
    return;
  }

  // Prepare user and bot names
  const userMessage = message.content.trim();
  if (!userMessage) return;
  const username = message.member?.displayName || message.author.username;
  let botname = client.user.username;
  try {
    const botMember = await message.guild.members.fetch(client.user.id);
    botname = botMember.displayName || client.user.username;
  } catch {}

  // Conversation history (per user per channel)
  const convoKey = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
  let convoHistory = getConversationHistory();
  if (!convoHistory[convoKey]) convoHistory[convoKey] = [];
  // Add the new user message
  convoHistory[convoKey].push({ role: 'user', name: username, content: userMessage });
  // Keep only the last 6 messages (user+bot)
  if (convoHistory[convoKey].length > 6) convoHistory[convoKey] = convoHistory[convoKey].slice(-6);

  try {
    const aiReply = await askAI(userMessage, behaviour, username, botname, convoHistory[convoKey]);
    // Add bot reply to history
    convoHistory[convoKey].push({ role: 'bot', name: botname, content: aiReply });
    if (convoHistory[convoKey].length > 6) convoHistory[convoKey] = convoHistory[convoKey].slice(-6);
    setConversationHistory(convoHistory);
    await message.reply(aiReply);
  } catch (err) {
    await message.reply("Ugh, something went wrong! It's not like I wanted to help you anyway!");
    console.error(err);
  }
});


// === Start Bot ===
client.login(process.env.CHATBOT_TOKEN);

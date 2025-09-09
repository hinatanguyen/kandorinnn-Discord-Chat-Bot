// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

import { askAI } from './src/ai.js';
const userBehavioursPath = './src/user_behaviours.json';
function getUserBehaviours() {
  try {
    return JSON.parse(fs.readFileSync(userBehavioursPath, 'utf8'));
  } catch {
    return {};
  }
}
function setUserBehaviours(obj) {
  fs.writeFileSync(userBehavioursPath, JSON.stringify(obj, null, 2));
}
import fs from 'fs';
const enabledChannelsPath = './src/enabled_channels.json';
function getEnabledChannels() {
  try {
    return JSON.parse(fs.readFileSync(enabledChannelsPath, 'utf8'));
  } catch (e) {
    return [];
  }
}
function setEnabledChannels(channels) {
  fs.writeFileSync(enabledChannelsPath, JSON.stringify(channels, null, 2));
}
function makeKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });


client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register slash commands
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
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const channelId = interaction.channel.id;
  const guildId = interaction.guildId;
  const key = makeKey(guildId, channelId);
  if (interaction.commandName === 'enable') {
    let enabled = getEnabledChannels();
    if (!enabled.includes(key)) {
      enabled.push(key);
      setEnabledChannels(enabled);
      await interaction.reply('Bot enabled in this channel!');
    } else {
      await interaction.reply('Bot is already enabled in this channel!');
    }
    return;
  }
  if (interaction.commandName === 'disable') {
    let enabled = getEnabledChannels();
    if (enabled.includes(key)) {
      enabled = enabled.filter(id => id !== key);
      setEnabledChannels(enabled);
      await interaction.reply('Bot disabled in this channel!');
    } else {
      await interaction.reply('Bot is already disabled in this channel!');
    }
    return;
  }
  if (interaction.commandName === 'behaviour') {
    const userId = interaction.user.id;
    const behaviour = interaction.options.getString('type');
    let userBehaviours = getUserBehaviours();
    userBehaviours[userId] = behaviour;
    setUserBehaviours(userBehaviours);
    await interaction.reply(`Your behaviour is now set to **${behaviour}**!`);
    return;
  }
});


client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // Ignore DMs
  const botMember = await message.guild.members.fetchMe();
  const botPermissions = message.channel.permissionsFor(botMember);
  if (!botPermissions || !botPermissions.has('SendMessages')) return;

  let enabled = getEnabledChannels();
  const key = makeKey(message.guild.id, message.channel.id);
  if (!enabled.includes(key)) {
    return;
  }

  // Check user behaviour
  let userBehaviours = getUserBehaviours();
  const behaviour = userBehaviours[message.author.id];
  if (!behaviour) {
    await message.reply('Please choose a behaviour with /behaviour before chatting with me!');
    return;
  }

  const userMessage = message.content.trim();
  if (!userMessage) return;
  const username = message.member?.displayName || message.author.username;
  // Get the bot's nickname or username for this guild
  let botname = client.user.username;
  try {
    const botMember = await message.guild.members.fetch(client.user.id);
    botname = botMember.displayName || client.user.username;
  } catch {}
  try {
    const aiReply = await askAI(userMessage, behaviour, username, botname);
    await message.reply(aiReply);
  } catch (err) {
    await message.reply("Ugh, something went wrong! It's not like I wanted to help you anyway!");
    console.error(err);
  }
});

client.login(process.env.CHATBOT_TOKEN);

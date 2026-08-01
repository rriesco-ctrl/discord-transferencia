const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Obtener token de variables de entorno o GitHub Secrets
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ Error: DISCORD_TOKEN no encontrado en variables de entorno');
  console.error('📝 Configura el secret DISCORD_TOKEN en GitHub Actions o en tu archivo .env');
  process.exit(1);
}

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ] 
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Cargar comandos
const commandsPath = path.join(__dirname, 'comandos');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Comando cargado: ${command.data.name}`);
    } else {
      console.log(`⚠️ Comando inválido: ${file}`);
    }
  }
}

// Evento: Bot listo
client.once('ready', () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  🤖 Bot conectado como: ${client.user.tag}`);
  console.log(`║  📊 Servidores: ${client.guilds.cache.size}`);
  console.log(`╚════════════════════════════════════════╝\n`);
  
  client.user.setActivity('⚽ Transferencias de fútbol', { type: 'WATCHING' });
});

// Evento: Interacción (Comandos slash)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ Comando no encontrado: ${interaction.commandName}`);
    return;
  }

  // Sistema de cooldown
  if (!client.cooldowns.has(command.data.name)) {
    client.cooldowns.set(command.data.name, new Collection());
  }

  const now = Date.now();
  const timestamps = client.cooldowns.get(command.data.name);
  const defaultCooldownSeconds = 3;
  const cooldownAmount = (command.cooldown || defaultCooldownSeconds) * 1000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
    if (now < expirationTime) {
      const expiredTimestamp = Math.round(expirationTime / 1000);
      return interaction.reply({
        content: `⏱️ Por favor espera, vuelve a intentar <t:${expiredTimestamp}:R>`,
        ephemeral: true
      });
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: '❌ Hubo un error al ejecutar este comando.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ Hubo un error al ejecutar este comando.',
        ephemeral: true
      });
    }
  }
});

// Evento: Mensaje directo
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.isDMBased()) {
    console.log(`📩 DM de ${message.author.tag}: ${message.content}`);
    await message.reply('👋 ¡Hola! Soy el bot de transferencias. Usa los comandos slash (/) en el servidor. ⚽');
    return;
  }
});

// Eventos de miembro
client.on('guildMemberAdd', (member) => {
  console.log(`✅ ${member.user.tag} se unió al servidor`);
});

client.on('guildMemberRemove', (member) => {
  console.log(`❌ ${member.user.tag} salió del servidor`);
});

// Manejo de errores
process.on('unhandledRejection', error => {
  console.error('❌ Error no manejado:', error);
});

// Conectar bot
client.login(token);

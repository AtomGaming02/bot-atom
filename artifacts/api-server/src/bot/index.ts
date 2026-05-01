import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  type GuildMember,
  type Message,
  type TextChannel,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { logger } from "../lib/logger";
import { getGuildConfig, setGuildConfig } from "./config";
import { generateWelcomeCard } from "./welcome-card";

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.GuildMember],
  });

  client.once("ready", () => {
    logger.info({ tag: client.user?.tag }, "Discord bot is online");
  });

  // ── Welcome new members ──────────────────────────────────────────────────────
  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      const cfg = getGuildConfig(member.guild.id);
      const channelId = cfg.welcomeChannelId ?? process.env["DISCORD_WELCOME_CHANNEL_ID"] ?? "";
      if (!channelId) return;

      const channel = member.guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (!channel?.isTextBased()) return;

      const card = await generateWelcomeCard({
        username: member.user.username,
        avatarUrl: member.user.displayAvatarURL({ size: 256, extension: "png" }),
        memberCount: member.guild.memberCount,
        backgroundUrl: cfg.backgroundUrl,
        accentColor: cfg.embedColor,
      });

      const customMsg = cfg.welcomeMessage
        ? cfg.welcomeMessage
            .replace("{user}", `${member}`)
            .replace("{count}", String(member.guild.memberCount))
        : `Hey ${member}, welcome to **${member.guild.name}**! 🎉\nUse \`!help\` to see available commands.`;

      const attachment = new AttachmentBuilder(card, { name: "welcome.png" });
      const embed = new EmbedBuilder()
        .setColor((cfg.embedColor as `#${string}`) ?? "#5865F2")
        .setDescription(customMsg)
        .setImage("attachment://welcome.png")
        .setFooter({ text: `${member.guild.name} • ${new Date().toLocaleDateString()}` });

      await channel.send({ embeds: [embed], files: [attachment] });
      logger.info({ userId: member.user.id }, "Welcome card sent");
    } catch (err) {
      logger.error({ err }, "Failed to send welcome card");
    }
  });

  // ── Interactions (buttons + modals) ─────────────────────────────────────────
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
      await handleButton(interaction as ButtonInteraction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction as ModalSubmitInteraction);
    }
  });

  // ── Message commands ─────────────────────────────────────────────────────────
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith("!")) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    switch (command) {
      case "setup":        return void handleSetup(message);
      case "testwelcome":  return void handleTestWelcome(message);
      case "help":         return void handleHelp(message);
      case "kick":         return void handleKick(message, args);
      case "ban":     return void handleBan(message, args);
      case "mute":    return void handleMute(message, args);
      case "unmute":  return void handleUnmute(message, args);
      case "warn":    return void handleWarn(message, args);
      case "clear":   return void handleClear(message, args);
      case "ping":    return void message.reply(`Pong! Latency: **${client.ws.ping}ms**`);
    }
  });

  return client;
}

// ── Test welcome ──────────────────────────────────────────────────────────────

async function handleTestWelcome(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("You need **Manage Server** permission to test the welcome.");
    return;
  }

  const cfg = getGuildConfig(message.guild!.id);
  const channelId = cfg.welcomeChannelId ?? process.env["DISCORD_WELCOME_CHANNEL_ID"] ?? "";

  if (!channelId) {
    await message.reply("No welcome channel set. Use `!setup` → **setup Channel** first.");
    return;
  }

  const channel = message.guild!.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel?.isTextBased()) {
    await message.reply(`Could not find welcome channel <#${channelId}>. Make sure the bot has access to it.`);
    return;
  }

  await message.reply(`Sending a test welcome to <#${channelId}>...`);

  const card = await generateWelcomeCard({
    username: message.author.username,
    avatarUrl: message.author.displayAvatarURL({ size: 256, extension: "png" }),
    memberCount: message.guild!.memberCount,
    backgroundUrl: cfg.backgroundUrl,
    accentColor: cfg.embedColor,
  });

  const customMsg = cfg.welcomeMessage
    ? cfg.welcomeMessage
        .replace("{user}", `${message.author}`)
        .replace("{count}", String(message.guild!.memberCount))
    : `Hey ${message.author}, welcome to **${message.guild!.name}**! 🎉\nUse \`!help\` to see available commands.`;

  const attachment = new AttachmentBuilder(card, { name: "welcome.png" });
  const embed = new EmbedBuilder()
    .setColor((cfg.embedColor as `#${string}`) ?? "#5865F2")
    .setDescription(`${customMsg}\n\n*This is a test preview.*`)
    .setImage("attachment://welcome.png")
    .setFooter({ text: `${message.guild!.name} • ${new Date().toLocaleDateString()}` });

  await channel.send({ embeds: [embed], files: [attachment] });
}

// ── Setup panel ──────────────────────────────────────────────────────────────

async function handleSetup(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("You need **Manage Server** permission to use setup.");
    return;
  }

  const cfg = getGuildConfig(message.guild!.id);

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("Setup Your Welcome!")
    .setDescription(
      "Choose the welcome setting you need and set the channel assigned to it.\n\n" +
      "🟠 **Fully Customizable**\n" +
      "👀 **High Quality Card**\n" +
      "😍 **Dreamlike designs**"
    )
    .addFields(
      { name: "Welcome Channel", value: cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : "*Not set*", inline: true },
      { name: "Accent Color", value: cfg.embedColor ?? "#5865F2", inline: true },
      { name: "Custom Message", value: cfg.welcomeMessage ?? "*Default message*", inline: false },
      { name: "Background URL", value: cfg.backgroundUrl ?? "*Default background*", inline: false },
    )
    .setFooter({ text: "Changes apply immediately to the next welcome" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("setup_channel")
      .setLabel("setup Channel")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("setup_background")
      .setLabel("setup Background")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("setup_message")
      .setLabel("setup Message")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("setup_color")
      .setLabel("setup Color")
      .setStyle(ButtonStyle.Secondary),
  );

  await message.reply({ embeds: [embed], components: [row] });
}

async function handleButton(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const member = interaction.guild.members.cache.get(interaction.user.id);
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You need **Manage Server** permission.", ephemeral: true });
    return;
  }

  if (interaction.customId === "setup_channel") {
    const modal = new ModalBuilder()
      .setCustomId("modal_channel")
      .setTitle("Set Welcome Channel")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("channel_id")
            .setLabel("Channel ID")
            .setPlaceholder("Right-click your channel → Copy Channel ID")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);

  } else if (interaction.customId === "setup_background") {
    const modal = new ModalBuilder()
      .setCustomId("modal_background")
      .setTitle("Set Background Image")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("bg_url")
            .setLabel("Background Image URL")
            .setPlaceholder("https://example.com/background.png")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );
    await interaction.showModal(modal);

  } else if (interaction.customId === "setup_message") {
    const modal = new ModalBuilder()
      .setCustomId("modal_message")
      .setTitle("Set Welcome Message")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("welcome_msg")
            .setLabel("Custom welcome message")
            .setPlaceholder("Use {user} for username, {count} for member number")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );
    await interaction.showModal(modal);

  } else if (interaction.customId === "setup_color") {
    const modal = new ModalBuilder()
      .setCustomId("modal_color")
      .setTitle("Set Accent Color")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("hex_color")
            .setLabel("Hex color code")
            .setPlaceholder("#5865F2")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;
  const guildId = interaction.guild.id;

  if (interaction.customId === "modal_channel") {
    const channelId = interaction.fields.getTextInputValue("channel_id").trim();
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      await interaction.reply({ content: `Could not find a channel with ID \`${channelId}\`. Make sure the bot has access to it.`, ephemeral: true });
      return;
    }
    setGuildConfig(guildId, { welcomeChannelId: channelId });
    await interaction.reply({ content: `Welcome channel set to <#${channelId}>. ✅`, ephemeral: true });

  } else if (interaction.customId === "modal_background") {
    const url = interaction.fields.getTextInputValue("bg_url").trim();
    setGuildConfig(guildId, { backgroundUrl: url || undefined });
    await interaction.reply({
      content: url ? `Background set to: ${url} ✅` : "Background reset to default. ✅",
      ephemeral: true,
    });

  } else if (interaction.customId === "modal_message") {
    const msg = interaction.fields.getTextInputValue("welcome_msg").trim();
    setGuildConfig(guildId, { welcomeMessage: msg || undefined });
    await interaction.reply({
      content: msg ? `Welcome message set to: *${msg}* ✅` : "Welcome message reset to default. ✅",
      ephemeral: true,
    });

  } else if (interaction.customId === "modal_color") {
    const hex = interaction.fields.getTextInputValue("hex_color").trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      await interaction.reply({ content: "Invalid hex color. Use format `#RRGGBB` (e.g. `#5865F2`)", ephemeral: true });
      return;
    }
    setGuildConfig(guildId, { embedColor: hex });
    await interaction.reply({ content: `Accent color set to **${hex}** ✅`, ephemeral: true });
  }
}

// ── Help ─────────────────────────────────────────────────────────────────────

async function handleHelp(message: Message) {
  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("Admin Bot Commands")
    .addFields(
      {
        name: "⚙️ Setup",
        value: "`!setup` — Open the welcome customization panel",
      },
      {
        name: "🔨 Moderation",
        value: [
          "`!kick @user [reason]` — Kick a member",
          "`!ban @user [reason]` — Ban a member",
          "`!mute @user [reason]` — Timeout for 10 minutes",
          "`!unmute @user` — Remove timeout",
          "`!warn @user [reason]` — DM a warning",
          "`!clear [amount]` — Delete messages (default 10, max 100)",
        ].join("\n"),
      },
      {
        name: "🛠️ Utility",
        value: ["`!ping` — Bot latency", "`!help` — This menu"].join("\n"),
      }
    )
    .setFooter({ text: "Moderation commands require appropriate permissions" });

  await message.reply({ embeds: [embed] });
}

// ── Moderation commands ───────────────────────────────────────────────────────

async function handleKick(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers)) {
    return void message.reply("You don't have permission to kick members.");
  }
  const target = message.mentions.members?.first();
  if (!target) return void message.reply("Usage: `!kick @user [reason]`");
  if (!target.kickable) return void message.reply("I cannot kick that member.");
  const reason = args.slice(1).join(" ") || "No reason provided";
  await target.kick(reason);
  await message.reply({ embeds: [modEmbed("Kicked", target.user.tag, reason, message.author.tag, 0xed4245)] });
  logger.info({ target: target.user.id, reason }, "Member kicked");
}

async function handleBan(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers)) {
    return void message.reply("You don't have permission to ban members.");
  }
  const target = message.mentions.members?.first();
  if (!target) return void message.reply("Usage: `!ban @user [reason]`");
  if (!target.bannable) return void message.reply("I cannot ban that member.");
  const reason = args.slice(1).join(" ") || "No reason provided";
  await target.ban({ reason });
  await message.reply({ embeds: [modEmbed("Banned", target.user.tag, reason, message.author.tag, 0xed4245)] });
  logger.info({ target: target.user.id, reason }, "Member banned");
}

async function handleMute(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return void message.reply("You don't have permission to timeout members.");
  }
  const target = message.mentions.members?.first();
  if (!target) return void message.reply("Usage: `!mute @user [reason]`");
  if (!target.moderatable) return void message.reply("I cannot timeout that member.");
  const reason = args.slice(1).join(" ") || "No reason provided";
  await target.timeout(10 * 60 * 1000, reason);
  await message.reply({ embeds: [modEmbed("Muted (10 min)", target.user.tag, reason, message.author.tag, 0xfee75c)] });
}

async function handleUnmute(message: Message, _args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return void message.reply("You don't have permission to remove timeouts.");
  }
  const target = message.mentions.members?.first();
  if (!target) return void message.reply("Usage: `!unmute @user`");
  await target.timeout(null);
  await message.reply(`Removed timeout from **${target.user.tag}**.`);
}

async function handleWarn(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return void message.reply("You don't have permission to warn members.");
  }
  const target = message.mentions.members?.first();
  if (!target) return void message.reply("Usage: `!warn @user [reason]`");
  const reason = args.slice(1).join(" ") || "No reason provided";
  try {
    await target.user.send(`You have received a warning in **${message.guild!.name}**.\n**Reason:** ${reason}`);
  } catch {
    logger.warn({ userId: target.user.id }, "Could not DM warning");
  }
  await message.reply({ embeds: [modEmbed("Warned", target.user.tag, reason, message.author.tag, 0xfee75c)] });
}

async function handleClear(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return void message.reply("You don't have permission to delete messages.");
  }
  if (!message.channel.isTextBased() || !("bulkDelete" in message.channel)) {
    return void message.reply("This command can only be used in server text channels.");
  }
  const amount = Math.min(parseInt(args[0] ?? "10", 10) || 10, 100);
  const channel = message.channel as TextChannel;
  const deleted = await channel.bulkDelete(amount, true);
  const reply = await message.channel.send(`Deleted **${deleted.size}** message(s).`);
  setTimeout(() => reply.delete().catch(() => {}), 5000);
}

function modEmbed(action: string, user: string, reason: string, mod: string, color: number) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Member ${action}`)
    .addFields(
      { name: "User", value: user, inline: true },
      { name: "Reason", value: reason, inline: true },
      { name: "Moderator", value: mod, inline: true }
    )
    .setTimestamp();
}

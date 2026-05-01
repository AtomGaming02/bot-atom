import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type Message,
  type TextChannel,
} from "discord.js";
import { logger } from "../lib/logger";

const WELCOME_CHANNEL_ID = process.env["DISCORD_WELCOME_CHANNEL_ID"] ?? "";
const GUILD_ID = process.env["DISCORD_GUILD_ID"] ?? "";

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,      // Privileged — enable in Dev Portal
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,    // Privileged — enable in Dev Portal
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.GuildMember],
  });

  client.once("ready", () => {
    logger.info({ tag: client.user?.tag }, "Discord bot is online");
  });

  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      if (member.guild.id !== GUILD_ID) return;

      const channel = member.guild.channels.cache.get(
        WELCOME_CHANNEL_ID
      ) as TextChannel | undefined;

      if (!channel || !channel.isTextBased()) {
        logger.warn({ channelId: WELCOME_CHANNEL_ID }, "Welcome channel not found or not text-based");
        return;
      }

      const memberCount = member.guild.memberCount;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Welcome to ${member.guild.name}!`)
        .setDescription(
          `Hey ${member}, glad you're here! You are member **#${memberCount}**.\n\n` +
            `Use \`!help\` to see available commands.`
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `${member.guild.name} • ${new Date().toLocaleDateString()}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      logger.info({ userId: member.user.id, guild: member.guild.id }, "Welcome message sent");
    } catch (err) {
      logger.error({ err }, "Failed to send welcome message");
    }
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith("!")) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (command === "help") {
      await handleHelp(message);
    } else if (command === "kick") {
      await handleKick(message, args);
    } else if (command === "ban") {
      await handleBan(message, args);
    } else if (command === "mute") {
      await handleMute(message, args);
    } else if (command === "unmute") {
      await handleUnmute(message, args);
    } else if (command === "warn") {
      await handleWarn(message, args);
    } else if (command === "clear") {
      await handleClear(message, args);
    } else if (command === "ping") {
      await message.reply(`Pong! Latency: **${client.ws.ping}ms**`);
    }
  });

  return client;
}

async function handleHelp(message: Message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Admin Bot Commands")
    .addFields(
      {
        name: "Moderation",
        value: [
          "`!kick @user [reason]` — Kick a member",
          "`!ban @user [reason]` — Ban a member",
          "`!mute @user [reason]` — Timeout a member for 10 minutes",
          "`!unmute @user` — Remove timeout from a member",
          "`!warn @user [reason]` — Send a warning to a member",
          "`!clear [amount]` — Delete messages (default: 10, max: 100)",
        ].join("\n"),
      },
      {
        name: "Utility",
        value: ["`!ping` — Check bot latency", "`!help` — Show this menu"].join("\n"),
      }
    )
    .setFooter({ text: "Moderation commands require appropriate permissions" });

  await message.reply({ embeds: [embed] });
}

async function handleKick(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers)) {
    await message.reply("You don't have permission to kick members.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("Please mention a member to kick. Usage: `!kick @user [reason]`");
    return;
  }

  if (!target.kickable) {
    await message.reply("I cannot kick that member (they may have a higher role than me).");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";

  try {
    await target.kick(reason);
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("Member Kicked")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: true },
        { name: "Moderator", value: message.author.tag, inline: true }
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    logger.info({ target: target.user.id, mod: message.author.id, reason }, "Member kicked");
  } catch (err) {
    logger.error({ err }, "Failed to kick member");
    await message.reply("Failed to kick the member.");
  }
}

async function handleBan(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("You don't have permission to ban members.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("Please mention a member to ban. Usage: `!ban @user [reason]`");
    return;
  }

  if (!target.bannable) {
    await message.reply("I cannot ban that member (they may have a higher role than me).");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";

  try {
    await target.ban({ reason });
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("Member Banned")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: true },
        { name: "Moderator", value: message.author.tag, inline: true }
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    logger.info({ target: target.user.id, mod: message.author.id, reason }, "Member banned");
  } catch (err) {
    logger.error({ err }, "Failed to ban member");
    await message.reply("Failed to ban the member.");
  }
}

async function handleMute(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("You don't have permission to timeout members.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("Please mention a member to mute. Usage: `!mute @user [reason]`");
    return;
  }

  if (!target.moderatable) {
    await message.reply("I cannot timeout that member.");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";
  const tenMinutes = 10 * 60 * 1000;

  try {
    await target.timeout(tenMinutes, reason);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("Member Muted (10 min)")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: true },
        { name: "Moderator", value: message.author.tag, inline: true }
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    logger.info({ target: target.user.id, mod: message.author.id, reason }, "Member muted");
  } catch (err) {
    logger.error({ err }, "Failed to mute member");
    await message.reply("Failed to mute the member.");
  }
}

async function handleUnmute(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("You don't have permission to remove timeouts.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("Please mention a member to unmute. Usage: `!unmute @user`");
    return;
  }

  try {
    await target.timeout(null);
    await message.reply(`Removed timeout from **${target.user.tag}**.`);
    logger.info({ target: target.user.id, mod: message.author.id }, "Member unmuted");
  } catch (err) {
    logger.error({ err }, "Failed to unmute member");
    await message.reply("Failed to remove the timeout.");
  }
}

async function handleWarn(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("You don't have permission to warn members.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("Please mention a member to warn. Usage: `!warn @user [reason]`");
    return;
  }

  const reason = args.slice(1).join(" ") || "No reason provided";

  try {
    await target.user.send(
      `You have received a warning in **${message.guild!.name}**.\n**Reason:** ${reason}`
    );
  } catch {
    logger.warn({ userId: target.user.id }, "Could not DM warning to user");
  }

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("Member Warned")
    .addFields(
      { name: "User", value: `${target.user.tag}`, inline: true },
      { name: "Reason", value: reason, inline: true },
      { name: "Moderator", value: message.author.tag, inline: true }
    )
    .setTimestamp();
  await message.reply({ embeds: [embed] });
  logger.info({ target: target.user.id, mod: message.author.id, reason }, "Member warned");
}

async function handleClear(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply("You don't have permission to delete messages.");
    return;
  }

  const amount = Math.min(parseInt(args[0] ?? "10", 10) || 10, 100);
  if (!message.channel.isTextBased() || !("bulkDelete" in message.channel)) {
    await message.reply("This command can only be used in server text channels.");
    return;
  }
  const channel = message.channel as TextChannel;

  try {
    const deleted = await channel.bulkDelete(amount, true);
    const reply = await message.channel.send(
      `Deleted **${deleted.size}** message(s).`
    );
    setTimeout(() => reply.delete().catch(() => {}), 5000);
    logger.info({ channel: channel.id, amount: deleted.size, mod: message.author.id }, "Messages cleared");
  } catch (err) {
    logger.error({ err }, "Failed to clear messages");
    await message.reply("Failed to delete messages (messages older than 14 days cannot be bulk deleted).");
  }
}

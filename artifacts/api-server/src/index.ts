import app from "./app";
import { logger } from "./lib/logger";
import { createBot } from "./bot/index";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const token = process.env["DISCORD_BOT_TOKEN"];

if (!token) {
  logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
} else {
  const bot = createBot();
  bot.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });
}

import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";
import { logger } from "../lib/logger";

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await axios.get<Buffer>(url, {
      responseType: "arraybuffer",
      timeout: 8000,
    });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

export interface WelcomeCardOptions {
  username: string;
  avatarUrl: string;
  serverName: string;
  memberCount: number;
  backgroundUrl?: string;
  customMessage?: string;
  accentColor?: string;
}

export async function generateWelcomeCard(opts: WelcomeCardOptions): Promise<Buffer> {
  const WIDTH = 800;
  const HEIGHT = 300;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const accent = opts.accentColor ?? "#5865F2";

  // ── Background ──────────────────────────────────────────────────────────────
  if (opts.backgroundUrl) {
    const bgBuf = await fetchImageBuffer(opts.backgroundUrl);
    if (bgBuf) {
      try {
        const bg = await loadImage(bgBuf);
        ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
        // Dark overlay so text is always readable
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } catch {
        drawDefaultBackground(ctx, WIDTH, HEIGHT, accent);
      }
    } else {
      drawDefaultBackground(ctx, WIDTH, HEIGHT, accent);
    }
  } else {
    drawDefaultBackground(ctx, WIDTH, HEIGHT, accent);
  }

  // ── Accent bar on left ───────────────────────────────────────────────────────
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 6, HEIGHT);

  // ── Avatar circle ────────────────────────────────────────────────────────────
  const avatarX = 90;
  const avatarY = HEIGHT / 2;
  const avatarR = 65;

  // Glow ring
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 4, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Avatar image
  const avatarBuf = await fetchImageBuffer(opts.avatarUrl);
  if (avatarBuf) {
    try {
      const avatar = await loadImage(avatarBuf);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
    } catch {
      logger.warn("Failed to load avatar image");
    }
  }

  // ── Text ─────────────────────────────────────────────────────────────────────
  const textX = 190;

  // Server name / title
  ctx.font = "bold 38px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 6;
  ctx.fillText(opts.serverName.toUpperCase(), textX, HEIGHT / 2 - 40);

  // WELCOME label
  ctx.font = "bold 52px Arial, sans-serif";
  ctx.fillStyle = accent;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 10;
  ctx.fillText("WELCOME", textX, HEIGHT / 2 + 15);

  // Custom message or member count
  const subText = opts.customMessage
    ? opts.customMessage.replace("{user}", opts.username).replace("{count}", String(opts.memberCount))
    : `YOU ARE MEMBER #${opts.memberCount}`;

  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(subText.toUpperCase(), textX, HEIGHT / 2 + 55);

  // Username at the bottom
  ctx.font = "18px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 0;
  ctx.fillText(`@${opts.username}`, textX, HEIGHT - 28);

  return canvas.toBuffer("image/png");
}

function drawDefaultBackground(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  width: number,
  height: number,
  accent: string
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f0f23");
  gradient.addColorStop(0.5, "#1a1a3e");
  gradient.addColorStop(1, "#0d0d1a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid dots
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let x = 0; x < width; x += 30) {
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Glow blob behind avatar area
  const radial = ctx.createRadialGradient(90, height / 2, 0, 90, height / 2, 160);
  radial.addColorStop(0, `${accent}33`);
  radial.addColorStop(1, "transparent");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);
}

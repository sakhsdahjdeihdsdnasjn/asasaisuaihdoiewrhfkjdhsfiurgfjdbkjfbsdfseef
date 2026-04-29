import { Bot } from "grammy";
import { config } from "dotenv";
import { nanoid } from "nanoid";
import { initDB, saveKey, getKey, markKeyUsed, loadKeys, getKeyStats, getRecentKeys, getPostedFilecodes } from "./db.js";
import { shortenLink } from "./shorten.js";
import { fetchDoodFiles, buildDoodUrl } from "./doodstream.js";
import { startScheduler } from "./scheduler.js";
import { initStatusTable, getStatus, setStatus, clearStatus, isMaintenance, setMaintenance } from "./status.js";

config();

export const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);

const isAdmin = (ctx) => ctx.from.id === ADMIN_ID;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const generateAndPost = async (filecode, title, thumbnail) => {
  const key = nanoid(8).toUpperCase();
  const botUsername = (await bot.api.getMe()).username;
  const deepLink = `https://t.me/${botUsername}?start=${key}`;
  const shrinkLink = await shortenLink(deepLink);
  const doodUrl = buildDoodUrl(filecode);

  await saveKey(key, {
    content: doodUrl,
    filecode,
    title: title || filecode,
    used: false,
    createdAt: new Date().toISOString(),
  });

  const caption = `🎬 <b>${title || "Video Baru!"}</b>\n\n📥 Download di sini:\n${shrinkLink}`;

  if (thumbnail) {
    await bot.api.sendPhoto(process.env.CHANNEL_ID, thumbnail, {
      caption,
      parse_mode: "HTML",
    });
  } else {
    await bot.api.sendMessage(process.env.CHANNEL_ID, caption, {
      parse_mode: "HTML",
    });
  }

  return { key, shrinkLink, doodUrl };
};

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

// /start
bot.command("start", async (ctx) => {
  const key = ctx.match?.trim();

  // Cek maintenance dulu
  const maintenance = await isMaintenance();
  if (maintenance) {
    return ctx.reply("🔧 Bot sedang dalam maintenance. Coba lagi nanti ya~");
  }

  // Tampilkan warning kalau ada
  const warning = await getStatus();

  if (!key) {
    const msg = warning
      ? `Haii! 🐦 Kamu butuh link valid dari channel ya~\n\n⚠️ <b>Info:</b> ${warning}`
      : `Haii! 🐦 Kamu butuh link valid dari channel ya~`;
    return ctx.reply(msg, { parse_mode: "HTML" });
  }

  const keyData = await getKey(key);
  if (!keyData) return ctx.reply("❌ Key tidak valid.");
  if (keyData.used) return ctx.reply("❌ Key sudah digunakan.");

  await markKeyUsed(key, ctx.from.id);

  let replyMsg = `✅ <b>${keyData.title}</b>\n\n🔗 Link:\n${keyData.content}\n\n⚠️ Jangan share ya~`;
  if (warning) replyMsg += `\n\n📢 <i>${warning}</i>`;

  await ctx.reply(replyMsg, { parse_mode: "HTML" });
});

// /post
bot.command("post", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  const input = ctx.match?.trim();
  if (!input) return ctx.reply("Usage: /post <doodstream_filecode_atau_url>");

  const urlMatch = input.match(
    /dood(?:stream\.com|\.(?:watch|re|la|so|to))\/(?:e|d|f)\/([a-zA-Z0-9]+)/,
  );
  const filecode = urlMatch ? urlMatch[1] : input;

  await ctx.reply("⏳ Generating...");

  try {
    const { key, shrinkLink, doodUrl } = await generateAndPost(filecode, null, null);
    await ctx.reply(
      `✅ <b>Berhasil Post!</b>\n\n🔑 Key: <code>${key}</code>\n📦 URL: <code>${doodUrl}</code>\n🔗 Link Channel:\n${shrinkLink}`,
      { parse_mode: "HTML" },
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(`❌ Gagal post: ${e.message}`);
  }
});

// /autopick
bot.command("autopick", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  await ctx.reply("⏳ Mengambil video dari Doodstream...");

  try {
    const result = await runAutoPost();
    if (!result) {
      return ctx.reply("⚠️ Semua video sudah pernah diposting atau tidak ada video baru.");
    }
    await ctx.reply(
      `✅ Auto-post berhasil!\n\n🎬 <b>${result.title}</b>\n🔑 Key: <code>${result.key}</code>\n🔗 ${result.shrinkLink}`,
      { parse_mode: "HTML" },
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(`❌ Gagal autopick: ${e.message}`);
  }
});

// /setstatus — set warning message
bot.command("setstatus", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  const msg = ctx.match?.trim();
  if (!msg) return ctx.reply("Usage: /setstatus <pesan>\nContoh: /setstatus Kami update konten setiap 6 jam sekali.");

  await setStatus(msg);
  await ctx.reply(`✅ Status di-set:\n\n📢 <i>${msg}</i>`, { parse_mode: "HTML" });
});

// /clearstatus — hapus warning
bot.command("clearstatus", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  await clearStatus();
  await ctx.reply("✅ Status/warning dihapus.");
});

// /maintenance — toggle maintenance mode
bot.command("maintenance", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  const current = await isMaintenance();
  await setMaintenance(!current);

  await ctx.reply(
    !current
      ? "🔧 Maintenance mode <b>ON</b> — semua user akan dapat pesan maintenance."
      : "✅ Maintenance mode <b>OFF</b> — bot kembali normal.",
    { parse_mode: "HTML" }
  );
});

// /schedule
bot.command("schedule", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  const input = ctx.match?.trim();
  const { getInterval, setInterval: setSchInterval, getNextRun } = await import("./scheduler.js");

  if (!input) {
    const interval = getInterval();
    const nextRun = getNextRun();
    return ctx.reply(
      `⏰ <b>Scheduler Info</b>\n\nInterval: <b>${interval} jam</b>\nNext run: <b>${nextRun ? nextRun.toLocaleString("id-ID") : "—"}</b>\n\nUntuk ubah: /schedule &lt;jam&gt;\nContoh: /schedule 6`,
      { parse_mode: "HTML" },
    );
  }

  const hours = parseInt(input);
  if (isNaN(hours) || hours < 1 || hours > 168) {
    return ctx.reply("❌ Masukkan angka jam yang valid (1–168).");
  }

  setSchInterval(hours);
  await ctx.reply(
    `✅ Interval diubah ke <b>${hours} jam</b>. Scheduler di-restart.`,
    { parse_mode: "HTML" },
  );
});

// /keys
bot.command("keys", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  const recent = await getRecentKeys(20);
  if (recent.length === 0) return ctx.reply("Belum ada key.");

  const stats = await getKeyStats();
  const text = recent
    .map(
      ({ key, title, used, usedAt }) =>
        `🔑 <code>${key}</code> <b>${title?.substring(0, 20) || "—"}</b> — ${used ? `✅ <i>${usedAt?.substring(0, 10)}</i>` : "⏳ Belum"}`,
    )
    .join("\n");

  await ctx.reply(
    `<b>Keys (${stats.total} total, showing last 20):</b>\n\n${text}`,
    { parse_mode: "HTML" },
  );
});

// /stats
bot.command("stats", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ Lo bukan admin.");

  const { total, used, unused } = await getKeyStats();
  await ctx.reply(
    `📊 <b>Statistik</b>\n\nTotal key: <b>${total}</b>\nTerpakai: <b>${used}</b>\nBelum: <b>${unused}</b>`,
    { parse_mode: "HTML" },
  );
});

// ─── AUTO-POST ────────────────────────────────────────────────────────────────

export const runAutoPost = async () => {
  const files = await fetchDoodFiles();
  if (!files || files.length === 0) return null;

  const postedFilecodes = await getPostedFilecodes();
  const newFile = files.find((f) => !postedFilecodes.has(f.filecode));
  if (!newFile) return null;

  const result = await generateAndPost(newFile.filecode, newFile.title, newFile.thumbnail);
  return { ...result, title: newFile.title };
};

// ─── INIT & START ─────────────────────────────────────────────────────────────

const init = async () => {
  await initDB();
  await initStatusTable();
  startScheduler();
  bot.start();
  console.log("🤖 Bot started!");
};

init().catch(console.error);
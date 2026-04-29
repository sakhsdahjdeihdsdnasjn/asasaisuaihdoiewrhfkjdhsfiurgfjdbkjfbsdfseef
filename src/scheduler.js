import { runAutoPost } from "./bot.js";

let intervalHours = Number(process.env.SCHEDULER_INTERVAL_HOURS) || 6;
let nextRun = null;
let timerId = null;

export const getInterval = () => intervalHours;
export const getNextRun = () => nextRun;

export const setInterval = (hours) => {
  intervalHours = hours;
  restartScheduler();
};

const tick = async () => {
  console.log(`[Scheduler] Tick at ${new Date().toISOString()}`);

  try {
    const result = await runAutoPost();
    if (!result) {
      console.log("[Scheduler] No new files to post.");
    } else {
      console.log(`[Scheduler] Posted: ${result.title} → ${result.shrinkLink}`);
    }
  } catch (e) {
    console.error("[Scheduler] Error:", e.message);
  }

  nextRun = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
  timerId = setTimeout(tick, intervalHours * 60 * 60 * 1000);
};

const restartScheduler = () => {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  console.log(`[Scheduler] (Re)starting with interval: ${intervalHours}h`);
  timerId = setTimeout(tick, intervalHours * 60 * 60 * 1000);
  nextRun = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
  console.log(`[Scheduler] First run scheduled: ${nextRun.toISOString()}`);
};

export const startScheduler = () => restartScheduler();
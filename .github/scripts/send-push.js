const fs = require("fs");

const START_DATE = "2026-03-04";
const SHUFFLE_SEED = "asya-tema-seed-v1";

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

if (!appId || !apiKey) {
  throw new Error("Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY");
}

const phrases = JSON.parse(fs.readFileSync("./phrases.json", "utf8"));

function daysSinceStart(startDateString) {
  const start = new Date(startDateString + "T00:00:00");
  const now = new Date();

  const utcToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));

  const utcStart = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  ));

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((utcToday - utcStart) / msPerDay));
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let a = seed >>> 0;
  return function() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIndices(length, cycleNumber) {
  const arr = Array.from({ length }, (_, i) => i);
  const seed = hashString(`${SHUFFLE_SEED}-${cycleNumber}-${length}`);
  const rand = createRng(seed);

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTodayPhrase() {
  const total = phrases.length;
  const dayOffset = daysSinceStart(START_DATE);
  const cycleNumber = Math.floor(dayOffset / total);
  const position = dayOffset % total;
  const order = shuffledIndices(total, cycleNumber);
  return phrases[order[position]];
}

async function sendPush() {
  const message = getTodayPhrase();

  const response = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ["Total Subscriptions"],
      headings: { en: "a message from asya" },
      contents: { en: message }
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OneSignal error: ${response.status} ${text}`);
  }

  console.log(text);
}

sendPush().catch((err) => {
  console.error(err);
  process.exit(1);
});

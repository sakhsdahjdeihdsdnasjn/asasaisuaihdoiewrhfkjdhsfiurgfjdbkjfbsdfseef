import { nanoid } from "nanoid";
import { readFileSync, writeFileSync } from "fs";

const KEYS_FILE = "./data/keys.json";

const [,, link] = process.argv;

if (!link) {
  console.log("Usage: node src/admin.js <doodstream-link>");
  process.exit(1);
}

const keys = JSON.parse(readFileSync(KEYS_FILE, "utf-8"));
const key = nanoid(8).toUpperCase();

keys[key] = { link, used: false, createdAt: new Date().toISOString() };
writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));

console.log(`✅ Key generated: ${key}`);
const fs = require("fs");
const path = require("path");

const PRESETS_DIR = path.join(__dirname, "..", "presets");

const PRESETS = {};

const files = fs.readdirSync(PRESETS_DIR).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  throw new Error(
    `No preset JSON files found in ${PRESETS_DIR}. ` +
      "Create at least one .json file (e.g. receptionist.json) with { instructions, openingMessage, voiceName }."
  );
}

for (const file of files) {
  const name = path.basename(file, ".json");
  const data = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), "utf8"));
  PRESETS[name] = data;
}

console.log(`Loaded ${files.length} preset(s): ${Object.keys(PRESETS).join(", ")}`);

const DEFAULT_PRESET = "receptionist";

module.exports = { PRESETS, DEFAULT_PRESET };

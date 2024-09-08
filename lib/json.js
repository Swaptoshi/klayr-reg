import fs from "fs";
import path from "path";

export function loadJson(jsonPath) {
  const absPath = path.resolve(jsonPath);
  if (fs.existsSync(absPath)) {
    return JSON.parse(fs.readFileSync(absPath, "utf-8"));
  }
  return {};
}

// Snapshots the git history into data/commits.json so the Build Map can read it
// at runtime, where the git directory is not available.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = execFileSync(
  "git",
  ["log", "--reverse", "--pretty=%h%x1f%aI%x1f%s"],
  { encoding: "utf8" },
);

const commits = raw
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const [hash, isoDate, subject] = line.split("\u001f");
    return { hash, isoDate, subject };
  });

mkdirSync("data", { recursive: true });
writeFileSync("data/commits.json", `${JSON.stringify(commits, null, 2)}\n`);
console.log(`wrote data/commits.json with ${commits.length} commits`);

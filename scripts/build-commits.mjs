// Snapshots the git history into data/commits.json so the Build Map can read it
// at runtime, where the git directory is not available.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = execFileSync(
  "git",
  ["log", "--reverse", "--pretty=%h%x1f%aI%x1f%s%x1f%B%x1e"],
  { encoding: "utf8" },
);

const commits = raw
  .split("\u001e")
  .filter((record) => record.trim() !== "")
  .map((record) => {
    record = record.replace(/^(?:\r?\n)+/, "");
    const [hash, isoDate, subject, message] = record.split("\u001f");
    const rest = message.startsWith(subject)
      ? message.slice(subject.length)
      : message;
    // Trailers such as Co-Authored-By are metadata, not part of the story on the map.
    const body = rest
      .split("\n")
      .filter((line) => !/^[A-Za-z-]+:\s/.test(line.trim()))
      .join("\n")
      .replace(/^(?:\r?\n)+/, "")
      .trimEnd();
    return { hash, isoDate, subject, body };
  });

mkdirSync("data", { recursive: true });
writeFileSync("data/commits.json", `${JSON.stringify(commits, null, 2)}\n`);
console.log(`wrote data/commits.json with ${commits.length} commits`);

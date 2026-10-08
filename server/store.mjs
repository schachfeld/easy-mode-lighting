import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

export class Store {
  constructor(directory, file, initial) {
    mkdirSync(directory, { recursive: true });
    this.path = join(directory, file);
    try {
      this.data = JSON.parse(readFileSync(this.path, "utf8"));
      if (!Array.isArray(this.data.scenes))
        throw new Error("Invalid scenes file.");
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          `Cannot read saved scenes at ${this.path}. Restore the file from a backup before starting Glow.`,
          { cause: error },
        );
      this.save(initial);
    }
  }
  save(data) {
    writeFileSync(`${this.path}.tmp`, JSON.stringify(data, null, 2), {
      mode: 0o600,
    });
    renameSync(`${this.path}.tmp`, this.path);
    this.data = data;
  }
}

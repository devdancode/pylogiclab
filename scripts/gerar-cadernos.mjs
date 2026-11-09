import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildExerciseNotebook } from "../lib/notebook.mjs";

const folder = new URL("../cadernos/", import.meta.url);
const curriculum = JSON.parse(
  await readFile(new URL("../content/curriculum.json", import.meta.url), "utf8")
);
await mkdir(folder, { recursive: true });
for (const [i, module] of curriculum.entries()) {
  for (const [j, lesson] of module.lessons.entries()) {
    const filename = "m" + (i + 1) + "-a" + (j + 1) + "-ex.ipynb";
    const notebook = buildExerciseNotebook(lesson.exercise);
    await writeFile(new URL(filename, folder), JSON.stringify(notebook, null, 2) + "\n");
  }
}

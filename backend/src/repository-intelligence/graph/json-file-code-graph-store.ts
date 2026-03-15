import { promises as fs } from "node:fs";
import path from "node:path";
import { CodeGraph } from "./code-graph";

export class JsonFileCodeGraphStore {
  async save(filePath: string, graph: CodeGraph): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(graph.toSnapshot(), null, 2), "utf8");
  }

  async load(filePath: string): Promise<CodeGraph> {
    const content = await fs.readFile(filePath, "utf8");
    const snapshot = JSON.parse(content) as Parameters<typeof CodeGraph.fromSnapshot>[0];
    return CodeGraph.fromSnapshot(snapshot);
  }
}

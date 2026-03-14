import {
  applyPatchTool,
  createFileTool,
  deleteFileTool,
  getFileInfoTool,
  listDirectoryTool,
  moveFileTool,
  readFileTool,
  runCommandTool,
  searchCodeTool,
  writeFileTool,
} from "./core";
import { ToolRegistry } from "./tool-registry";

export * from "./tool-call-store";
export * from "./core";
export * from "./tool-errors";
export * from "./tool-executor";
export * from "./tool-registry";
export * from "./tool-sandbox";
export * from "./tool-types";
export * from "./tool-utils";

export function createCoreTools() {
  return [
    readFileTool,
    writeFileTool,
    listDirectoryTool,
    searchCodeTool,
    applyPatchTool,
    runCommandTool,
    createFileTool,
    deleteFileTool,
    moveFileTool,
    getFileInfoTool,
  ];
}

export function createCoreToolRegistry(): ToolRegistry {
  return new ToolRegistry().registerMany(createCoreTools());
}

import { ToolNotFoundError } from "./tool-errors";
import type { Tool, ToolDescriptor, ToolExecutionContext } from "./tool-types";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }

    this.tools.set(tool.name, tool);
    return this;
  }

  registerMany(tools: Tool[]): this {
    for (const tool of tools) {
      this.register(tool);
    }

    return this;
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  get(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  getOrThrow(toolName: string): Tool {
    const tool = this.get(toolName);

    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    return tool;
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }));
  }

  async invoke(toolName: string, input: unknown, context: ToolExecutionContext): Promise<unknown> {
    const tool = this.getOrThrow(toolName);
    return tool.execute(input, context);
  }
}

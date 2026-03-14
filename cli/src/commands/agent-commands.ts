import { Command } from "commander";
import { createRuntime } from "../runtime";
import type { CliAppDependencies } from "../runtime";

export function registerAgentCommands(program: Command, dependencies: CliAppDependencies): void {
  program
    .command("agents [id]")
    .description("List agents or show a specific agent")
    .option("--session <id>", "Explicit session ID")
    .action(async (agentId, options, command) => {
      const runtime = await createRuntime(command, dependencies);

      if (agentId) {
        const agent = await runtime.apiClient.getAgent(agentId);
        runtime.renderer.printRecord("Agent", {
          id: agent.id,
          session_id: agent.sessionId,
          role: agent.role,
          display_name: agent.displayName,
          state: agent.state,
          room: agent.room,
          current_task_id: agent.currentTaskId ?? "",
        });
        return;
      }

      const agents = await runtime.apiClient.listAgents({
        sessionId: options.session ?? runtime.state.currentSessionId,
      });

      runtime.renderer.printTable(
        "Agents",
        [
          { key: "id", label: "ID" },
          { key: "displayName", label: "Name" },
          { key: "role", label: "Role" },
          { key: "state", label: "State" },
          { key: "room", label: "Room" },
        ],
        agents
      );
    });
}

import { Command } from "commander";
import { CliCommandError, createRuntime, requireCurrentSessionId } from "../runtime";
import type { CliAppDependencies } from "../runtime";

function createTaskName(description: string): string {
  const normalizedDescription = description.trim();

  if (normalizedDescription.length <= 72) {
    return normalizedDescription;
  }

  return `${normalizedDescription.slice(0, 69)}...`;
}

export function registerTaskCommands(program: Command, dependencies: CliAppDependencies): void {
  const taskCommand = program.command("task").description("Manage tasks");

  taskCommand
    .command("create <description>")
    .description("Create a task in the current session")
    .option("--session <id>", "Explicit session ID")
    .option("--priority <priority>", "Task priority", "medium")
    .option("--type <type>", "Task type")
    .action(async (description, options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const sessionId = requireCurrentSessionId(runtime, options.session);
      const spinner = runtime.createSpinner();
      spinner.start("Creating task...");

      try {
        const task = await runtime.apiClient.createTask({
          sessionId,
          name: createTaskName(description),
          description,
          priority: options.priority,
          taskType: options.type,
        });
        spinner.succeed("Task created.");
        runtime.renderer.printRecord("Task", {
          id: task.id,
          session_id: task.sessionId,
          name: task.name,
          status: task.status,
          priority: task.priority,
          type: task.taskType ?? "",
        });
      } catch (error) {
        spinner.fail("Failed to create task.");
        throw error;
      }
    });

  taskCommand
    .command("list")
    .description("List tasks")
    .option("--session <id>", "Explicit session ID")
    .action(async (options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const sessionId = options.session ?? runtime.state.currentSessionId;
      const tasks = await runtime.apiClient.listTasks({
        sessionId,
      });

      runtime.renderer.printTable(
        "Tasks",
        [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "sessionId", label: "Session" },
        ],
        tasks
      );
    });

  taskCommand
    .command("status <id>")
    .description("Show task details")
    .action(async (taskId, _options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const task = await runtime.apiClient.getTask(taskId);

      runtime.renderer.printRecord("Task", {
        id: task.id,
        session_id: task.sessionId,
        name: task.name,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        type: task.taskType ?? "",
        started_at: task.startedAt ?? "",
        completed_at: task.completedAt ?? "",
      });
    });

  taskCommand
    .command("cancel <id>")
    .description("Cancel a task")
    .action(async (taskId, _options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const spinner = runtime.createSpinner();
      spinner.start(`Cancelling task ${taskId}...`);

      try {
        const task = await runtime.apiClient.updateTask(taskId, {
          status: "cancelled",
        });
        spinner.succeed(`Task ${task.id} cancelled.`);
        runtime.renderer.printRecord("Task", {
          id: task.id,
          status: task.status,
        });
      } catch (error) {
        spinner.fail(`Failed to cancel task ${taskId}.`);
        throw error;
      }
    });

  taskCommand.action(() => {
    throw new CliCommandError("Use a task subcommand. Run `ai-office task help` for details.");
  });
}

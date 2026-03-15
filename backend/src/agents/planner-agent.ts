import { AgentRole, TaskPriority } from "@prisma/client";
import type { JsonValue } from "@ai-office/shared";
import { RoleAgent } from "./role-agent";
import {
  readBoolean,
  readString,
  readStringArray,
  toSlug,
  uniqueStrings,
  type JsonRecord,
} from "./task-io";
import type { AgentExecutionContext } from "./types";

const plannerSystemPrompt = [
  "You are the planner agent for the AI Office engineering system.",
  "Turn broad requests into an ordered task graph with explicit ownership, priorities, and dependencies.",
  "Bias toward clear execution slices, repo understanding before edits, and validation after implementation.",
].join(" ");

const fileReferencePattern = /(?:^|[\s(])([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?=$|[\s),.;:])/g;

type IntentUrgency = "low" | "medium" | "high" | "critical";

export type PlannerIntent = {
  rawRequest: string;
  normalizedRequest: string;
  objective: string;
  deliverables: string[];
  constraints: string[];
  mentionedFiles: string[];
  focusAreas: string[];
  requestedRoles: AgentRole[];
  urgency: IntentUrgency;
  requiresRepositoryScan: boolean;
};

export type PlannerTaskNode = {
  id: string;
  name: string;
  description: string;
  taskType: string;
  assignedRole: AgentRole;
  priority: TaskPriority;
  dependsOn: string[];
  reasoning: string;
};

export type PlannerTaskGraph = {
  tasks: PlannerTaskNode[];
  dependencyOrder: string[];
};

export class PlannerAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return plannerSystemPrompt;
  }

  interpretUserIntent(request: string, input: JsonRecord = {}): PlannerIntent {
    const normalizedRequest = request.trim().replace(/\s+/g, " ");
    const deliverables = inferDeliverables(normalizedRequest, input);
    const constraints = uniqueStrings([
      ...extractConstraints(normalizedRequest),
      ...readStringArray(input, "constraints"),
    ]);
    const mentionedFiles = uniqueStrings([
      ...extractMentionedFiles(normalizedRequest),
      ...readStringArray(input, "targetFiles"),
      ...readStringArray(input, "files"),
    ]);
    const focusAreas = inferFocusAreas(normalizedRequest, input);
    const requestedRoles = inferRequestedRoles(normalizedRequest, focusAreas, input);
    const urgency = inferUrgency(normalizedRequest, input);
    const requiresRepositoryScan =
      readBoolean(input, "requiresRepositoryScan") ??
      (mentionedFiles.length === 0 ||
        focusAreas.includes("repository-discovery") ||
        normalizedRequest.toLowerCase().includes("understand the codebase"));

    return {
      rawRequest: request,
      normalizedRequest,
      objective: normalizedRequest,
      deliverables,
      constraints,
      mentionedFiles,
      focusAreas,
      requestedRoles,
      urgency,
      requiresRepositoryScan,
    };
  }

  generateTaskGraph(intent: PlannerIntent): PlannerTaskGraph {
    const tasks: PlannerTaskNode[] = [];

    if (intent.requiresRepositoryScan) {
      tasks.push(
        this.createTaskNode({
          name: "Scan repository context",
          description: "Inspect the repository structure, frameworks, entry points, and configs.",
          taskType: "scan",
          assignedRole: AgentRole.repo_scanner,
          priority: intent.urgency === "critical" ? TaskPriority.high : TaskPriority.medium,
          dependsOn: [],
          reasoning: "Planner needs reliable repository context before downstream execution.",
        })
      );
    }

    const discoveryDependency = tasks.map((task) => task.id);
    const debugRequested = intent.requestedRoles.includes(AgentRole.debug);
    const codeRequested = intent.requestedRoles.includes(AgentRole.code);

    if (debugRequested) {
      tasks.push(
        this.createTaskNode({
          name: "Diagnose failing behavior",
          description: "Analyze failures, logs, or regressions and isolate the likely root cause.",
          taskType: "debug",
          assignedRole: AgentRole.debug,
          priority: resolveTaskPriority(intent.urgency, AgentRole.debug),
          dependsOn: discoveryDependency,
          reasoning: "Debug work should frame the fix before code changes are applied.",
        })
      );
    }

    if (codeRequested || tasks.length === 0) {
      tasks.push(
        this.createTaskNode({
          name: "Implement requested changes",
          description: buildCodeTaskDescription(intent),
          taskType: "code",
          assignedRole: AgentRole.code,
          priority: resolveTaskPriority(intent.urgency, AgentRole.code),
          dependsOn: debugRequested
            ? [tasks.find((task) => task.assignedRole === AgentRole.debug)?.id].filter(isString)
            : discoveryDependency,
          reasoning: "Code changes are the primary delivery step for implementation work.",
        })
      );
    }

    if (intent.requestedRoles.includes(AgentRole.test)) {
      tasks.push(
        this.createTaskNode({
          name: "Validate behavior with tests",
          description:
            "Generate or update tests, execute the relevant suite, and summarize any failures.",
          taskType: "test",
          assignedRole: AgentRole.test,
          priority: resolveTaskPriority(intent.urgency, AgentRole.test),
          dependsOn: tasks
            .filter((task) => task.assignedRole === AgentRole.code)
            .map((task) => task.id),
          reasoning: "Verification should run after code changes are prepared.",
        })
      );
    }

    if (intent.requestedRoles.includes(AgentRole.security)) {
      tasks.push(
        this.createTaskNode({
          name: "Review security impact",
          description:
            "Inspect commands, changed files, secrets, and dependency risks before completion.",
          taskType: "security",
          assignedRole: AgentRole.security,
          priority: resolveTaskPriority(intent.urgency, AgentRole.security),
          dependsOn: tasks
            .filter((task) => task.assignedRole === AgentRole.code)
            .map((task) => task.id),
          reasoning: "Security review should evaluate the final change set, not the raw intent.",
        })
      );
    }

    if (intent.requestedRoles.includes(AgentRole.pm)) {
      tasks.push(
        this.createTaskNode({
          name: "Coordinate execution progress",
          description:
            "Track task ownership, highlight blockers, and produce a concise status report.",
          taskType: "pm",
          assignedRole: AgentRole.pm,
          priority: resolveTaskPriority(intent.urgency, AgentRole.pm),
          dependsOn: [],
          reasoning: "Project management runs alongside execution and keeps the plan coherent.",
        })
      );
    }

    const prioritized = this.prioritizeTasks(tasks, intent.urgency);
    const dependencyOrder = this.orderDependencies(prioritized);

    return {
      tasks: prioritized,
      dependencyOrder,
    };
  }

  prioritizeTasks(tasks: PlannerTaskNode[], urgency: IntentUrgency): PlannerTaskNode[] {
    const priorityWeight: Record<TaskPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const urgencyBias = urgency === "critical" ? 1 : 0;

    return [...tasks].sort((left, right) => {
      const leftWeight = priorityWeight[left.priority] + urgencyBias;
      const rightWeight = priorityWeight[right.priority] + urgencyBias;

      if (leftWeight !== rightWeight) {
        return rightWeight - leftWeight;
      }

      return left.name.localeCompare(right.name);
    });
  }

  orderDependencies(tasks: PlannerTaskNode[]): string[] {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const ordered: string[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) {
        return;
      }

      if (visiting.has(taskId)) {
        throw new Error(`Detected a cycle while ordering planner tasks at ${taskId}.`);
      }

      visiting.add(taskId);
      const task = taskMap.get(taskId);
      if (!task) {
        return;
      }

      for (const dependency of task.dependsOn) {
        visit(dependency);
      }

      visiting.delete(taskId);
      visited.add(taskId);
      ordered.push(taskId);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return ordered;
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const request =
      readString(input, "request") ??
      readString(input, "prompt") ??
      context.task.description ??
      context.task.name;
    const intent = this.interpretUserIntent(request, input);
    const taskGraph = this.generateTaskGraph(intent);

    this.remember("last_planning_intent", intent as JsonValue);
    this.remember("last_task_graph", taskGraph as JsonValue);
    this.updateNotes({
      planner_summary: `${taskGraph.tasks.length} tasks prepared for ${intent.objective}.`,
      planner_dependency_order: taskGraph.dependencyOrder,
    });

    return this.buildExecutionResult({
      summary: `Planned ${taskGraph.tasks.length} task(s) for ${intent.objective}.`,
      output: {
        intent,
        taskGraph,
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: "planning-room",
    });
  }

  private createTaskNode(input: Omit<PlannerTaskNode, "id">): PlannerTaskNode {
    return {
      id: toSlug(`${input.assignedRole}-${input.taskType}-${input.name}`),
      ...input,
    };
  }
}

function inferDeliverables(request: string, input: JsonRecord): string[] {
  const seeded = readStringArray(input, "deliverables");
  const matches = request.match(/\b(?:build|create|implement|fix|refactor|test|scan|secure)\b[^.!,;]*/gi);

  return uniqueStrings([...(matches ?? []), ...seeded]).slice(0, 8);
}

function extractConstraints(request: string): string[] {
  const patterns = [
    /without ([^.,;]+)/gi,
    /do not ([^.,;]+)/gi,
    /must ([^.,;]+)/gi,
    /should ([^.,;]+)/gi,
    /need to ([^.,;]+)/gi,
  ];

  return patterns.flatMap((pattern) =>
    [...request.matchAll(pattern)].map((match) => match[1]?.trim() ?? "").filter(Boolean)
  );
}

function extractMentionedFiles(request: string): string[] {
  return [...request.matchAll(fileReferencePattern)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
}

function inferFocusAreas(request: string, input: JsonRecord): string[] {
  const normalized = request.toLowerCase();
  const focusAreas = new Set<string>(readStringArray(input, "focusAreas"));

  if (normalized.includes("scan") || normalized.includes("codebase") || normalized.includes("repo")) {
    focusAreas.add("repository-discovery");
  }

  if (normalized.includes("test")) {
    focusAreas.add("quality");
  }

  if (normalized.includes("bug") || normalized.includes("debug") || normalized.includes("error")) {
    focusAreas.add("stability");
  }

  if (normalized.includes("security") || normalized.includes("secret") || normalized.includes("vulnerability")) {
    focusAreas.add("security");
  }

  if (normalized.includes("plan") || normalized.includes("roadmap") || normalized.includes("break down")) {
    focusAreas.add("coordination");
  }

  if (focusAreas.size === 0) {
    focusAreas.add("implementation");
  }

  return [...focusAreas];
}

function inferRequestedRoles(
  request: string,
  focusAreas: string[],
  input: JsonRecord
): AgentRole[] {
  const roles = new Set<AgentRole>();
  const normalized = request.toLowerCase();
  const requestedRoleStrings = readStringArray(input, "requestedRoles");

  for (const roleName of requestedRoleStrings) {
    switch (roleName) {
      case "planner":
      case "code":
      case "test":
      case "debug":
      case "security":
      case "repo_scanner":
      case "pm":
        roles.add(roleName);
        break;
      default:
        break;
    }
  }

  if (normalized.includes("scan") || normalized.includes("analyze the repo")) {
    roles.add(AgentRole.repo_scanner);
  }

  if (
    normalized.includes("build") ||
    normalized.includes("implement") ||
    normalized.includes("create") ||
    normalized.includes("refactor") ||
    normalized.includes("update") ||
    normalized.includes("fix")
  ) {
    roles.add(AgentRole.code);
  }

  if (normalized.includes("test") || focusAreas.includes("quality")) {
    roles.add(AgentRole.test);
  }

  if (normalized.includes("debug") || normalized.includes("bug") || normalized.includes("error")) {
    roles.add(AgentRole.debug);
  }

  if (normalized.includes("security") || focusAreas.includes("security")) {
    roles.add(AgentRole.security);
  }

  if (
    normalized.includes("plan") ||
    normalized.includes("coordinate") ||
    normalized.includes("roadmap") ||
    focusAreas.includes("coordination")
  ) {
    roles.add(AgentRole.pm);
  }

  if (roles.size === 0) {
    roles.add(AgentRole.code);
  }

  return [...roles];
}

function inferUrgency(request: string, input: JsonRecord): IntentUrgency {
  const explicitUrgency = readString(input, "urgency");
  if (
    explicitUrgency === "low" ||
    explicitUrgency === "medium" ||
    explicitUrgency === "high" ||
    explicitUrgency === "critical"
  ) {
    return explicitUrgency;
  }

  const normalized = request.toLowerCase();

  if (
    normalized.includes("urgent") ||
    normalized.includes("asap") ||
    normalized.includes("blocker") ||
    normalized.includes("production down")
  ) {
    return "critical";
  }

  if (normalized.includes("important") || normalized.includes("soon") || normalized.includes("high priority")) {
    return "high";
  }

  if (normalized.includes("cleanup") || normalized.includes("nice to have")) {
    return "low";
  }

  return "medium";
}

function resolveTaskPriority(urgency: IntentUrgency, role: AgentRole): TaskPriority {
  if (urgency === "critical") {
    return role === AgentRole.debug || role === AgentRole.security
      ? TaskPriority.critical
      : TaskPriority.high;
  }

  if (urgency === "high") {
    return role === AgentRole.test ? TaskPriority.medium : TaskPriority.high;
  }

  if (urgency === "low") {
    return TaskPriority.low;
  }

  return role === AgentRole.repo_scanner || role === AgentRole.pm
    ? TaskPriority.medium
    : TaskPriority.high;
}

function buildCodeTaskDescription(intent: PlannerIntent): string {
  const fileHint =
    intent.mentionedFiles.length > 0 ? ` Focus on ${intent.mentionedFiles.join(", ")}.` : "";
  const constraintHint =
    intent.constraints.length > 0 ? ` Respect these constraints: ${intent.constraints.join("; ")}.` : "";

  return `Implement the requested outcome: ${intent.objective}.${fileHint}${constraintHint}`.trim();
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

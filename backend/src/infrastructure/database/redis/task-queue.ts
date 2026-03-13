import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import { redisConfig } from "../../../config/redis";
import { getBullMqConnectionOptions } from "./redis-client";
import { RedisQueueNames } from "./keyspace";

export type TaskQueuePayload = {
  taskId: string;
  sessionId: string;
  priority: "critical" | "high" | "medium" | "low";
};

const queueOptions = {
  connection: getBullMqConnectionOptions(),
  prefix: redisConfig.queuePrefix,
} as const;

export const taskDispatchQueue = new Queue<TaskQueuePayload, void, string>(
  RedisQueueNames.taskDispatch,
  queueOptions
);
export const taskDispatchQueueEvents = new QueueEvents(RedisQueueNames.taskDispatch, queueOptions);

export async function enqueueTask(payload: TaskQueuePayload, options?: JobsOptions): Promise<void> {
  await taskDispatchQueue.add(payload.taskId, payload, options);
}

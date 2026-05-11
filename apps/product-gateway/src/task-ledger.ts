import type { AgentTask } from "@pms-agent-v2/product-contracts";
import type { TaskLedger } from "./types.js";

export function createTaskLedger(seed: readonly AgentTask[] = []): TaskLedger {
  const tasks = new Map(seed.map((task) => [task.id, task]));
  return {
    add(task) {
      tasks.set(task.id, task);
    },
    list() {
      return Array.from(tasks.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    get(taskId) {
      return tasks.get(taskId);
    }
  };
}

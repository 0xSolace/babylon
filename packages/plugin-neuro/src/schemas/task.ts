/**
 * Task Schema - Track tasks and action chains
 */
import { defineSchema } from '../schema.ts';

export const taskSchema = defineSchema({
  name: 'task',
  table: 'cognitive_tasks',
  scope: 'room',
  fields: {
    title: { type: 'string', description: 'Task description' },
    taskType: {
      type: 'enum',
      options: ['request', 'question', 'action', 'followup', 'chain'],
      description: 'Type of task',
    },
    status: {
      type: 'enum',
      options: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'],
      description: 'Current status',
    },
    parentTaskId: {
      type: 'string',
      description: 'ID of parent task if part of chain',
      optional: true,
    },
    blockers: { type: 'array', description: 'What is blocking completion' },
    context: { type: 'array', description: 'Related message/room IDs' },
    priority: {
      type: 'number',
      min: 1,
      max: 100,
      description: 'Priority level',
    },
  },
  prompts: {
    task: 'Identify if this message represents a task, request, or part of a chain. Track dependencies and blockers.',
  },
  provider: {
    name: 'TASKS',
    description: 'Active tasks and action chains',
    headerText: '# Active tasks',
    emptyText: 'No active tasks.\n',
  },
  hooks: {
    formatProvider: (memories, _message, _runtime) => {
      const active = memories.filter(
        (m) =>
          m.metadata.status !== 'completed' && m.metadata.status !== 'cancelled'
      );
      if (active.length === 0) return 'No active tasks.\n';

      const lines = active.slice(0, 5).map((m) => {
        const title = m.metadata.title as string;
        const status = m.metadata.status as string;
        const priority = (m.metadata.priority as number) || 50;
        return `- [${status}] ${title} (P${priority})`;
      });
      return `# Active tasks\n${lines.join('\n')}\n`;
    },
  },
});

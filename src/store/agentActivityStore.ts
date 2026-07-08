/**
 * Agent Activity Store
 * Tracks real-time status of all agents
 */

export interface AgentActivity {
  agentName: string;
  status: 'idle' | 'working' | 'completed' | 'error';
  currentTask?: string;
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  error?: string;
  result?: Record<string, unknown>;
}

interface ActivityLog {
  timestamp: number;
  agentName: string;
  event: string;
  details?: Record<string, unknown>;
}

const activities: Map<string, AgentActivity> = new Map();
let activityLog: ActivityLog[] = [];
const MAX_LOG_SIZE = 100;

export const agentActivityStore = {
  // Start agent work
  startAgent(agentName: string, task: string): void {
    activities.set(agentName, {
      agentName,
      status: 'working',
      currentTask: task,
      progress: 0,
      startTime: Date.now(),
    });

    this.addLog(agentName, 'started', { task });
  },

  // Update progress
  updateProgress(agentName: string, progress: number, details?: Record<string, unknown>): void {
    const activity = activities.get(agentName);
    if (activity) {
      activity.progress = Math.min(100, Math.max(0, progress));
      if (details) {
        activity.result = details;
      }
    }

    this.addLog(agentName, 'progress', { progress, ...details });
  },

  // Complete agent work
  completeAgent(agentName: string, result?: Record<string, unknown>): void {
    const activity = activities.get(agentName);
    if (activity) {
      activity.status = 'completed';
      activity.progress = 100;
      activity.endTime = Date.now();
      activity.result = result;
    }

    this.addLog(agentName, 'completed', { result });
  },

  // Report error
  errorAgent(agentName: string, error: string): void {
    const activity = activities.get(agentName);
    if (activity) {
      activity.status = 'error';
      activity.error = error;
      activity.endTime = Date.now();
    }

    this.addLog(agentName, 'error', { error });
  },

  // Get current activity
  getActivity(agentName: string): AgentActivity | undefined {
    return activities.get(agentName);
  },

  // Get all activities
  getAllActivities(): AgentActivity[] {
    return Array.from(activities.values());
  },

  // Get activity log
  getLog(limit?: number): ActivityLog[] {
    if (limit) {
      return activityLog.slice(-limit);
    }
    return activityLog;
  },

  // Add to activity log
  addLog(agentName: string, event: string, details?: Record<string, unknown>): void {
    activityLog.push({
      timestamp: Date.now(),
      agentName,
      event,
      details,
    });

    // Keep log size manageable
    if (activityLog.length > MAX_LOG_SIZE) {
      activityLog = activityLog.slice(-MAX_LOG_SIZE);
    }
  },

  // Reset all activities
  reset(): void {
    activities.clear();
    activityLog = [];
  },

  // Get formatted status
  getFormattedStatus(): Record<string, unknown> {
    const status: Record<string, unknown> = {};
    activities.forEach((activity, name) => {
      status[name] = {
        status: activity.status,
        progress: activity.progress,
        currentTask: activity.currentTask,
        duration: activity.endTime ? activity.endTime - activity.startTime : Date.now() - activity.startTime,
      };
    });
    return status;
  },
};

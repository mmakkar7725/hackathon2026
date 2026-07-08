'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import type { AgentActivity } from '@/store/agentActivityStore';

interface AgentActivityPanelProps {
  pollingInterval?: number; // ms
}

export function AgentActivityPanel({ pollingInterval = 500 }: AgentActivityPanelProps) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [log, setLog] = useState<Array<{ timestamp: number; agentName: string; event: string }>>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/agent-status?logLimit=20');
        if (!response.ok) throw new Error('Failed to fetch agent status');

        const data = await response.json();
        setActivities(data.activities || []);
        setLog(data.log || []);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching agent status:', error);
        setIsLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, pollingInterval);
    return () => clearInterval(interval);
  }, [pollingInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working':
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-0)] hover:bg-[var(--surface-1)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm">🤖 Agent Activity</span>
          <span className="text-xs text-[var(--text-secondary)]">
            ({activities.length} agents)
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Agent Status Cards */}
      {expanded && (
        <div className="space-y-2">
          {isLoading && activities.length === 0 ? (
            <div className="p-3 text-center text-[var(--text-secondary)] text-sm">
              Waiting for agent activity...
            </div>
          ) : activities.length === 0 ? (
            <div className="p-3 text-center text-[var(--text-secondary)] text-sm">
              No agents active
            </div>
          ) : (
            activities.map(activity => (
              <div
                key={activity.agentName}
                className={`p-3 rounded-lg border transition-all ${getStatusColor(activity.status)}`}
              >
                {/* Agent Name & Status */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(activity.status)}
                    <span className="font-medium text-sm">{activity.agentName}</span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(
                      activity.status
                    )}`}
                  >
                    {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                  </span>
                </div>

                {/* Current Task */}
                {activity.currentTask && (
                  <p className="text-xs text-[var(--text-secondary)] mb-2">
                    Task: {activity.currentTask}
                  </p>
                )}

                {/* Progress Bar */}
                {activity.status === 'working' && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${activity.progress}%` }}
                    />
                  </div>
                )}

                {/* Duration */}
                <p className="text-xs text-[var(--text-secondary)]">
                  ⏱ {Math.round((activity.endTime || Date.now()) - activity.startTime)}ms
                </p>

                {/* Error Message */}
                {activity.error && (
                  <p className="text-xs text-red-600 mt-2">Error: {activity.error}</p>
                )}
              </div>
            ))
          )}

          {/* Activity Log */}
          {log.length > 0 && (
            <details className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-0)]">
              <summary className="cursor-pointer font-semibold text-xs text-[var(--text-secondary)]">
                📋 Activity Log ({log.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {log.slice().reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-[var(--text-secondary)] font-mono border-l-2 border-blue-200 pl-2 py-1"
                  >
                    <span className="text-blue-600">[{entry.agentName}]</span>{' '}
                    <span className="text-gray-500">{entry.event}</span>
                    <span className="text-gray-400 ml-1">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

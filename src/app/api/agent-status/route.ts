import { NextRequest, NextResponse } from 'next/server';
import { agentActivityStore } from '@/store/agentActivityStore';

/**
 * GET /api/agent-status - Get real-time agent activity
 * Returns current status of all agents and activity log
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agent = searchParams.get('agent'); // Optional: filter by agent name
    const logLimit = parseInt(searchParams.get('logLimit') || '50', 10);

    let activities;
    if (agent) {
      const activity = agentActivityStore.getActivity(agent);
      activities = activity ? [activity] : [];
    } else {
      activities = agentActivityStore.getAllActivities();
    }

    const log = agentActivityStore.getLog(logLimit);
    const status = agentActivityStore.getFormattedStatus();

    return NextResponse.json({
      activities,
      status,
      log,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Agent Status API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get agent status' },
      { status: 500 }
    );
  }
}

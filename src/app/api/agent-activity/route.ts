import { NextRequest, NextResponse } from 'next/server';
import { agentActivityStore } from '@/store/agentActivityStore';

/**
 * POST /api/agent-activity - Update agent status from client
 * Handles: startAgent, completeAgent, errorAgent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agentName, task, result, error } = body;

    console.log('[Agent Activity API] Received:', { action, agentName, task, result, error });

    if (!agentName) {
      return NextResponse.json(
        { error: 'Missing agentName' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start':
        agentActivityStore.startAgent(agentName, task || 'Processing...');
        console.log('[Agent Activity API] Started agent:', agentName);
        break;
      case 'complete':
        agentActivityStore.completeAgent(agentName, result);
        console.log('[Agent Activity API] Completed agent:', agentName);
        break;
      case 'error':
        agentActivityStore.errorAgent(agentName, error || 'Unknown error');
        console.log('[Agent Activity API] Error for agent:', agentName);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    const allActivities = agentActivityStore.getAllActivities();
    console.log('[Agent Activity API] All activities:', allActivities);

    return NextResponse.json({ success: true, activities: allActivities });
  } catch (error) {
    console.error('Agent activity update failed:', error);
    return NextResponse.json(
      { error: 'Failed to update agent activity' },
      { status: 500 }
    );
  }
}

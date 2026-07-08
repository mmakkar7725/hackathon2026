/**
 * Base Agent Interface & Message Bus
 * Enables peer-to-peer communication between agents
 */

export interface AgentMessage<T = Record<string, unknown>> {
  id: string;
  type: string; // e.g., 'data:ingested', 'nlp:analyzed', 'query:executed'
  payload: T;
  timestamp: number;
  source: string; // agent name
}

export interface AgentConfig {
  name: string;
  version?: string;
}

export type EventHandler = (message: AgentMessage<Record<string, unknown>>) => Promise<void>;

/**
 * EventBus: Central message hub for agent communication
 */
export class EventBus {
  private listeners: Map<string, Array<(msg: unknown) => Promise<void>>> = new Map();
  private messageHistory: AgentMessage<Record<string, unknown>>[] = [];

  subscribe(eventType: string, handler: (msg: unknown) => Promise<void>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  async publish(message: AgentMessage<Record<string, unknown>>): Promise<void> {
    this.messageHistory.push(message);
    const handlers = this.listeners.get(message.type) || [];
    await Promise.all(handlers.map(handler => handler(message)));
  }

  getHistory(eventType?: string): AgentMessage<Record<string, unknown>>[] {
    if (!eventType) return this.messageHistory;
    return this.messageHistory.filter(m => m.type === eventType);
  }
}

/**
 * Base Agent Class - All agents inherit from this
 */
export abstract class Agent {
  name: string;
  version: string;
  protected eventBus: EventBus;

  constructor(config: AgentConfig, eventBus: EventBus) {
    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.eventBus = eventBus;
  }

  /**
   * Subscribe to events this agent cares about
   */
  protected subscribe(eventType: string, handler: (msg: unknown) => Promise<void>): void {
    this.eventBus.subscribe(eventType, handler);
  }

  /**
   * Publish results to other agents
   */
  protected async publish(type: string, payload: Record<string, unknown>): Promise<void> {
    const message: AgentMessage = {
      id: `${this.name}-${Date.now()}`,
      type,
      payload,
      timestamp: Date.now(),
      source: this.name,
    };
    await this.eventBus.publish(message);
  }

  /**
   * Initialize agent - subscribe to events
   */
  abstract initialize(): void;

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      type: this.constructor.name,
    };
  }
}

/**
 * Agent Registry - Manage all active agents
 */
export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  register(agent: Agent): void {
    if (this.agents.has(agent.name)) {
      console.warn(`Agent "${agent.name}" already registered, overwriting`);
    }
    this.agents.set(agent.name, agent);
  }

  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  getMetadata() {
    return this.getAll().map(agent => agent.getMetadata());
  }
}

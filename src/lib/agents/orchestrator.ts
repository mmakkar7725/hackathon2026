/**
 * AgentOrchestrator
 * Manages agent lifecycle and coordinates multi-agent workflows
 * Shows how to use agents in different pipeline orders
 */

import {
  EventBus,
  Agent,
  AgentRegistry,
  DataIngestionAgent,
  NLPAgent,
  QueryExecutionAgent,
} from '@/lib/agents';

export interface OrchestratorConfig {
  enableLogging?: boolean;
  eventHistoryLimit?: number;
}

export class AgentOrchestrator {
  private eventBus: EventBus;
  private registry: AgentRegistry;
  private agents: Agent[] = [];
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      enableLogging: true,
      eventHistoryLimit: 100,
      ...config,
    };
    this.eventBus = new EventBus();
    this.registry = new AgentRegistry();

    this.initializeAgents();
  }

  /**
   * Create and register all agents
   */
  private initializeAgents(): void {
    const agents = [
      new DataIngestionAgent(this.eventBus),
      new NLPAgent(this.eventBus),
      new QueryExecutionAgent(this.eventBus),
    ];

    agents.forEach(agent => {
      agent.initialize();
      this.registry.register(agent);
      this.agents.push(agent);

      if (this.config.enableLogging) {
        console.log(`✓ Registered agent: ${agent.name}`);
      }
    });
  }

  /**
   * Ingest data - trigger DataIngestionAgent
   */
  async ingestData(fileContent: string, fileName: string, fileType: string): Promise<void> {
    await this.eventBus.publish({
      id: `orchestrator-${Date.now()}`,
      type: 'ingestion:parse-file',
      payload: { fileContent, fileName, fileType },
      timestamp: Date.now(),
      source: 'Orchestrator',
    });
  }

  /**
   * Analyze query - trigger NLPAgent
   */
  async analyzeQuery(query: string, useGeminiAssist: boolean = true): Promise<void> {
    await this.eventBus.publish({
      id: `orchestrator-${Date.now()}`,
      type: 'nlp:analyze-query',
      payload: { query, useGeminiAssist },
      timestamp: Date.now(),
      source: 'Orchestrator',
    });
  }

  /**
   * Get all registered agents
   */
  getAgents(): Agent[] {
    return this.agents;
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): Agent | undefined {
    return this.registry.get(name);
  }

  /**
   * Get agents metadata
   */
  getAgentsMetadata() {
    return this.registry.getMetadata();
  }

  /**
   * Get event history
   */
  getEventHistory(eventType?: string) {
    return this.eventBus.getHistory(eventType);
  }

  /**
   * Full workflow: Data Ingestion → NLP Analysis → Query Execution
   */
  async runFullPipeline(
    fileContent: string,
    fileName: string,
    query: string
  ): Promise<void> {
    if (this.config.enableLogging) {
      console.log('🚀 Starting full MedQuery pipeline...');
    }

    // Step 1: Ingest
    await this.ingestData(fileContent, fileName, 'text');
    await this.delay(500); // Wait for ingestion to complete

    // Step 2: Analyze query
    await this.analyzeQuery(query, true);
    await this.delay(500); // Wait for analysis to complete

    // Step 3: Execute query (automatic via event chain)

    if (this.config.enableLogging) {
      console.log('✅ Pipeline complete');
    }
  }

  /**
   * Test agents independently (useful for debugging)
   */
  async testAgentIndependently(agentName: string): Promise<void> {
    const agent = this.registry.get(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    const metadata = agent.getMetadata();
    console.log(`\n🧪 Testing ${agentName}:`);
    console.log(`  Name: ${metadata.name}`);
    console.log(`  Type: ${metadata.type}`);
    console.log(`  Version: ${metadata.version}`);

    const capabilities = (
      agent as unknown as { getCapabilities?: () => Record<string, unknown> }
    ).getCapabilities?.();
    if (capabilities) {
      console.log(`  Capabilities:`, capabilities);
    }
  }

  /**
   * Print system status
   */
  printStatus(): void {
    console.log('\n📊 AgentOrchestrator Status:');
    console.log(`  Total Agents: ${this.agents.length}`);
    console.log(
      `  Agents: ${this.agents.map(a => a.name).join(', ')}`
    );
    console.log(
      `  Event History: ${this.eventBus.getHistory().length} events`
    );
    console.log('');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function for easy orchestrator creation
 */
export function createAgentOrchestrator(config?: OrchestratorConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}

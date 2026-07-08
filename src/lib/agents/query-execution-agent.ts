/**
 * QueryExecutionAgent
 * Generates SQL and executes queries against ingested data
 * Reusable for any SQL generation + execution pipeline
 */

import { Agent, EventBus, AgentMessage } from './base';
import { AnalyzedQuery } from './nlp-agent';

export interface ExecutionResult {
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  confidence: number;
  feasibility: {
    isViable: boolean;
    expectedRowRange: string;
    warnings: string[];
  };
}

export class QueryExecutionAgent extends Agent {
  private currentData: Record<string, unknown> | null = null;
  private executedQueries: ExecutionResult[] = [];

  constructor(eventBus: EventBus) {
    super({ name: 'QueryExecutionAgent', version: '1.0.0' }, eventBus);
  }

  initialize(): void {
    // Listen for analyzed queries from NLPAgent
    this.subscribe('nlp:analyzed', this.handleAnalyzedQuery.bind(this) as (msg: unknown) => Promise<void>);
    // Listen for ingested data
    this.subscribe('data:ingested', this.handleDataUpdate.bind(this) as (msg: unknown) => Promise<void>);
    console.log(`✓ ${this.name} initialized and ready to execute queries`);
  }

  /**
   * Cache ingested data for query execution
   */
  private async handleDataUpdate(message: AgentMessage<{ data: Record<string, unknown> }>): Promise<void> {
    const { data } = message.payload;
    this.currentData = data;
    console.log(`[${this.name}] Cached data for execution`);
  }

  /**
   * Execute query against cached data
   */
  private async handleAnalyzedQuery(message: AgentMessage<{ originalQuery: string; analyzed: AnalyzedQuery }>): Promise<void> {
    try {
      const { originalQuery, analyzed } = message.payload;

      if (!this.currentData) {
        throw new Error('No data available for query execution. Ingest data first.');
      }

      console.log(`[${this.name}] Executing query: "${originalQuery}"`);

      const result = await this.executeQuery(originalQuery, analyzed);
      this.executedQueries.push(result);

      // Publish execution result
      await this.publish('query:executed', {
        originalQuery,
        result,
        status: 'success',
      });

      console.log(`[${this.name}] Query executed, ${result.rows.length} rows returned`);
    } catch (error) {
      await this.publish('query:error', {
        error: error instanceof Error ? error.message : 'Execution failed',
      });
      console.error(`[${this.name}] Error:`, error);
    }
  }

  /**
   * Generate SQL and execute against data
   */
  private async executeQuery(query: string, analyzed: AnalyzedQuery): Promise<ExecutionResult> {
    const startTime = Date.now();

    if (!this.currentData) {
      throw new Error('No data available for query execution');
    }

    // Call backend to generate SQL and get feasibility
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: query,
        useGeminiAssist: true,
        datasetStats: {
          demographics: (this.currentData as Record<string, Record<string, unknown>[]>).demographics.length,
          medicalHistory: (this.currentData as Record<string, Record<string, unknown>[]>).medicalHistory.length,
        },
        ambiguities: analyzed.ambiguities.ambiguities,
      }),
    });

    if (!response.ok) {
      throw new Error(`SQL generation failed: ${response.statusText}`);
    }

    const { sql, results, feasibilityCheck, confidence } = await response.json();

    return {
      sql,
      rows: results || [],
      rowCount: (results || []).length,
      executionTimeMs: Date.now() - startTime,
      confidence: confidence || 0.8,
      feasibility: {
        isViable: feasibilityCheck?.isViable || false,
        expectedRowRange: feasibilityCheck?.expectedRowRange || 'Unknown',
        warnings: feasibilityCheck?.warnings || [],
      },
    };
  }

  /**
   * Get query execution history
   */
  getExecutionHistory(limit: number = 10): ExecutionResult[] {
    return this.executedQueries.slice(-limit);
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return {
      supportedDatabases: ['in-memory', 'local-tables'],
      maxQueryLength: 1000,
      canGenerateSQL: true,
      supportsGeminiOptimization: true,
      supportsAsync: true,
    };
  }
}

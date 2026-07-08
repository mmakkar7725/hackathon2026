/**
 * NLPAgent
 * Analyzes natural language queries, detects and resolves ambiguities
 * Reusable for any domain-specific query understanding task
 */

import { Agent, EventBus, AgentMessage } from './base';
import { AmbiguityResolution } from '@/types/medical';

export interface AnalyzedQuery {
  original: string;
  ambiguities: AmbiguityResolution;
  clarifiedPrompt?: string;
  confidence: number;
  schema?: Record<string, unknown> | null;
}

export class NLPAgent extends Agent {
  private dataSchema: Record<string, unknown> | null = null;

  constructor(eventBus: EventBus) {
    super({ name: 'NLPAgent', version: '1.0.0' }, eventBus);
  }

  initialize(): void {
    // Listen for natural language queries
    this.subscribe('nlp:analyze-query', this.handleQueryAnalysis.bind(this) as (msg: unknown) => Promise<void>);
    // Listen for data schema updates from DataIngestionAgent
    this.subscribe('data:ingested', this.handleDataUpdate.bind(this) as (msg: unknown) => Promise<void>);
    console.log(`✓ ${this.name} initialized and listening for queries`);
  }

  /**
   * Update cached data schema when new data is ingested
   */
  private async handleDataUpdate(message: AgentMessage<{ data: { demographics: Record<string, unknown>[]; medicalHistory: Record<string, unknown>[] } }>): Promise<void> {
    const { data } = message.payload;
    this.dataSchema = {
      demographics: data.demographics.length > 0 ? Object.keys(data.demographics[0] || {}) : [],
      medicalHistory: data.medicalHistory.length > 0 ? Object.keys(data.medicalHistory[0] || {}) : [],
    };
    console.log(`[${this.name}] Updated schema from ingested data`);
  }

  /**
   * Analyze natural language query for ambiguities
   */
  private async handleQueryAnalysis(message: AgentMessage<{ query: string; useGeminiAssist: boolean }>): Promise<void> {
    try {
      const { query, useGeminiAssist } = message.payload;

      console.log(`[${this.name}] Analyzing query: "${query}"`);

      const analyzed = await this.analyzeQuery(query, useGeminiAssist);

      // Publish analysis results
      await this.publish('nlp:analyzed', {
        originalQuery: query,
        analyzed,
        status: 'success',
      });

      console.log(`[${this.name}] Analysis complete, ambiguities detected: ${analyzed.ambiguities.ambiguities.length}`);
    } catch (error) {
      await this.publish('nlp:error', {
        error: error instanceof Error ? error.message : 'Analysis failed',
      });
      console.error(`[${this.name}] Error:`, error);
    }
  }

  /**
   * Analyze query using Gemini or fallback deterministic approach
   */
  private async analyzeQuery(query: string, useGemini: boolean): Promise<AnalyzedQuery> {
    let ambiguities: AmbiguityResolution;

    if (useGemini) {
      // Call Gemini API endpoint
      const response = await fetch('/api/detect-ambiguities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      ambiguities = await response.json();
    } else {
      // Fallback: Deterministic ambiguity detection
      ambiguities = this.detectAmbiguitiesDeterministic(query);
    }

    return {
      original: query,
      ambiguities,
      clarifiedPrompt: ambiguities.clarifiedPrompt || query,
      confidence: 0.85,
      schema: this.dataSchema,
    };
  }

  /**
   * Deterministic ambiguity detection (no API calls)
   */
  private detectAmbiguitiesDeterministic(query: string): AmbiguityResolution {
    const ambiguities = [];

    // Simple pattern matching for common ambiguities
    if (query.toLowerCase().includes('heavy') || query.toLowerCase().includes('high')) {
      ambiguities.push({
        id: 'threshold-ambiguity',
        fragment: 'heavy/high',
        type: 'demographic' as const,
        interpretations: [
          {
            option: 'Severe/critical severity',
            likelihood: 'high' as const,
            explanation: 'Medical context suggests severe condition',
          },
          {
            option: 'Elevated numeric value',
            likelihood: 'medium' as const,
            explanation: 'Could be high measurement value',
          },
        ],
      });
    }

    return {
      hasAmbiguities: ambiguities.length > 0,
      ambiguities,
      clarifiedPrompt: query,
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return {
      supportsLanguages: ['en'],
      maxQueryLength: 500,
      canDetectAmbiguities: true,
      requiresSchema: true,
      supportsAsync: true,
    };
  }
}

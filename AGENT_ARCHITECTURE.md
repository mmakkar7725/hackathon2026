# MedQuery AI - Agentic Architecture Guide

## Overview

MedQuery AI has been refactored into a **Multi-Agent System** with peer-to-peer communication. This makes components reusable across different projects and easier to test independently.

## Architecture

### Three Main Agents

```
DataIngestionAgent  ──[emits: data:ingested]──┐
                                                 ├──→ Event Bus ──→ Event Handlers
NLPAgent  ──[listens: data:ingested]──          │
          ──[emits: nlp:analyzed]──────┤
                                         │
QueryExecutionAgent ──[listens: nlp:analyzed]──┘
                   ──[emits: query:executed]──→ Results
```

### 1. **DataIngestionAgent**
- **Responsibility**: Parse unstructured documents into structured medical data
- **Input**: File upload (PDF, image, text, CSV)
- **Output**: `ParsedMedicalData` { demographics, medicalHistory, metadata }
- **Events Emitted**:
  - `data:ingested` → Parsed data available
  - `data:ingestion-error` → Parsing failed
- **Reusable For**: Any document → structured data conversion pipeline

### 2. **NLPAgent**  
- **Responsibility**: Understand user queries, detect/resolve ambiguities
- **Input**: Natural language query + data schema context
- **Output**: `AnalyzedQuery` { original, ambiguities, clarifiedPrompt, confidence }
- **Events Emitted**:
  - `nlp:analyzed` → Analysis complete with ambiguities
  - `nlp:error` → Analysis failed
- **Reusable For**: Any domain-specific query understanding task

### 3. **QueryExecutionAgent**
- **Responsibility**: Generate SQL from queries and execute against data
- **Input**: Analyzed query + parsed data
- **Output**: `ExecutionResult` { sql, rows, confidence, feasibility }
- **Events Emitted**:
  - `query:executed` → Query results available
  - `query:error` → Execution failed
- **Reusable For**: Any SQL generation + execution pipeline

## Using the Agents

### Option 1: Full Pipeline with AgentOrchestrator

```typescript
import { createAgentOrchestrator } from '@/lib/agents/orchestrator';

// Create orchestrator
const orchestrator = createAgentOrchestrator({
  enableLogging: true,
  eventHistoryLimit: 100,
});

// Run full pipeline: Data → NLP → Query
await orchestrator.runFullPipeline(
  fileContent,
  'patient-data.txt',
  'Show me patients with diabetes'
);

// Print system status
orchestrator.printStatus();

// Get event history
const history = orchestrator.getEventHistory();
```

### Option 2: Individual Agent Control

```typescript
import { 
  EventBus,
  DataIngestionAgent,
  NLPAgent,
  QueryExecutionAgent,
} from '@/lib/agents';

// Create event bus and agents
const eventBus = new EventBus();
const dataAgent = new DataIngestionAgent(eventBus);
const nlpAgent = new NLPAgent(eventBus);
const queryAgent = new QueryExecutionAgent(eventBus);

// Initialize agents
dataAgent.initialize();
nlpAgent.initialize();
queryAgent.initialize();

// Trigger data ingestion
await eventBus.publish({
  id: 'ingest-1',
  type: 'ingestion:parse-file',
  payload: {
    fileContent: 'patient data here',
    fileName: 'data.txt',
    fileType: 'text',
  },
  timestamp: Date.now(),
  source: 'Application',
});

// Trigger query analysis
await eventBus.publish({
  id: 'query-1',
  type: 'nlp:analyze-query',
  payload: {
    query: 'Show diabetic patients',
    useGeminiAssist: true,
  },
  timestamp: Date.now(),
  source: 'Application',
});
```

### Option 3: Test Individual Agents

```typescript
import { DataIngestionAgent } from '@/lib/agents';

const eventBus = new EventBus();
const agent = new DataIngestionAgent(eventBus);

// Check agent capabilities
console.log(agent.getCapabilities());

// Check agent metadata
console.log(agent.getMetadata());
```

## File Structure

```
src/lib/agents/
  ├── base.ts                      # Base Agent class, EventBus, AgentRegistry
  ├── data-ingestion-agent.ts      # DataIngestionAgent
  ├── nlp-agent.ts                 # NLPAgent  
  ├── query-execution-agent.ts     # QueryExecutionAgent
  ├── orchestrator.ts              # AgentOrchestrator coordinator
  └── index.ts                     # Exports all agents and base classes
```

## Key Interfaces

### AgentMessage (Event)
```typescript
interface AgentMessage<T = Record<string, unknown>> {
  id: string;                    // Unique message ID
  type: string;                  // Event type (e.g., 'data:ingested')
  payload: T;                    // Event data
  timestamp: number;             // When published
  source: string;                // Which agent published it
}
```

### EventBus (Message Hub)
```typescript
class EventBus {
  subscribe(eventType: string, handler: Function): () => void;
  publish(message: AgentMessage): Promise<void>;
  getHistory(eventType?: string): AgentMessage[];
}
```

### Base Agent
```typescript
abstract class Agent {
  protected subscribe(eventType: string, handler: Function): void;
  protected async publish(type: string, payload: Record<string, unknown>): Promise<void>;
  abstract initialize(): void;
  getMetadata(): AgentMetadata;
}
```

## Event Flow Example

### Standard Pipeline: Ingest → Analyze → Execute

```
User uploads file
    ↓
DataIngestionAgent receives 'ingestion:parse-file' event
    ↓ (parses file)
DataIngestionAgent publishes 'data:ingested' event
    ↓
NLPAgent receives 'data:ingested' event (updates schema)
User submits query
    ↓
NLPAgent receives 'nlp:analyze-query' event
    ↓ (analyzes with Gemini)
NLPAgent publishes 'nlp:analyzed' event
    ↓
QueryExecutionAgent receives 'nlp:analyzed' event
    ↓ (generates SQL)
QueryExecutionAgent publishes 'query:executed' event
    ↓
Frontend displays results
```

## Reusability Examples

### Example 1: Generic Document Parser
```typescript
// Use DataIngestionAgent for any document-to-data conversion
const dataAgent = new DataIngestionAgent(eventBus);
dataAgent.initialize();

// Can parse: medical records, insurance documents, lab results, etc.
const capabilities = dataAgent.getCapabilities();
// { inputFormats: ['PDF', 'image', 'text', 'CSV'], ... }
```

### Example 2: Query Analyzer for Different Domains
```typescript
// NLPAgent can analyze queries for any domain
const nlpAgent = new NLPAgent(eventBus);

// Medical: "Show me patients with diabetes"
// Finance: "Which accounts have low balance?"
// Logistics: "Find delayed shipments"
```

### Example 3: SQL Generator for Different Databases
```typescript
// QueryExecutionAgent can work with different backends
// In-memory tables (current implementation)
// PostgreSQL, MySQL, BigQuery, etc. (just swap backend)
```

## Testing Agents Independently

```typescript
import { testAgentIndependently } from '@/lib/agents/orchestrator';

// Test DataIngestionAgent in isolation
await orchestrator.testAgentIndependently('DataIngestionAgent');

// Test NLPAgent without running full pipeline
await orchestrator.testAgentIndependently('NLPAgent');
```

## Extending with New Agents

```typescript
import { Agent, EventBus } from '@/lib/agents/base';

export class CustomAgent extends Agent {
  constructor(eventBus: EventBus) {
    super({ name: 'CustomAgent', version: '1.0.0' }, eventBus);
  }

  initialize(): void {
    // Listen to events you care about
    this.subscribe('your:event', this.handleEvent.bind(this) as (msg: unknown) => Promise<void>);
  }

  private async handleEvent(message: AgentMessage<YourPayloadType>): Promise<void> {
    // Process event
    // Emit your own events
    await this.publish('your:result', { /* result */ });
  }

  getCapabilities() {
    return {
      /* your capabilities */
    };
  }
}
```

## Benefits of Agentic Architecture

✅ **Modularity**: Each agent has single responsibility  
✅ **Reusability**: Use agents in different projects  
✅ **Testability**: Test agents independently without UI  
✅ **Scalability**: Add new agents without touching existing ones  
✅ **Maintainability**: Clear separation of concerns  
✅ **Flexibility**: Agents communicate via events (loose coupling)  
✅ **Extensibility**: Create custom agents by extending base Agent class  

## Migration Notes

The UI components (`nlp-workspace.tsx`, `query-input-panel.tsx`, etc.) still work as before. They now call the agent system through API endpoints:

- `POST /api/detect-ambiguities` → NLPAgent
- `POST /api/translate` → QueryExecutionAgent  
- `POST /api/intake/parse` → DataIngestionAgent (via existing code)

The agents run server-side and communicate via the EventBus.

---

**Next Steps**:
1. Create React hooks that wrap agent orchestration
2. Add database persistence for agent state
3. Build CLI tool for running agents independently
4. Create agent marketplace for sharing custom agents

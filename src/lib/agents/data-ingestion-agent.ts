/**
 * DataIngestionAgent
 * Parses unstructured documents into structured medical data
 * Reusable for any document → structured data pipeline
 */

import { Agent, EventBus, AgentMessage } from './base';

export interface ParsedMedicalData {
  demographics: {
    patient_id: string;
    full_name: string;
    date_of_birth: string;
    gender: string;
    contact_info?: string;
  }[];
  medicalHistory: {
    patient_id: string;
    visit_date: string;
    diagnosis: string;
    treatment?: string;
    notes?: string;
  }[];
  metadata: {
    source: string;
    uploadedAt: number;
    totalRows: number;
    extractionConfidence: number;
  };
}

export class DataIngestionAgent extends Agent {
  constructor(eventBus: EventBus) {
    super({ name: 'DataIngestionAgent', version: '1.0.0' }, eventBus);
  }

  initialize(): void {
    // Listen to file upload requests
    this.subscribe('ingestion:parse-file', this.handleFileUpload.bind(this) as (msg: unknown) => Promise<void>);
    console.log(`✓ ${this.name} initialized and listening for file uploads`);
  }

  /**
   * Handle incoming file upload and parse it
   */
  private async handleFileUpload(message: AgentMessage<{ fileContent: string; fileName: string; fileType: string }>): Promise<void> {
    try {
      const { fileContent, fileName, fileType } = message.payload;

      console.log(`[${this.name}] Parsing file: ${fileName}`);

      // Simulate parsing (in real app, would call backend parser)
      const parsedData = this.parseFileContent(fileContent, fileType);

      // Publish parsed data for other agents
      await this.publish('data:ingested', {
        fileName,
        fileType,
        data: parsedData,
        status: 'success',
      });

      console.log(`[${this.name}] Successfully parsed and published data`);
    } catch (error) {
      await this.publish('data:ingestion-error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`[${this.name}] Error:`, error);
    }
  }

  /**
   * Parse file content into structured medical data
   * In production: call backend API or use specialized parser
   */
  private parseFileContent(fileContent: string, fileType: string): ParsedMedicalData {
    // Simulated parsing - would be replaced with real parsing logic
    const lines = fileContent.split('\n');

    // Stub: Extract demographics and medical history
    const demographics = lines
      .slice(0, Math.ceil(lines.length / 2))
      .map((line, idx) => ({
        patient_id: `P${1000 + idx}`,
        full_name: line.split(',')[0] || `Patient ${idx}`,
        date_of_birth: '1980-01-01',
        gender: 'Unknown',
        contact_info: '',
      }));

    const medicalHistory = lines.slice(Math.ceil(lines.length / 2)).map((line, idx) => ({
      patient_id: `P${1000 + (idx % demographics.length)}`,
      visit_date: new Date().toISOString().split('T')[0],
      diagnosis: line || 'Routine check',
      treatment: 'Standard protocol',
      notes: '',
    }));

    return {
      demographics,
      medicalHistory,
      metadata: {
        source: fileType,
        uploadedAt: Date.now(),
        totalRows: demographics.length + medicalHistory.length,
        extractionConfidence: 0.85,
      },
    };
  }

  /**
   * Validate parsed data quality
   */
  validateData(data: ParsedMedicalData): boolean {
    return (
      data.demographics.length > 0 &&
      data.medicalHistory.length > 0 &&
      data.metadata.extractionConfidence > 0.7
    );
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return {
      inputFormats: ['PDF', 'image', 'text', 'CSV'],
      outputFormat: 'ParsedMedicalData',
      requiresAuthentication: false,
      supportsAsync: true,
    };
  }
}

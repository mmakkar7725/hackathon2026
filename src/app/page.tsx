"use client";

import { Activity, Sparkle } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { IngestionWorkspace } from "@/components/ingestion-workspace";
import { NlpWorkspace } from "@/components/nlp-workspace";

type AppTab = "ingestion" | "nlp";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("ingestion");

  return (
    <main className="dashboard-glow min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="fade-in-up flex flex-col gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--border)] bg-[var(--surface-0)] p-6 shadow-[var(--ds-elevation-3)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="ds-caption mb-2 flex items-center gap-2 font-semibold tracking-[0.14em] text-[var(--brand-700)] uppercase">
              <Activity size={14} /> Clinical Trial Platform
            </p>
            <h1 className="ds-display-lg text-[var(--text-primary)] sm:text-[34px]">
              EligibilityAI
            </h1>
            <p className="ds-body mt-2 max-w-2xl text-[var(--text-secondary)]">
              Enroll Smarter, Screen Faster. Transform clinical data into eligible trial subjects with AI-powered eligibility analysis.
            </p>
          </div>
          <Image
            src="/Quest-Diagnostics-RGB-gradient.jpg"
            alt="Quest Diagnostics"
            width={160}
            height={54}
            className="object-contain"
            priority
          />
        </header>

        <section className="fade-in-up rounded-[var(--ds-radius-sm)] border border-[var(--border)] bg-[var(--surface-0)] p-2 shadow-[var(--ds-elevation-1)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => setActiveTab("ingestion")}
              className={`rounded-[var(--ds-radius-sm)] px-4 py-2 text-left transition ${
                activeTab === "ingestion"
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
              }`}
            >
              <p className="ds-body font-bold">Clinical Data Ingestion</p>
              <p className="ds-caption">Upload and parse patient records into structured demographics and medical history.</p>
            </button>
            <button
              onClick={() => setActiveTab("nlp")}
              className={`rounded-[var(--ds-radius-sm)] px-4 py-2 text-left transition ${
                activeTab === "nlp"
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
              }`}
            >
              <p className="ds-body font-bold">Query Generation</p>
              <p className="ds-caption">Translate natural language questions into SQL queries over parsed patient data.</p>
            </button>
          </div>
        </section>

        {activeTab === "ingestion" ? <IngestionWorkspace /> : <NlpWorkspace />}


        <footer className="pb-4 text-center text-xs text-[var(--text-muted)]">
          <p className="inline-flex items-center gap-1">
            <Sparkle size={12} />
            Demonstration platform for clinical data ingestion and NLP-assisted SQL authoring.
          </p>
        </footer>
      </div>
    </main>
  );
}

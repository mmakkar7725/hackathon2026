import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function EntryPage() {
  return (
    <main className="dashboard-glow min-h-screen px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="ds-h1 text-[var(--text-primary)]">Entry Moved to Main App Tabs</h1>
          <p className="ds-body mt-2 text-[var(--text-secondary)]">
            The intake workflow is now the first tab in the main two-tab application.
          </p>
          <div className="mt-4">
            <Link href="/">
              <Button>Open Two-Tab App</Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

"use client";

import Prism from "prismjs";
import "prismjs/components/prism-sql";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SqlOutputProps {
  sql: string;
}

function normalizeSqlForView(sql: string) {
  return sql
    .trim()
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ")
    .replace(/\\"/g, '"');
}

export function SqlOutput({ sql }: SqlOutputProps) {
  const normalizedSql = normalizeSqlForView(sql);
  const highlighted = Prism.highlight(normalizedSql, Prism.languages.sql, "sql");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(normalizedSql);
  };

  const handleDownload = () => {
    const blob = new Blob([normalizedSql], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medquery-generated.sql";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="ds-h1 text-[18px] text-[var(--text-primary)]">Generated SQL</h3>
        <div className="flex gap-2">
          <Button onClick={handleCopy} size="sm" variant="secondary">
            Copy
          </Button>
          <Button onClick={handleDownload} size="sm" variant="secondary">
            Download
          </Button>
        </div>
      </div>
      <pre className="sql-scroll max-h-[340px] overflow-auto rounded-[var(--ds-radius-sm)] p-4 text-sm leading-6">
        <code
          className="language-sql"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, LoadingRows, PageHeader, Panel, StatusPill } from "@/components/app/primitives";
import { importsQuery } from "@/lib/api";
import { formatNumber, relativeTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({
    meta: [
      { title: "Imports — 2ndLife Revenue OS" },
      { name: "description", content: "Customer and policy list imports with row-level processing status." },
      { property: "og:title", content: "Imports — 2ndLife Revenue OS" },
      { property: "og:description", content: "Bring your customer book into the Revenue OS." },
    ],
  }),
  component: ImportsPage,
});

function ImportsPage() {
  const imports = useQuery(importsQuery());

  return (
    <>
      <PageHeader title="Imports" subtitle="Customer and policy list ingestion" />
      <Panel>
        {imports.isLoading ? (
          <LoadingRows rows={5} />
        ) : (imports.data ?? []).length === 0 ? (
          <EmptyState title="No imports yet" description="Upload a CSV to bring your book across." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3">File</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Rows</th>
                  <th className="pb-3 text-right">Imported</th>
                  <th className="pb-3 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {(imports.data ?? []).map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="py-3 font-medium">{i.filename}</td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          i.status === "completed" ? "success" : i.status === "failed" ? "danger" : "warning"
                        }
                      >
                        {titleCase(i.status)}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-right">{formatNumber(i.row_count)}</td>
                    <td className="py-3 text-right">{formatNumber(i.imported_count)}</td>
                    <td className="py-3 text-right text-muted-foreground">{relativeTime(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
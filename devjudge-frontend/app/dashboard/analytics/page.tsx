"use client";

import { useState, useCallback, ReactNode } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { AnalyticsContent } from "@/components/dashboard/analytics-content";

export default function AnalyticsPage() {
  const [pageMetadata, setPageMetadata] = useState<{
    eyebrow: string;
    title: string;
    actions?: ReactNode;
  }>({
    eyebrow: "",
    title: "",
  });

  const updatePageMetadata = useCallback((metadata: { eyebrow: string; title: string; actions?: ReactNode }) => {
    setPageMetadata(metadata);
  }, []);

  return (
    <MainLayout
      eyebrow={pageMetadata.eyebrow}
      title={pageMetadata.title}
      actions={pageMetadata.actions}
    >
      <AnalyticsContent setPageMetadata={updatePageMetadata} />
    </MainLayout>
  );
}

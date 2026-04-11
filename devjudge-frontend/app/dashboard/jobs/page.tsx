"use client";

import { useState, useCallback, ReactNode } from "react";
import { JobsScreen } from "@/components/dashboard/jobs-screen";
import { MainLayout } from "@/components/layout/main-layout";

export default function JobsPage() {
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
      <JobsScreen setPageMetadata={updatePageMetadata} />
    </MainLayout>
  );
}

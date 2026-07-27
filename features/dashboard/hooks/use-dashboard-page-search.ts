"use client";

import { useEffect, useState } from "react";

export const DASHBOARD_PAGE_SEARCH_EVENT = "dashboard-page-search";

type DashboardPageSearchDetail = {
  scope: string;
  query: string;
};

export function useDashboardPageSearch(scope: string) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleSearch = (event: Event) => {
      const detail = (event as CustomEvent<DashboardPageSearchDetail>).detail;
      if (detail?.scope === scope) {
        setQuery(detail.query);
      }
    };

    window.addEventListener(DASHBOARD_PAGE_SEARCH_EVENT, handleSearch);
    return () =>
      window.removeEventListener(DASHBOARD_PAGE_SEARCH_EVENT, handleSearch);
  }, [scope]);

  return [query, setQuery] as const;
}

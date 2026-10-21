"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  DEFAULT_KITCHEN_REGIONAL_SETTINGS,
  type KitchenRegionalSettings
} from "@/features/kitchen/components/kitchen-shared";

const KitchenRegionContext = createContext<KitchenRegionalSettings>(
  DEFAULT_KITCHEN_REGIONAL_SETTINGS
);

export function KitchenRegionProvider({
  children,
  value
}: {
  children: ReactNode;
  value: KitchenRegionalSettings;
}) {
  return (
    <KitchenRegionContext.Provider value={value}>
      {children}
    </KitchenRegionContext.Provider>
  );
}

export function useKitchenRegion() {
  return useContext(KitchenRegionContext);
}

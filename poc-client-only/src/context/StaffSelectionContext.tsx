import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSession } from "./SessionContext";

// 管理者専用の対象スタッフ選択状態。「予定」「勤怠」タブで共有する(仕様3.2/3.4)。
interface StaffSelectionContextValue {
  selectedStaffId: string;
  setSelectedStaffId: (id: string) => void;
}

const StaffSelectionContext = createContext<StaffSelectionContextValue | null>(null);

export function StaffSelectionProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [selectedStaffId, setSelectedStaffId] = useState<string>(session?.staffId ?? "");

  const value = useMemo(() => ({ selectedStaffId, setSelectedStaffId }), [selectedStaffId]);

  return <StaffSelectionContext.Provider value={value}>{children}</StaffSelectionContext.Provider>;
}

export function useStaffSelection(): StaffSelectionContextValue {
  const ctx = useContext(StaffSelectionContext);
  if (!ctx) throw new Error("useStaffSelection must be used within StaffSelectionProvider");
  return ctx;
}

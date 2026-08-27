import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TabKey = "schedule" | "customers" | "attendance";

export interface ReportModalState {
  open: boolean;
  customerId: string | null; // nullならスタンドアロン(領収書のみ登録)モード
  initialTab: "report" | "accident";
}

export interface ReceiptModalState {
  open: boolean;
  customerId: string | null;
  customerName: string | null;
}

interface AppUIContextValue {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;

  customerSearchQuery: string;
  navigateToCustomers: (searchQuery?: string) => void;
  consumeCustomerSearchQuery: () => void;

  reportModal: ReportModalState;
  openReportModal: (customerId: string | null, initialTab?: "report" | "accident") => void;
  closeReportModal: () => void;

  receiptModal: ReceiptModalState;
  openReceiptModal: (customerId?: string | null, customerName?: string | null) => void;
  closeReceiptModal: () => void;

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const AppUIContext = createContext<AppUIContextValue | null>(null);

export function AppUIProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [reportModal, setReportModal] = useState<ReportModalState>({ open: false, customerId: null, initialTab: "report" });
  const [receiptModal, setReceiptModal] = useState<ReceiptModalState>({ open: false, customerId: null, customerName: null });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const value = useMemo<AppUIContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      customerSearchQuery,
      navigateToCustomers: (searchQuery = "") => {
        setCustomerSearchQuery(searchQuery);
        setActiveTab("customers");
      },
      consumeCustomerSearchQuery: () => setCustomerSearchQuery(""),
      reportModal,
      openReportModal: (customerId, initialTab = "report") => setReportModal({ open: true, customerId, initialTab }),
      closeReportModal: () => setReportModal((s) => ({ ...s, open: false })),
      receiptModal,
      openReceiptModal: (customerId = null, customerName = null) =>
        setReceiptModal({ open: true, customerId, customerName }),
      closeReceiptModal: () => setReceiptModal((s) => ({ ...s, open: false })),
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [activeTab, customerSearchQuery, reportModal, receiptModal, settingsOpen],
  );

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>;
}

export function useAppUI(): AppUIContextValue {
  const ctx = useContext(AppUIContext);
  if (!ctx) throw new Error("useAppUI must be used within AppUIProvider");
  return ctx;
}

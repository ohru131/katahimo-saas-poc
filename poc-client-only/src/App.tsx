import { SessionProvider, useSession } from "./context/SessionContext";
import { StaffSelectionProvider } from "./context/StaffSelectionContext";
import { SettingsProvider } from "./context/SettingsContext";
import { AppUIProvider, useAppUI } from "./context/AppUIContext";
import { LoginModal } from "./components/login/LoginModal";
import { Header } from "./components/header/Header";
import { TabBar } from "./components/common/TabBar";
import { ScheduleTab } from "./components/schedule/ScheduleTab";
import { CustomersTab } from "./components/customers/CustomersTab";
import { AttendanceTab } from "./components/attendance/AttendanceTab";
import { ReportAccidentModal } from "./components/report/ReportAccidentModal";
import { ReceiptModal } from "./components/receipt/ReceiptModal";
import { SettingsModal } from "./components/settings/SettingsModal";

function MainApp() {
  const { session } = useSession();
  const { activeTab } = useAppUI();

  if (!session) return <LoginModal />;

  return (
    <>
      <Header />
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: "1em" }}>
        {activeTab === "schedule" && <ScheduleTab />}
        {activeTab === "customers" && <CustomersTab />}
        {activeTab === "attendance" && <AttendanceTab />}
      </main>
      <TabBar />
      <ReportAccidentModal />
      <ReceiptModal />
      <SettingsModal />
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <SettingsProvider>
        <StaffSelectionProvider>
          <AppUIProvider>
            <MainApp />
          </AppUIProvider>
        </StaffSelectionProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}

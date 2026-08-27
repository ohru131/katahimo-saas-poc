import { useEffect, useMemo, useState } from "react";
import type { Customer } from "../../types";
import { getData, getRecentCustomers, markRecentCustomer } from "../../api";
import { useSession } from "../../context/SessionContext";
import { useAppUI } from "../../context/AppUIContext";
import { CustomerDetailModal } from "./CustomerDetailModal";
import { CustomerHistoryModal } from "./CustomerHistoryModal";
import "./CustomersTab.css";

export function CustomersTab() {
  const { session } = useSession();
  const { customerSearchQuery, consumeCustomerSearchQuery, openReportModal, openReceiptModal } = useAppUI();

  const [searchText, setSearchText] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const { cities, customers } = useMemo(() => getData(), []);

  // スケジュールタブなどから顧客名検索クエリ付きで遷移してきた場合、検索欄へ反映する
  useEffect(() => {
    if (customerSearchQuery) {
      setSearchText(customerSearchQuery);
      consumeCustomerSearchQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearchQuery]);

  const displayedCustomers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const noFilter = q === "" && cityFilter === "";

    if (noFilter) {
      const recentIds = session ? getRecentCustomers(session) : [];
      if (recentIds.length > 0) {
        const byId = new Map(customers.map((c) => [c.id, c]));
        const ordered = recentIds
          .map((id) => byId.get(id))
          .filter((c): c is Customer => c != null);
        if (ordered.length > 0) return ordered;
      }
      return customers;
    }

    return customers.filter((c) => {
      const nameMatch = q === "" || c.name.toLowerCase().includes(q);
      const cityMatch = cityFilter === "" || c.city === cityFilter;
      return nameMatch && cityMatch;
    });
  }, [customers, searchText, cityFilter, session]);

  const handleCardClick = (customer: Customer) => {
    if (session) markRecentCustomer(session, customer.id);
    openReportModal(customer.id);
  };

  return (
    <div className="customers-tab stack">
      <button className="app-btn secondary" onClick={() => openReceiptModal(null, null)}>
        🧾 領収書登録
      </button>

      <div className="stack customers-filters">
        <div>
          <label className="field-label" htmlFor="customer-search-input">
            顧客名で検索
          </label>
          <input
            id="customer-search-input"
            className="field-input"
            type="text"
            placeholder="顧客名を入力"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="customer-city-select">
            地域で絞り込み
          </label>
          <select
            id="customer-city-select"
            className="field-input"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="">すべて</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {displayedCustomers.length === 0 ? (
        <p className="muted">該当する訪問先が見つかりません</p>
      ) : (
        <div className="stack">
          {displayedCustomers.map((customer) => (
            <div
              key={customer.id}
              className="app-card customer-card"
              onClick={() => handleCardClick(customer)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleCardClick(customer);
              }}
            >
              <div className="row between">
                <span className="customer-card-name">{customer.name}</span>
                <span className="badge">{customer.city}</span>
              </div>
              <div className="row customer-card-actions">
                <button
                  className="app-btn secondary small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailCustomer(customer);
                  }}
                >
                  顧客情報
                </button>
                <button
                  className="app-btn secondary small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoryCustomer(customer);
                  }}
                >
                  活動記録
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailCustomer && (
        <CustomerDetailModal customer={detailCustomer} onClose={() => setDetailCustomer(null)} />
      )}
      {historyCustomer && (
        <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
      )}
    </div>
  );
}

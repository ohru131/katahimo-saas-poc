import type { ReactNode } from "react";
import type { Customer, CustomerDetailField, FamilyMember } from "../../types";
import { Modal } from "../common/Modal";
import { buildCustomerMapSearchUrl } from "../../api";
import "./CustomersTab.css";

interface Props {
  customer: Customer;
  onClose: () => void;
}

function isKeyLike(key: string, target: string): boolean {
  return key === target || key.includes(target);
}

/** dob (YYYY-MM-DD、歴史上の人物のため負の年もありうる) から満年齢を計算する。 */
function calcAge(dob: string): number | null {
  const m = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthdayThisYear =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

function FamilyRow({ member }: { member: FamilyMember }) {
  const age = calcAge(member.dob);
  return (
    <div className="app-card family-card stack">
      <div className="row between">
        <span className="family-name">{member.name}</span>
        <span className="muted small">{age != null ? `${age}歳` : "―"}</span>
      </div>
      <div className="small">アレルギー: {member.allergy || "特になし"}</div>
      {member.info && <div className="muted small">{member.info}</div>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row between detail-row">
      <span className="field-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function detailValueFor(field: CustomerDetailField, emailField?: CustomerDetailField, phoneField?: CustomerDetailField) {
  if (field === emailField) {
    return <a href={`mailto:${field.value}`}>{field.value}</a>;
  }
  if (field === phoneField) {
    return <a href={`tel:${field.value.replace(/-/g, "")}`}>{field.value}</a>;
  }
  return field.value;
}

export function CustomerDetailModal({ customer, onClose }: Props) {
  const emailField = customer.details.find((d) => isKeyLike(d.key, "メールアドレス"));
  const phoneField = customer.details.find((d) => isKeyLike(d.key, "電話番号"));

  return (
    <Modal title={`${customer.name} の顧客情報`} onClose={onClose}>
      <div className="stack">
        <section className="stack">
          <h3 className="section-title">家族情報</h3>
          {customer.family.length === 0 ? (
            <p className="muted small">登録された家族情報はありません</p>
          ) : (
            <div className="stack">
              {customer.family.map((member, idx) => (
                <FamilyRow key={`${member.name}-${idx}`} member={member} />
              ))}
            </div>
          )}
        </section>

        <section className="stack">
          <h3 className="section-title">基本情報</h3>
          <div className="app-card stack">
            <DetailRow label="地域" value={customer.city} />
            <DetailRow
              label="住所"
              value={
                <a href={buildCustomerMapSearchUrl(customer.address)} target="_blank" rel="noreferrer">
                  {customer.address}
                </a>
              }
            />
            {customer.details.map((field) => (
              <DetailRow key={field.key} label={field.key} value={detailValueFor(field, emailField, phoneField)} />
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

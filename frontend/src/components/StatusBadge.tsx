type LedgerStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
type StudentStatus = 'ACTIVE' | 'INACTIVE';

export function LedgerBadge({ status }: { status: LedgerStatus }) {
  const map: Record<LedgerStatus, string> = {
    UNPAID: 'badge-unpaid',
    PARTIAL: 'badge-partial',
    PAID: 'badge-paid',
    WAIVED: 'badge-waived',
  };
  return <span className={map[status]}>{status}</span>;
}

export function StudentBadge({ status }: { status: StudentStatus }) {
  const map: Record<StudentStatus, string> = {
    ACTIVE: 'badge-active',
    INACTIVE: 'badge-inactive',
  };
  return <span className={map[status]}>{status}</span>;
}

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span className={status === 'SUCCESS' ? 'badge-paid' : 'badge-unpaid'}>
      {status}
    </span>
  );
}

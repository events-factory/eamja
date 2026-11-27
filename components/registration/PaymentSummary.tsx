import { extractCurrency, parseFeeAmount } from '@/lib/payment';

interface PaymentSummaryProps {
  fee: string;
  // The undiscounted fee, struck through when higher than `fee`.
  normalFee?: string;
  // What is left to pay, when part of the fee is already settled.
  due?: number;
}

// Fee breakdown shown on the last form step of a paid category.
export default function PaymentSummary({
  fee,
  normalFee,
  due,
}: PaymentSummaryProps) {
  const total = due ?? parseFeeAmount(fee);
  return (
    <div
      className="mt-5 rounded-xl border bg-white p-4 sm:p-5"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          style={{ color: 'var(--red)' }}
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Payment summary
        </span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--muted)' }}>Registration fee</span>
          <span
            className="font-medium tabular-nums"
            style={{ color: 'var(--text)' }}
          >
            {normalFee && parseFeeAmount(normalFee) > parseFeeAmount(fee) && (
              <span
                className="mr-2 font-normal line-through"
                style={{ color: 'var(--muted)' }}
              >
                {normalFee}
              </span>
            )}
            {fee}
          </span>
        </div>
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            Total due
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: 'var(--red)' }}
          >
            {extractCurrency(fee)} {total.toLocaleString()}
          </span>
        </div>
      </div>
      <p
        className="text-xs mt-3 flex items-center gap-1.5"
        style={{ color: 'var(--muted)' }}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Payments are processed securely. Card details never reach our servers.
      </p>
    </div>
  );
}

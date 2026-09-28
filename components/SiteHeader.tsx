import Image from 'next/image';
import Link from 'next/link';

const NAV = [
  { href: '/registration', label: 'Register' },
  { href: '/accommodation-2', label: 'Accommodation' },
];

interface SiteHeaderProps {
  eyebrow: string;
  title: string;
  active?: '/registration' | '/accommodation-2';
}

export default function SiteHeader({ eyebrow, title, active }: SiteHeaderProps) {
  return (
    <header
      style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div
          className="flex items-center gap-3 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Image
            src="/eamja-logo.png"
            alt="EAMJA"
            width={40}
            height={40}
            priority
            className="rounded-full shrink-0"
          />
          <span
            className="leading-tight min-w-0"
            style={{ fontFamily: 'var(--font-poppins),sans-serif' }}
          >
            <span
              className="block text-sm font-semibold tracking-wide"
              style={{ color: 'var(--ink)' }}
            >
              EAMJA
            </span>
            <span
              className="hidden sm:block text-xs font-normal"
              style={{ color: 'var(--muted)' }}
            >
              East African Magistrates&apos; and Judges&apos; Association
            </span>
          </span>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.href ? 'page' : undefined}
                className="px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-gray-100"
                style={{
                  fontFamily: 'var(--font-poppins),sans-serif',
                  color: active === item.href ? 'var(--red)' : 'var(--text)',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ padding: '56px 0 52px' }}>
          <p
            style={{
              fontFamily: 'var(--font-poppins),sans-serif',
              fontSize: 11,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
              color: 'var(--red)',
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            {eyebrow}
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-poppins),sans-serif',
              fontSize: 'clamp(30px,4.4vw,46px)',
              fontWeight: 700,
              color: 'var(--ink)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              maxWidth: 700,
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
}

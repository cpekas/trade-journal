export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true">
      <path
        d="M80 26 H176 A20 20 0 0 1 196 46 V230 L128 184 L60 230 V46 A20 20 0 0 1 80 26 Z"
        fill="#16C784"
      />
      <rect x="123" y="60" width="10" height="130" rx="5" fill="#0C3B2C" />
      <rect x="104" y="92" width="48" height="68" rx="10" fill="#0C3B2C" />
    </svg>
  )
}

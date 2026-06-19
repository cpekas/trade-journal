// Server-defined config (loaded via fetchConfig; user-editable in Settings; Laravel in Phase 2).
export const DEFAULT_CONFIG = {
  symbols: ['SOL', 'BTC', 'ETH', 'XRP'],
  sessions: ['آسیا', 'لندن', 'نیویورک'],
  timeframes: ['1m', '5m', '15m', '1H', '4H', 'D'],
  setups: ['Spring', 'شکست فیک', 'Fixed', 'Upthrust', 'Order Block', 'FVG', 'Liquidity Sweep', 'BOS'],
  leverages: ['1', '2', '3', '5', '10', '20', '25', '50', '100'],
  checklist: [
    { id: 'confirmed', label: 'تأیید گرفتم؟' },
    { id: 'rightSession', label: 'سشن درسته؟' },
    { id: 'standardSize', label: 'حجم استانداردمه؟' },
  ],
  // personal per-trade risk cap (%) — feeds the execution score and tilt warnings
  maxRiskPercent: 2,
  // top-down prep routines (editable in Settings; run in the روتین tab)
  routines: {
    monthly: ['OB', 'FVG', 'Liq', 'Reversal', 'Stone'],
    weekly: ['OB', 'FVG', 'Liq', 'Reversal', 'Stone'],
    daily: ['OB', 'FVG', 'Liq', 'Reversal', 'Stone'],
    h4: ['OB', 'FVG', 'Liq', 'Stone'], // ۴ساعته بدون Reversal
  },
  // reference timeframe for the trend-alignment check (user-editable in Settings)
  trendRefCadence: 'daily',
}

// shared Persian labels for cadences + trend bias
export const CADENCE_FA = { monthly: 'ماهانه', weekly: 'هفتگی', daily: 'روزانه', h4: '۴ساعته' } as const
export const BIAS_FA = {
  up: { icon: '📈', label: 'صعودی' },
  down: { icon: '📉', label: 'نزولی' },
  range: { icon: '↔️', label: 'رنج' },
} as const

// if-then chips for the weekly focus rule (implementation intentions)
export const IF_TRIGGERS = [
  'وسوسهٔ ورود زود داشتم',
  'دو ضرر پشت‌سرهم خوردم',
  'حس FOMO اومد',
  'خواستم حجم رو زیاد کنم',
  'قیمت بدون من حرکت کرد',
]
export const THEN_ACTIONS = [
  'تا تأیید کامل صبر می‌کنم',
  '۱۰ دقیقه از چارت فاصله می‌گیرم',
  'حجم استاندارد می‌زنم',
  'چک‌لیست رو کامل می‌کنم',
  'امروز دیگه ترید نمی‌کنم',
]

// Static option lists (not server-managed for now).
export const RISK_PERCENTS = ['0.5', '1', '2']
export const MOODS_BEFORE = ['😌 آروم', '💪 مطمئن', '⚡ عجول', '😨 ترس', '🤑 طمع']
export const MOODS_AFTER = ['😌 آروم', '😄 راضی', '😤 عصبی', '😞 پشیمون', '😬 مضطرب']
export const MISTAKES = ['عجله', 'حجم زیاد', 'جابجایی حد ضرر', 'ورود زودهنگام', 'خروج احساسی', 'بدون تأیید', 'FOMO', 'انتقام‌گیری']
export const DID_WELL = ['صبر', 'تأیید درست', 'حجم درست', 'احترام به حد ضرر', 'سشن درست', 'خروج طبق پلن']

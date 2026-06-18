interface Props {
  options: readonly string[]
  value?: string | string[]
  multi?: boolean
  onChange: (value: string | string[] | undefined) => void
}

export default function ChipGroup({ options, value, multi, onChange }: Props) {
  const isActive = (o: string) =>
    multi ? ((value as string[]) || []).includes(o) : value === o

  const click = (o: string) => {
    if (multi) {
      const arr = (value as string[]) || []
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])
    } else {
      onChange(value === o ? undefined : o)
    }
  }

  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={'chip' + (multi ? ' multi' : '') + (isActive(o) ? ' active' : '')}
          onClick={() => click(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

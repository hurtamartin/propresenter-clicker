interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}

// iOS-style segmented control.
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "sm",
}: Props<T>) {
  const item = size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 flex-1 px-3 text-[14px]";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex gap-0.5 rounded-full bg-raised p-0.5 ${size === "md" ? "w-full" : ""}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`press rounded-full font-semibold ${item} ${
              active
                ? "bg-surface text-fg shadow-[0_1px_3px_rgb(0_0_0/0.18)]"
                : "text-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

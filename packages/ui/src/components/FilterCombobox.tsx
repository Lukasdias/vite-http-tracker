import { CheckIcon, ChevronDownIcon, Cross2Icon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";

export interface FilterComboboxProps {
  label: string;
  placeholder: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

const MAX_VISIBLE_CHIPS = 2;

export function FilterCombobox({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = selected.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = Math.max(0, selected.length - visible.length);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent): void {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function toggleOption(option: string): void {
    const next = selected.includes(option)
      ? selected.filter((value) => value !== option)
      : [...selected, option];
    onChange(next);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
        {label}
      </span>
      <div
        className="input input-sm input-bordered flex min-h-9 w-full min-w-0 items-center gap-1.5 bg-base-100 text-left text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {visible.length ? (
            visible.map((value) => (
              <span
                key={value}
                className="badge badge-ghost max-w-24 shrink-0 gap-0.5 truncate font-mono text-[10px]"
              >
                <span className="truncate">{value}</span>
                <button
                  type="button"
                  className="-mr-1 rounded-full p-0.5 hover:bg-base-300"
                  aria-label={`Remove ${value}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleOption(value);
                  }}
                >
                  <Cross2Icon className="size-2.5" aria-hidden="true" />
                </button>
              </span>
            ))
          ) : (
            <span className="truncate text-xs text-base-content/50">{placeholder}</span>
          )}
          {hiddenCount > 0 && (
            <span className="badge badge-outline shrink-0 text-[10px]">+{hiddenCount}</span>
          )}
        </span>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>
      {open && (
        <div
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
        >
          {options.length ? (
            options.map((option) => {
              const checked = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => toggleOption(option)}
                >
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-content" : "border-base-300"}`}
                  >
                    {checked && <CheckIcon className="size-3" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 truncate font-mono">{option}</span>
                </button>
              );
            })
          ) : (
            <span className="block px-2 py-2 text-xs text-base-content/50">No options</span>
          )}
        </div>
      )}
    </div>
  );
}

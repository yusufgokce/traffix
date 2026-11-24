import type { ReactNode } from "react";

export function AppHeader({ right }: { right: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 px-5">
      <div className="flex items-center gap-2">
        <div className="grid size-7 place-items-center rounded-md bg-sun text-base font-black text-app">T</div>
        <span className="text-lg font-extrabold tracking-tight text-white">traffix</span>
      </div>
      <span className="max-w-[60%] truncate text-right text-[15px] leading-tight text-soft">{right}</span>
    </header>
  );
}

export function Primary({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-2xl bg-sun px-5 py-4 text-[17px] font-bold text-app enabled:active:scale-[0.99] disabled:opacity-40"
    >
      <span>{children}</span>
      <span aria-hidden>→</span>
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-card p-5 ${className}`}>{children}</div>;
}

export function Plate({ value, province, onChange, error }: {
  value: string;
  province: string;
  onChange?: (v: string) => void;
  error?: boolean;
}) {
  return (
    <div className={`relative rounded-xl border-4 bg-plate px-4 pb-3 pt-2 text-center ${error ? "border-coral" : "border-[#c9ccc0]"}`}>
      <span className="absolute left-2 top-2 size-1.5 rounded-full bg-app/70" />
      <span className="absolute right-2 top-2 size-1.5 rounded-full bg-app/70" />
      <div className="text-sm font-semibold tracking-wide text-app">{province.toUpperCase()}</div>
      {onChange ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8))}
          placeholder="ABCD 123"
          autoCapitalize="characters"
          aria-label="Licence plate"
          className="w-full bg-transparent text-center font-mono text-[34px] font-bold tracking-wider text-app outline-none placeholder:text-app/25"
        />
      ) : (
        <div className="font-mono text-[34px] font-bold tracking-wider text-app">{value}</div>
      )}
    </div>
  );
}

export function TargetCard({ label, value, voice, setVoice }: {
  label: string;
  value: string;
  voice: boolean;
  setVoice: (v: boolean) => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-app p-3">
          <div className="mb-2 flex gap-1.5">
            <i className="h-5 w-6 rounded bg-card-2" />
            <i className="h-5 w-6 rounded bg-card-2" />
            <i className="h-5 w-6 rounded bg-sun" />
          </div>
          <div className="mb-2 flex items-center gap-1">
            <i className="size-2.5 rounded-full bg-white" />
            <i className="h-1 flex-1 bg-sun" />
          </div>
          <div className="text-sm font-semibold text-white">You → {value}</div>
        </div>
        <div>
          <div className="text-soft">{label}</div>
          <div className="text-4xl font-black text-sun">{value}</div>
        </div>
      </div>
      <label className="flex items-center gap-3 font-semibold text-white">
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-sun stroke-2" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
        </svg>
        Voice guidance on
        <Toggle value={voice} onChange={setVoice} />
      </label>
    </Card>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative ml-auto h-7 w-12 rounded-full transition ${value ? "bg-sun" : "bg-card-2"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full transition-all ${value ? "left-6 bg-app" : "left-1 bg-plate"}`} />
    </button>
  );
}

export function Arrow({ dir }: { dir: "straight" | "left" | "right" }) {
  if (dir === "straight") {
    return (
      <svg viewBox="0 0 200 200" className="mx-auto h-52" aria-label="Go straight">
        <path d="M100 10 L190 95 L135 95 L135 190 L65 190 L65 95 L10 95 Z" fill="#f4de55" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 200" className={`mx-auto h-52 ${dir === "right" ? "-scale-x-100" : ""}`} aria-label={`Turn ${dir}`}>
      <path d="M10 75 L80 10 L80 50 L160 50 L160 190 L110 190 L110 100 L80 100 L80 140 Z" fill="#f4de55" />
    </svg>
  );
}

export function StopSign({ word }: { word: string }) {
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-52" aria-label={word}>
      <path d="M60 5 H140 L195 60 V140 L140 195 H60 L5 140 V60 Z" fill="#ca827b" />
      <text x="100" y="118" textAnchor="middle" fontSize="48" fontWeight="900" fill="#101718" fontFamily="inherit">
        {word}
      </text>
    </svg>
  );
}

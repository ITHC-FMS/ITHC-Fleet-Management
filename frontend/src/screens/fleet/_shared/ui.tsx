"use client";

import { Camera, Minus, Plus } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Photo } from "@/data/fleet";

/** Touch-first button: 64px tall minimum. */
export function BigButton({ children, onClick, tone = "default", selected, disabled, className, type = "button" }: {
  children: ReactNode; onClick?: () => void; tone?: "default" | "primary" | "danger" | "good"; selected?: boolean; disabled?: boolean; className?: string; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-16 min-w-16 rounded-xl border-2 px-5 text-lg font-semibold transition active:scale-[0.98] disabled:opacity-40",
        tone === "primary" && "border-primary bg-primary text-primary-foreground",
        tone === "danger" && "border-red-600 bg-red-600 text-white",
        tone === "good" && "border-emerald-600 bg-emerald-600 text-white",
        tone === "default" && (selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"),
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Big +/- stepper for odometer and similar numbers. */
export function NumberStepper({ value, onChange, steps = [1, 10, 100], unit, min = 0 }: { value: number; onChange: (n: number) => void; steps?: number[]; unit?: string; min?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-center gap-2 rounded-xl border-2 bg-card py-4">
        <span className="text-5xl font-bold tabular-nums">{value.toLocaleString("en-US")}</span>
        {unit && <span className="text-xl text-muted-foreground">{unit}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((s) => (
          <BigButton key={`m${s}`} onClick={() => onChange(Math.max(min, value - s))} className="flex items-center justify-center gap-1"><Minus className="size-5" /> {s}</BigButton>
        ))}
        {steps.map((s) => (
          <BigButton key={`p${s}`} onClick={() => onChange(value + s)} className="flex items-center justify-center gap-1"><Plus className="size-5" /> {s}</BigButton>
        ))}
      </div>
    </div>
  );
}

/** Downscale a camera image to a small thumbnail so it can live in local storage. */
export async function fileToPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = url; });
    const max = 140, k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return { name: file.name, thumb: c.toDataURL("image/jpeg", 0.55) };
  } catch {
    return { name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoCapture({ photos, onChange, label = "Take photo", big = true }: { photos: Photo[]; onChange: (p: Photo[]) => void; label?: string; big?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange([...photos, await fileToPhoto(f)]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn("flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed font-semibold hover:bg-muted", big ? "min-h-24 text-xl" : "min-h-12 text-sm")}
      >
        <Camera className={big ? "size-8" : "size-5"} /> {label}
      </button>
      <PhotoStrip photos={photos} onRemove={(i) => onChange(photos.filter((_, j) => j !== i))} />
    </div>
  );
}

export function PhotoStrip({ photos, onRemove }: { photos: Photo[]; onRemove?: (i: number) => void }) {
  if (!photos.length) return <p className="text-sm text-muted-foreground">No photos attached.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <div key={`${p.name}-${i}`} className="relative flex size-24 items-center justify-center overflow-hidden rounded-lg border bg-muted text-center text-[10px] text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.thumb ? <img src={p.thumb} alt={p.name} className="size-full object-cover" /> : <span className="px-1 break-all">{p.name}</span>}
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} className="absolute end-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">x</button>
          )}
        </div>
      ))}
    </div>
  );
}

export function DeskSwitcher({ desks, deskId, onChange }: { desks: { id: string; name: string }[]; deskId: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2">
      <span className="px-2 text-sm text-muted-foreground">Desk (demo switcher)</span>
      {desks.map((d) => (
        <BigButton key={d.id} selected={d.id === deskId} onClick={() => onChange(d.id)} className="min-h-14 text-base">{d.name.replace("Handover ", "")}</BigButton>
      ))}
    </div>
  );
}

export const Section = ({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) => (
  <section className="space-y-3 rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2>{right}</div>
    {children}
  </section>
);

export const fuelLabel = (e: number) => (e <= 0 ? "Empty" : e >= 8 ? "Full" : `${e}/8`);

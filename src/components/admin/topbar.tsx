type TopbarProps = {
  title?: string;
  subtitle?: string;
};

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          {title ? <div className="text-base font-semibold">{title}</div> : null}
          <div className="text-sm text-muted-foreground">{subtitle ?? "Real-time • Bakong • Reports"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-1 text-xs">Live</span>
          <span className="rounded-full bg-muted px-2 py-1 text-xs">USD</span>
        </div>
      </div>
    </div>
  );
}
import type { ReactNode } from "react";

export function ScreenShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="bg-stage flex h-dvh w-full flex-col items-center justify-center overflow-hidden px-8 py-6">
      <header className="mb-4 flex items-center gap-4 text-primary">
        <span className="h-px w-12 bg-primary/60" />
        <span className="font-display text-lg tracking-[0.4em] uppercase">Bohemia Experience</span>
        <span className="h-px w-12 bg-primary/60" />
      </header>
      <div className="flex w-full flex-1 flex-col items-center justify-center">{children}</div>
      {footer && <footer className="mt-4">{footer}</footer>}
    </main>
  );
}

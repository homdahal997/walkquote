import { Link, useLocation } from "@tanstack/react-router";
import { Briefcase, Home } from "lucide-react";

/** One-click switch between the homeowner estimate and the contractor demo inbox. */
export function ViewSwitcher() {
  const pathname = useLocation({ select: (location) => location.pathname });
  if (!(pathname === "/" || pathname === "/contractor")) return null;
  const onContractor = pathname === "/contractor";
  const base = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition";
  const active = "bg-primary text-primary-foreground shadow";
  const idle = "text-foreground hover:bg-muted";
  return (
    <nav aria-label="Switch view" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
      <Link to="/" className={`${base} ${onContractor ? idle : active}`}><Home size={15} /> Homeowner</Link>
      <Link to="/contractor" search={{ view: "demo" }} className={`${base} ${onContractor ? active : idle}`}><Briefcase size={15} /> Contractor demo</Link>
    </nav>
  );
}

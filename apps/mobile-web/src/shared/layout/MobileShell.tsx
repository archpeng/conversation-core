import { ClipboardList, History, Home, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../components/ui/button.js";
import { cn } from "../components/utils.js";

export type AppTab = "agent" | "tasks" | "objects" | "review";

type MobileShellProps = {
  activeTab: AppTab;
  onTabChange(tab: AppTab): void;
  children: ReactNode;
};

const tabs = [
  { id: "agent", label: "Agent", icon: Home },
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "objects", label: "Objects", icon: Search },
  { id: "review", label: "Review", icon: History }
] satisfies Array<{ id: AppTab; label: string; icon: typeof Home }>;

export function MobileShell({ activeTab, onTabChange, children }: MobileShellProps) {
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? "Agent";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f7f7f5]">
      <header className="sticky top-0 z-10 border-b border-border bg-[#f7f7f5]/95 px-4 py-2 backdrop-blur">
        <div className="text-xs font-medium uppercase tracking-normal text-muted">PMS Agent</div>
        <h1 className="text-lg font-semibold text-ink">{activeTab === "agent" ? "Conversation" : activeLabel}</h1>
      </header>
      <main className={cn("flex-1", activeTab === "agent" ? "min-h-0 overflow-hidden pb-16" : "space-y-4 px-4 py-4 pb-24")}>{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-border bg-white px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className={cn("h-12 flex-col gap-1 rounded-md px-1 text-xs", active ? "bg-neutral-100 text-ink" : "text-muted")}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}

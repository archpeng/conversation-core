import { useState } from "react";
import { AgentFeed } from "../features/agent/AgentFeed.js";
import { ObjectsView } from "../features/objects/ObjectsView.js";
import { ReviewView } from "../features/review/ReviewView.js";
import { TasksView } from "../features/tasks/TasksView.js";
import { MobileShell, type AppTab } from "../shared/layout/MobileShell.js";

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("agent");

  return (
    <MobileShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "agent" ? <AgentFeed /> : null}
      {activeTab === "tasks" ? <TasksView /> : null}
      {activeTab === "objects" ? <ObjectsView /> : null}
      {activeTab === "review" ? <ReviewView /> : null}
    </MobileShell>
  );
}

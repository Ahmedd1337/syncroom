import { WorkspaceApp } from "@/components/workspace-app";
import { demoSnapshot } from "@/lib/demo";
export default function DemoPage() {
  return <WorkspaceApp initial={demoSnapshot()} demo />;
}

import type { Metadata } from "next"
import { AgentModels } from "@/components/ops/agent-models"

export const metadata: Metadata = { title: "Agentmodeller · scout/gaming" }

export default function Page() {
  return <AgentModels />
}

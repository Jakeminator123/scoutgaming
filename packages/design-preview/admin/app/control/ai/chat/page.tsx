import type { Metadata } from "next"
import { AgentChat } from "@/components/ops/agent-chat"

export const metadata: Metadata = { title: "Intern agentchatt · scout/gaming" }

export default function Page() {
  return <AgentChat />
}

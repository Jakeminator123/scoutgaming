"use client"

import { useState, type FormEvent } from "react"
import { Plus } from "lucide-react"
import { ACCESS_LEVELS, CURRENT_USER, type AccessLevel } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Page, PageHeader, Panel, SmallButton, Td, Th, inputClass } from "./ui"
import { cn } from "@/lib/utils"

type Account = { id: string; name: string; email: string; level: AccessLevel; scope: string; mfa: boolean; lastSeen: string }

const SEED: Account[] = [
  { id: "u1", name: "Jakob L.", email: "jakob@scoutgaming.se", level: 1, scope: "all", mfa: true, lastSeen: "Nu" },
  { id: "u2", name: "Sara K.", email: "sara@scoutgaming.se", level: 1, scope: "all", mfa: true, lastSeen: "12/10 11:20" },
  { id: "u3", name: "Mattias B.", email: "mattias@scoutgaming.se", level: 2, scope: "all", mfa: true, lastSeen: "12/10 09:02" },
  { id: "u4", name: "Lina H.", email: "lina@scoutgaming.se", level: 3, scope: "all", mfa: false, lastSeen: "10/10 16:45" },
  { id: "u5", name: "Anna (Nordic Bet)", email: "anna@nordicbet.com", level: 2, scope: "nordic-bet", mfa: true, lastSeen: "11/10 13:10" },
]

export function AccountsAdmin() {
  const studio = useStudio()
  const [accounts, setAccounts] = useState(SEED)
  const [email, setEmail] = useState("")
  const [level, setLevel] = useState<AccessLevel>(3)
  const [scope, setScope] = useState("all")
  const [error, setError] = useState<string | null>(null)

  const scopeName = (id: string) => (id === "all" ? "Alla spelbolag" : studio.operators.find((item) => item.id === id)?.name ?? "Raderat bolag")
  const levelOnes = accounts.filter((account) => account.level === 1).length

  const changeLevel = (account: Account, next: AccessLevel) => {
    if (account.level === 1 && next !== 1 && levelOnes === 1) return setError("Minst ett konto måste ha nivå 1.")
    const reason = window.prompt(`Anledning till att ändra ${account.name} till ${ACCESS_LEVELS[next].label}:`)
    if (!reason?.trim()) return
    setAccounts((current) => current.map((item) => (item.id === account.id ? { ...item, level: next } : item)))
    studio.log("Åtkomst", `${account.name}: ${ACCESS_LEVELS[account.level].label} → ${ACCESS_LEVELS[next].label}`, reason.trim())
    setError(null)
  }

  const invite = (event: FormEvent) => {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setError("Ange en giltig e-post.")
    if (accounts.some((item) => item.email === value)) return setError("Kontot finns redan.")
    setAccounts((current) => [
      ...current,
      { id: `u-${Date.now().toString(36)}`, name: value.split("@")[0], email: value, level, scope, mfa: false, lastSeen: "Inbjuden" },
    ])
    studio.log("Åtkomst", `Bjöd in ${value} som ${ACCESS_LEVELS[level].label} (${scopeName(scope)})`)
    setEmail("")
    setError(null)
  }

  const remove = (account: Account) => {
    if (account.name === CURRENT_USER) return setError("Du kan inte ta bort ditt eget konto.")
    if (account.level === 1 && levelOnes === 1) return setError("Minst ett konto måste ha nivå 1.")
    if (!window.confirm(`Ta bort ${account.email}?`)) return
    setAccounts((current) => current.filter((item) => item.id !== account.id))
    studio.log("Åtkomst", `Tog bort konto ${account.email}`)
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Admin · Nivå 1"
        title="Konton & åtkomst"
        description="Nivå 1 administrerar allt, nivå 2 sköter drift och ser ekonomi, nivå 3 arbetar bara i Studio. Konton kan begränsas till ett spelbolag, till exempel bolagens egna kontaktpersoner."
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        {(Object.entries(ACCESS_LEVELS) as [string, (typeof ACCESS_LEVELS)[AccessLevel]][]).map(([key, meta]) => (
          <div key={key} className="rounded-lg border border-sg-line bg-sg-panel px-4 py-3">
            <dt className="flex items-center justify-between text-sm font-semibold">
              {meta.label}
              <span className="font-mono text-xs text-sg-muted">{`${accounts.filter((item) => item.level === Number(key)).length} konton`}</span>
            </dt>
            <dd className="mt-0.5 text-[11px] text-sg-muted">{meta.hint}</dd>
          </div>
        ))}
      </dl>

      <Panel
        title="Konton"
        meta={`${accounts.length} st`}
        action={
          <form onSubmit={invite} className="flex flex-wrap items-center gap-1.5">
            <label htmlFor="invite-email" className="sr-only">
              E-post
            </label>
            <input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="namn@bolag.se" className={cn(inputClass, "w-48")} />
            <label htmlFor="invite-level" className="sr-only">
              Nivå
            </label>
            <select id="invite-level" value={level} onChange={(event) => setLevel(Number(event.target.value) as AccessLevel)} className={inputClass}>
              {[1, 2, 3].map((item) => (
                <option key={item} value={item}>
                  {ACCESS_LEVELS[item as AccessLevel].label}
                </option>
              ))}
            </select>
            <label htmlFor="invite-scope" className="sr-only">
              Omfattning
            </label>
            <select id="invite-scope" value={scope} onChange={(event) => setScope(event.target.value)} className={inputClass}>
              <option value="all">Alla spelbolag</option>
              {studio.operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
            <SmallButton type="submit" tone="primary">
              <Plus className="size-3" aria-hidden />
              Bjud in
            </SmallButton>
          </form>
        }
      >
        {error && (
          <p role="alert" className="border-b border-sg-line px-4 py-2 text-xs text-sg-amber">
            {error}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Konto</Th>
                <Th>Nivå</Th>
                <Th>Omfattning</Th>
                <Th>2FA</Th>
                <Th>Senast aktiv</Th>
                <Th className="text-right">Åtgärd</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <Td>
                    <span className="font-medium">{account.name}</span>
                    <span className="block font-mono text-[11px] text-sg-muted">{account.email}</span>
                  </Td>
                  <Td>
                    <label htmlFor={`level-${account.id}`} className="sr-only">{`Nivå för ${account.name}`}</label>
                    <select
                      id={`level-${account.id}`}
                      value={account.level}
                      onChange={(event) => changeLevel(account, Number(event.target.value) as AccessLevel)}
                      className={inputClass}
                    >
                      {[1, 2, 3].map((item) => (
                        <option key={item} value={item}>
                          {ACCESS_LEVELS[item as AccessLevel].label}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td className={cn(account.scope !== "all" && "text-sg-teal")}>{scopeName(account.scope)}</Td>
                  <Td className={account.mfa ? "text-sg-lime" : "text-sg-amber"}>{account.mfa ? "På" : "Saknas"}</Td>
                  <Td className="font-mono text-sg-muted">{account.lastSeen}</Td>
                  <Td className="text-right">
                    <SmallButton tone="danger" onClick={() => remove(account)}>
                      Ta bort
                    </SmallButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  )
}

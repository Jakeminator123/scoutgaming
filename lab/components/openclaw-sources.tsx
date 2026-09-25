export function OpenClawSources() {
  return <details className="gateway-diagnostics"><summary>OpenClaw: dokumentation och konfiguration</summary>
    <p>Projektets ingång för människor och agenter är <code>open-claw/lab/docs/README.md</code>. Källindexet <code>OPENCLAW-DOCS.md</code> pekar på officiella sidor och rätt lokala konfigurationsfiler.</p>
    <p>Repots Gateway-image är låst till <strong>2026.9.5</strong> i <code>open-claw/lab/deploy/Dockerfile.gateway</code>. Kontrollera den faktiskt körda versionen och dess schema innan du ändrar inställningar. Dokumentationswebben kan beskriva en senare version.</p>
    <ul>
      <li><a href="https://docs.openclaw.ai/gateway/configuration-reference" target="_blank" rel="noreferrer">Konfigurationsreferens</a></li>
      <li><a href="https://docs.openclaw.ai/gateway/openai-http-api" target="_blank" rel="noreferrer">Gatewayens HTTP-API</a></li>
      <li><a href="https://docs.openclaw.ai/web/control-ui" target="_blank" rel="noreferrer">Dashboard och inställningar</a></li>
      <li><a href="https://docs.openclaw.ai/cli/mcp" target="_blank" rel="noreferrer">MCP: server- och klientfunktioner</a></li>
      <li><a href="https://github.com/openclaw/openclaw/tree/v2026.9.5" target="_blank" rel="noreferrer">Källkod för repots låsta version</a></li>
    </ul>
    <p>Här finns ett källindex och ett litet versionsmärkt kunskapspaket för runtime. Ingen full dokumentationsdatabas eller dokumentations-MCP är ansluten. Labbet anropar Gatewayen via HTTP.</p>
    <p>OpenAI-konfigurationen finns bakom Gatewayen. Modellnyckeln hör hemma där. Lokal anslutning och verifierade begränsningar beskrivs i <code>open-claw/lab/docs/LOCAL-CONNECTION-SV.md</code>; driftkonfiguration finns i <code>DEPLOYMENT.md</code>. Nyckelvärden ska aldrig klistras in i labbet.</p>
  </details>;
}

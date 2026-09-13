import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ConnectorProvider } from "@real-life-stack/toolkit"
import { erstelleServerConnector } from "./connector/server-connector"
import { brettAusPfad } from "./brett"
import App from "./App"
import "./index.css"

async function start() {
  const brett = brettAusPfad()
  const wurzel = createRoot(document.getElementById("root")!)
  const { connector, aufZustand } = await erstelleServerConnector(brett)
  wurzel.render(
    <StrictMode>
      <ConnectorProvider connector={connector}>
        <App brett={brett} aufZustand={aufZustand} />
      </ConnectorProvider>
    </StrictMode>,
  )
}

void start()

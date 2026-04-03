import AgentTerminal from './AgentTerminal'
import AgentHUD from './AgentHUD'

export const metadata = {
  title: 'AI Engine Cockpit',
}

export default async function AIEnginePage() {
    return (
        <div className="flex w-full overflow-hidden" style={{
            height: 'calc(100vh - 72px)', /* Assuming header is around 72px */
            background: 'url(/images/grid.svg) center/cover, #0a0a1a'
        }}>
            {/* Left/Center: The Agent Terminal */}
            <div className="flex-1 h-full">
                <AgentTerminal />
            </div>

            {/* Right: The Data HUD */}
            <div className="w-[380px] h-full shrink-0 border-l border-white/5">
                <AgentHUD />
            </div>
        </div>
    )
}

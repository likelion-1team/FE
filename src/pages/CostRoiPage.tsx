import { useState } from 'react'
import { useWorkspace } from '../components/Workspace'
import { CostRoi } from '../cost-roi/CostRoi'
import { PromptComparison } from '../cost-roi/PromptComparison'
import { Button, PageTitle } from '../components/ui'

export function CostRoiPage() {
  const { teamId } = useWorkspace()
  const [view, setView] = useState<'scenario' | 'comparison'>('scenario')

  return (
    <>
      <PageTitle
        title="비용과 ROI 시나리오"
        description="가정에 따른 비용과 시간 가치를 계산하거나, 두 프롬프트의 토큰을 OpenAI로 실측합니다."
      />
      <div className="roi-tabs" role="group" aria-label="비교 방식">
        <Button
          variant={view === 'scenario' ? 'primary' : 'secondary'}
          aria-pressed={view === 'scenario'}
          onClick={() => setView('scenario')}
        >
          비용·ROI 시나리오
        </Button>
        <Button
          variant={view === 'comparison' ? 'primary' : 'secondary'}
          aria-pressed={view === 'comparison'}
          onClick={() => setView('comparison')}
        >
          실제 토큰 비교
        </Button>
      </div>
      <div hidden={view !== 'scenario'}>
        <CostRoi />
      </div>
      <div hidden={view !== 'comparison'}>
        <PromptComparison teamId={teamId} active={view === 'comparison'} />
      </div>
    </>
  )
}

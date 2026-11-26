import { CostRoi } from '../cost-roi/CostRoi'
import { PageTitle } from '../components/ui'

export function CostRoiPage() {
  return (
    <>
      <PageTitle
        title="비용과 ROI 시나리오"
        description="본인이 입력한 가정으로 비용과 시간 가치를 비교합니다."
      />
      <CostRoi />
    </>
  )
}

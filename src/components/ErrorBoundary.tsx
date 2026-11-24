import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="teams-page">
        <section className="card error-state">
          <h1>화면을 표시하지 못했습니다</h1>
          <p role="alert">
            예상하지 못한 오류가 발생했습니다. 다시 불러오거나 내 팀 목록으로 이동해주세요.
          </p>
          <div className="row">
            <button className="button primary" onClick={() => window.location.reload()}>
              화면 다시 불러오기
            </button>
            <a className="button secondary" href="/teams">
              내 팀 목록으로
            </a>
          </div>
        </section>
      </main>
    )
  }
}

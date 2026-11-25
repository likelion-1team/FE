# API 통합 기록

## 실사용 브라우저 검증 — 2026-11-25 최신 확인

- 공개 FE의 `d13cfca` 배포에서 실제 팀장·팀원 계정으로 검증했습니다. 별도 시연 팀 5만 사용했으며 기존 팀 4의 기준·분석 데이터는 수정하지 않았습니다.
- 이전에 500이던 기준 저장은 이번에는 성공했습니다. 팀 5에 업무·성공/실패/판정 불가 조건과 대상 기간을 저장하고 버전 1을 확인했습니다. 과거 오류의 실제 수정 원인이나 운영 DB 상태는 확인하지 못했습니다.
- 팀원 계정으로 합성 JSON을 Windows 파일 선택 창에서 업로드했습니다. 후보 2건 중 1건만 선택했고 분석 1이 접수되어 QUEUED 이후 FAILED로 종료됐습니다. 결과 항목은 1건, 성공 0건·실패 1건이며 실패 코드는 `MODEL_NOT_CONFIGURED`였습니다. 새로고침 후에도 로그인과 같은 분석 상태가 유지됐습니다.
- 확인한 BE develop `8a180e4`의 GeminiFeedbackClient는 API 키가 비어 있을 때 이 코드를 반환합니다. 운영 서버 환경변수·실행 SHA·로그는 직접 확인하지 못했으므로 배포 담당자가 모델 설정을 확인해야 합니다. 프런트에서 모델 API 키를 받거나 분석 성공을 대체하지 않습니다.
- 팀원 계정에서 팀 성과 화면 접근은 성공했고 수치는 기여 인원·공개 정책에 따라 비공개로 표시됐습니다. 가입 인원이 공개 기준 기여 인원을 충족한다는 의미는 아닙니다.
- 분석 성공·생성 피드백·원문·후속 공유 흐름의 실계정 검증은 모델 설정이 해결되면 이어가야 합니다. 전체 v4 실사용 완료가 아닙니다.
- 후속 FE 보완: 분석 실패 코드를 한국어 원인·다음 행동과 함께 표시하고, 성공한 분석이 0건이면 새 피드백 이동 버튼을 숨깁니다. 해당 실패·새로고침 회귀 테스트를 추가했습니다.
- 현재까지 확인한 프로덕션 배포는 `d13cfca`, Vercel `dpl_926vnELrzeqvZeCkjB9N79EtdKPE`, 공개 주소 https://likelion-1team-fe.vercel.app 입니다. 아래 이전 배포·오류 기록은 각 확인 시점의 이력입니다.

## 최신 v4 원문·권한 계약 및 레드팀 보완 — 푸시 대상

기준: 11/25 18시 BE 인계 내용, 현재 공개 OpenAPI, BE develop `8a180e4`. 실행 서버의 정확한 SHA와 DB 상태를 확인한 것은 아닙니다. 이전 절의 오류는 해당 확인 시점의 기록이며, 이번 작업에서 설정 저장 500을 재발행하지 않았습니다.

- GET 원문 경로는 `/api/v1/conversation-versions/{conversationVersionId}`로 전환했습니다. 목록·상세의 버전 ID를 유지하고 nullable v3 itemId·버전 ID를 지원합니다. 원문 ID를 conversationId로 추정하지 않으며 null이면 버튼을 숨깁니다. 반환된 버전 ID가 요청과 다르면 오류입니다.
- 원문·피드백의 404/410을 실패로 처리합니다. causes·limitations가 빈 배열이면 빈 섹션 제목을 표시하지 않습니다. 서버의 400과 422는 모두 정상 저장으로 간주하지 않습니다.
- capabilities를 응답 검증·팀 상태에 보존합니다. 팀 성과 메뉴와 직접 경로는 canViewTeamMetrics=true인 경우만 열며, 설정·팀원·공유 사례 관리는 역할과 해당 capability를 함께 검사합니다. 권한 필드 누락 시 권한을 추정해 열지 않습니다. 서버의 최종 권한 검사는 별개입니다.
- 요청과 다른 ME/TEAM 응답은 표시하지 않습니다. SUPPRESSED 지표의 sampleSize와 관련 coverage·집계 건수를 숨깁니다. 잘못된 최신 응답을 잔존 구버전 필드로 우회 검증하지 않습니다.
- 공유본 식별자와 버전이 없으면 가이드 변경을 막습니다. private feedbackId를 sharedCaseId로 대신 보내지 않습니다. 변경 직전 최신 상태를 재조회하고 버전·지정 상태가 바뀌면 중단합니다. 철회·상태 변경이 조회에 반영되면 열린 확인창도 감춥니다. 15초 재조회·서버 이벤트 부재의 전파 한계는 유지됩니다.
- 서버의 명시적 null 반응과 NOT_SHARED는 오래된 목록 상태보다 우선합니다. 피드백 ID가 바뀌면 상세의 로컬 상태도 새로 시작합니다. 가이드 복사 중 화면을 떠나면 늦은 재검증 응답으로 복사를 시작하지 않습니다.
- 가이드·공유 사례도 모든 페이지를 읽고 같은 유형의 중복 그룹을 제거합니다. 응답 페이지 번호·페이지 크기가 요청 흐름과 다르면 중단합니다.
- 검증: lint·타입 검사·빌드, 단위/컴포넌트 35개·Playwright 36개(총 71개) 통과. 최신 공개 OpenAPI 필수 경로 17개·주요 필드 및 비인증 users/me 401 검사 통과. 새 브라우저 회귀는 버전 원문 조회·v3 null·삭제된 원문·capability 거부·오래된 반응·철회 확인창·ID 혼용 차단을 포함합니다.
- 목표·업무 결과·재작업 확인 저장·활용 이벤트·공유 미리보기 승인·원문 삭제 UI는 후속 연결 범위입니다. 삭제 API는 이번 점검에서 호출하지 않았고 서버 데이터를 생성·수정하지 않았습니다. 이번 결과를 실계정 전체 v4 통합 검증 완료로 해석하지 않습니다.
- 이 변경은 커밋·원격 푸시 대상이며 Vercel 재배포·main 병합은 포함하지 않습니다. 직전 공개 FE 배포는 `35eee75`입니다.

## 오류 원인 분석 — 2026-11-25

### 확인된 사실과 유력 원인 구분

- **분석 기준 저장 500:** 실제 요청은 v4 입력 제약과 맞고, Vercel 경유와 백엔드 직접 호출에서 실패했습니다. 버전은 0으로 유지됩니다. 실패 지점의 실제 예외는 서버 응답에 숨겨지며, GlobalExceptionHandler는 `[UnhandledException]`으로 스택을 기록합니다. 정확한 SQL·예외 원인 확정에는 해당 로그가 필요합니다.
- **가장 유력한 후보는 DB 마이그레이션 불일치입니다.** updateSettings는 `nextVersion()`을 만들어 새 team_settings 행을 INSERT합니다. 이전 team_id 단독 UNIQUE가 남으면 version=0 행이 있는 팀에 version=1 행을 추가하지 못합니다. 저장소의 `migrate-team-settings-history.sql`은 바로 이 단독 UNIQUE를 찾아 제거하는 SQL을 포함합니다. 동일 현상만으로 해당 인덱스가 실제 남아 있다고 확정하지는 않습니다.
- [BE PR #134](https://github.com/likelion-1team/BE/pull/134)는 배포·로컬 DB의 수동 이관 순서가 필수임을 명시합니다. `migrate-team-settings-v4.sql`의 조건 JSON·문자열 길이·기존 업무 유형 제약 변경도 확인 대상입니다. 다만 새 팀의 첫 저장 실패이므로, 기존 (team_id,name) 제약에 의한 _동일 이름 재저장_ 충돌보다는 team_settings 제약·필수 컬럼·INSERT 예외를 먼저 확인해야 합니다.
- 신규 팀 생성과 기본 version=0 조회는 성공합니다. 이는 DB가 전부 끊긴 상태보다 저장의 특정 경로·스키마 제약 문제 쪽을 뒷받침하지만, 정상 트랜잭션 연결을 보장하는 근거는 아닙니다.
- **팀원 TEAM 403:** 재확인한 실제 teams 응답은 canViewTeamMetrics=false이고, TEAM filter-options는 직접·프록시 모두 ROLE_FORBIDDEN입니다. [BE PR #161](https://github.com/likelion-1team/BE/pull/161)의 canViewTeamMetrics=true·팀원 TEAM 허용과 다릅니다. 소스 병합과 실행 배포의 권한 계약 차이가 확인되며, 실행 중인 정확한 SHA는 아직 확인하지 못했습니다. 기여자 부족은 200 SUPPRESSED가 기대되므로 이 403과 별개입니다.
- **팀 목록 응답 오류:** 배열에서 페이지 객체로 바뀐 API와 FE 검증 스키마 불일치였습니다. 현재 배포 `35eee75`에서 수정하고 실계정 팀 진입으로 확인했습니다.
- **업로드 차단·빈 이력:** 기준 version=0·taskType=null과 데이터 없음에 따른 상태입니다. 아직 업로드·분석이 실행되지 않아 Gemini 실패를 현재 원인으로 지목할 근거는 없습니다.
- 이전 비존재 계정 로그인 500은 현재 401 INVALID_CREDENTIALS로 바뀌었으며 제공된 6계정은 로그인에 성공했습니다. 과거 장애 원인을 현재 설정 500과 동일하다고 보지 않습니다.

### 확정에 필요한 최소 증거

1. 2026-11-25 15:55:29 KST 전후 PUT `/api/v1/teams/5/settings`의 `[UnhandledException]` 스택과 가장 안쪽 원인. Duplicate entry/constraint name, Unknown column, JSON 변환 오류 등을 구분합니다.
2. 프로젝트 `output/backend-settings-readonly-diagnostics.sql`로 실제 UNIQUE·컬럼·기준 버전을 조회합니다. 진단 파일은 읽기 전용입니다.
3. 실행 중인 BE의 실제 빌드 SHA와 연결 DB를 확인합니다. 최신 develop은 `30f619c`이나 실행 서버의 SHA로 단정하지 않습니다.
4. 결과에 맞춰 필요한 이관만 적용합니다. 이관 스크립트의 ADD COLUMN/DROP INDEX는 모두 멱등하지 않으므로 전체 스크립트를 무조건 재실행하면 안 됩니다.

이 분석에서 운영 DB 접속·스키마 변경·BE 배포는 하지 않았습니다. 서버 로그와 DB 메타데이터에 직접 접근할 수 없어 위 후보의 최종 확정은 남아 있습니다.

## 실계정 시연 검증 — 2026-11-25 오후

- 배포 코드 `35eee75`, 브랜치 `codex/fe-live-account-verification`. Vercel `dpl_4ThM6PeqSkkrEQyF5YTx8pQ7hu3E` production Ready. 공개 주소는 동일합니다.
- 실제 팀 목록이 `{items,page,size,total}`로 변경돼 기존 FE가 팀 진입 전에 응답 오류를 내던 문제를 재현·수정했습니다. 팀·팀원 목록은 모든 페이지를 읽습니다.
- 새 대시보드 filter-options 경로, settingsVersion·완료 주간 요청, 본인 확인 지표와 SUPPRESSED·표본 부족·미측정 상태를 반영했습니다. 숨긴 수치·표본을 0으로 만들지 않습니다.
- 업로드 multipart에 settingsVersion을 추가하고 READY/CONSUMED/EXPIRED 및 새 메타데이터 응답을 지원합니다. 업로드 이력에 이제 analysisId가 제공돼 새로고침 후에도 해당 분석으로 연결합니다. 오전 기록의 복구 제한은 이 서버 계약에서 해소됐습니다.
- 개인 피드백의 평탄 목록, 메시지 ID 기반 근거, 공유 버전 기반 철회 및 sharedCaseId 기반 가이드 경로를 반영했습니다. 새 공유 승인·실제 결과 저장 화면은 이번 보완에서 활성화하지 않았습니다.
- lint·타입 검사·빌드 통과. 단위/컴포넌트 28개와 Playwright 28개, 합계 56개 통과. 모의 API 회귀와 아래 실계정 확인을 구분합니다. 공개 OpenAPI 필수 경로 16개 검사 통과.

### 실제 확인한 범위

1. 제공받은 기본·추가 계정 6개 모두 실제 API 로그인 성공. 비밀번호는 Git·소스·이 문서에 저장하지 않았습니다. Windows DPAPI CurrentUser로 암호화하고 사용자/SYSTEM만 파일에 접근하도록 제한했습니다.
2. Chrome에서 팀장·기본 팀원 로그인, 로그아웃, 새로고침 뒤 쿠키 세션 복원 확인.
3. 사용자 선택에 따라 별도 팀 `시연 검증 전용 · 2026-11-25`(teamId=5) 생성, 기본 팀원 추가 성공. 팀장·팀원 각 역할과 명단 2명 확인. 기존 팀 4의 기준·회원·수치는 변경하지 않았습니다.
4. 팀원은 설정 읽기만 가능하고 수정·팀원 관리 메뉴가 없습니다. 팀장 URL로 직접 이동해도 실제 팀원 경로로 보정됩니다.
5. 새 팀의 빈 업로드 이력·개인 피드백·개선 가이드는 오류 대신 빈 상태로 표시됩니다. 기준 미설정 시 업로드를 차단합니다.
6. 현재 배포 서버는 팀원의 TEAM filter-options 요청에 403 ROLE_FORBIDDEN을 반환합니다. 최신 develop `30f619c`는 전원 조회 변경을 포함하지만 배포 여부를 소스만으로 단정하지 않습니다.

### 진행을 막는 백엔드 오류

- Chrome에서 새 팀의 정상 분석 기준 저장 요청이 500입니다. 백엔드 직접 PUT `/api/v1/teams/5/settings`에서도 **2026-11-25 15:55:29 KST, 500 INTERNAL_SERVER_ERROR**로 재현됐습니다. Vercel만의 문제는 아닙니다.
- 요청은 expectedVersion=0, 단일 taskType·세 조건 배열, 대상 2026-11-01~30, 온보딩 11-16, 대상 20건입니다. 재조회한 version은 0→0이며 taskType과 기간은 미설정 상태입니다. FE는 실패를 성공으로 표시하지 않고 입력을 보존합니다.
- 원인은 서버 로그 없이 확정하지 않았습니다. version 1 생성 시 DB 제약과 실제 마이그레이션 상태를 점검해야 합니다. 특히 `migrate-team-settings-history.sql`의 기존 team_id 단독 UNIQUE 제거, `migrate-team-settings-initial-version.sql`, `migrate-team-settings-v4.sql` 적용 여부를 확인할 필요가 있습니다. 이는 코드 대조에 따른 점검 후보이며 확정 원인이 아닙니다.
- 위 선행 오류로 실제 파일 업로드·분석 실행·피드백 생성·반응·공유·가이드 지정과 5명 기여 공개 정책을 끝까지 검증하지 못했습니다. 가입 인원 6명만으로 기여자 5명 조건을 충족했다고 간주하지 않습니다.
- 합성 대화 파일 2건은 프로젝트 `output/conversations-demo-synthetic-2026-11-25.json`에 준비했으며 서버에는 업로드하지 않았습니다. 오류 요청·응답 증거는 `tmp/real-demo-settings-failure.json`, 화면은 `output/real-demo-settings-500.jpg`입니다. 인증 토큰·비밀번호는 포함하지 않습니다.

## 프로덕션 재배포 — 2026-11-25

- 공개 주소: https://likelion-1team-fe.vercel.app
- 배포 코드: `f5f3ba5` · 브랜치 `codex/fe-current-api-contract` · 초안 PR [#3](https://github.com/likelion-1team/FE/pull/3), 대상 `codex/fe-redteam-hardening`.
- Vercel 배포: `dpl_2bw2N5JhQystx4FWzx9FxHCrSFco`, 06:45 KST 생성, production Ready 및 공개 도메인 alias 확인. Git 자동 배포는 연결하지 않았습니다.
- 빌드 설정: `VITE_API_BASE_URL=/api/v1`, `VITE_AUTH_TRANSPORT=auto`, `VITE_EMAIL_CHECK_METHOD=GET`. 프로덕션 JS는 검증한 로컬 빌드와 바이트 단위로 일치했습니다.
- lint·타입 검사·빌드 통과. 단위/컴포넌트 23개, Playwright 28개(신규 계약 시나리오 8개 포함), 합계 51개 통과. 브라우저 업무 테스트는 모의 API입니다.
- 실제 HTTPS OpenAPI의 필수 경로 13개와 기준 버전·selectionId·analysisId 관련 필드를 검사했습니다. 비인증 users/me는 401입니다.
- 실제 Chrome의 공개 회원가입 화면에서 합성 이메일로 중복 확인 성공, 로그인 화면에서 존재하지 않는 합성 계정의 잘못된 자격 증명 안내를 확인했습니다. 화면 런타임 error 로그는 없었습니다. 계정은 만들지 않았습니다.
- Vercel 경유에서 실제 FE Origin을 포함한 비존재 계정 로그인은 401 INVALID_CREDENTIALS였습니다. 실계정 쿠키 발급·갱신·팀 전환·업로드·분석 완료는 여전히 별도 검증이 필요합니다.
- 화면 기록: 프로젝트 루트 `output/fe-current-contract-deployed.jpg`. main 병합은 수행하지 않았습니다.

## FE 계약 보완 — 2026-11-25

아래 재확인에서 발견한 이메일 GET, 버전 기반 분석 기준, selectionId 후보 선택, analysisId 진행·항목 조회를 `codex/fe-current-api-contract`에서 반영했습니다. 이전 계약 설명은 날짜별 이력으로 남깁니다.

- 기준 저장은 expectedVersion과 단일 taskType의 성공·실패·판정 불가 조건을 전송합니다. 각 조건은 1~10줄·줄당 500자, 업무 이름은 200자까지이며 온보딩 시작일·대상 건수는 선택입니다. 버전 충돌 시 자동 덮어쓰지 않습니다.
- 후보는 별도 GET에서 selectable·duplicateType·validationCode를 확인하고 1부터 시작하는 페이지·검색을 지원합니다. 선택 최대 건수·파일 보존 시간은 settings.policies를 사용합니다.
- 분석은 settingsVersion과 selections[].selectionId/taskTypeId, Idempotency-Key를 전송하고 analysisId로 이동합니다. 같은 요청 재시도에는 캡처한 본문·멱등 키를 유지합니다. 지연된 수락 응답의 팀 전환 보호는 유지합니다.
- 분석 진행은 서버 pollAfterSeconds를 1~30초 범위로 적용하며 종료·오류·화면 이탈 시 주기 조회를 중단합니다. 부분 성공·실패 항목·피드백 진입을 표시하고, 항목 목록도 페이지 조회합니다.
- 업로드 CONSUMED는 분석 완료가 아닙니다. 이력 응답에 analysisId가 없으므로 새로고침 후 업로드만으로 상세 분석을 복원할 수 없습니다. 같은 세션의 접수 정보가 메모리에 남은 경우에만 연결합니다. 서버 후속: 이력에 analysisId 또는 상세 조회 링크 제공.
- 목표·업무 결과·재작업 확인 API의 공개는 확인했으나 이번 FE 구현 범위에는 포함하지 않습니다. 신규 공유 승인은 계속 비활성입니다.

## 재확인 — 2026-11-25

이 절이 아래 2026-11-24의 배포 상태 기록보다 최신입니다. FE 재배포나 실계정 검증 완료를 의미하지 않습니다.

- FE PR #1·#2는 모두 open·미병합이며 각 head는 `b998646`, `664e8a7` 그대로입니다. FE 작업 트리는 재확인 시작 시 깨끗했습니다.
- 읽기용 BE 복제본을 `origin/develop`의 `25937d2`로 fast-forward했습니다. 이전 로컬 기준은 `15ccd2f`였습니다. 실행 중인 서버의 정확한 커밋은 공개 OpenAPI만으로 확정하지 않습니다.
- 06:34 KST에 존재하지 않는 합성 이메일의 로그인 요청을 재검사했습니다. HTTPS 백엔드 직접 호출과 Vercel 경유 모두 **401 INVALID_CREDENTIALS**였습니다. 이전 로그인 500은 현재 재현되지 않으며, 과거 장애 원인은 서버 로그 없이 확정하지 않습니다. 비인증 `/users/me`도 양쪽 모두 401입니다.
- 이메일 확인은 **GET 200**, 기존 POST는 **401 AUTH_REQUIRED**로 양쪽에서 확인됐습니다. 현재 배포 FE의 POST 설정은 변경된 서버와 맞지 않습니다.
- 공개 OpenAPI에 목표 GET/PUT, 업로드 후보 GET, 분석 상태·항목 GET, 결과·재작업 확인 PUT이 추가됐습니다. 경로 공개는 인증 후 실제 저장·조회 성공의 증거가 아닙니다.
- 분석 기준은 `taskTypes[]/successDefinition`에서 `version/taskType/successConditions/failureConditions/unknownConditions/policies` 구조로 변경됐습니다. 수정 요청에 `expectedVersion`이 필요합니다. 기존 FE의 설정 스키마·저장 요청은 호환되지 않습니다.
- 분석 시작은 `settingsVersion`과 `selections[].selectionId/taskTypeId`를 받고 `analysisId`를 반환합니다. 분석 진행은 `/analyses/{analysisId}`, 항목 결과는 `/analyses/{analysisId}/items`로 확인합니다. 상태는 QUEUED/RUNNING/SUCCEEDED/PARTIALLY_SUCCEEDED/FAILED입니다. 업로드 상태에는 CONSUMED가 추가됐습니다. 기존 FE의 externalId 선택·uploadId 상태 흐름을 전환해야 합니다.
- 로그인·갱신 공개 응답에서 refreshToken이 빠진 쿠키 계약이 확인됐습니다. FE auto 모드는 이를 지원하지만 Vercel 경유 쿠키 발급·갱신·로그아웃은 실계정 확인이 남아 있습니다.
- 비식별 공유 미리보기·버전 승인, 활용 이벤트, 대화 삭제·삭제 작업 경로는 이번 OpenAPI에도 없습니다. 신규 공유 승인은 계속 비활성 상태를 유지해야 합니다.
- OpenAPI `servers`는 HTTPS로 정렬됐습니다. 공통 `Item`/`TaskType` 이름 충돌은 여전히 DTO 대조가 필요합니다.
- 사용자가 첨부한 서비스 흐름은 `/api` 접두사, uploadId 중심 상태 조회, boolean 공유 승인 등 과거 계약을 포함합니다. 실제 요청에는 `/api/v1`을 사용하고 위 변경을 반영해야 합니다. 링크된 Notion API 목록은 연결 도구에서 404로 조회되지 않아 하위 명세는 확인하지 못했습니다.

실계정 로그인·팀 전환·업로드·분석은 아직 미검증입니다. 사용자는 기존 테스트 계정에 직접 로그인하는 방식을 선택했습니다. 이 재확인에서 계정·팀·분석 데이터는 생성하지 않았습니다.

확인 기준: 2026-11-24 배포 OpenAPI와 BE `develop`의 DTO·컨트롤러. 개발 브랜치와 배포 서버의 변경 시점은 다를 수 있습니다. 이 문서는 실제 계정으로 모든 서버 기능을 검증했다는 의미가 아닙니다.

## Vercel 실배포 확인

- 공개 주소: https://likelion-1team-fe.vercel.app · 프로젝트 `likelion-1team-fe`, 배포 코드 `8dd5b22`, 확인일 2026-11-24.
- 실제 브라우저에서 정적 자원·한글 폰트·회원가입 화면·모바일 너비를 확인했습니다. 런타임 오류와 실패한 정적 자원 요청은 없었습니다.
- 비인증 보호 경로는 로그인으로 이동하며, `/api/v1/users/me`는 JSON 401을 반환합니다.
- 화면에서 보낸 POST `/api/v1/auth/email-check`는 실제 백엔드의 200 응답과 이메일 사용 가능 안내까지 확인했습니다. 계정은 생성하지 않았습니다.
- **확인된 백엔드 문제:** 존재하지 않는 이메일로 POST `/api/v1/auth/login` 요청 시 401 대신 `500 INTERNAL_SERVER_ERROR`를 반환합니다. 동일 요청이 백엔드 직접 호출과 Vercel 프록시 양쪽에서 재현됐습니다. 2026-11-24 12:47 KST 전후 서버 로그에서 사용자 없음·인증 실패 예외 처리를 확인해야 합니다. 현재 배포와 BE develop의 인증 구현 차이도 점검 대상입니다.
- 실제 계정 로그인·팀 변경·파일 업로드·분석 실행은 이 배포 점검에서 수행하지 않았습니다. 테스트 결과를 전체 업무 API의 실계정 검증 완료로 해석하지 않습니다.
- Vercel 프로젝트에는 Git 자동 배포를 연결하지 않았으며, 이번 배포는 명시적으로 선택한 보완 브랜치의 CLI 배포입니다.

## 현재 계약에 맞춘 항목

- 접두사 `/api/v1`, 응답 `{code,message,data,errors,timestamp}`. HTTP 204와 body 없는 성공 응답도 처리.
- 이메일 중복 확인은 POST `{email}`. 가입 비밀번호는 영문·숫자 포함 8~128자.
- 갱신 JSON `{refreshToken}`과 HttpOnly 쿠키 `{}` 방식 모두 지원. JSON 모드는 브라우저 새로고침 후 재로그인.
- 업로드는 multipart `file` 하나. 브라우저가 Content-Type boundary를 생성. 최대 20 MiB로 FE 검증하며 실제 구조·해제 크기·기간은 서버가 검사.
- 후보 목록은 업로드 응답의 `conversations`. 선택은 `externalId`와 `taskTypeId`. taskTypeId는 설정의 id/taskTypeId, 또는 filter-options의 동일 업무 이름으로 확인. ID가 없으면 분석 버튼 비활성.
- 진행 상태는 `/uploads/{uploadId}`의 UPLOADED/ANALYZING/DONE/FAILED. 3초 조회, 완료·실패·오류·화면 이탈 시 정지.
- 이력은 page=0, size=10 및 content·totalElements. 피드백 목록은 days 래퍼와 현재 서버의 page를 사용.
- 피드백 리스트와 공유 리스트는 OpenAPI의 공통 Item 스키마가 충돌하므로 실제 BE 응답 DTO에 맞춰 별도 TypeScript 타입 정의.
- 원문은 messages.idx·highlightIndexes. 서버에 없는 messageId를 추정하지 않음.
- 가이드 PUT/DELETE는 기존 `/feedbacks/{feedbackId}/guide`. 반응 취소 DELETE는 배포 경로 사용.
- 피드백 절감량은 근거 검증 전 미측정. LATEST/FREQUENCY 정렬만 제공.

## 백엔드 후속 항목

1. A13/A14 goals 및 버전 충돌 계약.
2. A15~A21 settingsVersion, selectionId, analysisId, 항목별 부분 성공과 멱등 처리.
3. A27~A29 실제 결과·재작업 확인과 활용 기록.
4. A30/A31 비식별 공유본 생성·만료·승인 버전. 이후 새 공유 승인 UI 활성화.
5. A32~A35 sharedCaseId 기반 가이드 경로.
6. A36~A39 팀원 팀 집계 권한, 완료 주간·보호 인원·표본·출처·누락 지표 계약.
7. A40/A41 대화 삭제·즉시 차단·비동기 정리.
8. OpenAPI HTTPS servers URL과 응답 DTO의 중복 Item 스키마명 수정.
9. 외부 출처에서 직접 API를 호출하는 경우 실제 FE Origin과 Idempotency-Key 헤더를 CORS 허용 목록에 추가. 현재 BE 기본 허용 Origin은 localhost:3000/5173이므로 신규 호스팅 도메인·127.0.0.1 접근을 별도 확인.

위 기능은 현재 FE에서 저장 성공을 시연하거나 localStorage에 임시 저장하지 않습니다. 실제 API 계약이 반영되면 UI를 활성화하고 새로운 계약으로 통합 검증해야 합니다.

## 레드팀 보완 브랜치

- `codex/fe-redteam-hardening`은 기존 `codex/fe-api-integration`을 기반으로 한다.
- 로그아웃 요청을 발행하면서 로컬 토큰·개인 캐시·화면을 즉시 정리한다. 비밀이 아닌 로그아웃 표식을 저장해 서버 오류 뒤 새로고침으로 쿠키 세션이 자동 복구되지 않도록 한다. 다른 탭도 storage 이벤트로 접근을 차단한다. 로그아웃 서버 확인 실패와 완료를 구분한다.
- 지연된 분석 응답은 떠난 화면의 이동·상태 변경을 실행하지 않는다. 이미 서버가 접수한 분석을 취소했다고 표시하지 않는다.
- 공유·가이드를 15초 주기, 화면 복귀·네트워크 복구 시 재검증하고 복사 직전 최신 공유본을 확인한다. 즉시 철회 통지는 서버 이벤트가 필요하며 이 FE 변경만으로 0초 반영을 보장하지 않는다.
- 주요 읽기 응답과 로그인/갱신·분석 수락 응답을 스키마로 검증한다. 필수 배열 누락은 오류이며, 진행 중 분석의 null 건수와 미설정 업로드 기간 등 계약상 nullable 값은 그대로 지원한다.
- 이메일 중복 확인은 기본 POST. BE develop의 GET 배포와 맞춰 `VITE_EMAIL_CHECK_METHOD=GET`으로 전환할 수 있다. 인증 쿠키 자동 전환만으로 API 메서드까지 자동 추측하지 않는다.
- 목표·실제 결과·재작업·삭제 등 미배포 기능은 계속 대기 상태다. 백엔드 코드나 Figma 원본은 이 FE 보완 브랜치에서 변경하지 않는다.

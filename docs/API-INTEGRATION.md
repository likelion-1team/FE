# API 통합 기록

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

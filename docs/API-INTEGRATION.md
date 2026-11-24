# API 통합 기록

확인 기준: 2026-11-24 배포 OpenAPI와 BE `develop`의 DTO·컨트롤러. 개발 브랜치와 배포 서버의 변경 시점은 다를 수 있습니다. 이 문서는 실제 계정으로 모든 서버 기능을 검증했다는 의미가 아닙니다.

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

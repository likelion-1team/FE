# TOKI 브랜드 에셋

원본: [1조벌자 피그마 · 초안](https://www.figma.com/design/M6iBTw20Bc1xbjXsy1m0xi?node-id=165-1586)

- `toki-logo.png`: `171:19`, 캐릭터와 TOKI 로고. 로그인·회원가입과 워크스페이스 상단에 사용.
- `toki-wordmark.png`: `221:242`, 남색 TOKI 워드마크. 공개 데모 상단에 사용.
- `toki-mascot.png`: 캐릭터만 원본 로고에서 추출한 128×128 PNG. 브라우저 탭과 시연 영상에 사용.
- 캐치프레이즈: `165:978`, Make Every Token Count.
- 서체: IBM Plex Sans KR. 기존 `@fontsource/ibm-plex-sans-kr`의 400·500·600·700 굵기를 유지하며 로컬 번들로 제공.

로고와 워드마크는 Figma 원본이며, 캐릭터 이미지도 원본 비율과 색상을 보존합니다.
공통 표시는 `src/components/BrandLogo.tsx`에서 관리합니다.

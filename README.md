# 5총사

교대근무를 고려하여 친구·동료의 공통 가능 시간을 찾는 일정 서비스입니다. 개인 일정은 시간 단위로 등록하고, 그룹에는 각자가 확인한 날짜의 가능 시간만 공유합니다.

## 기능

- 개인별 근무 표기와 근무 시간, 야간근무, 여러 일정, 주기·순환 반복
- 근무표 사진의 달력 영역 선택, 광고 제외, OCR 검토 후 일괄 등록
- Google Calendar 기본 캘린더 양방향 동기화와 수정 충돌 안내
- 그룹 구성원의 30분 단위 가능 시간과 여러 날 연속 여행 시간 검색
- 국내 카페·저녁·술·여행 장소 후보 및 구성원별 대중교통·자동차 이동 시간 비교

기존 날짜형 일정은 보존합니다. 시간 정보가 없어 새 일정으로 자동 변환하지 않습니다.

## 로컬 실행

Node.js 22가 필요합니다. Supabase 프로젝트의 URL·익명 키를 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 설정하고 `npm ci`, `npm run dev`를 실행합니다. 새 일정 기능에는 [Supabase 마이그레이션](supabase/migrations/202609290001_planner.sql)이 필요합니다.

Google, OCR, 장소 검색을 포함한 배포 순서와 필요한 서버 비밀키는 [배포 안내](docs/DEPLOYMENT.md)에 정리했습니다. Calendar API 활성화와 캘린더 접근 OAuth 동의는 각각 필요합니다. OCR용 Cloud Vision과 장소·길찾기 API는 별도 연결입니다.

## 검증

`npm test` · `npm run lint` · `npm run build`

테스트에는 PostgreSQL 엔진을 사용하는 PGlite가 포함되며, 그룹 접근 권한·Google 동기화 재시도·야간근무 날짜 처리·OCR 결과 검증을 확인합니다.

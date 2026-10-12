# 5총사 

교대근무를 고려하여 친구·동료의 공통 가능 시간을 찾는 일정 서비스입니다. 개인 일정은 시간 단위로 등록하고, 그룹에는 개인 일정 제목을 숨긴 채 빈 시간만 자동으로 공유합니다.

## 기능

- Google 전용 로그인, 개인별 근무 표기·시간, 야간근무, 일/주/월 반복 일정
- 주간·월간 근무표 전체 사진 자동 분석, 등록된 근무 유형 연결 및 결과 달력 검토 후 등록
- Google Calendar 기본 캘린더의 DB 우선 표시·자동 양방향 동기화와 수정 충돌 안내
- 그룹 구성원의 30분 단위 가능 시간과 여러 날 연속 여행 시간 검색
- 국내 카페·저녁·술·여행 장소 후보 및 구성원별 대중교통·자동차 이동 시간 비교

기존 날짜형 일정은 보존합니다. 시간 정보가 없어 새 일정으로 자동 변환하지 않습니다.

## 로컬 실행

Node.js 22가 필요합니다. Supabase 프로젝트의 URL·익명 키를 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 설정하고 `npm ci`, `npm run dev`를 실행합니다. 신규 설치에는 [기본 일정 마이그레이션](supabase/migrations/202609290001_planner.sql), [그룹 달력 마이그레이션](supabase/migrations/202610060001_group_workspace.sql), [자동 동기화 마이그레이션](supabase/migrations/202610080001_google_auto_sync.sql)을 순서대로 적용합니다. 기존 설치는 적용 이력을 확인한 뒤 누락된 마이그레이션만 적용합니다.

Google, 근무표 이미지 분석, 장소 검색을 포함한 배포 순서와 필요한 서버 비밀키는 [배포 안내](docs/DEPLOYMENT.md)에 정리했습니다. Calendar API 활성화와 캘린더 접근 OAuth 동의는 각각 필요합니다. 근무표 분석은 OpenAI 이미지 입력을 사용하며 Google Vision API는 필요하지 않습니다.

실제 사용 흐름과 **Kakao·ODsay 연결 방법, 내장 지도 미구현 범위**는 [사용 가이드](docs/USAGE.md)를 참고하세요. DB 변경을 열린 화면에 전달하려면 [Realtime 마이그레이션](supabase/migrations/202610120001_calendar_realtime.sql)을 추가 적용합니다.

## 검증

`npm test` · `npm run lint` · `npm run build`

테스트에는 PostgreSQL 엔진을 사용하는 PGlite가 포함되며, 그룹 접근 권한·Google 동기화 재시도·야간근무 날짜 처리·OCR 결과 검증을 확인합니다.

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TimePlanner from '../../src/components/TimePlanner';

window.__plannerFixture = { failSave: true, calls: [] };
createRoot(document.getElementById('root')).render(<StrictMode>
  <div className="app-shell" style={{ padding: '24px', minHeight: '1600px' }}>
    <div style={{ height: '700px' }}>화면을 스크롤한 상태에서 여는 테스트</div>
    <div className="mobile-screen-enter surface-card" style={{ maxWidth: '1100px', margin: 'auto', padding: '20px' }}><TimePlanner /></div>
    <nav aria-label="모바일 주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)]" style={{ height: '80px', borderTop: '1px solid var(--line)' }}>하단 네비게이션</nav>
  </div>
</StrictMode>);

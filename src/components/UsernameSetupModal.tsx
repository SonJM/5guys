'use client';

import { useState } from 'react';
import { updateUsernameAction } from '@/app/actions';

type Props = {
  onComplete: () => void;
};

export default function UsernameSetupModal({ onComplete }: Props) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const result = await updateUsernameAction(username);
    if (result.error) {
      setError(result.error);
    } else {
      onComplete(); // 완료 함수 호출
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102d28]/70 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="name-title" className="surface-card w-full max-w-sm p-8">
        <span className="brand-mark mb-5">5</span>
        <h2 id="name-title" className="mb-3 text-2xl font-black">어떻게 불러드릴까요?</h2>
        <p className="muted mb-6 text-sm leading-6">그룹 멤버들이 알아볼 수 있도록 사용할 이름이나 별명을 알려주세요.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            aria-label="표시할 이름"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="이름 (예: 홍길동)"
            className="w-full"
          />
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !username}
            className="primary-button mt-4 w-full"
          >
            {isLoading ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

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
      alert('이름이 설정되었습니다!');
      onComplete(); // 완료 함수 호출
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 dark:text-white">사용자 이름 설정</h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">다른 멤버들이 알아볼 수 있도록 사용할 이름(별명)을 입력해주세요.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="이름 (예: 홍길동)"
            className="w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
          />
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !username}
            className="w-full mt-4 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400"
          >
            {isLoading ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
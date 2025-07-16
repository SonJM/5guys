'use client';

import { inviteUserAction } from '@/app/actions';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

// 사용자 프로필의 타입을 정의합니다.
type Profile = {
  id: string;
  username: string | null;
  // email은 이제 보여주기용으로만 사용합니다.
  email: string | null;
}

export default function InviteMemberForm({ groupId }: { groupId: number | null }) {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 컴포넌트가 로드될 때 전체 사용자 목록을 불러옵니다.
  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from('profiles').select('*');
      if (data) {
        setAllUsers(data);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupId) {
      alert('그룹을 먼저 선택해주세요.');
      return;
    }
    if (!selectedUserId) {
      alert('초대할 사용자를 선택해주세요.');
      return;
    }
    setIsLoading(true);
    const result = await inviteUserAction(groupId, selectedUserId);
    if (result.error) {
      alert(result.error);
    } else {
      alert('성공적으로 초대했습니다!');
      setSelectedUserId('');
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className="p-2 border rounded-md shadow-sm flex-grow bg-white dark:bg-slate-700 dark:border-slate-600"
        disabled={!groupId}
      >
        <option value="">초대할 멤버 선택...</option>
        {allUsers.map(user => (
          <option key={user.id} value={user.id}>
            {user.username || user.email}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!groupId || isLoading}
        className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-slate-400"
      >
        초대
      </button>
    </form>
  );
}
'use server'

import { cookies } from 'next/headers' // cookies 임포트
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'


// 최종 결과를 담을 타입 정의 (가독성을 위해)
type VacationOption = {
  startDate: string
  endDate: string
  vacationDays: number
  requiredVacations: {
    username: string
    dates: string[]
  }[]
}

// 날짜를 'YYYY-MM-DD' 형식으로 변환하는 헬퍼 함수 (시간대 문제 해결)
function toYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear();
  // getUTCMonth()는 0부터 시작하므로 1을 더해줍니다.
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}


export async function findBestDateAction(
  duration: number,
  searchStart: string,
  searchEnd: string,
  groupId: number | null
): Promise<{ result?: VacationOption[]; error?: string }> {

  if (!groupId) {
    return { error: '그룹을 먼저 선택해주세요.' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: groupMembers, error: membersError } = await supabase
    .from('group_members')
    .select(`
      profiles (id, username, schedules (date, status))
    `)
    .eq('group_id', groupId)

  if (membersError) return { error: '그룹 멤버 정보를 가져오는 데 실패했습니다.' }

  // Supabase의 join 결과 형식에 맞춰 실제 프로필 데이터만 추출합니다.
  const profiles = groupMembers.map(m => m.profiles).filter(p => p !== null) as any[];

  if (!profiles || profiles.length === 0) {
    return { error: '그룹에 등록된 사용자가 없습니다.' }
  }

  // 2. 날짜를 시간대 문제없는 UTC 기준으로 처리합니다.
  const startDate = new Date(`${searchStart}T00:00:00Z`)
  const endDate = new Date(`${searchEnd}T00:00:00Z`)

  let bestVacationDays = Infinity
  let bestOptions: VacationOption[] = []

  // 3. 날짜를 하루씩 이동하며 최적의 옵션을 찾습니다.
  for (let d = startDate.getTime(); d <= endDate.getTime(); d += 24 * 60 * 60 * 1000) {
    const currentStartDate = new Date(d)
    const currentEndDate = new Date(d + (duration - 1) * 24 * 60 * 60 * 1000)

    if (currentEndDate > endDate) break

    let currentVacationDays = 0
    const currentRequiredVacations: { username: string; dates: string[] }[] = []

    // 4. 각 사용자의 필요 휴가 일수를 계산합니다.
    for (const profile of profiles) {
      const userVacations: string[] = []
      for (let i = 0; i < duration; i++) {
        const checkDate = new Date(currentStartDate.getTime() + i * 24 * 60 * 60 * 1000)
        const dateString = toYYYYMMDD(checkDate) // 시간대 문제없는 헬퍼 함수 사용

        const schedule = profile.schedules.find(s => s.date === dateString)
        if (schedule?.status === '근무') {
          userVacations.push(dateString)
        }
      }

      if (userVacations.length > 0) {
        currentVacationDays += userVacations.length
        currentRequiredVacations.push({
          username: profile.username || `사용자(${profile.id.substring(0, 6)})`,
          dates: userVacations,
        })
      }
    }

    // 5. 더 좋은 옵션(휴가를 덜 쓰는 날짜)을 찾으면 목록을 업데이트합니다.
    const newOption: VacationOption = {
      startDate: toYYYYMMDD(currentStartDate),
      endDate: toYYYYMMDD(currentEndDate),
      vacationDays: currentVacationDays,
      requiredVacations: currentRequiredVacations,
    }

    if (currentVacationDays < bestVacationDays) {
      // 더 좋은 케이스를 찾았으므로 목록을 초기화하고 새로 추가합니다.
      bestVacationDays = currentVacationDays
      bestOptions = [newOption]
    } else if (currentVacationDays === bestVacationDays) {
      // 동일하게 좋은 케이스이므로 목록에 추가합니다.
      bestOptions.push(newOption)
    }
  }

  if (bestOptions.length === 0) {
    return { error: '지정한 범위 내에서 적절한 날짜를 찾을 수 없습니다.' }
  }

  return { result: bestOptions }
}

export async function createGroupAction(groupName: string) {
  if (!groupName) {
    return { error: '그룹 이름을 입력해주세요.' }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 1. 'groups' 테이블에 새로운 그룹 생성
  const { data: newGroup, error: groupError } = await supabase
    .from('groups')
    .insert({ name: groupName, created_by: user.id })
    .select()
    .single()

  if (groupError) {
    return { error: '그룹 생성에 실패했습니다: ' + groupError.message }
  }

  // 2. 'group_members' 테이블에 그룹 생성자를 첫 멤버로 추가
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: newGroup.id, user_id: user.id })

  if (memberError) {
    // 만약 멤버 추가에 실패하면, 방금 만든 그룹을 삭제하여 데이터를 정합시킵니다.
    await supabase.from('groups').delete().eq('id', newGroup.id)
    return { error: '그룹 멤버 추가에 실패했습니다: ' + memberError.message }
  }

  // 데이터 변경 후, 홈페이지를 새로고침하여 목록을 갱신합니다.
  revalidatePath('/')
  return { success: true }
}
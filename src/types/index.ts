export type CalendarView = 'day' | 'week' | 'month'
export type ScheduleStatus = 'A' | 'B' | 'C' | '휴무' | '약속'

export type Profile = {
  id: string
  username: string | null
  email: string | null
}

export type Group = {
  id: number
  name: string
}

export type MemberSchedule = {
  date: string
  status: ScheduleStatus
  user_id: string
  event_title?: string | null
  profiles: { username: string | null } | null
}

export type VacationOption = {
  startDate: string
  endDate: string
  vacationDays: number
  requiredVacations: { username: string; dates: string[] }[]
}

export type WorkPattern = {
  id: number
  user_id: string
  shift_name: string
  shift_code: string
  start_time: string | null
  end_time: string | null
}

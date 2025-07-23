// src/components/FindBestDate.tsx
'use client'

import { useState } from 'react'
import { findBestDateAction } from '@/app/actions'
import AddToGoogleCalendar from '@/components/AddToGoogleCalendar'

// 서버에서 오는 결과 타입을 정의합니다.
type VacationOption = {
  startDate: string
  endDate: string
  vacationDays: number
  requiredVacations: {
    username: string
    dates: string[]
  }[]
}

export default function FindBestDate({ selectedGroupId }: { selectedGroupId: number | null }) {
  const [duration, setDuration] = useState(3)
  const [searchStart, setSearchStart] = useState('')
  const [searchEnd, setSearchEnd] = useState('')
  const [results, setResults] = useState<VacationOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setResults([])

    if (!selectedGroupId) {
      setError('그룹을 먼저 선택해주세요.');
      return;
    }
    if (!searchStart || !searchEnd) {
      setError('검색할 시작일과 종료일을 모두 지정해주세요.');
      return;
    }

    setIsLoading(true)
    try {
      const data = await findBestDateAction(duration, searchStart, searchEnd, selectedGroupId)
      if (data.error) {
        setError(data.error)
      } else if (data.result) {
        setResults(data.result)
      }
    } catch (e) {
      setError(`알 수 없는 에러가 발생했습니다: ${(e as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-12 p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">🏖️ 최적의 여행 날짜 찾기</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* flex-wrap 추가 및 input 너비 조정 */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="searchStart" className="block text-sm font-medium text-slate-600 dark:text-slate-400">검색 시작일</label>
            <input
              type="date"
              id="searchStart"
              value={searchStart}
              onChange={(e) => setSearchStart(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="searchEnd" className="block text-sm font-medium text-slate-600 dark:text-slate-400">검색 종료일</label>
            <input
              type="date"
              id="searchEnd"
              value={searchEnd}
              onChange={(e) => setSearchEnd(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
        </div>
        {/* flex-wrap 추가 및 button 너비 조정 */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-slate-600 dark:text-slate-400">여행 기간 (일)</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              className="mt-1 p-2 w-24 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading || !selectedGroupId}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 flex-grow sm:flex-grow-0"
          >
            {isLoading ? '계산 중...' : '찾기'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/50 dark:border-red-700 dark:text-red-300">
          <p className="font-bold">오류 발생</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold dark:text-slate-100">추천 여행 날짜:</h4>
          <div className="mt-4 flex flex-col gap-4">
            {results.map((result, index) => (
              <div key={index} className="bg-white dark:bg-slate-800 p-4 border border-blue-200 dark:border-slate-700 rounded-lg shadow">
                <p className="font-bold text-blue-700 dark:text-blue-400">
                  🗓️ 추천 {index + 1}: {result.startDate} ~ {result.endDate}
                </p>

                <AddToGoogleCalendar 
                  startDate={result.startDate}
                  endDate={result.endDate}
                  title="🎉 5총사 여행!"
                  details={`총 ${result.vacationDays}일의 휴가 필요. 상세 내용은 5총사 앱에서 확인하세요!`}
                />

                {result.requiredVacations.length > 0 ? (
                  <ul className="mt-2 list-disc list-inside text-sm text-slate-700 dark:text-slate-300">
                    {result.requiredVacations.map((vacation) => (
                      <li key={vacation.username}>
                        <span className="font-semibold">{vacation.username}:</span> {vacation.dates.join(', ')} 휴가 필요
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-semibold">✨ 모든 멤버가 휴가 없이 떠날 수 있어요!</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
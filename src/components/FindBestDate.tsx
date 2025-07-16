'use client'

import { useState } from 'react'
import { findBestDateAction } from '@/app/actions'

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
    setIsLoading(true)
    setError(null)
    setResults([])

    if (!searchStart || !searchEnd) {
      setError('검색할 날짜 범위를 지정해주세요.')
      setIsLoading(false)
      return
    }

    try {
      // 서버 액션에 selectedGroupId를 전달합니다.
      const data = await findBestDateAction(duration, searchStart, searchEnd, selectedGroupId)
      if (data.error) {
        setError(data.error)
      } else if (data.result) {
        setResults(data.result)
      }
    } catch (e) {
      setError('알 수 없는 에러가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // 다크 모드 스타일 추가
    <div className="mt-12 p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">🏖️ 최적의 여행 날짜 찾기</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label htmlFor="searchStart" className="block text-sm font-medium text-slate-600 dark:text-slate-400">검색 시작일</label>
            <input
              type="date"
              id="searchStart"
              value={searchStart}
              onChange={(e) => setSearchStart(e.target.value)}
              className="mt-1 p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <div>
            <label htmlFor="searchEnd" className="block text-sm font-medium text-slate-600 dark:text-slate-400">검색 종료일</label>
            <input
              type="date"
              id="searchEnd"
              value={searchEnd}
              onChange={(e) => setSearchEnd(e.target.value)}
              className="mt-1 p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-slate-600 dark:text-slate-400">여행 기간 (일)</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              className="mt-1 p-2 w-20 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600"
          >
            {isLoading ? '계산 중...' : '찾기'}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 text-red-500">에러: {error}</p>}

      {results.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold dark:text-slate-100">🎉 최적의 날짜를 찾았어요! (총 {results.length}개)</h4>
          <p className="text-slate-600 dark:text-slate-300">
            아래 날짜들에 여행하면 총 <strong className="text-blue-600 dark:text-blue-400">{results[0].vacationDays}일</strong>의 휴가만 필요해요.
          </p>
          
          <div className="mt-4 flex flex-col gap-4">
            {results.map((result, index) => (
              <div key={index} className="bg-white dark:bg-slate-800 p-4 border border-blue-200 dark:border-slate-700 rounded-lg shadow">
                <p className="font-bold text-blue-700 dark:text-blue-400">
                  🗓️ 추천 {index + 1}: {result.startDate} ~ {result.endDate}
                </p>
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
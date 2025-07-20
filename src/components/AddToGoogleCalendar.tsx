'use client'

type Props = {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  title: string
  details: string
}

export default function AddToGoogleCalendar({ startDate, endDate, title, details }: Props) {
  const createGoogleCalendarUrl = () => {
    const formatAsGoogleDate = (dateStr: string) => dateStr.replace(/-/g, '')

    const endDateObj = new Date(endDate + 'T00:00:00Z')
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 1)
    const googleEndDate = endDateObj.toISOString().split('T')[0]

    const url = new URL('https://www.google.com/calendar/render')
    url.searchParams.append('action', 'TEMPLATE')
    url.searchParams.append('text', title)
    url.searchParams.append('dates', `${formatAsGoogleDate(startDate)}/${formatAsGoogleDate(googleEndDate)}`)
    url.searchParams.append('details', details)

    return url.toString()
  }

  return (
    <a
      href={createGoogleCalendarUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
    >
      + 구글 캘린더에 추가하기
    </a>
  )
}
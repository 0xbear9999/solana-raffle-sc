import { cn } from "@nextui-org/react"
import { useEffect, useState } from "react"

function calculateTimeLeft(until: number) {
  const difference = until * 1000 - Date.now()
  let timeLeft = {}

  if (difference > 0) {
    timeLeft = {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      difference: Math.floor(difference / 1000),
    }
  }

  return timeLeft
}

export function Countdown({
  until,
  className,
  compact,
  threshold = 60 * 60,
  thresholdClassName = "text-danger font-bold text-xl",
  urgent = true,
}: {
  until: number
  className?: string
  compact?: boolean
  threshold?: number
  thresholdClassName?: string
  urgent?: boolean
}) {
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>(calculateTimeLeft(until))

  useEffect(() => {
    const id = setTimeout(() => {
      setTimeLeft(calculateTimeLeft(until))
    }, 1000)

    return () => {
      clearTimeout(id)
    }
  })

  const timerComponents = Object.keys(timeLeft)
    .filter((k) => k !== "difference")
    .map((interval, index) => {
      if (!timeLeft[interval as keyof object]) {
        if (interval === "days") {
          return
        }

        if (interval === "hours") {
          return !!timeLeft.days
        }

        if (interval === "minutes") {
          return !!(timeLeft.hours || timeLeft.days)
        }
      }

      return (
        <span key={index} className={cn({ [thresholdClassName]: urgent && timeLeft.difference <= threshold })}>
          {timeLeft[interval as keyof object]}
          {compact ? "" : " "}
          {compact
            ? interval.charAt(0)
            : timeLeft[interval] === 1
            ? interval.slice(0, interval.length - 1)
            : interval}{" "}
        </span>
      )
    })

  return <p className={className}>{timerComponents.length ? timerComponents : "ENDED"}</p>
}

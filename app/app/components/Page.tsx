import { PropsWithChildren } from "react"

export function Page({ children }: PropsWithChildren) {
  return <div className="flex flex-col items-center justify-center h-full w-full">{children}</div>
}

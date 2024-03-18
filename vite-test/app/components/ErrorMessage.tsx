import { BackArrow } from "./BackArrow"

export function ErrorMessage({ title, content }: { title: string; content?: string }) {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <h1 className="text-xl font-bold">{title}</h1>
      {content && <p>{content}</p>}
    </div>
  )
}

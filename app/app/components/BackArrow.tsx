import { Link } from "@remix-run/react"
import { Link as NextUiLink } from "@nextui-org/react"

export function BackArrow({ label = "Back" }: { label?: string }) {
  return (
    <p>
      <Link to="..">
        <NextUiLink className="font-bold bg-background rounded-xl px-2 py-1">◄ {label}</NextUiLink>
      </Link>
    </p>
  )
}

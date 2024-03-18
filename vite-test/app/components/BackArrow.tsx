import { Link } from "@remix-run/react"
import { Link as NextUiLink } from "@nextui-org/react"

export function BackArrow({ label = "Back" }: { label?: string }) {
  return (
    <Link to="..">
      <NextUiLink className="font-bold">◄ {label}</NextUiLink>
    </Link>
  )
}

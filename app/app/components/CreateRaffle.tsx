import { PlusCircleIcon } from "@heroicons/react/24/outline"
import { Card, CardBody } from "@nextui-org/react"
import { Link } from "@remix-run/react"
import { Title } from "./Title"

export function CreateRaffle() {
  return (
    <Card className="hidden xl:flex absolute bottom-20 right-10">
      <CardBody className="flex items-center justify-center">
        <Link to="/create" className="flex flex-col items-center justify-center gap-2">
          <PlusCircleIcon className="text-primary w-8" />
          <p className="text-xl font-bold uppercase">
            Create <Title />
          </p>
        </Link>
      </CardBody>
    </Card>
  )
}

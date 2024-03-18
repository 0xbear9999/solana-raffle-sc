import { Card, CardBody, CardFooter, CardHeader } from "@nextui-org/react"
import { PropsWithChildren, ReactNode } from "react"

export function PanelCard({ title, children, footer }: PropsWithChildren<{ title: ReactNode; footer?: ReactNode }>) {
  return (
    <Card className="lg:w-2/3 w-full m-auto sm:py-10 sm:px-16 px-8 py-5">
      <CardHeader>
        <h1 className="sm:text-3xl text-xl uppercase font-bold text-center w-full">{title}</h1>
      </CardHeader>
      <CardBody className="flex flex-col gap-4 sm:text-lg text-md">{children}</CardBody>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  )
}

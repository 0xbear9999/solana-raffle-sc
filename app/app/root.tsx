import stylesheet from "~/tailwind.css"

import type { LinksFunction, MetaFunction } from "@vercel/remix"
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  json,
  useLoaderData,
  useMatches,
} from "@remix-run/react"
import { Navbar, NavbarBrand, NavbarContent, Spinner } from "@nextui-org/react"
import walletStyles from "@solana/wallet-adapter-react-ui/styles.css"
import { Toaster } from "react-hot-toast"
import { XCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { PriorityFeesSelector } from "./components/PriorityFeesSelector"
import PoweredBy from "./components/PoweredBy"
import { Providers } from "./components/Providers"
import { WalletButton } from "./components/WalletButton"
import { useEffect } from "react"

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "stylesheet", href: walletStyles },
]

export async function loader() {
  return json({
    rpcHost: process.env.PUBLIC_RPC_HOST!,
  })
}

export const meta: MetaFunction = () => {
  return [
    { title: "// RAFFLE" },
    {
      name: "description",
      content: "Decentralized provably fair raffles onchain",
    },
  ]
}

export default function App() {
  let matches = useMatches()
  let childRoute = matches.find((match: any) => match.data !== null && "theme" in match.data)

  const { rpcHost } = useLoaderData<typeof loader>()

  useEffect(() => {
    // @ts-ignore
    const setTimeoutProto = window.setTimeout.__proto__
    if (!setTimeoutProto.unref) {
      setTimeoutProto.unref = function () {}
    }
  }, [])

  const theme = (childRoute?.data as any)?.theme
  const background = theme?.backgrounds?.[theme?.background] || "/bg.png"

  return (
    <html lang="en" className="bg-black">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-screen">
        <Toaster
          toastOptions={{
            loading: {
              icon: <Spinner size="sm" />,
            },
            error: {
              icon: <XCircleIcon className="h-6 w-6 text-red-500" />,
            },
            success: {
              icon: <CheckCircleIcon className="h-6 w-6 text-green-500" />,
            },
          }}
        />
        <Providers rpcHost={rpcHost}>
          <div className="main-theme text-foreground bg-background relative flex flex-col h-screen">
            <Navbar maxWidth="full" position="sticky" className="border-b-1 border-primary">
              <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
                <NavbarBrand as="li" className="gap-3 max-w-fit">
                  <Link to="/" className="flex gap-1">
                    <p className="text-primary text-3xl">//</p>
                    <p className="font-bold text-inherit text-3xl">RAFFLE</p>
                  </Link>
                </NavbarBrand>
              </NavbarContent>
              <NavbarContent justify="end">
                <WalletButton />
              </NavbarContent>
            </Navbar>
            <div
              className="overflow-auto flex-1 bg-[image:var(--image-url)] bg-no-repeat bg-cover h-full bg-fixed pb-20"
              style={{ "--image-url": `url('${background}')` } as any}
            >
              <main className="container h-full mx-auto max-w-7xl pt-10 px-6 flex-grow">
                <Outlet />
              </main>
            </div>

            <footer className="w-full flex items-center justify-center p-2 px-6 sticky bottom-0">
              <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <p className="text-[8px]">powered by</p>
                  <Link to="https://xinlabs.io" target="_blank" rel="noreferrer">
                    <PoweredBy className="h-4 fill-white" />
                  </Link>
                </div>
                <PriorityFeesSelector />
              </div>
            </footer>
          </div>
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.process = ${JSON.stringify({ env: {} })}`,
          }}
        />
      </body>
    </html>
  )
}

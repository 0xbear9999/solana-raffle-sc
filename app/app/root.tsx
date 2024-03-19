import { Buffer } from "buffer"
import stylesheet from "~/tailwind.css"

import type { LinksFunction, MetaFunction } from "@vercel/remix"
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Route,
  Routes,
  Scripts,
  ScrollRestoration,
  json,
  useLoaderData,
  useLocation,
  useMatches,
} from "@remix-run/react"
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Spinner,
  cn,
} from "@nextui-org/react"
import walletStyles from "@solana/wallet-adapter-react-ui/styles.css"
import { Toaster } from "react-hot-toast"
import { XCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { PriorityFeesSelector } from "./components/PriorityFeesSelector"
import PoweredBy from "./components/PoweredBy"
import { Providers } from "./components/Providers"
import { WalletButton } from "./components/WalletButton"
import { PropsWithChildren, useEffect, useState } from "react"
import { Title } from "./components/Title"
import { useTheme } from "./context/theme"
import { CreateRaffle } from "./components/CreateRaffle"

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

globalThis.Buffer = Buffer

export default function App() {
  const { pathname } = useLocation()
  let matches = useMatches()
  const [aboutModalShowing, setAboutModalShowing] = useState(false)
  const [pricingModalShowing, setPricingModalShowing] = useState(false)

  function toggleAboutModal() {
    setAboutModalShowing(!aboutModalShowing)
  }

  function togglePricingModal() {
    setPricingModalShowing(!pricingModalShowing)
  }

  const { rpcHost } = useLoaderData<typeof loader>()

  useEffect(() => {
    // @ts-ignore
    const setTimeoutProto = window.setTimeout(() => {}).__proto__
    if (!setTimeoutProto.unref) {
      setTimeoutProto.unref = function () {}
    }
  }, [])

  let childRoute = matches.find((match: any) => match.data !== null && "theme" in match.data)
  const theme = (childRoute?.data as any)?.theme

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
        <Providers rpcHost={rpcHost} theme={theme} key={pathname}>
          <Layout>
            <Outlet />
            {!childRoute && pathname !== "/create" && <CreateRaffle />}
          </Layout>
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

function Layout({ children }: PropsWithChildren) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const { theme } = useTheme()

  const menuItems = [
    {
      href: "/",
      label: "Home",
    },
    {
      href: "/create",
      label: "Create",
    },
    {
      href: "/about",
      label: "About",
    },
    {
      href: "/pricing",
      label: "Pricing",
    },
  ]

  const background = theme?.bg || "/bg.svg"
  return (
    <div className="main-theme text-foreground bg-background relative flex flex-col h-screen">
      <Navbar maxWidth="full" position="sticky" className="border-b-1 border-primary">
        <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
          <NavbarBrand as="li" className="gap-3 max-w-fit">
            <Link to="/">
              <Title size="text-3xl" />
            </Link>
          </NavbarBrand>
        </NavbarContent>

        <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} className="sm:hidden" />

        <NavbarContent justify="end" className="hidden sm:flex gap-10">
          {menuItems.map((item, index) => (
            <NavbarItem key={index}>
              <Link to={item.href} className={cn("font-bold", { "text-primary": pathname === item.href })}>
                {item.label}
              </Link>
            </NavbarItem>
          ))}

          <WalletButton />
        </NavbarContent>
        <NavbarMenu className="main-theme text-foreground">
          <div className="flex flex-col gap-3 uppercase">
            <WalletButton />
            {menuItems.map((item, index) => (
              <NavbarMenuItem key={`${item.label}-${index}`}>
                <Link to={item.href} className={cn("w-full", { "text-primary": pathname === item.href })}>
                  {item.label}
                </Link>
              </NavbarMenuItem>
            ))}
            <NavbarMenuItem>
              <Link to="http://stake.xinlabs.io" className={cn("w-full")} target="_blank" rel="noreferrer">
                <Title app="Stake" />
              </Link>
            </NavbarMenuItem>
          </div>

          <div className="flex items-center gap-2 absolute bottom-5">
            <p className="text-[8px] text-nowrap">powered by</p>
            <Link to="https://xinlabs.io" target="_blank" rel="noreferrer">
              <PoweredBy className="h-4 fill-white" />
            </Link>
          </div>
        </NavbarMenu>
      </Navbar>
      <div
        className="overflow-auto flex-1 bg-[image:var(--image-url)] bg-no-repeat bg-cover h-full bg-fixed pb-20"
        style={{ "--image-url": `url('${background}')` } as any}
      >
        <main className="container h-full mx-auto max-w-7xl pt-10 px-6 flex-grow">{children}</main>
      </div>

      <footer className="w-full flex items-center justify-center p-2 px-6 sticky bottom-0">
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-[8px] text-nowrap">powered by</p>
            <Link to="https://xinlabs.io" target="_blank" rel="noreferrer">
              <PoweredBy className="h-4 fill-white" />
            </Link>
          </div>
          <PriorityFeesSelector />
        </div>
      </footer>
    </div>
  )
}

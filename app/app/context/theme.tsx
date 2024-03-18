import { Dispatch, PropsWithChildren, SetStateAction, createContext, useContext, useState } from "react"
import { Theme } from "~/types/types"

const Context = createContext<
  { theme: Theme | null | undefined; setTheme: Dispatch<SetStateAction<Theme | null | undefined>> } | undefined
>(undefined)

export function ThemeProvider({ children, theme: initialTheme }: PropsWithChildren<{ theme?: Theme }>) {
  const [theme, setTheme] = useState<Theme | null | undefined>(initialTheme)

  return <Context.Provider value={{ theme, setTheme }}>{children}</Context.Provider>
}

export const useTheme = () => {
  const context = useContext(Context)

  if (context === undefined) {
    throw new Error("useTheme must be used in a ThemeProvider")
  }

  return context
}

import { Menu } from 'lucide-react'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'
import { NavLink } from 'react-router'

import { CartButton } from '@/components/layout/cart-button'
import { Logo } from '@/components/layout/logo'
import { Container } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { PRIMARY_NAV } from '@/lib/site'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8))

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled ? 'border-border bg-background/75 backdrop-blur-xl' : 'border-transparent bg-background',
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className="relative block px-3 py-2 text-sm">
                  {({ isActive }) => (
                    <>
                      <span className={cn('transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        {link.label}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="nav-underline"
                          className="absolute inset-x-3 -bottom-px h-px bg-foreground"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <CartButton />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Abrir menú">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Menú</SheetTitle>
              </SheetHeader>
              <nav aria-label="Móvil" className="px-4">
                <ul className="flex flex-col gap-1">
                  {PRIMARY_NAV.map((link, index) => (
                    <motion.li
                      key={link.to}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index + 0.1 }}
                    >
                      <NavLink
                        to={link.to}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          cn('block rounded-lg px-3 py-3 text-lg', isActive ? 'bg-muted font-medium' : 'text-muted-foreground')
                        }
                      >
                        {link.label}
                      </NavLink>
                    </motion.li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}

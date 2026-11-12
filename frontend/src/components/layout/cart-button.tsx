import { ShoppingBag } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { useCart } from '@/features/cart/cart-context'

export function CartButton() {
  const { totalPieces, setOpen } = useCart()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative rounded-full"
      onClick={() => setOpen(true)}
      aria-label={`Abrir carrito, ${totalPieces} ${totalPieces === 1 ? 'pieza' : 'piezas'}`}
    >
      <ShoppingBag />
      <AnimatePresence>
        {totalPieces > 0 && (
          <motion.span
            key={totalPieces}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground tabular-nums"
            aria-hidden
          >
            {totalPieces > 99 ? '99+' : totalPieces}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  )
}

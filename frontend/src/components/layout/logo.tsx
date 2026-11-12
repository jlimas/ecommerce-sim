import { Link } from 'react-router'

import { ROUTES, STORE } from '@/lib/site'

/** Pixel avatar + wordmark. The wordmark glitches (cyan/magenta split) on hover. */
export function Logo() {
  return (
    <Link to={ROUTES.home} className="group flex items-center gap-2.5" aria-label={`${STORE.name}, inicio`}>
      <img
        src="/arkanoid-avatar.png"
        alt=""
        width={36}
        height={36}
        className="size-9 object-contain [image-rendering:pixelated] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-rotate-3"
      />
      <span className="font-pixel text-base tracking-wide uppercase group-hover:animate-[glitch-shift_0.45s_steps(2,end)_1]">
        {STORE.name}
      </span>
    </Link>
  )
}

import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-sky-700 hover:bg-sky-800 text-white',
        danger:  'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-green-500 hover:bg-green-600 text-white',
        outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
        ghost:   'hover:bg-gray-100 text-gray-600',
        orange:  'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100',
        purple:  'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100',
        muted:   'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed',
      },
      size: {
        sm:   'px-3 py-1.5 text-sm',
        md:   'px-4 py-2 text-sm',
        lg:   'px-5 py-2.5 text-base',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

const Button = ({ className, variant, size, asChild = false, ...props }) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
export default Button

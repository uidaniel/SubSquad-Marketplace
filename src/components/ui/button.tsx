import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * There is one primary action on a screen and it is black; brand orange is
 * reserved for the single action that starts something new (the page-head CTA),
 * so a page never has two buttons competing to be pressed.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-medium transition-colors " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-ink/90",
        brand: "bg-brand-strong text-white hover:bg-brand-stronger",
        outline:
          "border border-line-strong bg-surface text-ink hover:bg-ground",
        ghost: "text-ink-2 hover:bg-ground hover:text-ink",
        danger:
          "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
        link: "text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        default: "h-9 px-4 text-[13.5px]",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-9",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "default", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };

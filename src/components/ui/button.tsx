"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "group/btn inline-flex shrink-0 select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-lg font-semibold tracking-[0.01em] transition-[background-color,border-color,color,box-shadow] duration-300 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-[#0b0b0b] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_28px_-14px_rgb(240_120_50/0.8)] hover:bg-brand-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_14px_32px_-12px_rgb(240_120_50/0.75)]",
        outline:
          "border border-white/20 bg-white/[0.03] text-fg backdrop-blur-sm hover:border-white/55 hover:bg-white/[0.08]",
        ghost: "text-fg hover:bg-white/[0.06]",
        whatsapp:
          "bg-whatsapp text-[#04210f] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_28px_-14px_rgb(37_211_102/0.75)] hover:brightness-110",
      },
      size: {
        sm: "h-10 px-5 text-[0.8125rem]",
        md: "h-12 px-6 text-sm",
        lg: "h-14 px-8 text-[0.9375rem]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type VariantProps_ = VariantProps<typeof buttonVariants>;

const motionProps = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 420, damping: 30 },
} as const;

export function Button({
  className,
  variant,
  size,
  disabled,
  ...props
}: HTMLMotionProps<"button"> & VariantProps_) {
  return (
    <motion.button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      {...(disabled ? {} : motionProps)}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: HTMLMotionProps<"a"> & VariantProps_) {
  return (
    <motion.a
      className={cn(buttonVariants({ variant, size }), className)}
      {...motionProps}
      {...props}
    />
  );
}

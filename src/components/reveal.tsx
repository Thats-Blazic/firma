"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export const easeOut = [0.22, 1, 0.36, 1] as const;

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
};

/** Fades + lifts content into view once when it enters the viewport. */
export function Reveal({ delay = 0, y = 28, className, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.9, ease: easeOut, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Small editorial label: orange index, hairline, muted caption. */
export function Eyebrow({
  index,
  children,
  className,
  center,
}: {
  index?: string;
  children: React.ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3.5 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-muted",
        center && "justify-center",
        className,
      )}
    >
      {index ? <span className="tabular-nums text-brand">{index}</span> : null}
      <span aria-hidden="true" className="h-px w-10 bg-white/20" />
      {children}
    </p>
  );
}

type SectionHeadingProps = {
  index?: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  id?: string;
  className?: string;
};

export function SectionHeading({ index, eyebrow, title, description, align = "left", id, className }: SectionHeadingProps) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <Eyebrow index={index} center={align === "center"} className="mb-6">
        {eyebrow}
      </Eyebrow>
      <h2
        id={id}
        className="text-[2.125rem] font-semibold leading-[1.06] tracking-[-0.03em] text-fg sm:text-5xl lg:text-[3.5rem]"
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-6 max-w-xl text-base leading-[1.7] text-muted sm:text-[1.0625rem]",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

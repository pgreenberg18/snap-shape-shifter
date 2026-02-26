import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full" style={{ background: '#0B1220', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
      <SliderPrimitive.Range className="absolute h-full" style={{ background: 'linear-gradient(90deg, hsl(217 100% 59% / 0.6), hsl(217 100% 59%))' }} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-[18px] w-[18px] rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" style={{ background: 'linear-gradient(145deg, #2A3446, #111827)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }} />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

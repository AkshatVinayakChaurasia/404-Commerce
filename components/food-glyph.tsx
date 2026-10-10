// Line drawings per menu category. Drawn, not photographed: the demo never
// shows a dish that isn't on the merchant's catalog.

type Props = { category: string; size?: number; className?: string };

export function FoodGlyph({ category, size = 72, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (category) {
    case "coffee":
      return (
        <svg {...common}>
          <path d="M19 18h26l-3.5 34a4 4 0 0 1-4 3.6h-11a4 4 0 0 1-4-3.6z" />
          <path d="M20.5 30h23" />
          <path d="M36 18 41 6h5" />
          <circle cx="27" cy="39" r="2.2" />
          <circle cx="35" cy="44" r="2.2" />
          <circle cx="30" cy="48" r="1.6" />
        </svg>
      );
    case "healthy":
      return (
        <svg {...common}>
          <path d="M8 32h48a24 18 0 0 1-48 0z" />
          <path d="M24 32c-2-8 2-14 10-16-1 8-4 13-10 16z" />
          <path d="M34 32c2-6 8-9 14-8-3 5-8 8-14 8z" />
          <circle cx="20" cy="27" r="3" />
          <path d="M22 52h20" />
        </svg>
      );
    case "cafe":
      return (
        <svg {...common}>
          <path d="M10 44 32 14l22 30z" />
          <path d="M13 40c6-3 12 3 19 0s13 3 19 0" />
          <path d="M10 44v4h44v-4" />
        </svg>
      );
    case "south_indian":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="44" rx="25" ry="8" />
          <path d="M12 40 50 22c3-1 5 2 3 4L22 46" />
          <path d="M30 31l4 8" />
          <path d="M40 26l3 7" />
        </svg>
      );
    case "dessert":
      return (
        <svg {...common}>
          <path d="M24 10h16a3 3 0 0 1 3 3v26a11 11 0 0 1-22 0V13a3 3 0 0 1 3-3z" />
          <path d="M32 50v8" />
          <path d="M26 22h12M26 30h12" />
        </svg>
      );
    case "chinese":
      return (
        <svg {...common}>
          <path d="M8 34h48a24 17 0 0 1-48 0z" />
          <path d="M16 34c3-5 6-5 9 0s6 5 9 0 6-5 9 0 5 4 7 0" />
          <path d="M40 8 30 30M48 10 36 30" />
          <path d="M24 53h16" />
        </svg>
      );
    case "juice":
      return (
        <svg {...common}>
          <path d="M18 16h28l-4 40H22z" />
          <path d="M19.5 28h25" />
          <circle cx="46" cy="16" r="7" />
          <path d="M46 9v14M39 16h14" />
        </svg>
      );
    case "biryani":
      return (
        <svg {...common}>
          <path d="M10 28h44l-4 22a6 6 0 0 1-6 5H20a6 6 0 0 1-6-5z" />
          <path d="M8 28h48" />
          <path d="M24 28c0-8 4-12 8-12s8 4 8 12" />
          <path d="M32 16v-5" />
        </svg>
      );
    case "bakery":
      return (
        <svg {...common}>
          <path d="M8 40c8-18 40-18 48 0-6 6-14 6-24 6S14 46 8 40z" />
          <path d="M22 30l4 12M32 28v14M42 30l-4 12" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="34" r="20" />
          <circle cx="32" cy="34" r="12" />
        </svg>
      );
  }
}

import { Box } from "@cursosactive/p360-new-ui";
import type { LucideIcon } from "lucide-react";

interface AppIconProps {
  icon: LucideIcon;
  size?: number;
  /** Chakra color token; herdada pelo SVG via currentColor. */
  color?: string;
}

/**
 * Wrapper fino para ícones lucide: aplica uma cor do tema Chakra (via
 * currentColor) e alinha o SVG verticalmente com o texto ao lado.
 */
export default function AppIcon({
  icon: Icon,
  size = 18,
  color,
}: AppIconProps) {
  return (
    <Box
      as="span"
      color={color}
      display="inline-flex"
      alignItems="center"
      lineHeight="0"
      flexShrink={0}
    >
      <Icon size={size} />
    </Box>
  );
}

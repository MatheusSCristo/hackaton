import { useState } from "react";
import { AspectRatio, Badge, Box, HStack, Text } from "@cursosactive/p360-new-ui";
import { Stethoscope } from "lucide-react";

import AppIcon from "./AppIcon";
import type { CasoAcervo } from "./data";

interface CasoCardProps {
  caso: CasoAcervo;
  selected: boolean;
  onSelect: (id: string, titulo: string) => void;
}

/** Card quadrado de um caso: foto no topo, conteúdo abaixo. Usado em grade. */
export default function CasoCard({ caso, selected, onSelect }: CasoCardProps) {
  const [imgError, setImgError] = useState(false);
  const showImg = caso.fotoUrl && !imgError;

  return (
    <Box
      role="button"
      tabIndex={0}
      cursor="pointer"
      onClick={() => onSelect(caso.id, caso.titulo)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(caso.id, caso.titulo);
        }
      }}
      display="flex"
      flexDirection="column"
      h="full"
      overflow="hidden"
      borderWidth="1px"
      borderColor={selected ? "blue.500" : "gray.200"}
      borderRadius="lg"
      transition="border-color 0.15s, box-shadow 0.15s"
      _hover={{
        borderColor: selected ? "blue.500" : "gray.300",
        boxShadow: "sm",
      }}
    >
      {/* Foto / placeholder — proporção fixa (4:3) pra não ficar uma tira fina cortada. */}
      <AspectRatio ratio={4 / 3} w="full" flexShrink={0}>
        <Box
          bg={`${caso.areaColor}.50`}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {showImg ? (
            <img
              src={caso.fotoUrl ?? undefined}
              alt=""
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <AppIcon
              icon={Stethoscope}
              size={26}
              color={`${caso.areaColor}.400`}
            />
          )}
        </Box>
      </AspectRatio>

      {/* Conteúdo */}
      <Box
        p="3"
        flex="1"
        display="flex"
        flexDirection="column"
        bg={selected ? "blue.50" : "white"}
      >
        {caso.area && (
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color={`${caso.areaColor}.600`}
            mb="0.5"
          >
            {caso.area}
          </Text>
        )}
        <Text
          fontWeight="bold"
          color="gray.900"
          fontSize="sm"
          lineHeight="1.25"
          lineClamp={2}
        >
          {caso.titulo}
        </Text>
        {caso.descricao && (
          <Text fontSize="xs" color="gray.600" mt="1" lineClamp={2}>
            {caso.descricao}
          </Text>
        )}
        {caso.chips.length > 0 && (
          <HStack gap="1.5" wrap="wrap" mt="auto" pt="2.5">
            {caso.chips.map((chip) => (
              <Badge
                key={chip}
                variant="subtle"
                colorPalette="gray"
                borderRadius="full"
                px="2"
                py="0.5"
                fontSize="xs"
              >
                {chip}
              </Badge>
            ))}
          </HStack>
        )}
      </Box>
    </Box>
  );
}

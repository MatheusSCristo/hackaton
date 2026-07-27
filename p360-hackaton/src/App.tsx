import { useTranslation } from "react-i18next";

import { AbsoluteCenter, Box } from "@cursosactive/p360-new-ui";

function App() {
  const { t } = useTranslation();

  return (
    <Box position="relative" h="100vh" bg="gray.100" borderRadius="md">
      <AbsoluteCenter>
        <Box bg="bg.emphasized" px="4" py="2" borderRadius="md" color="fg">
          {t("GREETING")}
        </Box>
      </AbsoluteCenter>
    </Box>
  );
}

export default App;

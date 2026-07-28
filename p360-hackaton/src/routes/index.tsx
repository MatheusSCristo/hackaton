import { BrowserRouter, Route, Routes } from "react-router";

import OverviewPage from "@/components/pages/aula/OverviewPage";
import AulaConectadaPage from "@/components/pages/aula/AulaConectadaPage";
import AulaCockpitPage from "@/components/pages/aula/AulaCockpitPage";
import AbrirSessaoPage from "@/components/pages/apresentar/AbrirSessaoPage";
import ApresentarPage from "@/components/pages/apresentar/ApresentarPage";
import ProjecaoPage from "@/components/pages/apresentar/ProjecaoPage";
import SalaAlunoPage from "@/components/pages/sala/SalaAlunoPage";
import SimuladoPage from "@/components/pages/simulado/SimuladoPage";

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/nova-aula" element={<AulaConectadaPage />} />
        <Route path="/aulas/:aulaId" element={<AulaCockpitPage />} />
        {/* Modo apresentação: controle no notebook + projeção no projetor. */}
        <Route path="/aulas/:aulaId/apresentar" element={<ApresentarPage />} />
        <Route path="/aulas/:aulaId/projetar" element={<ProjecaoPage />} />
        {/* Sessão ao vivo: independente do Apresentar (ver AbrirSessaoPage). */}
        <Route path="/aulas/:aulaId/sessao/abrir" element={<AbrirSessaoPage />} />
        {/* Sala do aluno: casca única da sessão, entrada por código. */}
        <Route path="/sala/:codigo" element={<SalaAlunoPage />} />
        {/* Pós-aula: página própria, o aluno faz em casa. */}
        <Route path="/simulado/:blocoId" element={<SimuladoPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router";

import OverviewPage from "@/components/pages/aula/OverviewPage";
import AulaConectadaPage from "@/components/pages/aula/AulaConectadaPage";
import ApresentarPage from "@/components/pages/apresentar/ApresentarPage";
import ProjecaoPage from "@/components/pages/apresentar/ProjecaoPage";
import SalaAlunoPage from "@/components/pages/sala/SalaAlunoPage";
import SimuladoPage from "@/components/pages/simulado/SimuladoPage";
import ResumoPage from "@/components/pages/resumo/ResumoPage";

/**
 * Não existe mais tela separada de preparação: a aula tem uma superfície só, a
 * apresentação. Mantido como redirect porque links de `/aulas/:id` circulam.
 */
function RedirecionaParaApresentar() {
  const { aulaId } = useParams<{ aulaId: string }>();
  return <Navigate to={`/aulas/${aulaId}/apresentar`} replace />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/nova-aula" element={<AulaConectadaPage />} />
        <Route path="/aulas/:aulaId" element={<RedirecionaParaApresentar />} />
        {/* Modo apresentação: controle no notebook + projeção no projetor. */}
        <Route path="/aulas/:aulaId/apresentar" element={<ApresentarPage />} />
        <Route path="/aulas/:aulaId/projetar" element={<ProjecaoPage />} />
        {/* Sala do aluno: casca única da sessão, entrada por código. */}
        <Route path="/sala/:codigo" element={<SalaAlunoPage />} />
        {/* Pós-aula: páginas próprias, o aluno faz/lê em casa. */}
        <Route path="/simulado/:blocoId" element={<SimuladoPage />} />
        <Route path="/resumo/:blocoId" element={<ResumoPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

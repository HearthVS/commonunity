import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "./components/Layout";
import AuthGate from "./components/AuthGate";
import Inventory from "./pages/Inventory";
import InstrumentDetail from "./pages/InstrumentDetail";
import ChakraAtlas from "./pages/ChakraAtlas";
import ChakraDetail from "./pages/ChakraDetail";
import BiofieldAtlas from "./pages/BiofieldAtlas";
import AyurvedaAtlas from "./pages/AyurvedaAtlas";
import CentersAtlas from "./pages/CentersAtlas";
import KoshasAtlas from "./pages/KoshasAtlas";
import SubtleBodiesAtlas from "./pages/SubtleBodiesAtlas";
import Questionnaire from "./pages/Questionnaire";
import QuestionnaireResult from "./pages/QuestionnaireResult";
import Clients from "./pages/Clients";
import Intake from "./pages/Intake";
import Protocols from "./pages/Protocols";
import ProtocolDetail from "./pages/ProtocolDetail";
import SessionLog from "./pages/SessionLog";
import SessionDetail from "./pages/SessionDetail";
import Composer from "./pages/Composer";
import Sources from "./pages/Sources";
import WhyOM from "./pages/WhyOM";
import PractitionerGuide from "./pages/PractitionerGuide";
import InventoryAudit from "./pages/InventoryAudit";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          {/* Standalone intake — no Layout */}
          <Route path="/intake" component={Intake} />

          <Route>
            <AuthGate>
              <Layout>
                <Switch>
                  <Route path="/" component={Inventory} />
                  <Route path="/inventory" component={Inventory} />
                  <Route path="/inventory/audit" component={InventoryAudit} />
                  <Route path="/inventory/:id" component={InstrumentDetail} />
                  <Route path="/chakras" component={ChakraAtlas} />
                  <Route path="/chakras/:id" component={ChakraDetail} />
                  <Route path="/biofield" component={BiofieldAtlas} />
                  <Route path="/ayurveda" component={AyurvedaAtlas} />
                  <Route path="/centers" component={CentersAtlas} />
                  <Route path="/koshas" component={KoshasAtlas} />
                  <Route path="/subtle-bodies" component={SubtleBodiesAtlas} />
                  <Route path="/questionnaire" component={Questionnaire} />
                  <Route path="/questionnaire/result/:id" component={QuestionnaireResult} />
                  <Route path="/clients" component={Clients} />
                  <Route path="/protocols" component={Protocols} />
                  <Route path="/protocols/:id" component={ProtocolDetail} />
                  <Route path="/sessions" component={SessionLog} />
                  <Route path="/sessions/:id" component={SessionDetail} />
                  <Route path="/composer" component={Composer} />
                  <Route path="/sources" component={Sources} />
                  <Route path="/why-om" component={WhyOM} />
                  <Route path="/guide" component={PractitionerGuide} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </AuthGate>
          </Route>
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

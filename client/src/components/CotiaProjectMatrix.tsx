import { Badge } from "@/components/ui/badge";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateCotiaMatrix,
  parseBrazilianDecimal,
} from "@shared/financial/cotiaMatrix";
import {
  CAPTATION_CHANNELS,
  COMMERCIAL_TEAM_ROLES,
  SALES_KIT_INVESTMENTS,
  SALES_ROOM_INVESTMENTS,
} from "@shared/financial/cotiaInvestmentCatalog";
import { Save } from "lucide-react";

type CotiaProjectMatrixProps = {
  values: Record<string, string>;
  sourceRef: string;
  status: "provided" | "pending";
  disabled?: boolean;
  saving?: boolean;
  onChange: (key: string, value: string) => void;
  onSourceChange: (value: string) => void;
  onStatusChange: (value: "provided" | "pending") => void;
  onSave: () => void;
};

type CommissionRole = { key: string; label: string };
type WorkforceRole = { key: string; label: string };
type CostLine = { key: string; label: string };

const commissionRoles: CommissionRole[] = [
  { key: "comissaoCorretor", label: "Corretor" },
  { key: "comissaoFechador", label: "Fechador" },
  { key: "comissaoCaptador", label: "Captador" },
  { key: "comissaoLiderCaptacao", label: "Líder de captação" },
  { key: "comissaoSubLider", label: "Sub-líderes (captação/sala)" },
  { key: "comissaoGerenteSala", label: "Gerente de sala" },
  { key: "comissaoGerenteFinanceiro", label: "Gerente financeiro" },
];

const salesRoomRoles: WorkforceRole[] = [
  { key: "admContratos", label: "ADM / Contratos" },
  { key: "salaKids", label: "Sala Kids" },
  { key: "recepcao", label: "Recepção" },
  { key: "liderAdmFinanceiro", label: "Líder ADM / Financeiro" },
  { key: "gerenteAdm", label: "Gerente ADM" },
  { key: "garcom", label: "Garçom" },
  { key: "limpeza", label: "Limpeza" },
  { key: "seguranca", label: "Segurança" },
];

const operatingCosts: CostLine[] = [
  { key: "utilidades", label: "Energia elétrica / aluguel / IPTU / água" },
  { key: "carros", label: "Aluguel de carro com motorista" },
  { key: "impressoras", label: "Aluguel de impressoras" },
  { key: "materiais", label: "Limpeza / descartáveis / copa" },
  { key: "marketingTi", label: "Marketing / T.I. / sistema / ADM financeiro" },
  { key: "juridicoContabil", label: "Jurídico / contabilidade" },
];

const paymentMethods: CostLine[] = [
  { key: "cartaoVista", label: "Cartão de crédito à vista" },
  { key: "cartaoParcelado", label: "Cartão parcelado" },
  { key: "debito", label: "À vista / cartão de débito" },
  { key: "recorrenteCheque", label: "Crédito recorrente / cheque" },
  { key: "boleto", label: "Boleto" },
];

function money(value: number) {
  return value
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

function number(value: number, digits = 0) {
  return value
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: digits })
    : "—";
}

function MatrixSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-900/30 bg-white shadow-sm">
      <div className="border-b border-slate-900/30 bg-[#fff200] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.08em] text-slate-950">
        {title}
      </div>
      {children}
    </section>
  );
}

export function CotiaProjectMatrix({
  values,
  sourceRef,
  status,
  disabled,
  saving,
  onChange,
  onSourceChange,
  onStatusChange,
  onSave,
}: CotiaProjectMatrixProps) {
  const v = (key: string) => values[key] ?? "";
  const field = (key: string, placeholder = "PENDENTE", mode = "decimal") => (
    <Input
      disabled={disabled}
      inputMode={mode === "text" ? "text" : "decimal"}
      value={v(key)}
      onChange={event => onChange(key, event.target.value)}
      placeholder={placeholder}
      className="h-8 min-w-0 border-0 bg-transparent px-2 text-right text-sm font-semibold text-slate-900 shadow-none focus-visible:ring-1 focus-visible:ring-amber-500"
    />
  );
  const calculations = calculateCotiaMatrix(values);

  return (
    <div className="space-y-5 text-slate-900">
      <div className="rounded-xl border border-slate-900/30 bg-slate-950 px-4 py-3 text-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">
              TGR Consulting · Página 01
            </p>
            <h2 className="mt-1 font-serif text-2xl">Matriz de Montagem da Operação</h2>
            <p className="mt-1 text-xs text-slate-300">
              Preencha o que já foi decidido. Total, custo e tempo são calculados na frente, igual a folha de Cotia — só que vivos.
            </p>
          </div>
          <Badge className={status === "provided" ? "bg-emerald-400/20 text-emerald-100" : "bg-amber-300/15 text-amber-100"}>
            {status === "provided" ? "INFORMADO" : "PENDENTE"}
          </Badge>
        </div>
      </div>

      <MatrixSection title="Hospedar / Da Mata · Dados do projeto">
        <div className="grid border-collapse sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["nomeProjeto", "Nome do projeto", "Novo projeto", "text"],
            ["praca", "Praça / cidade", "Cidade / UF", "text"],
            ["dataBase", "Data-base", "MM/AAAA", "text"],
            ["inicioOperacao", "Início da operação", "MM/AAAA", "text"],
          ].map(([key, label, placeholder, mode]) => (
            <div className="border-b border-r border-slate-900/20 p-2" key={key}>
              <Label className="text-[10px] font-black uppercase tracking-wide text-slate-600">{label}</Label>
              {field(key, placeholder, mode)}
            </div>
          ))}
        </div>
      </MatrixSection>

      <MatrixSection title="Produto, estoque e condição comercial">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <tbody>
              {[
                ["valorCota", "Valor da cota", "R$"],
                ["valorEntrada", "Valor da entrada", "R$"],
                ["parcelasEntrada", "Parcelas da entrada", "Qtd."],
                ["cotasPorApartamento", "Cotas por apartamento", "Qtd."],
                ["totalApartamentos", "Total de apartamentos", "Qtd."],
                ["eficiencia", "Eficiência comercial", "%"],
                ["valorCortesia", "Valor da cortesia", "R$"],
                ["taxaCancelamento", "Taxa de cancelamento", "%"],
                ["cotasVendidasMes", "Cotas vendidas por mês", "Qtd."],
              ].map(([key, label, unit]) => (
                <tr className="border-b border-slate-900/20" key={key}>
                  <td className="w-[48%] bg-slate-50 px-3 py-1.5 font-bold">{label}</td>
                  <td className="w-[12%] border-l border-slate-900/20 px-2 text-center text-xs text-slate-500">{unit}</td>
                  <td className="border-l border-slate-900/20">{field(key)}</td>
                  <td className="w-[25%] border-l border-slate-900/20 px-3 text-right text-xs text-slate-500">Premissa da operação</td>
                </tr>
              ))}
              {[
                ["Valor da parcela da entrada", money(calculations.entryInstallmentValue)],
                ["Total de cotas", number(calculations.totalShares)],
                ["VGV potencial", money(calculations.grossValue)],
                ["Entrada potencial", money(calculations.entrancePotential)],
                ["Meses de operação", number(calculations.monthsOfOperation, 1)],
              ].map(([label, result]) => (
                <tr className="border-b border-slate-900/20 bg-slate-100" key={label}>
                  <td className="px-3 py-1.5 font-black">{label}</td>
                  <td className="border-l border-slate-900/20" colSpan={3}><p className="px-3 text-right font-black">{result}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixSection>

      <MatrixSection title="Carteira do projeto e comissão por cota da pirâmide">
        <div className="grid border-b border-slate-900/20 sm:grid-cols-2">
          <div className="border-r border-slate-900/20 p-2">
            <Label className="text-[10px] font-black uppercase text-slate-600">Percentual do projeto adimplente</Label>
            {field("percentualAdimplente", "PENDENTE")}
          </div>
          <div className="p-2 text-right text-xs text-slate-500">Definir se é meta de carteira saudável ou regra de recebimento.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Profissional</th><th className="px-3 py-2 text-right">Valor / cota</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Total / cota</th></tr></thead>
            <tbody>
              {commissionRoles.map(role => {
                const total =
                  parseBrazilianDecimal(values[`${role.key}Valor`]) *
                  parseBrazilianDecimal(values[`${role.key}Quantidade`]);
                return <tr className="border-b border-slate-900/20" key={role.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{role.label}</td><td>{field(`${role.key}Valor`)}</td><td className="border-l border-slate-900/20">{field(`${role.key}Quantidade`)}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(total)}</td></tr>;
              })}
              <tr key="commission-per-share" className="bg-[#fff200]"><td className="px-3 py-2 font-black">Comissão por cota vendida</td><td colSpan={3} className="px-3 text-right font-black">{money(calculations.commissionPerShare)}</td></tr>
            </tbody>
          </table>
        </div>
      </MatrixSection>

      <MatrixSection title="Investimento em captação e canais">
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><tbody>
          {[
            ["captadoresQuantidade", "Número de captadores", "Pessoas"],
            ["captadorFixoMensal", "Fixo mensal por captador", "R$"],
            ["captadorAbordagensMes", "Abordagens por captador / mês", "Casais"],
            ["captadorTaxaQualificacao", "Taxa de qualificação", "%"],
            ["captadorTaxaComparecimento", "Taxa de comparecimento", "%"],
            ["captadorIncentivoPorCasal", "Incentivo por casal qualificado", "R$"],
            ["canalAtivacaoInicial", "Ativação inicial de canais", "R$"],
            ["canalMidiaMensal", "Mídia / custo recorrente de canais", "R$/mês"],
          ].map(([key, label, unit]) => <tr className="border-b border-slate-900/20" key={key}><td className="w-[48%] bg-slate-50 px-3 py-1.5 font-bold">{label}</td><td className="w-[12%] border-l border-slate-900/20 px-2 text-center text-xs text-slate-500">{unit}</td><td className="border-l border-slate-900/20">{field(key)}</td><td className="w-[25%] border-l border-slate-900/20 px-3 text-right text-xs text-slate-500">Variável de cenário</td></tr>)}
          {[
            ["Abordagens potenciais / mês", number(calculations.abordagensPotenciais)],
            ["Casais qualificados / mês", number(calculations.casaisQualificados)],
            ["NT projetadas / mês", number(calculations.ntProjetadas)],
            ["Investimento fixo de captação / mês", money(calculations.captacaoFixaMensal)],
            ["Incentivo variável de captação / mês", money(calculations.captacaoVariavelMensal)],
            ["Custo por casal qualificado", money(calculations.custoPorCasalQualificado)],
            ["Custo por NT", money(calculations.custoPorNt)],
          ].map(([label, result]) => <tr className="border-b border-slate-900/20 bg-slate-100" key={label}><td className="px-3 py-1.5 font-black">{label}</td><td colSpan={3} className="border-l border-slate-900/20 px-3 text-right font-black">{result}</td></tr>)}
          <tr key="acquisition-total" className="bg-[#fff200]"><td className="px-3 py-2 font-black">Investimento total de captação / mês</td><td colSpan={3} className="px-3 text-right font-black">{money(calculations.captacaoMensal)}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Máquina de captação / OPC por canal">
        <div className="border-b border-slate-900/20 bg-slate-50 px-3 py-2 text-xs text-slate-600">Preencha o funil real de cada origem. <strong>Qualificados / mês</strong> é uma alternativa direta quando abordagens e pesquisa ainda não foram medidas; as demais etapas ficam pendentes até serem definidas.</div>
        <div className="overflow-x-auto"><table className="min-w-[1740px] border-collapse text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Canal</th><th className="px-3 py-2 text-right">Ativação</th><th className="px-3 py-2 text-right">Recorrente/mês</th><th className="px-3 py-2 text-right">Abordagens</th><th className="px-3 py-2 text-right">Pesquisa %</th><th className="px-3 py-2 text-right">Qualif. %</th><th className="px-3 py-2 text-right">Qualif. direto</th><th className="px-3 py-2 text-right">Convite %</th><th className="px-3 py-2 text-right">Agendam. %</th><th className="px-3 py-2 text-right">Show %</th><th className="px-3 py-2 text-right">Tour %</th><th className="px-3 py-2 text-right">Conversão %</th><th className="px-3 py-2 text-right">Comissão/venda</th><th className="px-3 py-2 text-right">D90 %</th></tr></thead><tbody>
          {CAPTATION_CHANNELS.map(channel => <tr className="border-b border-slate-900/20" key={channel.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{channel.label}</td><td>{field(`${channel.key}AtivacaoInicial`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}RecorrenteMensal`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}AbordagensMes`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}PesquisaRate`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}QualificacaoRate`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}QualificadosMes`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}ConviteRate`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}AgendamentoRate`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}ShowRate`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}TourRate`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}Conversao`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}ComissaoPorVenda`)}</td><td className="border-l border-slate-900/20">{field(`${channel.key}AtivoD90`)}</td></tr>)}
        </tbody></table></div>
        <div className="overflow-x-auto"><table className="min-w-[1480px] border-collapse text-xs"><thead className="bg-slate-800 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Resultado por origem</th><th className="px-3 py-2 text-right">Abord.</th><th className="px-3 py-2 text-right">Pesquisas</th><th className="px-3 py-2 text-right">Qualif.</th><th className="px-3 py-2 text-right">Convites</th><th className="px-3 py-2 text-right">Agendam.</th><th className="px-3 py-2 text-right">Comparec.</th><th className="px-3 py-2 text-right">Tours</th><th className="px-3 py-2 text-right">Vendas</th><th className="px-3 py-2 text-right">Comissão</th><th className="px-3 py-2 text-right">VPG</th><th className="px-3 py-2 text-right">D90</th></tr></thead><tbody>
          {calculations.channelMetrics.map(metric => <React.Fragment key={metric.key}><tr className="border-b border-slate-900/20 bg-slate-100" key={`${metric.key}-result`}><td className="px-3 py-1.5 font-bold">{CAPTATION_CHANNELS.find(channel => channel.key === metric.key)?.label}</td><td className="px-3 text-right">{number(metric.approaches)}</td><td className="px-3 text-right">{number(metric.research)}</td><td className="px-3 text-right">{number(metric.qualified)}</td><td className="px-3 text-right">{number(metric.invites)}</td><td className="px-3 text-right">{number(metric.appointments)}</td><td className="px-3 text-right">{number(metric.attendance)}</td><td className="px-3 text-right">{number(metric.tours)}</td><td className="px-3 text-right">{number(metric.sales)}</td><td className="px-3 text-right">{money(metric.commissionMonthly)}</td><td className="px-3 text-right">{money(metric.vpg)}</td><td className="px-3 text-right">{number(metric.activeD90)}</td></tr><tr className="border-b border-slate-900/20 bg-white text-slate-600" key={`${metric.key}-costs`}><td className="px-3 py-1.5 font-semibold">Custo por etapa</td><td colSpan={2} className="px-3 text-right">Abord. {money(metric.costPerApproach)}</td><td className="px-3 text-right">Pesquisa {money(metric.costPerResearch)}</td><td className="px-3 text-right">Qualif. {money(metric.costPerQualified)}</td><td className="px-3 text-right">Agendam. {money(metric.costPerAppointment)}</td><td className="px-3 text-right">Comparec. {money(metric.costPerAttendance)}</td><td className="px-3 text-right">Tour {money(metric.costPerTour)}</td><td colSpan={4} className="px-3 text-right font-bold">Custo por venda {money(metric.costPerSale)}</td></tr></React.Fragment>)}
          <tr key="acquisition-multichannel-total" className="bg-[#fff200]"><td className="px-3 py-2 font-black">Captação multicanal</td><td colSpan={4} className="px-3 text-right font-black">Ativação {money(calculations.channelActivation)}</td><td colSpan={4} className="px-3 text-right font-black">Recorrente + comissão {money(calculations.channelRecurring)}</td><td colSpan={4} className="px-3 text-right font-black">Volume, qualidade e custo por etapa separados</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Pré-investimento — sala de vendas e sales kit">
        <div className="grid border-b border-slate-900/20 sm:grid-cols-2">
          <div className="border-r border-slate-900/20 p-2"><Label className="text-[10px] font-black uppercase text-slate-600">Meses de pré-operação</Label>{field("mesesPreOperacao", "PENDENTE")}</div>
          <div className="p-2 text-right text-xs text-slate-500">O pré-investimento será distribuído antes da abertura da operação. Sem prazo, o fluxo fica PENDENTE.</div>
        </div>
        <div className="grid border-b border-slate-900/20 sm:grid-cols-3">
          <div className="border-r border-slate-900/20 p-2"><Label className="text-[10px] font-black uppercase text-slate-600">Mês · ativação de captação</Label>{field("implantacaoCaptacaoMes", "PENDENTE")}</div>
          <div className="border-r border-slate-900/20 p-2"><Label className="text-[10px] font-black uppercase text-slate-600">Mês · sala de vendas</Label>{field("implantacaoSalaMes", "PENDENTE")}</div>
          <div className="p-2"><Label className="text-[10px] font-black uppercase text-slate-600">Mês · sales kit</Label>{field("implantacaoSalesKitMes", "PENDENTE")}</div>
        </div>
        <div className="border-b border-slate-900/20 bg-slate-50 px-3 py-2 text-xs text-slate-600">Sala premium sem obra pesada: quantidade é definida pela capacidade da operação; fornecedor e custo a cotar nunca são inventados.</div>
        <div className="overflow-x-auto"><table className="min-w-[1500px] border-collapse text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Sala de vendas</th><th className="px-3 py-2">Nível</th><th className="px-3 py-2">Base de quantidade</th><th className="px-3 py-2">Qtd.</th><th className="px-3 py-2">Custo unit.</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Lead time</th><th className="px-3 py-2">Dependência</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Total</th></tr></thead><tbody>
          {SALES_ROOM_INVESTMENTS.map(item => { const total = parseBrazilianDecimal(values[`${item.key}Quantidade`]) * parseBrazilianDecimal(values[`${item.key}CustoUnitario`]); return <tr className="border-b border-slate-900/20" key={item.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{item.label}</td><td className="px-3 text-center text-xs">{item.priority}</td><td className="px-3 text-center text-xs text-slate-600">{item.capacityBasis}</td><td>{field(`${item.key}Quantidade`)}</td><td className="border-l border-slate-900/20">{field(`${item.key}CustoUnitario`)}</td><td className="border-l border-slate-900/20">{field(`${item.key}Owner`, "PENDENTE", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}LeadTime`, "Dias", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}Dependencia`, "PENDENTE", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}Fornecedor`, "A cotar", "text")}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(total)}</td></tr> })}
        </tbody></table></div>
        <div className="border-y border-slate-900/20 bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700">Sales kit — catálogo, versão e aprovação</div>
        <div className="overflow-x-auto"><table className="min-w-[2100px] border-collapse text-xs"><thead className="bg-slate-800 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Peça</th><th className="px-3 py-2">Nível</th><th className="px-3 py-2">Objetivo</th><th className="px-3 py-2">Usuário</th><th className="px-3 py-2">Momento</th><th className="px-3 py-2">Formato</th><th className="px-3 py-2">Entrega</th><th className="px-3 py-2">Qtd.</th><th className="px-3 py-2">Custo unit.</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Lead time</th><th className="px-3 py-2">Atualização</th><th className="px-3 py-2">Aprovação</th><th className="px-3 py-2">Dependência</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Total</th></tr></thead><tbody>
          {SALES_KIT_INVESTMENTS.map(item => { const total = parseBrazilianDecimal(values[`${item.key}Quantidade`]) * parseBrazilianDecimal(values[`${item.key}CustoUnitario`]); return <tr className="border-b border-slate-900/20" key={item.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{item.label}</td><td className="px-3 text-center">{item.priority}</td><td className="px-3 text-slate-600">{item.objective}</td><td className="px-3 text-slate-600">{item.user}</td><td className="px-3 text-slate-600">{item.moment}</td><td className="px-3 text-slate-600">{item.format}</td><td className="px-3 text-slate-600">{item.delivery}</td><td>{field(`${item.key}Quantidade`)}</td><td className="border-l border-slate-900/20">{field(`${item.key}CustoUnitario`)}</td><td className="border-l border-slate-900/20">{field(`${item.key}Owner`, "PENDENTE", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}LeadTime`, item.leadTimeUnit, "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}Atualizacao`, "PENDENTE", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}Aprovacao`, "PENDENTE", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}Dependencia`, "PENDENTE", "text")}</td><td className="border-l border-slate-900/20">{field(`${item.key}Fornecedor`, "A cotar", "text")}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(total)}</td></tr> })}
          <tr key="implementation-total" className="bg-[#fff200]"><td className="px-3 py-2 font-black">Pré-investimento de implantação</td><td colSpan={15} className="px-3 text-right font-black">{money(calculations.implementationInvestment)}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Modelo comercial — estrutura fixa e comissão">
        <div className="border-b border-slate-900/20 bg-slate-50 px-3 py-2 text-xs text-slate-600">Comissão e custo por venda usam as cotas vendidas/mês; sem esse número, usam as vendas calculadas pelos canais. A produtividade informa a capacidade por função, não inventa venda.</div>
        <div className="overflow-x-auto"><table className="min-w-[1180px] border-collapse text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Função</th><th className="px-3 py-2 text-right">Headcount</th><th className="px-3 py-2 text-right">Fixo mensal</th><th className="px-3 py-2 text-right">Comissão/venda</th><th className="px-3 py-2 text-right">Produtividade/mês</th><th className="px-3 py-2 text-right">Capacidade/mês</th><th className="px-3 py-2 text-right">Custo fixo</th><th className="px-3 py-2 text-right">Comissão/mês</th><th className="px-3 py-2 text-right">Custo/venda</th></tr></thead><tbody>
          {calculations.commercialTeamMetrics.map(metric => <tr className="border-b border-slate-900/20" key={metric.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{COMMERCIAL_TEAM_ROLES.find(role => role.key === metric.key)?.label}</td><td>{field(`${metric.key}Quantidade`)}</td><td className="border-l border-slate-900/20">{field(`${metric.key}FixoMensal`)}</td><td className="border-l border-slate-900/20">{field(`${metric.key}ComissaoPorVenda`)}</td><td className="border-l border-slate-900/20">{field(`${metric.key}ProdutividadeMes`)}</td><td className="border-l border-slate-900/20 px-3 text-right">{number(metric.capacityMonthly)}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(metric.fixedCost)}</td><td className="border-l border-slate-900/20 px-3 text-right">{money(metric.commissionMonthly)}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(metric.costPerSale)}</td></tr>)}
          <tr key="commercial-model-total" className="bg-[#fff200]"><td className="px-3 py-2 font-black">Modelo comercial</td><td colSpan={2} className="px-3 text-right font-black">Base: {number(calculations.commercialSalesBasis)} vendas/mês</td><td colSpan={2} className="px-3 text-right font-black">Capacidade {number(calculations.commercialTeamCapacity)}/mês</td><td colSpan={2} className="px-3 text-right font-black">Fixo {money(calculations.commercialTeamFixed)}</td><td colSpan={2} className="px-3 text-right font-black">Comissão {money(calculations.commercialTeamCommissionMonthly)}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Pós-venda">
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><tbody>
          {[
            ["posVendaConsultores", "Número de consultores", "Qtd."],
            ["contratosPorConsultor", "Contratos por consultor", "Qtd."],
            ["posVendaSalario", "Salário por consultor", "R$"],
            ["posVendaAlmoco", "Almoço por consultor", "R$"],
            ["posVendaTransporte", "Transporte por consultor", "R$"],
            ["posVendaEncargos", "Encargos / adicionais", "%"],
            ["tempoPrevistoMeses", "Tempo previsto", "Meses"],
          ].map(([key, label, unit]) => <tr className="border-b border-slate-900/20" key={key}><td className="w-[48%] bg-slate-50 px-3 py-1.5 font-bold">{label}</td><td className="w-[12%] border-l border-slate-900/20 px-2 text-center text-xs text-slate-500">{unit}</td><td className="border-l border-slate-900/20">{field(key)}</td></tr>)}
          <tr key="post-sales-total" className="bg-slate-100"><td className="px-3 py-2 font-black">Custo mensal de pós-venda</td><td colSpan={2} className="px-3 text-right font-black">{money(calculations.postSalesMonthly)}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Despesa fixa — salas de vendas">
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Função</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Salário</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody>
          {salesRoomRoles.map(role => { const total = parseBrazilianDecimal(values[`${role.key}Quantidade`]) * parseBrazilianDecimal(values[`${role.key}Salario`]); return <tr className="border-b border-slate-900/20" key={role.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{role.label}</td><td>{field(`${role.key}Quantidade`)}</td><td className="border-l border-slate-900/20">{field(`${role.key}Salario`)}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(total)}</td></tr>; })}
          <tr key="room-transport" className="border-b border-slate-900/20"><td className="bg-slate-50 px-3 py-1.5 font-bold">Passagem / dia</td><td>{field("passagemDia")}</td><td className="border-l border-slate-900/20 px-3 text-right text-xs text-slate-500">Dias/mês</td><td className="border-l border-slate-900/20">{field("diasOperacaoMes")}</td></tr>
          <tr key="room-meal" className="border-b border-slate-900/20"><td className="bg-slate-50 px-3 py-1.5 font-bold">Refeição / dia</td><td>{field("refeicaoDia")}</td><td className="border-l border-slate-900/20 px-3 text-right text-xs text-slate-500">Encargos %</td><td className="border-l border-slate-900/20">{field("encargosSala")}</td></tr>
          <tr key="room-total" className="bg-[#fff200]"><td className="px-3 py-2 font-black">Total mensal da sala</td><td colSpan={3} className="px-3 text-right font-black">{money(calculations.roomMonthly)}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Custos operacionais da operação">
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Rubrica</th><th className="px-3 py-2 text-right">Média mensal</th><th className="px-3 py-2 text-right">Duração (meses)</th><th className="px-3 py-2 text-right">Total no período</th></tr></thead><tbody>
          {operatingCosts.map(line => { const total = parseBrazilianDecimal(values[`${line.key}Mensal`]) * parseBrazilianDecimal(values[`${line.key}Meses`]); return <tr className="border-b border-slate-900/20" key={line.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{line.label}</td><td>{field(`${line.key}Mensal`)}</td><td className="border-l border-slate-900/20">{field(`${line.key}Meses`)}</td><td className="border-l border-slate-900/20 px-3 text-right font-bold">{money(total)}</td></tr>; })}
          <tr key="opex-total" className="bg-[#fff200]"><td className="px-3 py-2 font-black">OPEX mensal consolidado</td><td colSpan={3} className="px-3 text-right font-black">{money(calculations.opexMonthly)}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <MatrixSection title="Média das formas de pagamento da entrada">
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-white"><tr><th className="px-3 py-2 text-left">Forma de pagamento</th><th className="px-3 py-2 text-right">% do mix</th><th className="px-3 py-2 text-right">Taxa / MDR</th><th className="px-3 py-2 text-right">Prazo (dias)</th></tr></thead><tbody>
          {paymentMethods.map(method => <tr className="border-b border-slate-900/20" key={method.key}><td className="bg-slate-50 px-3 py-1.5 font-semibold">{method.label}</td><td>{field(`${method.key}Percentual`)}</td><td className="border-l border-slate-900/20">{field(`${method.key}Taxa`)}</td><td className="border-l border-slate-900/20">{field(`${method.key}Prazo`)}</td></tr>)}
          <tr key="payment-mdr" className="bg-slate-100"><td className="px-3 py-1.5 font-black">MDR médio ponderado</td><td colSpan={3} className="px-3 text-right font-black">{number(calculations.weightedMdrRate, 2)}%</td></tr>
          <tr key="payment-gross-entry" className="bg-slate-100"><td className="px-3 py-1.5 font-black">Entrada bruta / mês</td><td colSpan={3} className="px-3 text-right font-black">{money(calculations.grossEntryMonthly)}</td></tr>
          <tr key="payment-net-entry" className="bg-slate-100"><td className="px-3 py-1.5 font-black">Entrada líquida após taxas</td><td colSpan={3} className="px-3 text-right font-black">{money(calculations.netEntryMonthly)}</td></tr>
          <tr key="payment-mix-total" className={calculations.paymentMix && Math.abs(calculations.paymentMix - 100) > 0.01 ? "bg-rose-100" : "bg-[#fff200]"}><td className="px-3 py-2 font-black">Mix informado</td><td colSpan={3} className="px-3 text-right font-black">{number(calculations.paymentMix, 2)}% {calculations.paymentMix && Math.abs(calculations.paymentMix - 100) > 0.01 ? "· precisa fechar em 100%" : ""}</td></tr>
        </tbody></table></div>
      </MatrixSection>

      <div className="rounded-xl border-2 border-slate-950 bg-[#fff200] p-4 text-slate-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.14em]">Pré-investimento / operação recorrente / entrada líquida</p><p className="mt-1 text-lg font-black">{money(calculations.preOperationalInvestment)} · {money(calculations.recurringOperationMonthly)} · {money(calculations.netEntryMonthly)}</p></div>
          <div className="w-full sm:w-72"><Label className="text-xs font-black uppercase">Fonte ou responsável pela folha</Label><Input value={sourceRef} onChange={event => onSourceChange(event.target.value)} placeholder="Ata, briefing, responsável" className="mt-1 h-9 border-slate-950/30 bg-white/65 text-slate-950" /></div>
          <div><Label className="text-xs font-black uppercase">Status</Label><select value={status} onChange={event => onStatusChange(event.target.value as "provided" | "pending")} className="mt-1 h-9 rounded-md border border-slate-950/30 bg-white px-3 text-sm"><option value="pending">PENDENTE</option><option value="provided">INFORMADO</option></select></div>
          <Button disabled={disabled || saving} onClick={onSave} className="bg-slate-950 text-white hover:bg-slate-800"><Save className="mr-2 h-4 w-4" />Registrar Página 1</Button>
        </div>
      </div>
    </div>
  );
}

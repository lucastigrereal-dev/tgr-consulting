export const CAPTATION_CHANNELS = [
  { key: "rua", label: "Rua" },
  { key: "pontosProprios", label: "Pontos próprios" },
  { key: "atracoes", label: "Atrações" },
  { key: "eventos", label: "Eventos" },
  { key: "hotelInhouse", label: "Hotel / in-house" },
  { key: "noturno", label: "Noturno" },
  { key: "parceiros", label: "Parceiros" },
  { key: "campanhas", label: "Campanhas" },
  { key: "trafegoDigital", label: "Tráfego digital" },
  { key: "indicacao", label: "Indicação" },
  { key: "experimental", label: "Canal experimental" },
] as const;

export const SALES_ROOM_INVESTMENTS = [
  { key: "recepcao", label: "Recepção e cadastro", priority: "Essencial", capacityBasis: "Pontos de cadastro" },
  { key: "comunicacaoVisual", label: "Comunicação visual e painel de credibilidade", priority: "Essencial", capacityBasis: "Áreas de impacto" },
  { key: "tvs", label: "TVs, verticais e videowall", priority: "Importante", capacityBasis: "Zonas de apresentação" },
  { key: "audio", label: "Som e música ambiente", priority: "Importante", capacityBasis: "Ambientes" },
  { key: "computadores", label: "Computadores, impressoras e tablets", priority: "Essencial", capacityBasis: "Estações comerciais" },
  { key: "mesas", label: "Mesas e infraestrutura comercial", priority: "Essencial", capacityBasis: "Casais simultâneos" },
  { key: "pagamentos", label: "Fechamento, pagamentos e identificação", priority: "Essencial", capacityBasis: "Pontos de fechamento" },
  { key: "crmSala", label: "CRM e integração de atendimento", priority: "Essencial", capacityBasis: "Fluxos de atendimento" },
  { key: "posVendaImediato", label: "Pós-venda imediato", priority: "Importante", capacityBasis: "Mesas de pós-venda" },
] as const;

export const SALES_KIT_INVESTMENTS = [
  { key: "bookLuxo", label: "Book de luxo e institucional", priority: "Essencial", objective: "Contextualizar valor e credibilidade", user: "Consultor / closer", moment: "Abertura e descoberta", format: "Impresso + PDF", delivery: "Físico / digital", leadTimeUnit: "Dias" },
  { key: "apresentacao", label: "Apresentação institucional e do empreendimento", priority: "Essencial", objective: "Conduzir a narrativa comercial", user: "Consultor / closer", moment: "Apresentação", format: "Slides", delivery: "Digital / tela", leadTimeUnit: "Dias" },
  { key: "videos", label: "Vídeos, destinos e credibilidade", priority: "Importante", objective: "Tornar o benefício tangível", user: "Consultor", moment: "Encantamento", format: "Vídeo", delivery: "Digital", leadTimeUnit: "Dias" },
  { key: "plantasMapas", label: "Plantas, mapas e destinos", priority: "Essencial", objective: "Demonstrar produto e localização", user: "Consultor", moment: "Demonstração", format: "Prancha + PDF", delivery: "Físico / digital", leadTimeUnit: "Dias" },
  { key: "beneficios", label: "Clube, parceiros e benefícios", priority: "Importante", objective: "Sustentar benefício recorrente", user: "Consultor / pós-venda", moment: "Valor e retenção", format: "Catálogo", delivery: "Físico / digital", leadTimeUnit: "Dias" },
  { key: "proposta", label: "Proposta, tabela e simulações", priority: "Essencial", objective: "Converter condição em decisão", user: "Closer", moment: "Proposta e fechamento", format: "Tabela / simulador", delivery: "Digital / impresso", leadTimeUnit: "Dias" },
  { key: "objecoes", label: "Materiais de objeção e fechamento", priority: "Essencial", objective: "Responder dúvidas críticas", user: "Closer / líder", moment: "Fechamento", format: "Playbook", delivery: "Digital", leadTimeUnit: "Dias" },
  { key: "documentacao", label: "Documentação e kit pós-venda", priority: "Essencial", objective: "Formalizar e orientar o cliente", user: "ADM / pós-venda", moment: "Assinatura e D0", format: "Kit documental", delivery: "Físico / digital", leadTimeUnit: "Dias" },
] as const;

export const COMMERCIAL_TEAM_ROLES = [
  { key: "liner", label: "Liner / consultor" },
  { key: "closer", label: "Closer / fechador" },
  { key: "liderComercial", label: "Líder comercial" },
  { key: "gerenteComercial", label: "Gerente comercial" },
  { key: "diretorComercial", label: "Diretor comercial" },
  { key: "salesOps", label: "Sales Ops" },
] as const;

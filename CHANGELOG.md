# Changelog

## 0.1.0 — Fundação Boardroom

Esta primeira release do IGR entrega o núcleo determinístico e a plataforma de decisão: projeção decimal de 1–120 meses, VPL, TIR, Payback, memória de KPI, fórmula versionada, snapshots com hash, Builder auditável, cenários, baseline imutável, Goal Seek, Capital Envelope, Boardroom, governança, PDF/PPTX autorizado e persistência de exportação.

O Builder passou a registrar os domínios de produto/estoque, preço/pagamentos, captação/capacidade, custos/workforce, comissões/parceiros, carteira/perdas e CAPEX/OPEX como componentes versionados, com status, payload e proveniência. A biblioteca histórica também foi implementada de forma isolada do modelo vivo.

O hardening removeu dependências sem uso, atualizou pacotes com achados de segurança, trocou o exportador PPTX por geração OOXML baseada em JSZip e corrigiu compatibilidades do runtime com Express 5. A auditoria de dependências de produção encerrou sem vulnerabilidades conhecidas.

## Gates ainda bloqueados por fonte

O dataset de regressão Pipa, o seed Natal produtivo e as regras matemáticas detalhadas de workforce/capacidade comercial continuam pendentes de fonte canônica. O produto preserva esses dados como `PENDENTE`; ele não inventa taxa, produtividade, turnover ou histórico só para a tela parecer adulta.

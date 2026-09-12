# Smart Fardo Creator

PRD — Sistema de Separação Logística Inteligente (SLI)

1. Informações do Projeto

Produto: Sistema de Separação Logística Inteligente (SLI)

Versão: MVP 1.0

Plataforma: Web Application

Framework de Desenvolvimento: Lovable

Objetivo do Documento: Definir os requisitos funcionais, regras de negócio, arquitetura de experiência do usuário e critérios de aceite para o desenvolvimento do Sistema de Separação Logística Inteligente.

2. Resumo Executivo

O Sistema de Separação Logística Inteligente (SLI) será uma aplicação web responsável por automatizar a leitura, análise e processamento de arquivos operacionais utilizados em centros de distribuição e operações logísticas.

A solução permitirá que operadores realizem upload de arquivos Excel ou CSV e recebam automaticamente um documento PDF padronizado, organizado por FARDOs de separação e pronto para impressão operacional.

O sistema elimina a necessidade de execução manual de scripts Python, reduzindo erros operacionais, aumentando a produtividade e padronizando o processo de separação.

3. Problema de Negócio

Atualmente o processo depende da execução manual de scripts em Python no Google Colab.

Principais dificuldades:

Dependência de conhecimento técnico.

Possibilidade de erro operacional.

Tempo elevado para processamento.

Falta de padronização visual.

Dificuldade para usuários não técnicos.

4. Objetivos do Produto

Objetivo Principal

Automatizar integralmente a geração de documentos de separação logística.

Objetivos Secundários

Reduzir o tempo de processamento operacional.

Eliminar manipulação manual de planilhas.

Automatizar a identificação de produtos.

Automatizar a criação de FARDOs.

Disponibilizar PDF pronto para impressão.

Melhorar a rastreabilidade operacional.

5. Público-Alvo

Primário

Auxiliares de Logística

Conferentes

Separadores

Operadores de CD

Secundário

Supervisores Operacionais

Coordenadores Logísticos

Analistas de Planejamento

Equipe Administrativa

6. Escopo do MVP

Incluído

Upload de Arquivos

Suporte para:

XLSX

XLS

CSV

Processamento Automático

Leitura da primeira aba como base principal.

Leitura opcional da segunda aba para obtenção de informações complementares.

Identificação Inteligente de Colunas

O sistema deverá localizar automaticamente:

Produto

Endereço

Código do Produto

Quantidade

Mesmo quando os cabeçalhos possuírem nomenclaturas diferentes.

Cálculo de Medidas

O sistema deverá:

Detectar medidas em milímetros.

Converter automaticamente para centímetros.

Calcular altura total por item.

Formação de FARDOs

O sistema deverá:

Agrupar itens por capacidade máxima.

Respeitar limite configurado de 65 cm.

Dividir itens em múltiplos FARDOs quando necessário.

Geração de Documento

Produzir:

PDF operacional.

Layout paisagem.

Formato A4.

Paginação automática.

Rodapé operacional.

Identificação de fim do documento.

7. Regras de Negócio

RN001 — Limite de FARDO

Cada FARDO poderá possuir no máximo:

65 cm de altura acumulada.

RN002 — Conversão de Unidade

Fórmula:

Altura em CM = Altura em MM ÷ 10

RN003 — Divisão de Produtos

Quando a soma da altura ultrapassar o limite do FARDO:

O sistema deverá dividir automaticamente a quantidade do item entre múltiplos FARDOs.

RN004 — Quantidade Mínima

Toda linha processada deverá possuir quantidade mínima igual a 1.

RN005 — Identificação do Último FARDO

O último FARDO do documento deverá apresentar:

FIM

em destaque visual.

RN006 — Rodapé Operacional

Caso exista segunda aba no arquivo:

O sistema deverá buscar automaticamente:

Rota

Pedido Origem

Número de Separação

8. Jornada do Usuário

Etapa 1

Usuário acessa a aplicação.

Etapa 2

Realiza upload do arquivo.

Etapa 3

Sistema valida estrutura.

Etapa 4

Sistema exibe resumo dos dados encontrados.

Etapa 5

Usuário confirma processamento.

Etapa 6

Sistema gera FARDOs automaticamente.

Etapa 7

Sistema gera PDF.

Etapa 8

Usuário realiza download do documento.

9. Estrutura de Telas

Tela 01 — Dashboard Inicial

Componentes

Área Drag & Drop

Botão Upload

Histórico de Processamentos

Indicador de Status

Tela 02 — Validação

Componentes

Nome do arquivo

Total de registros

Colunas identificadas

Colunas não identificadas

Botão Continuar

Tela 03 — Pré-Visualização

Componentes

Total de FARDOs

Altura por FARDO

Quantidade por FARDO

Prévia da impressão

Tela 04 — Resultado

Componentes

Download PDF

Novo Processamento

Histórico

10. Requisitos Funcionais

RF001

Permitir upload de arquivos XLSX e CSV.

RF002

Detectar automaticamente a estrutura da planilha.

RF003

Identificar colunas utilizando sinônimos.

RF004

Extrair medidas em MM.

RF005

Converter MM para CM.

RF006

Calcular altura total dos produtos.

RF007

Criar FARDOs automaticamente.

RF008

Dividir itens excedentes.

RF009

Calcular quantidade total por FARDO.

RF010

Gerar PDF operacional.

RF011

Inserir rodapé operacional.

RF012

Inserir marcador FIM.

RF013

Permitir download do PDF.

11. Requisitos Não Funcionais

Performance

Processar até 20.000 registros em menos de 15 segundos.

Segurança

Arquivos processados devem ser removidos após conclusão.

Disponibilidade

Disponibilidade mínima de 99%.

Usabilidade

Fluxo completo executado em até 3 cliques.

Compatibilidade

Suporte para:

Chrome

Edge

Firefox

12. Layout do PDF

Formato

A4

Paisagem

Cabeçalho

FARDO X

ALTURA TOTAL

QUANTIDADE TOTAL

Corpo

ProdutoEndereçoCódigoQuantidade

Rodapé

Rota

Pedido Origem

Separação

Última Página

Exibir:

FIM

em destaque centralizado.

13. Critérios de Aceite

O sistema será considerado aprovado quando:

Arquivos XLSX e CSV forem processados com sucesso.

As colunas forem identificadas automaticamente.

As medidas forem convertidas corretamente.

Os FARDOs respeitarem o limite de 65 cm.

O PDF for gerado sem intervenção manual.

O último FARDO exibir FIM.

O documento estiver pronto para impressão operacional.

14. Arquitetura Técnica Recomendada

Front-End

Lovable

React

Tailwind

Back-End

Supabase Edge Functions

Banco de Dados

Supabase PostgreSQL

Armazenamento

Supabase Storage

Processamento

Python Serverless

Pandas

OpenPyXL

Geração de PDF

ReportLab

15. Roadmap Futuro

V1.1

Configuração dinâmica da altura máxima do FARDO.

Escolha do formato de impressão.

V1.2

Histórico completo de processamentos.

Dashboard operacional.

V1.3

Integração com ERP Senior.

Integração com WMS.

V2.0

Inteligência Artificial para reconhecimento de layouts.

Sugestão automática de agrupamentos.

Monitoramento operacional em tempo real.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://separaologsticainteligente.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bb0806c3-a3c1-436f-989d-fba2e10bc0e1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

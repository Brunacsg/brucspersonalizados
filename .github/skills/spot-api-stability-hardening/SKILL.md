---
name: spot-api-stability-hardening
description: "Auditar e corrigir problemas de integracao e performance em projetos Node.js/Express com catalogo Spot Gifts. Use quando houver lentidao no catalogo, estoque travado em carregando, imagens quebradas, mapeamento incompleto de campos da API, erros silenciosos, promessas pendentes e regressao de estabilidade."
argument-hint: "Descreva sintomas, ambiente e endpoints impactados"
user-invocable: true
disable-model-invocation: false
---

# Spot API Stability Hardening

## Resultado Esperado

Aplicar um fluxo disciplinado de investigacao e correcao para resolver, em uma unica implementacao, problemas de performance, integracao, imagens, estoque e estabilidade em um projeto que consome Spot Gifts, preservando compatibilidade e comportamento atual.

Modo de operacao:
- Auditoria completa seguida de implementacao das correcoes.
- Em qualquer trade-off, compatibilidade total tem prioridade sobre ganho marginal de performance.

## Quando Usar

- Catalogo com carregamento lento para alto volume de produtos.
- Estoque preso em "Carregando" sem estado terminal.
- Imagens quebradas no detalhe de produto ou miniaturas.
- Campos da API nao refletidos na tela.
- Integracao instavel por autenticacao, timeout, retry, cache ou rate limit.
- Erros silenciosos em promises, try/catch ou fluxos async.
- Sinais de codigo morto e processamento redundante.

## Guardrails Obrigatorios

Nao pode:
- Alterar layout.
- Alterar CSS.
- Renomear arquivos.
- Mudar arquitetura.
- Remover funcionalidades.
- Alterar contratos de API.
- Quebrar compatibilidade.
- Introduzir dependencia nova sem necessidade objetiva.
- Fazer refatoracao desnecessaria.

Deve:
- Corrigir bugs com causa raiz identificada.
- Otimizar performance sem alterar comportamento funcional.
- Melhorar estabilidade e tratamento de erro.
- Reduzir tempo de carregamento.
- Preservar funcionalidades existentes.

## Fluxo de Trabalho (Obrigatorio)

1. Baseline e observabilidade temporaria.
- Levantar tempos de resposta ponta a ponta (API externa, backend, frontend).
- Medir quantidade de requisicoes por tela e detectar duplicidade.
- Adicionar logs temporarios minimos para endpoint, latencia, payload resumido, erro de autenticacao, erro de estoque, erro de imagem e promise pendente.
- Definir criterios de sucesso antes da primeira mudanca.

2. Analise completa antes de editar qualquer arquivo.
- Mapear fluxo completo: Response JSON -> Backend -> Controllers -> Services -> Repository -> DTO/Model -> Frontend -> Tela.
- Listar gargalos de CPU e memoria (loops, sort/filter repetidos, renderizacao redundante).
- Catalogar problemas de async (await em loops inadequados, promises sem await, catch vazio, timeout ausente).
- Identificar pontos de falha por problema e consolidar em matriz de causa raiz.

3. Correcao em lote por causa raiz.
- Corrigir primeiro os pontos estruturais que destravam multiplos sintomas.
- Evitar tentativa e erro. Cada alteracao precisa de hipotese e validacao objetiva.
- Aplicar melhorias de performance sem alterar contrato nem estrutura externa.

4. Validacao funcional e nao funcional.
- Executar testes e checks de lint/sintaxe.
- Confirmar ausencia de erro e warning no console.
- Confirmar que o fluxo de dados exibe todos os campos esperados (incluindo opcionais, arrays e objetos aninhados).
- Remover logs temporarios.

5. Relatorio final tecnico.
- Entregar causa raiz por problema, alteracoes por arquivo/funcao/linhas, ganhos de performance, riscos e passos de validacao.

## Matriz de Diagnostico e Correcao

### Problema 1: Catalogo muito lento
Checklist tecnico:
- Medir tempo da API externa, backend e render frontend separadamente.
- Contar requisicoes e identificar chamadas duplicadas.
- Buscar chamadas dentro de loops, await em for/map e processamento O(n^2) evitavel.
- Priorizar paralelismo seguro com Promise.all para I/O independente.
- Evitar renderizacao repetida e recalculo de filtros/ordenacao sem necessidade.
- Revisar debounce, paginacao e estrategia de cache para volume alto.
Criterio de saida:
- Catalogo abre rapidamente mesmo com mais de 1200 produtos, sem degradar busca/filtro.

### Problema 2: Estoque preso em carregando
Checklist tecnico:
- Verificar endpoint e parametros enviados.
- Confirmar timeout e caminho de erro terminal no frontend.
- Detectar promise pendente e await incorreto.
- Validar autenticacao e ACCESS_KEY.
- Tratar resposta parcial e campo ausente.
Regra obrigatoria:
- Em qualquer falha, mostrar "Estoque indisponivel".
- Nunca manter estado infinito de carregamento.

### Problema 3: Imagens quebradas no detalhe
Checklist tecnico:
- Validar campos reais retornados para imagem principal e adicionais.
- Priorizar URL fornecida pela API quando existente.
- Tratar URL absoluta/relativa, HTTPS, encoding e caracteres especiais.
- Suportar imagens nulas com fallback somente quando nao houver imagem valida.
Criterio de saida:
- Imagem principal e miniaturas corretas no detalhe, sem montagem manual indevida quando a API ja fornece URL final.

### Problema 4: Dados da API nao exibidos por completo
Checklist tecnico:
- Comparar campo a campo do JSON ate a tela.
- Mapear campos opcionais sem descarte silencioso.
- Preservar arrays e objetos aninhados no mapeamento.
- Revisar DTO/Model para evitar perda de informacao.
Criterio de saida:
- Nenhum campo util da API e descartado no pipeline.

### Problema 5: Integracao com API
Checklist tecnico:
- Auditar autenticacao, ACCESS_KEY, headers, timeout e retry.
- Verificar paginacao, cache, rate limit e chamadas repetidas.
- Garantir tratamento consistente de erro e resposta incompleta.
Criterio de saida:
- Integracao estavel, com erros trataveis e sem regressao de contrato.

### Problema 6: Performance geral
Checklist tecnico:
- Eliminar fetch duplicado e processamento redundante.
- Reduzir renderizacoes desnecessarias e recriacao de funcoes custosas.
- Remover listeners nao utilizados e prevenir vazamento.
Criterio de saida:
- Menor custo de CPU/memoria com comportamento funcional preservado.

### Problema 7: Pipeline de imagens
Checklist tecnico:
- Verificar lazy loading, preload, cache e download repetido.
- Evitar baixar a mesma imagem varias vezes.
Criterio de saida:
- Imagens aparecem rapidamente apos dados estarem disponiveis.

### Problema 8: Logs de debug temporarios
Checklist tecnico:
- Inserir logs de investigacao somente durante diagnostico.
- Cobrir endpoint chamado, latencia e erros criticos.
Regra obrigatoria:
- Remover todos os logs temporarios antes da entrega.

### Problema 9: Erros silenciosos
Checklist tecnico:
- Corrigir try/catch vazio e .catch() que engole erro.
- Garantir await onde necessario.
- Tratar timeout, abort e promises ignoradas.
Criterio de saida:
- Fluxos async com erro observavel e estado terminal definido.

### Problema 10: Codigo morto
Checklist tecnico:
- Remover imports nao usados, funcoes inativas e duplicacoes reais.
- Nao alterar comportamento externo.
Criterio de saida:
- Base mais limpa, sem regressao funcional.

## Logica de Decisao

1. Se existe sintoma sem metrica, instrumentar antes de alterar.
2. Se duas causas competem, priorizar a que explica mais sintomas.
3. Se correcao muda contrato/API/layout/CSS, rejeitar e buscar alternativa.
4. Se erro de rede/autenticacao/timeout ocorrer, sempre aplicar estado terminal no frontend.
5. Se API ja retorna URL valida de imagem, usar diretamente.
6. Se campo pode existir no JSON e nao chega na tela, rastrear pipeline inteiro ate localizar descarte.
7. Se houver conflito entre compatibilidade e performance, manter compatibilidade e buscar otimizar por outra via.

## Checklist de Conclusao

- Nenhum erro no console.
- Nenhum warning novo.
- Build e checks funcionando.
- Catalogo rapido.
- Busca e filtros responsivos.
- Estoque funcional com fallback de indisponibilidade.
- Imagens funcionando e sem quebras.
- Todos os dados esperados da API exibidos.
- Nenhuma funcionalidade quebrada.
- Nenhuma regressao detectada.
- Nenhuma promise pendente sem tratamento.
- Nenhum endpoint critico falhando.

## Formato de Entrega Obrigatorio

1. Causa raiz encontrada para cada problema.
2. Arquivos modificados.
3. Funcoes modificadas.
4. Linhas alteradas.
5. Justificativa tecnica de cada alteracao.
6. Melhorias de performance obtidas.
7. Possiveis riscos.
8. Como validar funcionamento ponta a ponta.
9. Lista de testes executados.
10. Confirmacao de que nenhuma funcionalidade existente foi quebrada.

## Prompt de Uso

Use este skill para auditar e corrigir integralmente lentidao do catalogo, estoque travado em carregando, imagens quebradas e perda de campos da API Spot, com analise de causa raiz antes de qualquer edicao e entrega em relatorio tecnico completo.

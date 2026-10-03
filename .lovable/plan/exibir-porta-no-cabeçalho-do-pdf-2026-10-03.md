# Exibir Porta no cabeçalho do PDF

## Alteração
- Mapear automaticamente a coluna **Porta** junto aos dados operacionais da planilha.
- Ler o primeiro número válido da coluna; no arquivo enviado, o valor identificado é **988**.
- Mostrar **PORTA: 988** no cabeçalho de todas as páginas do PDF, preservando FARDO, data, altura e quantidade.

## Verificação
- Processar o arquivo enviado e confirmar a identificação de Porta, Rota, Pedido Origem e Separação.
- Gerar o PDF e conferir que o número da Porta aparece no cabeçalho sem sobreposição.

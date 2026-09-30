// Checklist base da visita presencial: o que qualquer comprador consegue verificar sem equipamento, so olhando,
// tocando e dirigindo. Itens do modelo (dossie) e do anuncio (analise) sao acrescentados pela IA em cima desta base.
// Mantenha os ids estaveis: as respostas sao guardadas por id.

export type OrigemItem = 'base' | 'modelo' | 'anuncio';
export type RespostaItem = 'ok' | 'problema' | 'nao_aplica';

export type ItemChecklist = {
  id: string;
  texto: string;
  dica: string;
  origem: OrigemItem;
  /** Por que este item entrou (defeito cronico ou suspeita do anuncio). So para origem != base. */
  motivo?: string;
  resposta: RespostaItem | null;
  observacao: string;
  fotos: string[];
};

export type AreaChecklist = {
  id: string;
  titulo: string;
  icone: string;
  intro: string;
  itens: ItemChecklist[];
};

export type Checklist = {
  versao: number;
  areas: AreaChecklist[];
  perguntas_ao_vendedor: string[];
};

export const CHECKLIST_VERSAO = 1;

type ItemBase = [id: string, texto: string, dica: string];
type AreaBase = { id: string; titulo: string; icone: string; intro: string; itens: ItemBase[] };

const AREAS_BASE: AreaBase[] = [
  {
    id: 'documentos',
    titulo: 'Documentos e identificação',
    icone: '📄',
    intro: 'Antes de olhar o carro, confira se ele é o que o documento diz.',
    itens: [
      ['doc_placa', 'Placa igual à do documento (CRLV)', 'Compare os caracteres um a um e o município de registro.'],
      ['doc_chassi', 'Chassi legível e igual ao documento', 'Fica na base do para-brisa (lado do motorista), na coluna da porta e sob o banco ou no assoalho. Sem rebites, riscos ou pintura por cima.'],
      ['doc_vidros', 'Gravação do chassi em todos os vidros', 'Todos os vidros devem ter os mesmos últimos dígitos gravados. Um vidro sem gravação foi trocado.'],
      ['doc_motor', 'Número do motor igual ao documento (quando acessível)', 'Peça ao vendedor para mostrar. Motor sem número ou com número diferente é problema de documentação.'],
      ['doc_km', 'Quilometragem do painel anotada', 'Fotografe o painel ligado. Compare com o anúncio e com o histórico de revisões.'],
      ['doc_luzes', 'Painel sem luzes de alerta acesas', 'Ligue a ignição sem dar partida: todas as luzes acendem. Depois de ligar, todas devem apagar (airbag, ABS, injeção, óleo, bateria).'],
      ['doc_manual', 'Manual, chave reserva e histórico de revisões', 'Falta de chave reserva custa caro em carros com chave codificada. Revisões carimbadas ou notas fiscais.'],
      ['doc_debitos', 'Multas, IPVA e restrições consultados', 'Consulte a placa no site do Detran do estado antes de fechar. Peça o CRLV em nome do vendedor.']
    ]
  },
  {
    id: 'frente',
    titulo: 'Frente',
    icone: '🚗',
    intro: 'Agache na frente do carro e olhe as peças contra a luz.',
    itens: [
      ['fr_vaos', 'Vãos do capô iguais dos dois lados', 'A fresta entre capô e para-lamas deve ter a mesma largura em toda a volta. Capô mais alto de um lado indica batida ou ajuste.'],
      ['fr_tom', 'Capô, para-lamas e para-choque com a mesma cor e brilho', 'Olhe de lado, contra a luz: o reflexo deve correr contínuo de uma peça para a outra.'],
      ['fr_farois', 'Faróis iguais entre si (brilho, amarelamento, marca)', 'Um farol novo e o outro amarelado sugere troca após batida daquele lado. Confira a marca gravada na lente.'],
      ['fr_parafusos', 'Parafusos dos para-lamas e do capô sem marca de ferramenta', 'Abra o capô: os parafusos de fábrica têm tinta intacta. Tinta quebrada ou cabeça brilhante = peça removida.'],
      ['fr_longarinas', 'Longarinas e painel frontal sem dobras, solda ou massa', 'Com o capô aberto, siga com o olhar as duas vigas laterais até o para-choque: devem ser lisas, com selante de fábrica uniforme.'],
      ['fr_radiador', 'Radiador, condensador e suporte do painel sem amassados', 'Amassados na colmeia do radiador ou suporte tortos indicam impacto frontal.']
    ]
  },
  {
    id: 'laterais',
    titulo: 'Laterais',
    icone: '🚪',
    intro: 'Faça o mesmo dos dois lados e compare um com o outro.',
    itens: [
      ['la_portas', 'Portas alinhadas com para-lamas e laterais', 'Vãos iguais em cima e embaixo. Porta que precisa de força para fechar ou "cai" ao abrir tem dobradiça ou coluna mexida.'],
      ['la_tom', 'Portas e para-lamas com mesma cor, brilho e textura', 'Repintura costuma dar textura de casca de laranja e brilho diferente. Compare cada porta com a vizinha.'],
      ['la_borrachas', 'Borrachas, frisos e maçanetas sem névoa de tinta', 'Pintura de fábrica não invade borracha nem plástico. Tinta no encontro de porta e borracha = repintura.'],
      ['la_colunas', 'Colunas A, B e C sem reparo (abra as portas)', 'Com a porta aberta, olhe a coluna e a soleira: solda de fábrica é regular; massa, lixa ou pintura irregular indicam reparo estrutural.'],
      ['la_soleiras', 'Soleiras e parte baixa sem amassados, ferrugem ou repintura', 'Agache e olhe a base das portas. Ferrugem aqui é comum em carros de litoral ou que passaram por enchente.'],
      ['la_etiquetas', 'Etiquetas de fábrica presentes nas portas', 'Muitos carros têm etiqueta de identificação na coluna ou na porta. Faltar em uma porta só indica troca.'],
      ['la_retrovisores', 'Retrovisores da mesma cor e funcionando', 'Retrovisor de cor levemente diferente costuma ser peça de reposição.']
    ]
  },
  {
    id: 'traseira',
    titulo: 'Traseira',
    icone: '🔙',
    intro: 'Abra o porta-malas e levante o carpete.',
    itens: [
      ['tr_tampa', 'Tampa do porta-malas alinhada e com vãos iguais', 'Vãos desiguais ou tampa que não fecha de primeira indicam batida traseira.'],
      ['tr_lanternas', 'Lanternas iguais entre si e bem encaixadas', 'Lanterna com tom ou encaixe diferente foi trocada.'],
      ['tr_assoalho', 'Assoalho do porta-malas e alojamento do estepe sem ondulações', 'Levante o carpete: o fundo deve ser liso, com selante uniforme. Ondulação, massa ou pintura nova = batida traseira.'],
      ['tr_estepe', 'Estepe, macaco e chave de roda presentes', 'Confira o estado do estepe e se as ferramentas são do carro.'],
      ['tr_umidade', 'Porta-malas sem umidade, cheiro de mofo ou barro', 'Água acumulada no alojamento do estepe indica vedação ruim ou enchente.']
    ]
  },
  {
    id: 'vidros_pneus',
    titulo: 'Vidros, pneus e rodas',
    icone: '🛞',
    intro: 'Pneus e vidros contam a história do carro.',
    itens: [
      ['vp_parabrisa', 'Para-brisa sem trincas e com a mesma marca dos outros vidros', 'Trinca reprova na vistoria. Marca diferente = vidro trocado (pergunte por quê).'],
      ['vp_pneus_marca', 'Quatro pneus da mesma marca e modelo', 'Pneus diferentes indicam economia na manutenção. Anote a marca de cada um.'],
      ['vp_pneus_sulco', 'Sulco acima do indicador de desgaste (TWI)', 'Passe o dedo dentro do sulco: deve ter mais de 3 mm. Abaixo de 1,6 mm é ilegal.'],
      ['vp_pneus_desgaste', 'Desgaste uniforme, sem lado mais gasto', 'Desgaste só na borda interna ou externa indica alinhamento ruim ou suspensão torta.'],
      ['vp_dot', 'Data de fabricação dos pneus (DOT) anotada', 'Os quatro últimos dígitos do DOT são semana e ano. Pneu com mais de 5 anos precisa de troca mesmo com sulco.'],
      ['vp_rodas', 'Rodas sem trincas, empenos ou reparos', 'Passe a mão na borda interna procurando amassados. Roda empenada trepida na direção em velocidade.']
    ]
  },
  {
    id: 'interior',
    titulo: 'Interior',
    icone: '💺',
    intro: 'O desgaste do interior precisa combinar com a quilometragem.',
    itens: [
      ['in_volante', 'Volante, manopla e pedais com desgaste compatível com a km', 'Volante liso e brilhante, pedal de borracha careca e manopla gasta com "60 mil km" indicam km adulterada.'],
      ['in_bancos', 'Bancos sem rasgos, afundamento ou capas escondendo defeitos', 'Levante capas e olhe a lateral do banco do motorista, a que mais desgasta.'],
      ['in_carpete', 'Carpete e forro seco, sem barro, mancha ou cheiro', 'Levante o tapete e passe a mão embaixo do banco: umidade ou areia indicam enchente.'],
      ['in_parafusos', 'Parafusos dos bancos e cintos sem ferrugem', 'Ferrugem nos parafusos internos é sinal clássico de carro alagado.'],
      ['in_eletrica', 'Vidros, travas, retrovisores e ar-condicionado funcionando', 'Teste tudo: cada vidro, trava, farol, seta, limpador, buzina, central multimídia e o ar gelando.'],
      ['in_cintos', 'Cintos travando ao puxar rápido e sem sinais de troca', 'Cinto que não trava ou etiqueta cortada indica airbag disparado e cinto substituído.'],
      ['in_airbag', 'Painel e volante sem sinais de airbag disparado', 'Tampa do airbag com cor, textura ou encaixe diferente do resto do painel = airbag já acionou.']
    ]
  },
  {
    id: 'motor',
    titulo: 'Motor e fluidos',
    icone: '🔧',
    intro: 'Peça para ligar o carro frio, antes de o vendedor "esquentar" antes de você chegar.',
    itens: [
      ['mo_frio', 'Partida a frio imediata, sem fumaça nem barulho', 'Toque no capô ao chegar: se estiver quente, o carro foi aquecido antes. Fumaça azul (óleo) ou branca contínua (junta do cabeçote) reprovam.'],
      ['mo_oleo', 'Óleo no nível e sem aspecto leitoso', 'Óleo cor de café com leite indica água no motor. Nível baixo indica consumo ou descuido.'],
      ['mo_arrefecimento', 'Reservatório de arrefecimento no nível, sem óleo ou ferrugem', 'Líquido com óleo boiando ou marrom indica problema de junta ou descuido com a manutenção.'],
      ['mo_vazamentos', 'Sem vazamentos no motor, câmbio e embaixo do carro', 'Olhe o chão onde o carro estava parado e a parte de baixo do motor com uma lanterna.'],
      ['mo_correias', 'Correias e mangueiras sem rachaduras', 'Correia ressecada ou mangueira inchada são trocas próximas.'],
      ['mo_bateria', 'Bateria sem zinabre e com data recente', 'Polos esverdeados e carcaça estufada indicam bateria no fim.'],
      ['mo_ruidos', 'Sem ruídos metálicos, batidas ou assobios com o motor ligado', 'Acelere levemente em ponto morto e ouça. Tique-taque forte, chocalho ou assobio pedem mecânico.']
    ]
  },
  {
    id: 'teste',
    titulo: 'Test drive',
    icone: '🛣️',
    intro: 'Dirija por pelo menos 15 minutos, com rádio e ar desligados, em rua e via rápida.',
    itens: [
      ['te_direcao', 'Direção centrada, sem puxar para um lado', 'Em reta plana, solte de leve o volante: o carro deve seguir reto. Volante torto com o carro reto indica alinhamento ou suspensão.'],
      ['te_freios', 'Freio firme, sem trepidação, ruído ou puxar para um lado', 'Freie forte em local seguro. Trepidação no pedal = disco empenado.'],
      ['te_cambio', 'Trocas de marcha suaves, sem trancos, patinação ou demora', 'No automático, teste D, R e as reduções. Tranco no engate ou demora para engatar a ré são caros.'],
      ['te_suspensao', 'Sem batidas secas ou rangidos em lombadas e buracos', 'Passe devagar por uma lombada de lado: barulho de "toc" indica bucha, bieleta ou amortecedor.'],
      ['te_motor', 'Motor responde sem falhas, engasgos ou perda de força', 'Acelere forte em segunda marcha. Falha, fumaça no retrovisor ou luz de injeção acendendo reprovam.'],
      ['te_temperatura', 'Temperatura estável durante todo o teste', 'Observe o ponteiro ou a luz: deve estabilizar no meio e não subir no trânsito parado.'],
      ['te_ar', 'Ar-condicionado gelando parado e em movimento', 'Ligue no máximo por 10 minutos. Deixar de gelar parado indica problema no sistema.'],
      ['te_eletronica', 'Sem luzes de alerta acendendo durante o teste', 'Qualquer luz que acenda em movimento vale um scanner antes de fechar.']
    ]
  }
];

export function checklistBase(): Checklist {
  return {
    versao: CHECKLIST_VERSAO,
    areas: AREAS_BASE.map((area) => ({
      id: area.id,
      titulo: area.titulo,
      icone: area.icone,
      intro: area.intro,
      itens: area.itens.map(([id, texto, dica]) => ({ id, texto, dica, origem: 'base', resposta: null, observacao: '', fotos: [] }))
    })),
    perguntas_ao_vendedor: []
  };
}

export const AREA_IDS = AREAS_BASE.map((a) => a.id);

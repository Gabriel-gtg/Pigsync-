export type StatusLote = 'ativo' | 'encerrado';

export type TipoEvento = 'baixa' | 'contagem';

export type MetodoEvento = 'manual' | 'foto' | 'video' | null;

export interface Galpao {
  id: string;
  numero: number;
  nome: string;
}

export interface Silo {
  id: string;
  galpao_id: string;
  numero: number;
}

export interface Lote {
  id: string;
  silo_id: string;
  quantidade_inicial: number;
  data_entrada: string;
  status: StatusLote;
}

export interface EventoLote {
  id: string;
  lote_id: string;
  silo_id: string;
  tipo: TipoEvento;
  quantidade: number;
  metodo: MetodoEvento;
  confianca: number | null;
  motivo: string | null;
  midia_path: string | null;
  usuario_id: string;
  criado_em: string;
  sincronizado_em: string | null;
}

export interface Perfil {
  id: string;
  nome: string;
  papel: string;
}

export interface SaldoLote {
  lote_id: string;
  silo_id: string;
  quantidade_inicial: number;
  quantidade_atual: number;
  ultima_contagem_em: string | null;
  ultima_contagem_valor: number | null;
}

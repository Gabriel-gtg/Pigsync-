import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ErrorMessage, Loading } from '@/components/screen-state';
import { supabase } from '@/lib/supabase';
import type { EventoLote, Lote, Silo } from '@/types/database';

interface EventoComUsuario extends EventoLote {
  usuarioNome: string;
}

const TIPO_LABEL: Record<EventoLote['tipo'], string> = {
  baixa: 'Baixa',
  contagem: 'Contagem',
};

export default function LoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lote, setLote] = useState<Lote | null>(null);
  const [silo, setSilo] = useState<Silo | null>(null);
  const [saldoAtual, setSaldoAtual] = useState<number | null>(null);
  const [eventos, setEventos] = useState<EventoComUsuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);

    const { data: loteData, error: loteError } = await supabase
      .from('lotes')
      .select('*')
      .eq('id', id)
      .single();

    if (loteError) {
      setError(loteError.message);
      return;
    }
    setLote(loteData as Lote);

    const [
      { data: siloData, error: siloError },
      { data: saldoData, error: saldoError },
      { data: eventosData, error: eventosError },
    ] = await Promise.all([
      supabase.from('silos').select('*').eq('id', (loteData as Lote).silo_id).single(),
      supabase
        .from('saldo_lotes')
        .select('quantidade_atual')
        .eq('lote_id', id)
        .maybeSingle(),
      supabase
        .from('eventos_lote')
        .select('*')
        .eq('lote_id', id)
        .order('criado_em', { ascending: false }),
    ]);

    const firstError = siloError ?? saldoError ?? eventosError;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    setSilo(siloData as Silo);
    setSaldoAtual(saldoData?.quantidade_atual ?? (loteData as Lote).quantidade_inicial);

    const eventosList = (eventosData ?? []) as EventoLote[];
    const usuarioIds = [...new Set(eventosList.map((e) => e.usuario_id))];

    let nomesPorUsuario = new Map<string, string>();
    if (usuarioIds.length > 0) {
      const { data: perfisData } = await supabase
        .from('perfis')
        .select('id, nome')
        .in('id', usuarioIds);
      nomesPorUsuario = new Map((perfisData ?? []).map((p) => [p.id, p.nome]));
    }

    setEventos(
      eventosList.map((evento) => ({
        ...evento,
        usuarioNome: nomesPorUsuario.get(evento.usuario_id) ?? 'Desconhecido',
      }))
    );
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (error) return <ErrorMessage message={error} />;
  if (!lote || !eventos) return <Loading />;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitleBox}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {silo ? `Silo ${silo.numero}` : 'Lote'}
              </Text>
              <Text style={styles.headerSubtitle}>Lote ativo</Text>
            </View>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={styles.list}
        data={eventos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <SummaryStat label="Saldo atual" value={String(saldoAtual ?? '—')} highlight />
                <SummaryStat
                  label="Quantidade inicial"
                  value={String(lote.quantidade_inicial)}
                />
              </View>
              <Text style={styles.summaryDate}>
                Entrada em {new Date(lote.data_entrada).toLocaleDateString('pt-BR')}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.actionBaixa]}
                onPress={() => router.push(`/lote/${id}/baixa`)}
              >
                <Text style={styles.actionButtonText}>Registrar baixa</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.actionContagem]}
                onPress={() => router.push(`/lote/${id}/contagem`)}
              >
                <Text style={styles.actionButtonText}>Registrar contagem</Text>
              </Pressable>
            </View>

            <Text style={styles.historyTitle}>Histórico</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum evento registrado ainda.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.eventRow}>
            <View
              style={[
                styles.eventBadge,
                item.tipo === 'baixa' ? styles.eventBadgeBaixa : styles.eventBadgeContagem,
              ]}
            >
              <Text style={styles.eventBadgeText}>{TIPO_LABEL[item.tipo]}</Text>
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventQuantidade}>
                {item.tipo === 'baixa' ? '-' : ''}
                {item.quantidade}
              </Text>
              {item.motivo ? <Text style={styles.eventMotivo}>{item.motivo}</Text> : null}
              <Text style={styles.eventMeta}>
                {item.usuarioNome} ·{' '}
                {new Date(item.criado_em).toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>
        )}
      />
    </>
  );
}

function SummaryStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#f9fafb',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#bbf7d0',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  summaryValueHighlight: {
    color: '#166534',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  summaryDate: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBaixa: {
    backgroundColor: '#b91c1c',
  },
  actionContagem: {
    backgroundColor: '#1d4ed8',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 24,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  eventBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  eventBadgeBaixa: {
    backgroundColor: '#fee2e2',
  },
  eventBadgeContagem: {
    backgroundColor: '#dbeafe',
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  eventInfo: {
    flex: 1,
  },
  eventQuantidade: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  eventMotivo: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
  },
  eventMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});

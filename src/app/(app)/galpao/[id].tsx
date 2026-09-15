import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ErrorMessage, Loading } from '@/components/screen-state';
import { supabase } from '@/lib/supabase';
import type { Galpao, Lote, SaldoLote, Silo } from '@/types/database';

interface SiloComLote extends Silo {
  lote: (Lote & { saldoAtual: number }) | null;
}

export default function SilosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [galpao, setGalpao] = useState<Galpao | null>(null);
  const [silos, setSilos] = useState<SiloComLote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);

    const { data: galpaoData, error: galpaoError } = await supabase
      .from('galpoes')
      .select('id, numero, nome')
      .eq('id', id)
      .single();

    const { data: silosData, error: silosError } = await supabase
      .from('silos')
      .select('id, galpao_id, numero')
      .eq('galpao_id', id)
      .order('numero');

    const firstError = galpaoError ?? silosError;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    setGalpao(galpaoData as Galpao);

    const siloIds = (silosData ?? []).map((s) => s.id);
    if (siloIds.length === 0) {
      setSilos([]);
      return;
    }

    const [{ data: lotesData, error: lotesError }, { data: saldosData, error: saldosError }] =
      await Promise.all([
        supabase.from('lotes').select('*').in('silo_id', siloIds).eq('status', 'ativo'),
        supabase.from('saldo_lotes').select('*').in('silo_id', siloIds),
      ]);

    const secondError = lotesError ?? saldosError;
    if (secondError) {
      setError(secondError.message);
      return;
    }

    const lotes = (lotesData ?? []) as Lote[];
    const saldos = (saldosData ?? []) as SaldoLote[];
    const saldoPorLote = new Map(saldos.map((s) => [s.lote_id, s.quantidade_atual]));

    const combined = (silosData as Silo[]).map((silo) => {
      const lote = lotes.find((l) => l.silo_id === silo.id) ?? null;
      return {
        ...silo,
        lote: lote ? { ...lote, saldoAtual: saldoPorLote.get(lote.id) ?? 0 } : null,
      };
    });

    setSilos(combined);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <>
      <Stack.Screen options={{ title: galpao ? galpao.nome : 'Silos' }} />
      {error ? (
        <ErrorMessage message={error} />
      ) : !silos ? (
        <Loading />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={silos}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => item.lote && router.push(`/lote/${item.lote.id}`)}
              disabled={!item.lote}
            >
              <View>
                <Text style={styles.cardTitle}>Silo {item.numero}</Text>
                {item.lote ? (
                  <Text style={styles.cardSubtitle}>
                    Entrada em {new Date(item.lote.data_entrada).toLocaleDateString('pt-BR')}
                  </Text>
                ) : (
                  <Text style={styles.cardSubtitle}>Sem lote ativo</Text>
                )}
              </View>
              {item.lote ? (
                <View style={styles.saldoBox}>
                  <Text style={styles.saldoValue}>{item.lote.saldoAtual}</Text>
                  <Text style={styles.saldoLabel}>
                    de {item.lote.quantidade_inicial}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  saldoBox: {
    alignItems: 'flex-end',
  },
  saldoValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#166534',
  },
  saldoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
});

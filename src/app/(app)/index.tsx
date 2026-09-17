import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ErrorMessage, Loading } from '@/components/screen-state';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Galpao, SaldoLote, Silo } from '@/types/database';

interface GalpaoComSaldo extends Galpao {
  saldoTotal: number;
  silosNumeros: number[];
}

function formatarSilos(numeros: number[]): string {
  if (numeros.length === 0) return 'Sem silos';
  const ordenados = [...numeros].sort((a, b) => a - b);
  const min = ordenados[0];
  const max = ordenados[ordenados.length - 1];
  const contiguo = max - min + 1 === ordenados.length;
  if (ordenados.length === 1) return `Silo ${min}`;
  if (contiguo) return `Silos ${min}-${max}`;
  return `Silos ${ordenados.join(', ')}`;
}

export default function GalpoesScreen() {
  const { signOut } = useAuth();
  const [galpoes, setGalpoes] = useState<GalpaoComSaldo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [
      { data: galpoesData, error: galpoesError },
      { data: silosData, error: silosError },
      { data: saldosData, error: saldosError },
    ] = await Promise.all([
      supabase.from('galpoes').select('id, numero, nome').order('numero'),
      supabase.from('silos').select('id, galpao_id, numero').order('numero'),
      supabase.from('saldo_lotes').select('lote_id, silo_id, quantidade_atual'),
    ]);

    const firstError = galpoesError ?? silosError ?? saldosError;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const silos = (silosData ?? []) as Pick<Silo, 'id' | 'galpao_id' | 'numero'>[];
    const saldos = (saldosData ?? []) as Pick<SaldoLote, 'silo_id' | 'quantidade_atual'>[];
    const saldoPorSilo = new Map(saldos.map((s) => [s.silo_id, s.quantidade_atual]));

    const combined = ((galpoesData ?? []) as Galpao[]).map((galpao) => {
      const silosDoGalpao = silos.filter((s) => s.galpao_id === galpao.id);
      const saldoTotal = silosDoGalpao.reduce(
        (sum, s) => sum + (saldoPorSilo.get(s.id) ?? 0),
        0
      );
      return {
        ...galpao,
        saldoTotal,
        silosNumeros: silosDoGalpao.map((s) => s.numero),
      };
    });

    setGalpoes(combined);
  }, []);

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
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.signOutText}>Sair</Text>
            </Pressable>
          ),
        }}
      />
      {error ? (
        <ErrorMessage message={error} />
      ) : !galpoes ? (
        <Loading />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={galpoes}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/galpao/${item.id}`)}
            >
              <View>
                <Text style={styles.cardTitle}>{item.nome}</Text>
                <Text style={styles.cardSubtitle}>{formatarSilos(item.silosNumeros)}</Text>
              </View>
              <View style={styles.saldoBox}>
                <Text style={styles.saldoValue}>{item.saldoTotal}</Text>
                <Text style={styles.saldoLabel}>cab.</Text>
              </View>
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
    gap: 12,
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
  signOutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});

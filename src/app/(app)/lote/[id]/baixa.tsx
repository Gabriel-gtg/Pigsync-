import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Loading } from '@/components/screen-state';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export default function RegistrarBaixaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [siloId, setSiloId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('lotes')
      .select('silo_id')
      .eq('id', id)
      .single()
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setSiloId(data.silo_id);
      });
  }, [id]);

  async function handleSubmit() {
    const quantidadeNumero = Number(quantidade);
    if (!quantidade || !Number.isInteger(quantidadeNumero) || quantidadeNumero <= 0) {
      setError('Informe uma quantidade válida (número inteiro maior que zero).');
      return;
    }
    if (!siloId || !session) {
      setError('Não foi possível carregar os dados do lote. Tente novamente.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from('eventos_lote').insert({
      lote_id: id,
      silo_id: siloId,
      tipo: 'baixa',
      quantidade: quantidadeNumero,
      motivo: motivo.trim() || null,
      usuario_id: session.user.id,
      criado_em: new Date().toISOString(),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.back();
  }

  if (!siloId && !error) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.label}>Quantidade</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 3"
          keyboardType="number-pad"
          value={quantidade}
          onChangeText={setQuantidade}
          editable={!submitting}
        />

        <Text style={styles.label}>Motivo (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ex: morte, transferência, venda…"
          value={motivo}
          onChangeText={setMotivo}
          multiline
          numberOfLines={3}
          editable={!submitting}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Registrando…' : 'Registrar baixa'}
          </Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={submitting}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 20,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#b91c1c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 15,
  },
});

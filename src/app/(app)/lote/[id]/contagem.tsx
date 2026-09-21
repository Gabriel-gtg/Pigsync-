import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Loading } from '@/components/screen-state';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

type Metodo = 'manual' | 'foto';

export default function RegistrarContagemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [siloId, setSiloId] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<Metodo>('manual');
  const [quantidade, setQuantidade] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [confianca, setConfianca] = useState<number | null>(null);

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

  async function analisarFoto(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64) {
      setError('Não foi possível ler a foto. Tente outra.');
      return;
    }
    setError(null);
    setConfianca(null);
    setAnalisando(true);

    const { data, error: fnError } = await supabase.functions.invoke('contar-porcos', {
      body: { imageBase64: asset.base64 },
    });

    setAnalisando(false);

    if (fnError || !data || typeof data.quantidade !== 'number') {
      setError('Não foi possível contar automaticamente. Você pode ajustar o número manualmente.');
      return;
    }

    setQuantidade(String(data.quantidade));
    setConfianca(typeof data.confianca === 'number' ? data.confianca : null);
  }

  async function escolherFoto(origem: 'camera' | 'galeria') {
    const permissao =
      origem === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      setError('Permissão negada. Habilite o acesso à câmera/fotos nas configurações do app.');
      return;
    }

    const resultado =
      origem === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            base64: true,
            quality: 0.6,
          });

    if (resultado.canceled || !resultado.assets[0]) return;

    const asset = resultado.assets[0];
    setFoto(asset);
    setQuantidade('');
    await analisarFoto(asset);
  }

  async function handleSubmit() {
    const quantidadeNumero = Number(quantidade);
    if (!quantidade || !Number.isInteger(quantidadeNumero) || quantidadeNumero < 0) {
      setError('Informe uma quantidade válida (número inteiro maior ou igual a zero).');
      return;
    }
    if (!siloId || !session) {
      setError('Não foi possível carregar os dados do lote. Tente novamente.');
      return;
    }
    if (metodo === 'foto' && !foto) {
      setError('Tire ou escolha uma foto pra contar por IA.');
      return;
    }

    setError(null);
    setSubmitting(true);

    let midiaPath: string | null = null;

    if (metodo === 'foto' && foto?.base64) {
      const caminho = `${id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('contagens')
        .upload(caminho, decode(foto.base64), { contentType: 'image/jpeg' });

      if (uploadError) {
        setSubmitting(false);
        setError(`Falha ao enviar a foto: ${uploadError.message}`);
        return;
      }
      midiaPath = caminho;
    }

    const { error: insertError } = await supabase.from('eventos_lote').insert({
      lote_id: id,
      silo_id: siloId,
      tipo: 'contagem',
      metodo,
      quantidade: quantidadeNumero,
      confianca: metodo === 'foto' ? confianca : null,
      midia_path: midiaPath,
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
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, metodo === 'manual' && styles.tabActive]}
            onPress={() => setMetodo('manual')}
          >
            <Text style={[styles.tabText, metodo === 'manual' && styles.tabTextActive]}>
              Manual
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, metodo === 'foto' && styles.tabActive]}
            onPress={() => setMetodo('foto')}
          >
            <Text style={[styles.tabText, metodo === 'foto' && styles.tabTextActive]}>
              Foto (IA)
            </Text>
          </Pressable>
        </View>

        {metodo === 'foto' ? (
          <>
            {foto ? (
              <Image source={{ uri: foto.uri }} style={styles.preview} resizeMode="cover" />
            ) : null}

            <View style={styles.photoButtonsRow}>
              <Pressable
                style={styles.photoButton}
                onPress={() => escolherFoto('camera')}
                disabled={analisando || submitting}
              >
                <Text style={styles.photoButtonText}>📷 Tirar foto</Text>
              </Pressable>
              <Pressable
                style={styles.photoButton}
                onPress={() => escolherFoto('galeria')}
                disabled={analisando || submitting}
              >
                <Text style={styles.photoButtonText}>🖼️ Galeria</Text>
              </Pressable>
            </View>

            {analisando ? (
              <Text style={styles.analisandoText}>Analisando foto com IA…</Text>
            ) : null}

            {confianca !== null ? (
              <Text style={styles.confiancaText}>
                Confiança da IA: {Math.round(confianca * 100)}%
              </Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>
          {metodo === 'foto' ? 'Quantidade contada (ajuste se precisar)' : 'Quantidade contada'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 245"
          keyboardType="number-pad"
          value={quantidade}
          onChangeText={setQuantidade}
          editable={!submitting}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || analisando}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Registrando…' : 'Registrar contagem'}
          </Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={submitting}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </Pressable>
      </ScrollView>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#111827',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginTop: 8,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  analisandoText: {
    fontSize: 13,
    color: '#1d4ed8',
    textAlign: 'center',
    marginTop: 10,
  },
  confiancaText: {
    fontSize: 13,
    color: '#166534',
    textAlign: 'center',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
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

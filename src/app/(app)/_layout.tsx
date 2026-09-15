import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#166534' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Galpões' }} />
      <Stack.Screen name="galpao/[id]" options={{ title: 'Silos' }} />
      <Stack.Screen name="lote/[id]/index" options={{ title: 'Lote' }} />
      <Stack.Screen
        name="lote/[id]/baixa"
        options={{ title: 'Registrar baixa', presentation: 'modal' }}
      />
      <Stack.Screen
        name="lote/[id]/contagem"
        options={{ title: 'Registrar contagem', presentation: 'modal' }}
      />
    </Stack>
  );
}

import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: { fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#888', textAlign: 'center' },
  action: { marginTop: 24 },
});

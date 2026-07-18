import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export default function ServicePicker({ services, selectedId, onSelect }) {
  const selected = services.find((service) => service.id === selectedId);

  if (services.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hay masajes disponibles todavía.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {services.map((service) => {
          const isSelected = service.id === selectedId;
          return (
            <Pressable
              key={service.id}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => onSelect(service.id)}
            >
              <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                {service.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected && (
        <View style={styles.details}>
          <Text style={styles.detailsName}>{selected.name}</Text>
          {selected.description ? (
            <Text style={styles.detailsDescription}>{selected.description}</Text>
          ) : null}
          <View style={styles.detailsMetaRow}>
            <Text style={styles.detailsMeta}>{selected.durationMinutes} min</Text>
            <Text style={styles.detailsMeta}>·</Text>
            <Text style={styles.detailsMeta}>${selected.price}</Text>
          </View>
          {selected.materials ? (
            <Text style={styles.detailsMaterials}>Se utiliza: {selected.materials}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  row: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowSelected: {
    backgroundColor: colors.accent,
  },
  rowText: {
    fontSize: typography.cardMeta,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowTextSelected: {
    color: colors.surface,
  },
  details: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: spacing.md,
  },
  detailsName: {
    fontSize: typography.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailsDescription: {
    fontSize: typography.cardBody,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  detailsMetaRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  detailsMeta: {
    fontSize: typography.cardMeta,
    fontWeight: '600',
    color: colors.accent,
    marginRight: spacing.xs,
  },
  detailsMaterials: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  empty: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
  },
});
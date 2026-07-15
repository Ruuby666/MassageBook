import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { formatTimeString } from '../utils/dateHelpers';

export default function BlockCard({ block, onDelete }) {
  const timeLabel = block.allDay
    ? 'Todo el día'
    : `${formatTimeString(block.startTime)} – ${formatTimeString(block.endTime)}`;

  return (
    <View style={styles.card}>
      <Ionicons name="lock-closed" size={18} color={colors.textSecondary} style={styles.icon} />
      <View style={styles.details}>
        <Text style={styles.label}>Bloqueado · {timeLabel}</Text>
        {block.reason ? <Text style={styles.reason}>{block.reason}</Text> : null}
      </View>
      <Pressable onPress={() => onDelete(block.id)} hitSlop={10}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEAE4',
    borderRadius: 14,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  icon: {
    marginRight: spacing.sm,
  },
  details: {
    flex: 1,
  },
  label: {
    fontSize: typography.cardBody,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reason: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

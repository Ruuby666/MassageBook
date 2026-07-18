import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { formatTime } from '../utils/dateHelpers';

export default function AppointmentCard({ appointment, onPress }) {
  const { clientName, phone, address, service, durationMinutes, date, notes } = appointment;

  return (
    <Pressable style={styles.card} onPress={() => onPress?.(appointment)}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{formatTime(date)}</Text>
        <View style={styles.durationBadge}>
          <Text style={styles.duration}>{durationMinutes} min</Text>
        </View>
      </View>
      <View style={styles.details}>
        <Text style={styles.clientName}>{clientName}</Text>
        <Text style={styles.service}>{service}</Text>
        <Text style={styles.address}>{address}</Text>
        <Text style={styles.phone}>{phone}</Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  timeColumn: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: spacing.md,
  },
  time: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  durationBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  duration: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  details: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.cardTitle,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  service: {
    fontSize: typography.cardBody,
    color: colors.accent,
    marginTop: 2,
  },
  address: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
    marginTop: 4,
  },
  phone: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notes: {
    fontSize: 12,
    color: '#A8A8A8',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

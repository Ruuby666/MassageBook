import { StyleSheet, Text, View } from 'react-native';
import ModalBackdrop from './ModalBackdrop';
import { colors, spacing, typography } from '../theme';
import { formatFullDate, formatTime } from '../utils/dateHelpers';

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function AppointmentDetailModal({ appointment, onClose }) {
  return (
    <ModalBackdrop visible={Boolean(appointment)} onRequestClose={onClose}>
      <View style={styles.sheet} onStartShouldSetResponder={() => true}>
        {appointment && (
          <>
            <Text style={styles.title}>{appointment.clientName}</Text>
            <Text style={styles.subtitle}>
              {formatFullDate(appointment.date)} · {formatTime(appointment.date)}
            </Text>

            <DetailRow label="Masaje" value={appointment.service} />
            <DetailRow
              label="Duración"
              value={appointment.durationMinutes ? `${appointment.durationMinutes} min` : null}
            />
            <DetailRow
              label="Precio"
              value={typeof appointment.price === 'number' ? `€${appointment.price}` : null}
            />
            <DetailRow label="Teléfono" value={appointment.phone} />
            <DetailRow label="Correo" value={appointment.email} />
            <DetailRow label="Dirección" value={appointment.address} />
            <DetailRow label="Notas" value={appointment.notes} />
          </>
        )}
      </View>
    </ModalBackdrop>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.cardMeta,
    color: colors.accent,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  row: {
    marginBottom: spacing.md,
  },
  rowLabel: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: typography.cardBody,
    color: colors.textPrimary,
    marginTop: 2,
  },
});

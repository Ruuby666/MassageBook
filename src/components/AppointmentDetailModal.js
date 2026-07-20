import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import ModalBackdrop from './ModalBackdrop';
import { colors, spacing, typography } from '../theme';
import {
  dateToTimeString,
  formatFullDate,
  formatTime,
  formatTimeString,
  timeStringToDate,
} from '../utils/dateHelpers';

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function AppointmentDetailModal({ appointment, onClose, onEditTime, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState(null);
  const [activePicker, setActivePicker] = useState(null); // 'date' | 'time' | null
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!appointment) {
      setEditing(false);
      setActivePicker(null);
      return;
    }
    setEditDate(appointment.date);
    setEditTime(dateToTimeString(appointment.date));
  }, [appointment]);

  function startEditing() {
    setEditDate(appointment.date);
    setEditTime(dateToTimeString(appointment.date));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setActivePicker(null);
  }

  function handleDateChange(event, selected) {
    setActivePicker(null);
    if (event.type === 'dismissed' || !selected) return;
    setEditDate(selected);
  }

  function handleTimeChange(event, selected) {
    setActivePicker(null);
    if (event.type === 'dismissed' || !selected) return;
    setEditTime(dateToTimeString(selected));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onEditTime(appointment.id, timeStringToDate(editDate, editTime));
      setEditing(false);
    } catch (error) {
      Alert.alert('No se pudo reprogramar', error.message || 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminar cita',
      `¿Eliminar la cita de ${appointment.clientName}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(appointment.id);
              onClose();
            } catch (error) {
              Alert.alert('No se pudo eliminar', error.message || 'Intenta de nuevo.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ModalBackdrop visible={Boolean(appointment)} onRequestClose={onClose}>
      <View style={styles.sheet} onStartShouldSetResponder={() => true}>
        {appointment && (
          <>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{appointment.clientName}</Text>
                {!editing && (
                  <Text style={styles.subtitle}>
                    {formatFullDate(appointment.date)} · {formatTime(appointment.date)}
                  </Text>
                )}
              </View>
              {!editing && (
                <View style={styles.headerActions}>
                  <Pressable
                    onPress={confirmDelete}
                    hitSlop={12}
                    disabled={deleting}
                    testID="delete-appointment-button"
                  >
                    <Ionicons name="trash-outline" size={26} color={colors.blocked} />
                  </Pressable>
                  <Pressable onPress={startEditing} hitSlop={12} testID="edit-time-button">
                    <Ionicons name="pencil-outline" size={26} color={colors.accent} />
                  </Pressable>
                </View>
              )}
            </View>

            {editing && (
              <View style={styles.editBox}>
                <View style={styles.editFieldsRow}>
                  <Pressable style={styles.editField} onPress={() => setActivePicker('date')}>
                    <Text style={styles.editFieldLabel}>Fecha</Text>
                    <Text style={styles.editFieldValue}>{formatFullDate(editDate)}</Text>
                  </Pressable>
                  <Pressable style={styles.editField} onPress={() => setActivePicker('time')}>
                    <Text style={styles.editFieldLabel}>Hora</Text>
                    <Text style={styles.editFieldValue}>{formatTimeString(editTime)}</Text>
                  </Pressable>
                </View>

                {activePicker === 'date' && (
                  <DateTimePicker mode="date" value={editDate} onChange={handleDateChange} />
                )}
                {activePicker === 'time' && (
                  <DateTimePicker
                    mode="time"
                    value={timeStringToDate(new Date(), editTime)}
                    is24Hour={false}
                    onChange={handleTimeChange}
                  />
                )}

                <View style={styles.editActions}>
                  <Pressable
                    style={[styles.button, styles.cancelButton]}
                    onPress={cancelEditing}
                    disabled={saving}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.confirmButton, saving && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.confirmButtonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  },
  editBox: {
    marginBottom: spacing.lg,
  },
  editFieldsRow: {
    flexDirection: 'row',
  },
  editField: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  editFieldLabel: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
  },
  editFieldValue: {
    fontSize: typography.cardBody,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    marginLeft: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: colors.surface,
    fontWeight: '600',
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

import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SERVICE_DURATIONS } from '../constants/services';
import { colors, spacing, typography } from '../theme';
import {
  dateToTimeString,
  formatFullDate,
  formatTimeString,
  rangesOverlap,
  timeStringToDate,
} from '../utils/dateHelpers';

const DEFAULT_TIME = '09:00';
const DEFAULT_DURATION = 60;

export default function AppointmentModal({ visible, date, existingAppointments = [], onClose, onConfirm }) {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [service, setService] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [startTime, setStartTime] = useState(DEFAULT_TIME);
  const [notes, setNotes] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  function reset() {
    setClientName('');
    setPhone('');
    setAddress('');
    setService('');
    setDuration(DEFAULT_DURATION);
    setStartTime(DEFAULT_TIME);
    setNotes('');
    setShowPicker(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleConfirm() {
    if (!clientName.trim() || !address.trim()) {
      Alert.alert('Faltan datos', 'El nombre del cliente y la dirección son obligatorios.');
      return;
    }

    const newStart = timeStringToDate(date, startTime);
    const newEnd = new Date(newStart.getTime() + duration * 60000);
    const overlaps = existingAppointments.some((appointment) => {
      const apptStart = new Date(appointment.date);
      const apptEnd = new Date(apptStart.getTime() + appointment.durationMinutes * 60000);
      return rangesOverlap(newStart, newEnd, apptStart, apptEnd);
    });
    if (overlaps) {
      Alert.alert(
        'Horario ocupado',
        'Ya existe una cita que se cruza con este horario. Elige otra hora.'
      );
      return;
    }

    onConfirm({
      clientName: clientName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      service: service.trim() || 'Masaje',
      durationMinutes: duration,
      startTime,
      notes: notes.trim(),
    });
    reset();
  }

  function handleTimeChange(event, selected) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setStartTime(dateToTimeString(selected));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Nueva cita · {date ? formatFullDate(date) : ''}</Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre del cliente"
            placeholderTextColor={colors.textSecondary}
            value={clientName}
            onChangeText={setClientName}
          />
          <TextInput
            style={styles.input}
            placeholder="Teléfono"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Dirección"
            placeholderTextColor={colors.textSecondary}
            value={address}
            onChangeText={setAddress}
          />
          <TextInput
            style={styles.input}
            placeholder="Servicio (ej. Masaje relajante)"
            placeholderTextColor={colors.textSecondary}
            value={service}
            onChangeText={setService}
          />

          <Text style={styles.label}>Duración</Text>
          <View style={styles.durationRow}>
            {SERVICE_DURATIONS.map((minutes) => (
              <Pressable
                key={minutes}
                style={[styles.durationChip, duration === minutes && styles.durationChipSelected]}
                onPress={() => setDuration(minutes)}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    duration === minutes && styles.durationChipTextSelected,
                  ]}
                >
                  {minutes} min
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Hora</Text>
          <Pressable style={styles.timeField} onPress={() => setShowPicker(true)}>
            <Text style={styles.timeFieldValue}>{formatTimeString(startTime)}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              mode="time"
              value={timeStringToDate(new Date(), startTime)}
              is24Hour={false}
              onChange={handleTimeChange}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Notas (opcional)"
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Guardar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  sheetContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: typography.cardBody,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  durationRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  durationChip: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  durationChipSelected: {
    backgroundColor: colors.accent,
  },
  durationChipText: {
    fontSize: typography.cardMeta,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  durationChipTextSelected: {
    color: colors.surface,
  },
  timeField: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  timeFieldValue: {
    fontSize: typography.cardBody,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
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
  confirmButtonText: {
    color: colors.surface,
    fontWeight: '600',
  },
});

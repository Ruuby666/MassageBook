import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ModalBackdrop from './ModalBackdrop';
import ServicePicker from './ServicePicker';
import { colors, spacing, typography } from '../theme';
import {
  dateToTimeString,
  formatFullDate,
  formatTimeString,
  rangesOverlap,
  timeStringToDate,
} from '../utils/dateHelpers';

const DEFAULT_TIME = '09:00';

export default function AppointmentModal({
  visible,
  date,
  services = [],
  existingAppointments = [],
  onClose,
  onConfirm,
}) {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [serviceId, setServiceId] = useState(null);
  const [startTime, setStartTime] = useState(DEFAULT_TIME);
  const [notes, setNotes] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setClientName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setServiceId(null);
    setStartTime(DEFAULT_TIME);
    setNotes('');
    setShowPicker(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (!clientName.trim() || !address.trim()) {
      Alert.alert('Faltan datos', 'El nombre del cliente y la dirección son obligatorios.');
      return;
    }

    const selectedService = services.find((service) => service.id === serviceId);
    if (!selectedService) {
      Alert.alert('Falta el masaje', 'Elige qué masaje le vas a hacer.');
      return;
    }

    const newStart = timeStringToDate(date, startTime);
    const newEnd = new Date(newStart.getTime() + selectedService.durationMinutes * 60000);
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

    setSaving(true);
    try {
      await onConfirm({
        clientName: clientName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        serviceId,
        startTime,
        notes: notes.trim(),
      });
      reset();
    } catch (error) {
      Alert.alert('No se pudo guardar', error.message || 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function handleTimeChange(event, selected) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setStartTime(dateToTimeString(selected));
  }

  return (
    <ModalBackdrop visible={visible} onRequestClose={handleClose}>
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        onStartShouldSetResponder={() => true}
      >
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
            placeholder="Correo (opcional, para el recordatorio)"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Dirección"
            placeholderTextColor={colors.textSecondary}
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Masaje</Text>
          <ServicePicker services={services} selectedId={serviceId} onSelect={setServiceId} />

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
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirmButton, saving && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={saving}
            >
              <Text style={styles.confirmButtonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
            </Pressable>
          </View>
      </ScrollView>
    </ModalBackdrop>
  );
}

const styles = StyleSheet.create({
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
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: colors.surface,
    fontWeight: '600',
  },
});
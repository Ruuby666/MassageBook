import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { dateToTimeString, formatFullDate, formatTimeString, timeStringToDate } from '../utils/dateHelpers';

const DEFAULT_START = '09:00';
const DEFAULT_END = '10:00';

export default function BlockModal({ visible, date, onClose, onConfirm }) {
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  const [reason, setReason] = useState('');
  const [pickerTarget, setPickerTarget] = useState(null);

  function reset() {
    setAllDay(true);
    setStartTime(DEFAULT_START);
    setEndTime(DEFAULT_END);
    setReason('');
    setPickerTarget(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleConfirm() {
    if (!allDay && startTime >= endTime) {
      Alert.alert('Horario inválido', 'La hora de inicio debe ser antes que la hora de fin.');
      return;
    }
    onConfirm({
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      reason: reason.trim(),
    });
    reset();
  }

  function handleTimeChange(event, selected) {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (event.type === 'dismissed' || !selected) return;
    const value = dateToTimeString(selected);
    if (pickerTarget === 'start') setStartTime(value);
    else setEndTime(value);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Bloquear · {date ? formatFullDate(date) : ''}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Todo el día</Text>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.accent }} />
          </View>

          {!allDay && (
            <View style={styles.timeRow}>
              <Pressable style={styles.timeField} onPress={() => setPickerTarget('start')}>
                <Text style={styles.timeFieldLabel}>Desde</Text>
                <Text style={styles.timeFieldValue}>{formatTimeString(startTime)}</Text>
              </Pressable>
              <Pressable style={styles.timeField} onPress={() => setPickerTarget('end')}>
                <Text style={styles.timeFieldLabel}>Hasta</Text>
                <Text style={styles.timeFieldValue}>{formatTimeString(endTime)}</Text>
              </Pressable>
            </View>
          )}

          {pickerTarget && (
            <DateTimePicker
              mode="time"
              value={timeStringToDate(new Date(), pickerTarget === 'start' ? startTime : endTime)}
              is24Hour={false}
              onChange={handleTimeChange}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Motivo (opcional)"
            placeholderTextColor={colors.textSecondary}
            value={reason}
            onChangeText={setReason}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Bloquear</Text>
            </Pressable>
          </View>
        </View>
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowLabel: {
    fontSize: typography.cardBody,
    color: colors.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timeField: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  timeFieldLabel: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
  },
  timeFieldValue: {
    fontSize: typography.cardBody,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: typography.cardBody,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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

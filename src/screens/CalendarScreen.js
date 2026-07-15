import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppointmentCard from '../components/AppointmentCard';
import AppointmentModal from '../components/AppointmentModal';
import BlockCard from '../components/BlockCard';
import BlockModal from '../components/BlockModal';
import DaySelector from '../components/DaySelector';
import FloatingActionButton from '../components/FloatingActionButton';
import { mockAppointments } from '../data/mockAppointments';
import { mockBlocks } from '../data/mockBlocks';
import { colors, spacing, typography } from '../theme';
import {
  buildDayWindow,
  formatMonthYear,
  isSameDay,
  timeStringToDate,
  toDateKey,
  toLocalIsoString,
} from '../utils/dateHelpers';

export default function CalendarScreen() {
  const days = useMemo(() => buildDayWindow(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [appointments, setAppointments] = useState(mockAppointments);
  const [blocks, setBlocks] = useState(mockBlocks);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);

  const daysWithAppointments = useMemo(() => {
    const set = new Set();
    appointments.forEach((appointment) => {
      set.add(new Date(appointment.date).toDateString());
    });
    return set;
  }, [appointments]);

  const blockedDays = useMemo(() => {
    const set = new Set();
    blocks.forEach((block) => {
      set.add(new Date(`${block.date}T00:00:00`).toDateString());
    });
    return set;
  }, [blocks]);

  const fullyBlockedDays = useMemo(() => {
    const set = new Set();
    blocks
      .filter((block) => block.allDay)
      .forEach((block) => set.add(new Date(`${block.date}T00:00:00`).toDateString()));
    return set;
  }, [blocks]);

  const appointmentsForSelectedDay = useMemo(() => {
    return appointments.filter((appointment) => isSameDay(new Date(appointment.date), selectedDate));
  }, [appointments, selectedDate]);

  const itemsForSelectedDay = useMemo(() => {
    const dateKey = toDateKey(selectedDate);

    const dayAppointments = appointmentsForSelectedDay
      .map((appointment) => ({
        type: 'appointment',
        sortKey: new Date(appointment.date).getTime(),
        data: appointment,
      }));

    const dayBlocks = blocks
      .filter((block) => block.date === dateKey)
      .map((block) => ({
        type: 'block',
        sortKey: block.allDay ? -1 : timeStringToDate(selectedDate, block.startTime).getTime(),
        data: block,
      }));

    return [...dayAppointments, ...dayBlocks].sort((a, b) => a.sortKey - b.sortKey);
  }, [selectedDate, appointmentsForSelectedDay, blocks]);

  function handleConfirmBlock(blockData) {
    setBlocks((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, date: toDateKey(selectedDate), ...blockData },
    ]);
    setBlockModalVisible(false);
  }

  function handleDeleteBlock(id) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  }

  function handleConfirmAppointment({ startTime, ...appointmentData }) {
    setAppointments((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        ...appointmentData,
        date: toLocalIsoString(timeStringToDate(selectedDate, startTime)),
      },
    ]);
    setAppointmentModalVisible(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{formatMonthYear(selectedDate)}</Text>
      <DaySelector
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        daysWithAppointments={daysWithAppointments}
        blockedDays={blockedDays}
        fullyBlockedDays={fullyBlockedDays}
      />
      {itemsForSelectedDay.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tienes citas ni bloqueos este día</Text>
        </View>
      ) : (
        <FlatList
          data={itemsForSelectedDay}
          keyExtractor={(item) => item.data.id}
          renderItem={({ item }) =>
            item.type === 'appointment' ? (
              <AppointmentCard appointment={item.data} />
            ) : (
              <BlockCard block={item.data} onDelete={handleDeleteBlock} />
            )
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FloatingActionButton
        icon="add"
        bottomOffset={96}
        onPress={() => setAppointmentModalVisible(true)}
      />
      <FloatingActionButton
        icon="lock-closed"
        bottomOffset={28}
        onPress={() => setBlockModalVisible(true)}
      />

      <AppointmentModal
        visible={appointmentModalVisible}
        date={selectedDate}
        existingAppointments={appointmentsForSelectedDay}
        onClose={() => setAppointmentModalVisible(false)}
        onConfirm={handleConfirmAppointment}
      />

      <BlockModal
        visible={blockModalVisible}
        date={selectedDate}
        onClose={() => setBlockModalVisible(false)}
        onConfirm={handleConfirmBlock}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    fontSize: typography.header,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 128,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});

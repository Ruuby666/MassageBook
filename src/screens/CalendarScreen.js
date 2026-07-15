import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppointmentCard from '../components/AppointmentCard';
import BlockCard from '../components/BlockCard';
import BlockModal from '../components/BlockModal';
import DaySelector from '../components/DaySelector';
import FloatingActionButton from '../components/FloatingActionButton';
import { mockAppointments } from '../data/mockAppointments';
import { mockBlocks } from '../data/mockBlocks';
import { colors, spacing, typography } from '../theme';
import { buildDayWindow, formatMonthYear, isSameDay, timeStringToDate, toDateKey } from '../utils/dateHelpers';

export default function CalendarScreen() {
  const days = useMemo(() => buildDayWindow(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [blocks, setBlocks] = useState(mockBlocks);
  const [modalVisible, setModalVisible] = useState(false);

  const daysWithAppointments = useMemo(() => {
    const set = new Set();
    mockAppointments.forEach((appointment) => {
      set.add(new Date(appointment.date).toDateString());
    });
    return set;
  }, []);

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

  const itemsForSelectedDay = useMemo(() => {
    const dateKey = toDateKey(selectedDate);

    const dayAppointments = mockAppointments
      .filter((appointment) => isSameDay(new Date(appointment.date), selectedDate))
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
  }, [selectedDate, blocks]);

  function handleConfirmBlock(blockData) {
    setBlocks((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, date: toDateKey(selectedDate), ...blockData },
    ]);
    setModalVisible(false);
  }

  function handleDeleteBlock(id) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
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

      <FloatingActionButton onPress={() => setModalVisible(true)} />

      <BlockModal
        visible={modalVisible}
        date={selectedDate}
        onClose={() => setModalVisible(false)}
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
    paddingBottom: spacing.xl + 64,
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

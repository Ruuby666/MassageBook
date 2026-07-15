import { useMemo, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import AppointmentCard from '../components/AppointmentCard';
import DaySelector from '../components/DaySelector';
import { mockAppointments } from '../data/mockAppointments';
import { colors, spacing, typography } from '../theme';
import { buildDayWindow, formatMonthYear, isSameDay } from '../utils/dateHelpers';

export default function CalendarScreen() {
  const days = useMemo(() => buildDayWindow(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(days[0]);

  const daysWithAppointments = useMemo(() => {
    const set = new Set();
    mockAppointments.forEach((appointment) => {
      set.add(new Date(appointment.date).toDateString());
    });
    return set;
  }, []);

  const appointmentsForSelectedDay = useMemo(() => {
    return mockAppointments
      .filter((appointment) => isSameDay(new Date(appointment.date), selectedDate))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{formatMonthYear(selectedDate)}</Text>
      <DaySelector
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        daysWithAppointments={daysWithAppointments}
      />
      {appointmentsForSelectedDay.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tienes citas este día</Text>
        </View>
      ) : (
        <FlatList
          data={appointmentsForSelectedDay}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AppointmentCard appointment={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    paddingBottom: spacing.xl,
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
